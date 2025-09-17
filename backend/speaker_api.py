# REST API endpoints for speaker management
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import numpy as np
import soundfile as sf
import io
import logging
from datetime import datetime

# Import dependencies
from speaker_database import get_db, db_manager
from speaker_models import Speaker, SpeakerUtterance, SpeakerSession, SessionMetadata
from speaker_enhanced_asr import get_speaker_enhanced_asr
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# Create router
speaker_router = APIRouter(prefix="/api/speakers", tags=["Speaker Management"])

# Pydantic models for request/response
class SpeakerEnrollmentResponse(BaseModel):
    success: bool
    message: str
    speaker_id: Optional[int] = None
    speaker_name: Optional[str] = None
    display_name: Optional[str] = None

class SpeakerInfo(BaseModel):
    id: int
    name: str
    display_name: Optional[str]
    email: Optional[str]
    is_active: bool
    created_at: str
    total_sessions: int
    total_utterances: int

class SessionInfo(BaseModel):
    session_id: str
    title: Optional[str]
    start_time: str
    end_time: Optional[str]
    total_speakers: int
    total_duration: float
    total_utterances: int

class UtteranceInfo(BaseModel):
    id: int
    text: str
    speaker_name: str
    speaker_id: Optional[int]
    start_time: float
    end_time: float
    confidence: float
    is_manual_assignment: bool
    created_at: str

class UpdateSpeakerRequest(BaseModel):
    utterance_id: int
    new_speaker_name: str

class StartSessionRequest(BaseModel):
    session_id: str
    title: Optional[str] = None


@speaker_router.post("/enroll", response_model=SpeakerEnrollmentResponse)
async def enroll_speaker(
    audio_file: UploadFile = File(...),
    speaker_name: str = Form(...),
    display_name: Optional[str] = Form(None),
    email: Optional[str] = Form(None)
):
    """
    Enroll a new speaker using their greeting/introduction audio
    """
    try:
        # Validate file type
        if not audio_file.content_type.startswith('audio/'):
            raise HTTPException(status_code=400, detail="File must be an audio file")
        
        # Read audio data
        audio_content = await audio_file.read()
        
        # Convert to numpy array using soundfile
        try:
            audio_data, sample_rate = sf.read(io.BytesIO(audio_content))
            
            # Ensure mono audio
            if len(audio_data.shape) > 1:
                audio_data = np.mean(audio_data, axis=1)
            
            # Resample to 16kHz if needed
            if sample_rate != 16000:
                import librosa
                audio_data = librosa.resample(audio_data, orig_sr=sample_rate, target_sr=16000)
                
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid audio file: {str(e)}")
        
        # Get ASR processor
        asr_processor = get_speaker_enhanced_asr()
        
        # Enroll speaker
        result = await asr_processor.enroll_speaker(
            audio_data, speaker_name, display_name, email
        )
        
        if result["success"]:
            return SpeakerEnrollmentResponse(**result)
        else:
            raise HTTPException(status_code=400, detail=result["message"])
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error enrolling speaker: {e}")
        raise HTTPException(status_code=500, detail=f"Enrollment failed: {str(e)}")


@speaker_router.get("/list", response_model=List[SpeakerInfo])
async def list_speakers(db: Session = Depends(get_db)):
    """Get list of all enrolled speakers"""
    try:
        speakers = db.query(Speaker).filter(Speaker.is_active == True).all()
        
        result = []
        for speaker in speakers:
            # Count sessions and utterances
            session_count = db.query(SpeakerSession).filter(
                SpeakerSession.speaker_id == speaker.id
            ).count()
            
            utterance_count = db.query(SpeakerUtterance).filter(
                SpeakerUtterance.speaker_id == speaker.id
            ).count()
            
            speaker_info = SpeakerInfo(
                id=speaker.id,
                name=speaker.name,
                display_name=speaker.display_name,
                email=speaker.email,
                is_active=speaker.is_active,
                created_at=speaker.created_at.isoformat() if speaker.created_at else "",
                total_sessions=session_count,
                total_utterances=utterance_count
            )
            result.append(speaker_info)
        
        return result
        
    except Exception as e:
        logger.error(f"Error listing speakers: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list speakers: {str(e)}")


@speaker_router.delete("/delete/{speaker_id}")
async def delete_speaker(speaker_id: int, db: Session = Depends(get_db)):
    """Deactivate a speaker (soft delete)"""
    try:
        speaker = db.query(Speaker).filter(Speaker.id == speaker_id).first()
        if not speaker:
            raise HTTPException(status_code=404, detail="Speaker not found")
        
        speaker.is_active = False
        db.commit()
        
        return {"success": True, "message": f"Speaker {speaker.name} deactivated"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting speaker {speaker_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete speaker: {str(e)}")


@speaker_router.post("/session/start")
async def start_session(request: StartSessionRequest):
    """Start a new meeting session"""
    try:
        asr_processor = get_speaker_enhanced_asr()
        result = await asr_processor.start_session(request.session_id, request.title)
        
        if result["success"]:
            return result
        else:
            raise HTTPException(status_code=400, detail=result["message"])
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting session: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to start session: {str(e)}")


@speaker_router.post("/session/end")
async def end_session():
    """End the current session"""
    try:
        asr_processor = get_speaker_enhanced_asr()
        result = await asr_processor.end_session()
        
        if result["success"]:
            return result
        else:
            raise HTTPException(status_code=400, detail=result["message"])
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error ending session: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to end session: {str(e)}")


@speaker_router.get("/sessions", response_model=List[SessionInfo])
async def list_sessions(db: Session = Depends(get_db)):
    """Get list of all sessions"""
    try:
        sessions = db.query(SessionMetadata).order_by(SessionMetadata.created_at.desc()).all()
        
        result = []
        for session in sessions:
            session_info = SessionInfo(
                session_id=session.session_id,
                title=session.title,
                start_time=session.start_time.isoformat() if session.start_time else "",
                end_time=session.end_time.isoformat() if session.end_time else None,
                total_speakers=session.total_speakers or 0,
                total_duration=session.total_duration or 0.0,
                total_utterances=session.total_utterances or 0
            )
            result.append(session_info)
        
        return result
        
    except Exception as e:
        logger.error(f"Error listing sessions: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list sessions: {str(e)}")


@speaker_router.get("/session/{session_id}/transcript")
async def get_session_transcript(session_id: str):
    """Get complete transcript for a session"""
    try:
        asr_processor = get_speaker_enhanced_asr()
        result = await asr_processor.get_session_transcript(session_id)
        
        if result["success"]:
            return result
        else:
            raise HTTPException(status_code=404, detail=result["message"])
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting session transcript: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get transcript: {str(e)}")


@speaker_router.get("/session/{session_id}/speakers")
async def get_session_speakers(session_id: str):
    """Get all speakers for a specific session"""
    try:
        asr_processor = get_speaker_enhanced_asr()
        
        if asr_processor.speaker_system:
            speakers = asr_processor.speaker_system.get_session_speakers(session_id)
            return {"success": True, "speakers": speakers}
        else:
            raise HTTPException(status_code=400, detail="Speaker recognition is disabled")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting session speakers: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get session speakers: {str(e)}")


@speaker_router.put("/utterance/update-speaker")
async def update_utterance_speaker(request: UpdateSpeakerRequest):
    """Update speaker assignment for a specific utterance"""
    try:
        asr_processor = get_speaker_enhanced_asr()
        result = await asr_processor.update_speaker_assignment(
            request.utterance_id, request.new_speaker_name
        )
        
        if result["success"]:
            return result
        else:
            raise HTTPException(status_code=400, detail=result["message"])
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating speaker assignment: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update speaker: {str(e)}")


@speaker_router.get("/utterances/{session_id}", response_model=List[UtteranceInfo])
async def get_session_utterances(session_id: str, db: Session = Depends(get_db)):
    """Get all utterances for a session with detailed information"""
    try:
        utterances = db.query(SpeakerUtterance).filter(
            SpeakerUtterance.session_id == session_id
        ).order_by(SpeakerUtterance.start_time).all()
        
        result = []
        for utterance in utterances:
            speaker_name = "Unknown"
            if utterance.speaker:
                speaker_name = utterance.speaker.display_name or utterance.speaker.name
            elif utterance.auto_speaker_name:
                speaker_name = utterance.auto_speaker_name
            
            utterance_info = UtteranceInfo(
                id=utterance.id,
                text=utterance.text,
                speaker_name=speaker_name,
                speaker_id=utterance.speaker_id,
                start_time=utterance.start_time,
                end_time=utterance.end_time,
                confidence=utterance.confidence,
                is_manual_assignment=utterance.is_manual_assignment,
                created_at=utterance.created_at.isoformat() if utterance.created_at else ""
            )
            result.append(utterance_info)
        
        return result
        
    except Exception as e:
        logger.error(f"Error getting session utterances: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get utterances: {str(e)}")


@speaker_router.get("/statistics")
async def get_system_statistics():
    """Get system-wide speaker recognition statistics"""
    try:
        asr_processor = get_speaker_enhanced_asr()
        stats = asr_processor.get_system_statistics()
        
        # Add database statistics
        db_stats = db_manager.get_database_stats()
        stats["database_stats"] = db_stats
        
        return {"success": True, "statistics": stats}
        
    except Exception as e:
        logger.error(f"Error getting system statistics: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get statistics: {str(e)}")


@speaker_router.post("/process-audio")
async def process_audio_with_speakers(
    audio_file: UploadFile = File(...),
    session_id: Optional[str] = Form(None)
):
    """
    Process audio with both transcription and speaker diarization
    This is the main endpoint for real-time audio processing
    """
    try:
        # Validate file type
        if not audio_file.content_type.startswith('audio/'):
            raise HTTPException(status_code=400, detail="File must be an audio file")
        
        # Read audio data
        audio_content = await audio_file.read()
        
        # Convert to numpy array
        try:
            audio_data, sample_rate = sf.read(io.BytesIO(audio_content))
            
            # Ensure mono audio
            if len(audio_data.shape) > 1:
                audio_data = np.mean(audio_data, axis=1)
            
            # Resample if needed
            if sample_rate != 16000:
                import librosa
                audio_data = librosa.resample(audio_data, orig_sr=sample_rate, target_sr=16000)
                sample_rate = 16000
                
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid audio file: {str(e)}")
        
        # Get ASR processor
        asr_processor = get_speaker_enhanced_asr()
        
        # Start session if provided and not already started
        if session_id and asr_processor.current_session_id != session_id:
            session_result = await asr_processor.start_session(session_id)
            if not session_result["success"]:
                raise HTTPException(status_code=400, detail=session_result["message"])
        
        # Process audio with speakers
        result = await asr_processor.process_audio_with_speakers(audio_data, sample_rate)
        
        if result["success"]:
            return result
        else:
            raise HTTPException(status_code=400, detail=result["message"])
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing audio: {e}")
        raise HTTPException(status_code=500, detail=f"Audio processing failed: {str(e)}")


@speaker_router.get("/health")
async def health_check():
    """Health check endpoint for speaker recognition system"""
    try:
        asr_processor = get_speaker_enhanced_asr()
        
        # Check if models are loaded
        models_status = {
            "asr_model_loaded": hasattr(asr_processor.asr_processor, 'model') and asr_processor.asr_processor.model is not None,
            "speaker_system_enabled": asr_processor.enable_speaker_recognition,
            "current_session": asr_processor.current_session_id
        }
        
        if asr_processor.speaker_system:
            models_status.update({
                "diarization_pipeline_loaded": asr_processor.speaker_system.diarization_pipeline is not None,
                "embedding_model_loaded": asr_processor.speaker_system.embedding_model is not None,
                "device": str(asr_processor.speaker_system.device)
            })
        
        # Check database connection
        from speaker_database import check_database_health
        db_healthy = check_database_health()
        
        return {
            "success": True,
            "status": "healthy",
            "models": models_status,
            "database_healthy": db_healthy,
            "timestamp": f"{datetime.now().isoformat()}"
        }
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "success": False,
            "status": "unhealthy",
            "error": str(e),
            "timestamp": f"{datetime.now().isoformat()}"
        }
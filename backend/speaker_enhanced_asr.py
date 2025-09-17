# Speaker-Enhanced ASR Processor
# Integrates speaker diarization and recognition with transcription

import numpy as np
import logging
import asyncio
import threading
from typing import Dict, List, Optional, Any, Tuple
from pathlib import Path
import json
import time
from datetime import datetime

# Import existing ASR processor
from enhanced_asr_processor import EnhancedASRProcessor, AudioSegment

# Import speaker recognition system
from speaker_recognition import SpeakerRecognitionSystem, SpeakerDiarizationConfig
from speaker_database import db_manager
from speaker_models import SpeakerUtterance, SpeakerSession, SessionMetadata

logger = logging.getLogger(__name__)


class SpeakerEnhancedASRProcessor:
    """
    Enhanced ASR Processor with integrated speaker diarization and recognition
    Combines transcription with speaker identification for meeting analysis
    """
    
    def __init__(self, 
                 asr_model_size: str = "large-v2",
                 device: str = "cuda",
                 compute_type: str = "int8",
                 enable_speaker_recognition: bool = True):
        
        # Initialize base ASR processor
        self.asr_processor = EnhancedASRProcessor(
            model_size=asr_model_size,
            device=device,
            compute_type=compute_type
        )
        
        # Initialize speaker recognition system
        self.enable_speaker_recognition = enable_speaker_recognition
        if enable_speaker_recognition:
            self.speaker_system = SpeakerRecognitionSystem()
        else:
            self.speaker_system = None
        
        # Session management
        self.current_session_id = None
        self.session_utterance_count = 0
        self.session_start_time = None
        
        # Processing configuration
        self.processing_config = {
            "enable_realtime_diarization": True,
            "buffer_duration": 5.0,  # Buffer for speaker diarization
            "min_utterance_duration": 0.5,
            "max_utterance_gap": 2.0,  # Max gap between utterances from same speaker
            "confidence_threshold": 0.7
        }
        
        # Utterance buffer for speaker processing
        self.utterance_buffer = []
        self.buffer_lock = threading.Lock()
        
        # Statistics
        self.stats = {
            "total_utterances": 0,
            "speaker_identified": 0,
            "auto_assigned_speakers": 0,
            "enrollment_requests": 0,
            "session_count": 0
        }
        
        logger.info("Speaker-Enhanced ASR Processor initialized")
        logger.info(f"Speaker Recognition: {'enabled' if enable_speaker_recognition else 'disabled'}")
    
    async def start_session(self, session_id: str, title: str = None) -> Dict[str, Any]:
        """Start a new meeting session with speaker tracking"""
        try:
            self.current_session_id = session_id
            self.session_utterance_count = 0
            self.session_start_time = datetime.now()
            self.utterance_buffer.clear()
            
            # Start speaker recognition session
            if self.speaker_system:
                success = self.speaker_system.start_session(session_id, title)
                if not success:
                    logger.error(f"Failed to start speaker recognition session: {session_id}")
            
            # Initialize session in database
            db_session = db_manager.get_session()
            try:
                session_metadata = SessionMetadata(
                    session_id=session_id,
                    title=title or f"Meeting Session {session_id}",
                    start_time=self.session_start_time
                )
                db_session.add(session_metadata)
                db_session.commit()
            finally:
                db_manager.close_session(db_session)
            
            self.stats["session_count"] += 1
            
            logger.info(f"Session started: {session_id}")
            return {
                "success": True,
                "session_id": session_id,
                "message": "Session started successfully",
                "speaker_recognition_enabled": self.enable_speaker_recognition
            }
            
        except Exception as e:
            logger.error(f"Error starting session {session_id}: {e}")
            return {
                "success": False,
                "message": f"Failed to start session: {str(e)}"
            }
    
    async def enroll_speaker(self, audio_data: np.ndarray, speaker_name: str,
                           display_name: str = None, email: str = None) -> Dict[str, Any]:
        """Enroll a speaker using their greeting/introduction audio"""
        if not self.speaker_system:
            return {
                "success": False,
                "message": "Speaker recognition is disabled"
            }
        
        try:
            result = self.speaker_system.enroll_speaker(
                audio_data, speaker_name, display_name, email
            )
            
            if result["success"]:
                self.stats["enrollment_requests"] += 1
                logger.info(f"Speaker enrolled: {speaker_name}")
            
            return result
            
        except Exception as e:
            logger.error(f"Error enrolling speaker {speaker_name}: {e}")
            return {
                "success": False,
                "message": f"Enrollment failed: {str(e)}"
            }
    
    async def process_audio_with_speakers(self, audio_data: np.ndarray, 
                                        sample_rate: int = 16000) -> Dict[str, Any]:
        """
        Process audio with both transcription and speaker diarization
        Returns enhanced transcript with speaker identification
        """
        try:
            if not self.current_session_id:
                return {
                    "success": False,
                    "message": "No active session. Please start a session first."
                }
            
            start_time = time.time()
            
            # Step 1: Perform ASR transcription
            logger.debug("Processing audio with ASR...")
            asr_result = await self._process_asr(audio_data, sample_rate)
            
            if not asr_result["success"]:
                return asr_result
            
            transcript_segments = asr_result.get("segments", [])
            
            # Step 2: Perform speaker diarization if enabled
            speaker_segments = []
            if self.enable_speaker_recognition and self.speaker_system:
                logger.debug("Performing speaker diarization...")
                speaker_segments = self.speaker_system.diarize_and_identify_speakers(
                    audio_data, self.current_session_id
                )
            
            # Step 3: Combine transcription with speaker identification
            enhanced_transcript = []
            if speaker_segments:
                enhanced_transcript = self.speaker_system.process_transcript_with_speakers(
                    speaker_segments, transcript_segments
                )
            else:
                # No speaker diarization - use transcript as-is with unknown speaker
                enhanced_transcript = [
                    {
                        **segment,
                        "speaker_name": "Unknown",
                        "speaker_id": None,
                        "confidence": 0.0,
                        "is_auto_assigned": True
                    }
                    for segment in transcript_segments
                ]
            
            # Step 4: Store utterances in database
            await self._store_utterances(enhanced_transcript)
            
            processing_time = time.time() - start_time
            
            # Update statistics
            self.stats["total_utterances"] += len(enhanced_transcript)
            speaker_identified_count = sum(1 for seg in enhanced_transcript 
                                         if seg.get("speaker_id") is not None)
            auto_assigned_count = len(enhanced_transcript) - speaker_identified_count
            
            self.stats["speaker_identified"] += speaker_identified_count
            self.stats["auto_assigned_speakers"] += auto_assigned_count
            
            result = {
                "success": True,
                "transcript": enhanced_transcript,
                "processing_time": processing_time,
                "session_id": self.current_session_id,
                "speaker_segments": len(speaker_segments),
                "total_segments": len(enhanced_transcript),
                "statistics": {
                    "speaker_identified": speaker_identified_count,
                    "auto_assigned": auto_assigned_count,
                    "total_utterances": len(enhanced_transcript)
                }
            }
            
            logger.info(f"Audio processed: {len(enhanced_transcript)} segments, "
                       f"{speaker_identified_count} identified, "
                       f"{auto_assigned_count} auto-assigned")
            
            return result
            
        except Exception as e:
            logger.error(f"Error processing audio with speakers: {e}")
            return {
                "success": False,
                "message": f"Processing failed: {str(e)}"
            }
    
    async def _process_asr(self, audio_data: np.ndarray, sample_rate: int) -> Dict[str, Any]:
        """Process audio with ASR transcription"""
        try:
            # Create audio segment
            audio_segment = AudioSegment(
                data=audio_data,
                sample_rate=sample_rate,
                timestamp=time.time(),
                duration=len(audio_data) / sample_rate
            )
            
            # Process with enhanced ASR
            result = await self.asr_processor.process_audio_segment(audio_segment)
            
            return result
            
        except Exception as e:
            logger.error(f"ASR processing error: {e}")
            return {
                "success": False,
                "message": f"ASR processing failed: {str(e)}"
            }
    
    async def _store_utterances(self, transcript_segments: List[Dict]) -> None:
        """Store utterances in database with speaker information"""
        try:
            if not transcript_segments:
                return
            
            db_session = db_manager.get_session()
            try:
                for i, segment in enumerate(transcript_segments):
                    utterance = SpeakerUtterance(
                        session_id=self.current_session_id,
                        speaker_id=segment.get("speaker_id"),
                        text=segment.get("text", ""),
                        start_time=segment.get("start_time", 0.0),
                        end_time=segment.get("end_time", 0.0),
                        confidence=segment.get("confidence", 0.0),
                        auto_speaker_name=segment.get("speaker_name") if not segment.get("speaker_id") else None,
                        is_manual_assignment=False
                    )
                    db_session.add(utterance)
                    self.session_utterance_count += 1
                
                db_session.commit()
                logger.debug(f"Stored {len(transcript_segments)} utterances in database")
                
            finally:
                db_manager.close_session(db_session)
                
        except Exception as e:
            logger.error(f"Error storing utterances: {e}")
    
    async def update_speaker_assignment(self, utterance_id: int, 
                                      new_speaker_name: str) -> Dict[str, Any]:
        """Update speaker assignment for a specific utterance"""
        try:
            if not self.speaker_system:
                return {
                    "success": False,
                    "message": "Speaker recognition is disabled"
                }
            
            success = self.speaker_system.update_speaker_name(utterance_id, new_speaker_name)
            
            if success:
                return {
                    "success": True,
                    "message": f"Speaker updated to {new_speaker_name}",
                    "utterance_id": utterance_id
                }
            else:
                return {
                    "success": False,
                    "message": "Failed to update speaker assignment"
                }
                
        except Exception as e:
            logger.error(f"Error updating speaker assignment: {e}")
            return {
                "success": False,
                "message": f"Update failed: {str(e)}"
            }
    
    async def get_session_transcript(self, session_id: str = None) -> Dict[str, Any]:
        """Get complete transcript for a session with speaker information"""
        try:
            session_id = session_id or self.current_session_id
            if not session_id:
                return {
                    "success": False,
                    "message": "No session specified"
                }
            
            db_session = db_manager.get_session()
            try:
                # Get all utterances for the session
                utterances = db_session.query(SpeakerUtterance).filter(
                    SpeakerUtterance.session_id == session_id
                ).order_by(SpeakerUtterance.start_time).all()
                
                # Format transcript
                transcript = []
                for utterance in utterances:
                    speaker_name = "Unknown"
                    if utterance.speaker:
                        speaker_name = utterance.speaker.display_name or utterance.speaker.name
                    elif utterance.auto_speaker_name:
                        speaker_name = utterance.auto_speaker_name
                    
                    transcript.append({
                        "id": utterance.id,
                        "text": utterance.text,
                        "speaker_name": speaker_name,
                        "speaker_id": utterance.speaker_id,
                        "start_time": utterance.start_time,
                        "end_time": utterance.end_time,
                        "confidence": utterance.confidence,
                        "is_manual_assignment": utterance.is_manual_assignment,
                        "created_at": utterance.created_at.isoformat() if utterance.created_at else None
                    })
                
                # Get session statistics
                session_speakers = []
                if self.speaker_system:
                    session_speakers = self.speaker_system.get_session_speakers(session_id)
                
                return {
                    "success": True,
                    "session_id": session_id,
                    "transcript": transcript,
                    "total_utterances": len(transcript),
                    "speakers": session_speakers,
                    "session_statistics": self._calculate_session_stats(transcript)
                }
                
            finally:
                db_manager.close_session(db_session)
                
        except Exception as e:
            logger.error(f"Error getting session transcript: {e}")
            return {
                "success": False,
                "message": f"Failed to get transcript: {str(e)}"
            }
    
    def _calculate_session_stats(self, transcript: List[Dict]) -> Dict[str, Any]:
        """Calculate session statistics from transcript"""
        if not transcript:
            return {}
        
        # Group by speaker
        speakers = {}
        total_duration = 0
        
        for utterance in transcript:
            speaker_name = utterance["speaker_name"]
            duration = utterance["end_time"] - utterance["start_time"]
            total_duration += duration
            
            if speaker_name not in speakers:
                speakers[speaker_name] = {
                    "utterance_count": 0,
                    "total_duration": 0,
                    "average_confidence": 0
                }
            
            speakers[speaker_name]["utterance_count"] += 1
            speakers[speaker_name]["total_duration"] += duration
            
            # Update average confidence
            old_avg = speakers[speaker_name]["average_confidence"]
            count = speakers[speaker_name]["utterance_count"]
            new_confidence = utterance.get("confidence", 0)
            speakers[speaker_name]["average_confidence"] = (old_avg * (count - 1) + new_confidence) / count
        
        # Calculate percentages
        for speaker_data in speakers.values():
            if total_duration > 0:
                speaker_data["speaking_percentage"] = (speaker_data["total_duration"] / total_duration) * 100
            else:
                speaker_data["speaking_percentage"] = 0
        
        return {
            "total_speakers": len(speakers),
            "total_duration": total_duration,
            "speaker_breakdown": speakers,
            "session_start": transcript[0]["created_at"] if transcript else None,
            "session_end": transcript[-1]["created_at"] if transcript else None
        }
    
    async def end_session(self) -> Dict[str, Any]:
        """End the current session and generate summary"""
        try:
            if not self.current_session_id:
                return {
                    "success": False,
                    "message": "No active session"
                }
            
            session_id = self.current_session_id
            
            # Get session transcript and statistics
            session_data = await self.get_session_transcript(session_id)
            
            # Update session metadata
            db_session = db_manager.get_session()
            try:
                session_metadata = db_session.query(SessionMetadata).filter(
                    SessionMetadata.session_id == session_id
                ).first()
                
                if session_metadata:
                    session_metadata.end_time = datetime.now()
                    if session_data["success"]:
                        stats = session_data.get("session_statistics", {})
                        session_metadata.total_speakers = stats.get("total_speakers", 0)
                        session_metadata.total_duration = stats.get("total_duration", 0.0)
                        session_metadata.total_utterances = session_data.get("total_utterances", 0)
                    
                    db_session.commit()
                
            finally:
                db_manager.close_session(db_session)
            
            # Clear current session
            self.current_session_id = None
            self.session_utterance_count = 0
            self.session_start_time = None
            
            logger.info(f"Session ended: {session_id}")
            
            return {
                "success": True,
                "session_id": session_id,
                "message": "Session ended successfully",
                "final_statistics": session_data.get("session_statistics", {}),
                "total_utterances": session_data.get("total_utterances", 0)
            }
            
        except Exception as e:
            logger.error(f"Error ending session: {e}")
            return {
                "success": False,
                "message": f"Failed to end session: {str(e)}"
            }
    
    def get_system_statistics(self) -> Dict[str, Any]:
        """Get system-wide statistics"""
        return {
            "system_stats": self.stats.copy(),
            "asr_stats": getattr(self.asr_processor, 'stats', {}),
            "current_session": self.current_session_id,
            "session_utterances": self.session_utterance_count,
            "speaker_recognition_enabled": self.enable_speaker_recognition
        }


# Global instance for the application
speaker_enhanced_asr = None

def initialize_speaker_enhanced_asr(**kwargs):
    """Initialize the global speaker-enhanced ASR processor"""
    global speaker_enhanced_asr
    speaker_enhanced_asr = SpeakerEnhancedASRProcessor(**kwargs)
    return speaker_enhanced_asr

def get_speaker_enhanced_asr():
    """Get the global speaker-enhanced ASR processor instance"""
    global speaker_enhanced_asr
    if speaker_enhanced_asr is None:
        speaker_enhanced_asr = SpeakerEnhancedASRProcessor()
    return speaker_enhanced_asr
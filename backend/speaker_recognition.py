# Speaker Diarization and Recognition System using pyannote.audio
import os
import io
import numpy as np
import torch
import librosa
import pickle
import hashlib
import tempfile
from typing import List, Dict, Tuple, Optional, Union
from pathlib import Path
import logging
from datetime import datetime, timedelta
import json

# pyannote.audio imports
from pyannote.audio import Pipeline, Model
from pyannote.core import Segment, Annotation
import torchaudio

# SpeechBrain for embeddings
import speechbrain as sb
from speechbrain.pretrained import EncoderClassifier

# scikit-learn for clustering and similarity
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.cluster import DBSCAN
import hdbscan

# Database imports
from speaker_database import db_manager, get_db
from speaker_models import Speaker, SpeakerUtterance, SpeakerSession, SessionMetadata, SpeakerEmbedding
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class SpeakerDiarizationConfig:
    """Configuration for speaker diarization system"""
    
    def __init__(self):
        # Model configurations
        self.diarization_model = "pyannote/speaker-diarization-3.1"
        self.embedding_model = "speechbrain/spkrec-ecapa-voxceleb"
        
        # Diarization parameters
        self.min_speakers = 1
        self.max_speakers = 10
        self.clustering_threshold = 0.7
        
        # Speaker recognition thresholds
        self.enrollment_threshold = 0.8
        self.recognition_threshold = 0.75
        self.verification_threshold = 0.7
        
        # Audio processing
        self.sample_rate = 16000
        self.min_segment_duration = 0.5  # Minimum segment duration in seconds
        self.max_segment_duration = 30.0  # Maximum segment duration in seconds
        
        # Embedding parameters
        self.embedding_dim = 192  # ECAPA-TDNN embedding dimension
        self.max_embeddings_per_speaker = 50  # For averaging
        
        # Session parameters
        self.auto_speaker_prefix = "Speaker"
        self.enrollment_duration_min = 3.0  # Minimum enrollment audio duration
        self.enrollment_duration_max = 10.0  # Maximum enrollment audio duration


class SpeakerRecognitionSystem:
    """Main speaker recognition and diarization system"""
    
    def __init__(self, config: SpeakerDiarizationConfig = None):
        self.config = config or SpeakerDiarizationConfig()
        self.diarization_pipeline = None
        self.embedding_model = None
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        # Initialize models
        self._initialize_models()
        
        # Session management
        self.current_session_id = None
        self.session_speakers = {}  # speaker_id -> speaker_info
        self.auto_speaker_counter = 0
        
        logger.info(f"Speaker Recognition System initialized on device: {self.device}")
    
    def _initialize_models(self):
        """Initialize pyannote and SpeechBrain models"""
        try:
            logger.info("Loading speaker diarization pipeline...")
            self.diarization_pipeline = Pipeline.from_pretrained(
                self.config.diarization_model,
                use_auth_token=os.getenv("HUGGINGFACE_TOKEN")  # Required for pyannote models
            )
            
            if torch.cuda.is_available():
                self.diarization_pipeline.to(self.device)
            
            logger.info("Loading speaker embedding model...")
            self.embedding_model = EncoderClassifier.from_hparams(
                source=self.config.embedding_model,
                savedir=f"pretrained_models/{self.config.embedding_model.replace('/', '_')}",
                run_opts={"device": self.device}
            )
            
            logger.info("Models loaded successfully!")
            
        except Exception as e:
            logger.error(f"Error initializing models: {e}")
            raise
    
    def start_session(self, session_id: str, title: str = None) -> bool:
        """Start a new speaker recognition session"""
        try:
            self.current_session_id = session_id
            self.session_speakers = {}
            self.auto_speaker_counter = 0
            
            # Create session metadata in database
            db_session = db_manager.get_session()
            try:
                session_metadata = SessionMetadata(
                    session_id=session_id,
                    title=title or f"Meeting Session {session_id}",
                    start_time=datetime.now(),
                    diarization_model=self.config.diarization_model,
                    min_speakers=self.config.min_speakers,
                    max_speakers=self.config.max_speakers
                )
                db_session.add(session_metadata)
                db_session.commit()
                
                logger.info(f"Started session: {session_id}")
                return True
                
            finally:
                db_manager.close_session(db_session)
                
        except Exception as e:
            logger.error(f"Error starting session {session_id}: {e}")
            return False
    
    def enroll_speaker(self, audio_data: np.ndarray, speaker_name: str, 
                      display_name: str = None, email: str = None) -> Dict:
        """Enroll a new speaker using their greeting/introduction audio"""
        try:
            # Validate audio length
            duration = len(audio_data) / self.config.sample_rate
            if duration < self.config.enrollment_duration_min:
                return {
                    "success": False,
                    "message": f"Audio too short. Minimum {self.config.enrollment_duration_min}s required."
                }
            
            if duration > self.config.enrollment_duration_max:
                # Trim to maximum duration
                max_samples = int(self.config.enrollment_duration_max * self.config.sample_rate)
                audio_data = audio_data[:max_samples]
            
            # Extract speaker embedding
            embedding = self._extract_embedding(audio_data)
            if embedding is None:
                return {"success": False, "message": "Failed to extract speaker embedding"}
            
            # Check for existing speaker with similar embedding
            existing_speaker = self._find_similar_speaker(embedding)
            if existing_speaker:
                return {
                    "success": False,
                    "message": f"Speaker already enrolled as: {existing_speaker['name']}",
                    "existing_speaker": existing_speaker
                }
            
            # Save audio file
            audio_path = self._save_enrollment_audio(audio_data, speaker_name)
            
            # Create new speaker in database
            db_session = db_manager.get_session()
            try:
                new_speaker = Speaker(
                    name=speaker_name,
                    display_name=display_name or speaker_name,
                    email=email,
                    embedding=pickle.dumps(embedding),
                    embedding_model=self.config.embedding_model,
                    confidence_threshold=self.config.enrollment_threshold,
                    enrollment_audio_path=audio_path
                )
                db_session.add(new_speaker)
                db_session.commit()
                db_session.refresh(new_speaker)
                
                # Add to current session
                if self.current_session_id:
                    session_speaker = SpeakerSession(
                        session_id=self.current_session_id,
                        speaker_id=new_speaker.id,
                        session_speaker_name=display_name or speaker_name,
                        is_enrolled_in_session=True,
                        enrollment_timestamp=datetime.now()
                    )
                    db_session.add(session_speaker)
                    db_session.commit()
                    
                    # Update session speakers cache
                    self.session_speakers[new_speaker.id] = {
                        "name": speaker_name,
                        "display_name": display_name or speaker_name,
                        "embedding": embedding,
                        "id": new_speaker.id
                    }
                
                logger.info(f"Speaker enrolled successfully: {speaker_name} (ID: {new_speaker.id})")
                
                return {
                    "success": True,
                    "message": f"Speaker '{display_name or speaker_name}' enrolled successfully",
                    "speaker_id": new_speaker.id,
                    "speaker_name": speaker_name,
                    "display_name": display_name or speaker_name
                }
                
            finally:
                db_manager.close_session(db_session)
                
        except Exception as e:
            logger.error(f"Error enrolling speaker {speaker_name}: {e}")
            return {"success": False, "message": f"Enrollment failed: {str(e)}"}
    
    def diarize_and_identify_speakers(self, audio_data: np.ndarray, 
                                    session_id: str = None) -> List[Dict]:
        """
        Perform speaker diarization and identify speakers
        Returns list of segments with speaker identification
        """
        try:
            session_id = session_id or self.current_session_id
            if not session_id:
                raise ValueError("No active session. Please start a session first.")
            
            # Create temporary audio file for pyannote
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
                temp_path = temp_file.name
                torchaudio.save(temp_path, torch.FloatTensor(audio_data).unsqueeze(0), 
                              self.config.sample_rate)
            
            try:
                # Perform speaker diarization
                logger.info("Performing speaker diarization...")
                diarization = self.diarization_pipeline(temp_path)
                
                # Process each segment
                segments = []
                for turn, _, speaker_label in diarization.itertracks(yield_label=True):
                    start_time = turn.start
                    end_time = turn.end
                    
                    # Extract audio segment
                    start_sample = int(start_time * self.config.sample_rate)
                    end_sample = int(end_time * self.config.sample_rate)
                    segment_audio = audio_data[start_sample:end_sample]
                    
                    # Skip very short segments
                    if (end_time - start_time) < self.config.min_segment_duration:
                        continue
                    
                    # Extract embedding for this segment
                    segment_embedding = self._extract_embedding(segment_audio)
                    if segment_embedding is None:
                        continue
                    
                    # Identify speaker
                    speaker_info = self._identify_speaker(segment_embedding, session_id)
                    
                    segment_info = {
                        "start_time": start_time,
                        "end_time": end_time,
                        "duration": end_time - start_time,
                        "pyannote_speaker": speaker_label,
                        "identified_speaker": speaker_info["name"],
                        "speaker_id": speaker_info.get("speaker_id"),
                        "confidence": speaker_info["confidence"],
                        "embedding": segment_embedding,
                        "audio_segment": segment_audio
                    }
                    
                    segments.append(segment_info)
                
                logger.info(f"Diarization completed. Found {len(segments)} segments")
                return segments
                
            finally:
                # Clean up temporary file
                os.unlink(temp_path)
                
        except Exception as e:
            logger.error(f"Error in speaker diarization: {e}")
            return []
    
    def process_transcript_with_speakers(self, segments: List[Dict], 
                                       transcript_segments: List[Dict]) -> List[Dict]:
        """
        Combine speaker diarization results with transcript segments
        """
        try:
            enhanced_transcript = []
            
            for trans_seg in transcript_segments:
                trans_start = trans_seg.get("start", 0)
                trans_end = trans_seg.get("end", trans_start + 1)
                trans_text = trans_seg.get("text", "")
                
                # Find overlapping speaker segments
                best_match = None
                best_overlap = 0
                
                for speaker_seg in segments:
                    spk_start = speaker_seg["start_time"]
                    spk_end = speaker_seg["end_time"]
                    
                    # Calculate overlap
                    overlap_start = max(trans_start, spk_start)
                    overlap_end = min(trans_end, spk_end)
                    overlap_duration = max(0, overlap_end - overlap_start)
                    
                    if overlap_duration > best_overlap:
                        best_overlap = overlap_duration
                        best_match = speaker_seg
                
                # Create enhanced transcript segment
                enhanced_seg = {
                    "text": trans_text,
                    "start_time": trans_start,
                    "end_time": trans_end,
                    "speaker_name": "Unknown",
                    "speaker_id": None,
                    "confidence": 0.0,
                    "is_auto_assigned": True
                }
                
                if best_match and best_overlap > 0.1:  # At least 100ms overlap
                    enhanced_seg.update({
                        "speaker_name": best_match["identified_speaker"],
                        "speaker_id": best_match.get("speaker_id"),
                        "confidence": best_match["confidence"],
                        "is_auto_assigned": best_match.get("speaker_id") is None
                    })
                
                enhanced_transcript.append(enhanced_seg)
            
            return enhanced_transcript
            
        except Exception as e:
            logger.error(f"Error processing transcript with speakers: {e}")
            return transcript_segments
    
    def _extract_embedding(self, audio_data: np.ndarray) -> Optional[np.ndarray]:
        """Extract speaker embedding from audio data"""
        try:
            # Ensure correct sample rate
            if len(audio_data) == 0:
                return None
            
            # Convert to torch tensor
            audio_tensor = torch.FloatTensor(audio_data).unsqueeze(0).to(self.device)
            
            # Extract embedding
            with torch.no_grad():
                embeddings = self.embedding_model.encode_batch(audio_tensor)
                embedding = embeddings.squeeze().cpu().numpy()
            
            return embedding
            
        except Exception as e:
            logger.error(f"Error extracting embedding: {e}")
            return None
    
    def _find_similar_speaker(self, embedding: np.ndarray) -> Optional[Dict]:
        """Find existing speaker with similar embedding"""
        try:
            db_session = db_manager.get_session()
            try:
                speakers = db_session.query(Speaker).filter(Speaker.is_active == True).all()
                
                best_similarity = 0
                best_speaker = None
                
                for speaker in speakers:
                    stored_embedding = pickle.loads(speaker.embedding)
                    similarity = cosine_similarity(
                        embedding.reshape(1, -1),
                        stored_embedding.reshape(1, -1)
                    )[0][0]
                    
                    if similarity > best_similarity and similarity > self.config.enrollment_threshold:
                        best_similarity = similarity
                        best_speaker = {
                            "id": speaker.id,
                            "name": speaker.name,
                            "display_name": speaker.display_name,
                            "similarity": similarity
                        }
                
                return best_speaker
                
            finally:
                db_manager.close_session(db_session)
                
        except Exception as e:
            logger.error(f"Error finding similar speaker: {e}")
            return None
    
    def _identify_speaker(self, embedding: np.ndarray, session_id: str) -> Dict:
        """Identify speaker from embedding"""
        try:
            # First check session speakers cache
            best_match = None
            best_similarity = 0
            
            for speaker_id, speaker_info in self.session_speakers.items():
                similarity = cosine_similarity(
                    embedding.reshape(1, -1),
                    speaker_info["embedding"].reshape(1, -1)
                )[0][0]
                
                if similarity > best_similarity and similarity > self.config.recognition_threshold:
                    best_similarity = similarity
                    best_match = speaker_info
            
            if best_match:
                return {
                    "name": best_match["display_name"],
                    "speaker_id": best_match["id"],
                    "confidence": best_similarity
                }
            
            # Check database for all enrolled speakers
            db_session = db_manager.get_session()
            try:
                speakers = db_session.query(Speaker).filter(Speaker.is_active == True).all()
                
                for speaker in speakers:
                    stored_embedding = pickle.loads(speaker.embedding)
                    similarity = cosine_similarity(
                        embedding.reshape(1, -1),
                        stored_embedding.reshape(1, -1)
                    )[0][0]
                    
                    if similarity > best_similarity and similarity > self.config.recognition_threshold:
                        best_similarity = similarity
                        best_match = {
                            "name": speaker.display_name or speaker.name,
                            "speaker_id": speaker.id,
                            "confidence": similarity
                        }
                        
                        # Add to session cache
                        self.session_speakers[speaker.id] = {
                            "name": speaker.name,
                            "display_name": speaker.display_name or speaker.name,
                            "embedding": stored_embedding,
                            "id": speaker.id
                        }
                
                if best_match:
                    return best_match
                
            finally:
                db_manager.close_session(db_session)
            
            # No match found - assign automatic speaker name
            self.auto_speaker_counter += 1
            auto_name = f"{self.config.auto_speaker_prefix}{self.auto_speaker_counter}"
            
            return {
                "name": auto_name,
                "speaker_id": None,
                "confidence": 0.0
            }
            
        except Exception as e:
            logger.error(f"Error identifying speaker: {e}")
            return {
                "name": "Unknown",
                "speaker_id": None,
                "confidence": 0.0
            }
    
    def _save_enrollment_audio(self, audio_data: np.ndarray, speaker_name: str) -> str:
        """Save enrollment audio to file"""
        try:
            # Create enrollment directory
            enrollment_dir = Path("enrollments")
            enrollment_dir.mkdir(exist_ok=True)
            
            # Generate filename
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"{speaker_name}_{timestamp}.wav"
            filepath = enrollment_dir / filename
            
            # Save audio file
            torchaudio.save(str(filepath), torch.FloatTensor(audio_data).unsqueeze(0), 
                          self.config.sample_rate)
            
            return str(filepath)
            
        except Exception as e:
            logger.error(f"Error saving enrollment audio: {e}")
            return ""
    
    def update_speaker_name(self, utterance_id: int, new_speaker_name: str) -> bool:
        """Update speaker name for a specific utterance"""
        try:
            db_session = db_manager.get_session()
            try:
                utterance = db_session.query(SpeakerUtterance).filter(
                    SpeakerUtterance.id == utterance_id
                ).first()
                
                if not utterance:
                    return False
                
                # Check if speaker exists
                speaker = db_session.query(Speaker).filter(
                    Speaker.name == new_speaker_name
                ).first()
                
                if speaker:
                    utterance.speaker_id = speaker.id
                    utterance.auto_speaker_name = None
                else:
                    utterance.auto_speaker_name = new_speaker_name
                    utterance.speaker_id = None
                
                utterance.is_manual_assignment = True
                db_session.commit()
                
                logger.info(f"Updated speaker name for utterance {utterance_id} to {new_speaker_name}")
                return True
                
            finally:
                db_manager.close_session(db_session)
                
        except Exception as e:
            logger.error(f"Error updating speaker name: {e}")
            return False
    
    def get_session_speakers(self, session_id: str) -> List[Dict]:
        """Get all speakers for a session"""
        try:
            db_session = db_manager.get_session()
            try:
                speakers = db_session.query(SpeakerSession).filter(
                    SpeakerSession.session_id == session_id
                ).all()
                
                result = []
                for session_speaker in speakers:
                    speaker_info = {
                        "session_speaker_name": session_speaker.session_speaker_name,
                        "speaker_id": session_speaker.speaker_id,
                        "is_enrolled": session_speaker.is_enrolled_in_session,
                        "total_utterances": session_speaker.total_utterances,
                        "total_speaking_time": session_speaker.total_speaking_time,
                        "average_confidence": session_speaker.average_confidence
                    }
                    
                    if session_speaker.speaker:
                        speaker_info.update({
                            "name": session_speaker.speaker.name,
                            "display_name": session_speaker.speaker.display_name,
                            "email": session_speaker.speaker.email
                        })
                    
                    result.append(speaker_info)
                
                return result
                
            finally:
                db_manager.close_session(db_session)
                
        except Exception as e:
            logger.error(f"Error getting session speakers: {e}")
            return []


# Global instance
speaker_system = SpeakerRecognitionSystem()
# Simplified Speaker Recognition System without HuggingFace dependencies
import os
import io
import numpy as np
import librosa
import pickle
import tempfile
from typing import List, Dict, Tuple, Optional, Union
from pathlib import Path
import logging
from datetime import datetime
import json
import hashlib

# Traditional ML imports
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.cluster import DBSCAN, KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA

# Audio processing
import webrtcvad
import soundfile as sf

# Database imports
try:
    from speaker_database import db_manager, get_db
    from speaker_models import Speaker, SpeakerUtterance, SpeakerSession, SessionMetadata
    DATABASE_AVAILABLE = True
except ImportError:
    DATABASE_AVAILABLE = False

logger = logging.getLogger(__name__)


class SimpleSpeakerConfig:
    """Configuration for simplified speaker recognition"""
    
    def __init__(self):
        # Audio processing
        self.sample_rate = 16000
        self.n_mfcc = 13
        self.n_fft = 2048
        self.hop_length = 512
        self.win_length = 2048
        
        # Feature extraction
        self.feature_dim = 39  # 13 MFCC + 13 delta + 13 delta-delta
        self.min_segment_duration = 0.5
        self.max_segment_duration = 30.0
        
        # Speaker recognition thresholds
        self.enrollment_threshold = 0.75
        self.recognition_threshold = 0.70
        self.clustering_threshold = 0.65
        
        # Session parameters
        self.auto_speaker_prefix = "Speaker"
        self.enrollment_duration_min = 2.0
        self.enrollment_duration_max = 10.0
        self.max_speakers = 10


class SimpleSpeakerRecognition:
    """Simplified speaker recognition using traditional ML approaches"""
    
    def __init__(self, config: SimpleSpeakerConfig = None):
        self.config = config or SimpleSpeakerConfig()
        self.scaler = StandardScaler()
        self.pca = PCA(n_components=20)  # Reduce dimensionality
        
        # Session management
        self.current_session_id = None
        self.session_speakers = {}  # speaker_id -> speaker_info
        self.auto_speaker_counter = 0
        
        # Feature extraction setup
        self.vad = webrtcvad.Vad(2)  # Aggressiveness level 2
        
        logger.info("Simplified Speaker Recognition System initialized")
    
    def start_session(self, session_id: str, title: str = None) -> bool:
        """Start a new speaker recognition session"""
        try:
            self.current_session_id = session_id
            self.session_speakers = {}
            self.auto_speaker_counter = 0
            
            if DATABASE_AVAILABLE:
                # Create session metadata in database
                db_session = db_manager.get_session()
                try:
                    session_metadata = SessionMetadata(
                        session_id=session_id,
                        title=title or f"Meeting Session {session_id}",
                        start_time=datetime.now()
                    )
                    db_session.add(session_metadata)
                    db_session.commit()
                finally:
                    db_manager.close_session(db_session)
            
            logger.info(f"Started session: {session_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error starting session {session_id}: {e}")
            return False
    
    def extract_audio_features(self, audio_data: np.ndarray) -> Optional[np.ndarray]:
        """Extract MFCC features from audio"""
        try:
            # Ensure audio is the right length
            duration = len(audio_data) / self.config.sample_rate
            if duration < self.config.min_segment_duration:
                return None
            
            # Extract MFCC features
            mfcc = librosa.feature.mfcc(
                y=audio_data,
                sr=self.config.sample_rate,
                n_mfcc=self.config.n_mfcc,
                n_fft=self.config.n_fft,
                hop_length=self.config.hop_length,
                win_length=self.config.win_length
            )
            
            # Calculate delta and delta-delta coefficients
            delta_mfcc = librosa.feature.delta(mfcc)
            delta2_mfcc = librosa.feature.delta(mfcc, order=2)
            
            # Combine features
            features = np.concatenate([mfcc, delta_mfcc, delta2_mfcc], axis=0)
            
            # Calculate statistics (mean and std) across time
            feature_mean = np.mean(features, axis=1)
            feature_std = np.std(features, axis=1)
            
            # Combine mean and std for final feature vector
            final_features = np.concatenate([feature_mean, feature_std])
            
            return final_features
            
        except Exception as e:
            logger.error(f"Error extracting audio features: {e}")
            return None
    
    def voice_activity_detection(self, audio_data: np.ndarray) -> List[Tuple[float, float]]:
        """Simple voice activity detection"""
        try:
            # Convert to 16-bit PCM for webrtcvad
            audio_int16 = (audio_data * 32768).astype(np.int16)
            
            # Frame size for VAD (30ms at 16kHz = 480 samples)
            frame_duration = 30  # ms
            frame_size = int(self.config.sample_rate * frame_duration / 1000)
            
            speech_segments = []
            current_segment_start = None
            
            for i in range(0, len(audio_int16) - frame_size, frame_size):
                frame = audio_int16[i:i + frame_size].tobytes()
                
                try:
                    is_speech = self.vad.is_speech(frame, self.config.sample_rate)
                    
                    if is_speech and current_segment_start is None:
                        current_segment_start = i / self.config.sample_rate
                    elif not is_speech and current_segment_start is not None:
                        segment_end = i / self.config.sample_rate
                        if segment_end - current_segment_start >= self.config.min_segment_duration:
                            speech_segments.append((current_segment_start, segment_end))
                        current_segment_start = None
                        
                except Exception:
                    # Skip problematic frames
                    continue
            
            # Handle case where speech goes to end of audio
            if current_segment_start is not None:
                segment_end = len(audio_int16) / self.config.sample_rate
                if segment_end - current_segment_start >= self.config.min_segment_duration:
                    speech_segments.append((current_segment_start, segment_end))
            
            return speech_segments
            
        except Exception as e:
            logger.error(f"VAD error: {e}")
            # Fallback: treat entire audio as speech
            duration = len(audio_data) / self.config.sample_rate
            if duration >= self.config.min_segment_duration:
                return [(0.0, duration)]
            return []
    
    def enroll_speaker(self, audio_data: np.ndarray, speaker_name: str, 
                      display_name: str = None, email: str = None) -> Dict:
        """Enroll a new speaker using traditional feature extraction"""
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
            
            # Extract speaker features
            features = self.extract_audio_features(audio_data)
            if features is None:
                return {"success": False, "message": "Failed to extract speaker features"}
            
            # Check for existing speaker with similar features
            existing_speaker = self._find_similar_speaker(features)
            if existing_speaker:
                return {
                    "success": False,
                    "message": f"Speaker already enrolled as: {existing_speaker['name']}",
                    "existing_speaker": existing_speaker
                }
            
            # Save audio file
            audio_path = self._save_enrollment_audio(audio_data, speaker_name)
            
            if DATABASE_AVAILABLE:
                # Create new speaker in database
                db_session = db_manager.get_session()
                try:
                    new_speaker = Speaker(
                        name=speaker_name,
                        display_name=display_name or speaker_name,
                        email=email,
                        embedding=pickle.dumps(features),
                        embedding_model="mfcc_traditional",
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
                            "features": features,
                            "id": new_speaker.id
                        }
                    
                    speaker_id = new_speaker.id
                finally:
                    db_manager.close_session(db_session)
            else:
                # Store in memory only
                speaker_id = len(self.session_speakers) + 1
                self.session_speakers[speaker_id] = {
                    "name": speaker_name,
                    "display_name": display_name or speaker_name,
                    "features": features,
                    "id": speaker_id
                }
            
            logger.info(f"Speaker enrolled successfully: {speaker_name} (ID: {speaker_id})")
            
            return {
                "success": True,
                "message": f"Speaker '{display_name or speaker_name}' enrolled successfully",
                "speaker_id": speaker_id,
                "speaker_name": speaker_name,
                "display_name": display_name or speaker_name
            }
            
        except Exception as e:
            logger.error(f"Error enrolling speaker {speaker_name}: {e}")
            return {"success": False, "message": f"Enrollment failed: {str(e)}"}
    
    def identify_speakers_in_audio(self, audio_data: np.ndarray) -> List[Dict]:
        """Identify speakers in audio using VAD and clustering"""
        try:
            if not self.current_session_id:
                raise ValueError("No active session. Please start a session first.")
            
            # Perform voice activity detection
            speech_segments = self.voice_activity_detection(audio_data)
            
            if not speech_segments:
                return []
            
            # Extract features for each speech segment
            segments_with_features = []
            for start_time, end_time in speech_segments:
                start_sample = int(start_time * self.config.sample_rate)
                end_sample = int(end_time * self.config.sample_rate)
                segment_audio = audio_data[start_sample:end_sample]
                
                features = self.extract_audio_features(segment_audio)
                if features is not None:
                    segments_with_features.append({
                        "start_time": start_time,
                        "end_time": end_time,
                        "features": features,
                        "audio": segment_audio
                    })
            
            # Identify speaker for each segment
            result_segments = []
            for segment in segments_with_features:
                speaker_info = self._identify_speaker(segment["features"])
                
                result_segments.append({
                    "start_time": segment["start_time"],
                    "end_time": segment["end_time"],
                    "duration": segment["end_time"] - segment["start_time"],
                    "identified_speaker": speaker_info["name"],
                    "speaker_id": speaker_info.get("speaker_id"),
                    "confidence": speaker_info["confidence"],
                    "features": segment["features"],
                    "audio_segment": segment["audio"]
                })
            
            logger.info(f"Speaker identification completed. Found {len(result_segments)} segments")
            return result_segments
            
        except Exception as e:
            logger.error(f"Error in speaker identification: {e}")
            return []
    
    def _find_similar_speaker(self, features: np.ndarray) -> Optional[Dict]:
        """Find existing speaker with similar features"""
        try:
            if DATABASE_AVAILABLE:
                db_session = db_manager.get_session()
                try:
                    speakers = db_session.query(Speaker).filter(Speaker.is_active == True).all()
                    
                    best_similarity = 0
                    best_speaker = None
                    
                    for speaker in speakers:
                        stored_features = pickle.loads(speaker.embedding)
                        similarity = cosine_similarity(
                            features.reshape(1, -1),
                            stored_features.reshape(1, -1)
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
            else:
                # Check in-memory speakers
                best_similarity = 0
                best_speaker = None
                
                for speaker_id, speaker_info in self.session_speakers.items():
                    similarity = cosine_similarity(
                        features.reshape(1, -1),
                        speaker_info["features"].reshape(1, -1)
                    )[0][0]
                    
                    if similarity > best_similarity and similarity > self.config.enrollment_threshold:
                        best_similarity = similarity
                        best_speaker = speaker_info.copy()
                        best_speaker["similarity"] = similarity
                
                return best_speaker
                
        except Exception as e:
            logger.error(f"Error finding similar speaker: {e}")
            return None
    
    def _identify_speaker(self, features: np.ndarray) -> Dict:
        """Identify speaker from features"""
        try:
            # Check session speakers cache first
            best_match = None
            best_similarity = 0
            
            for speaker_id, speaker_info in self.session_speakers.items():
                similarity = cosine_similarity(
                    features.reshape(1, -1),
                    speaker_info["features"].reshape(1, -1)
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
            
            if DATABASE_AVAILABLE:
                # Check database for all enrolled speakers
                db_session = db_manager.get_session()
                try:
                    speakers = db_session.query(Speaker).filter(Speaker.is_active == True).all()
                    
                    for speaker in speakers:
                        stored_features = pickle.loads(speaker.embedding)
                        similarity = cosine_similarity(
                            features.reshape(1, -1),
                            stored_features.reshape(1, -1)
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
                                "features": stored_features,
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
            sf.write(str(filepath), audio_data, self.config.sample_rate)
            
            return str(filepath)
            
        except Exception as e:
            logger.error(f"Error saving enrollment audio: {e}")
            return ""


# Global instance
simple_speaker_system = SimpleSpeakerRecognition()

def get_simple_speaker_system():
    """Get the global simple speaker system instance"""
    return simple_speaker_system
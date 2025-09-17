# Database models for speaker recognition system
from sqlalchemy import Column, Integer, String, LargeBinary, DateTime, Float, Boolean, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import datetime
import json

Base = declarative_base()


class Speaker(Base):
    """Model for storing speaker information and embeddings"""
    __tablename__ = "speakers"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    display_name = Column(String(255), nullable=True)  # User-friendly name
    email = Column(String(255), nullable=True, unique=True, index=True)
    
    # Speaker embedding data
    embedding = Column(LargeBinary, nullable=False)  # Serialized numpy array
    embedding_model = Column(String(100), nullable=False, default="speechbrain/spkrec-ecapa-voxceleb")
    confidence_threshold = Column(Float, nullable=False, default=0.8)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_active = Column(Boolean, default=True)
    enrollment_audio_path = Column(String(500), nullable=True)  # Path to original enrollment audio
    
    # Relationships
    utterances = relationship("SpeakerUtterance", back_populates="speaker")
    sessions = relationship("SpeakerSession", back_populates="speaker")

    def __repr__(self):
        return f"<Speaker(id={self.id}, name='{self.name}', display_name='{self.display_name}')>"


class SpeakerUtterance(Base):
    """Model for storing individual speaker utterances with timestamps"""
    __tablename__ = "speaker_utterances"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(100), nullable=False, index=True)
    speaker_id = Column(Integer, ForeignKey("speakers.id"), nullable=True)  # Null for unknown speakers
    
    # Utterance data
    text = Column(Text, nullable=False)
    start_time = Column(Float, nullable=False)  # Start time in seconds
    end_time = Column(Float, nullable=False)    # End time in seconds
    confidence = Column(Float, nullable=False, default=0.0)  # Speaker recognition confidence
    
    # Auto-assigned speaker for unknown speakers
    auto_speaker_name = Column(String(50), nullable=True)  # Speaker1, Speaker2, etc.
    
    # Audio data
    audio_segment_path = Column(String(500), nullable=True)  # Path to audio segment
    embedding = Column(LargeBinary, nullable=True)  # Utterance embedding for verification
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_manual_assignment = Column(Boolean, default=False)  # True if manually assigned by user
    
    # Relationships
    speaker = relationship("Speaker", back_populates="utterances")

    def __repr__(self):
        speaker_name = self.speaker.name if self.speaker else self.auto_speaker_name
        return f"<SpeakerUtterance(id={self.id}, speaker='{speaker_name}', text='{self.text[:50]}...')>"


class SpeakerSession(Base):
    """Model for tracking speakers in each session"""
    __tablename__ = "speaker_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(100), nullable=False, index=True)
    speaker_id = Column(Integer, ForeignKey("speakers.id"), nullable=True)
    
    # Session-specific speaker data
    session_speaker_name = Column(String(255), nullable=False)  # Name used in this session
    is_enrolled_in_session = Column(Boolean, default=False)  # Did they enroll in this session?
    enrollment_timestamp = Column(DateTime(timezone=True), nullable=True)
    
    # Statistics
    total_utterances = Column(Integer, default=0)
    total_speaking_time = Column(Float, default=0.0)  # Total speaking time in seconds
    average_confidence = Column(Float, default=0.0)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    speaker = relationship("Speaker", back_populates="sessions")

    def __repr__(self):
        return f"<SpeakerSession(session_id='{self.session_id}', speaker='{self.session_speaker_name}')>"


class SessionMetadata(Base):
    """Model for storing session-level metadata"""
    __tablename__ = "session_metadata"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(100), unique=True, nullable=False, index=True)
    
    # Session info
    title = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=True)
    
    # Diarization settings
    diarization_model = Column(String(100), default="pyannote/speaker-diarization-3.1")
    min_speakers = Column(Integer, default=1)
    max_speakers = Column(Integer, default=10)
    
    # Statistics
    total_speakers = Column(Integer, default=0)
    total_duration = Column(Float, default=0.0)
    total_utterances = Column(Integer, default=0)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<SessionMetadata(session_id='{self.session_id}', title='{self.title}')>"


class SpeakerEmbedding(Base):
    """Model for storing multiple embeddings per speaker for improved accuracy"""
    __tablename__ = "speaker_embeddings"
    
    id = Column(Integer, primary_key=True, index=True)
    speaker_id = Column(Integer, ForeignKey("speakers.id"), nullable=False)
    
    # Embedding data
    embedding = Column(LargeBinary, nullable=False)
    embedding_type = Column(String(50), nullable=False)  # 'enrollment', 'verification', 'utterance'
    confidence_score = Column(Float, nullable=False)
    
    # Source information
    source_audio_path = Column(String(500), nullable=True)
    session_id = Column(String(100), nullable=True)
    utterance_id = Column(Integer, ForeignKey("speaker_utterances.id"), nullable=True)
    
    # Quality metrics
    audio_quality_score = Column(Float, nullable=True)
    duration_seconds = Column(Float, nullable=True)
    snr_db = Column(Float, nullable=True)  # Signal-to-noise ratio
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_primary = Column(Boolean, default=False)  # Primary embedding for the speaker

    def __repr__(self):
        return f"<SpeakerEmbedding(id={self.id}, speaker_id={self.speaker_id}, type='{self.embedding_type}')>"
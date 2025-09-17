import os
import json
import logging
import time
from pathlib import Path
from typing import List, Dict, Any, Optional
from faster_whisper import WhisperModel
import torch

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TranscriptionService:
    def __init__(self):
        self.model = None
        self._initialize_model()
        
        # Hallucination prevention - unwanted phrases as specified
        self.UNWANTED_PHRASES = ["subscribe", "bell icon", "channel", "like and share", "thanks for watching"]
    
    def _initialize_model(self):
        """Initialize Faster-Whisper model with optimal settings for RTX 3050 Ti 4GB"""
        try:
            # Use CUDA with float16 precision for RTX 3050 Ti 4GB
            device = "cuda"
            compute_type = "float16"
            
            logger.info(f"Initializing Whisper medium model on {device} with {compute_type} precision")
            
            # Initialize with exact specifications from user requirements
            self.model = WhisperModel("medium", device="cuda", compute_type="float16")
            
            logger.info("Whisper model initialized successfully on GPU")
            
        except Exception as e:
            logger.error(f"Failed to initialize Whisper model on CUDA: {e}")
            # Fallback to CPU if GPU fails
            try:
                logger.info("Falling back to CPU...")
                self.model = WhisperModel("medium", device="cpu", compute_type="int8")
                logger.info("Fallback to CPU model successful")
            except Exception as cpu_error:
                logger.error(f"CPU fallback also failed: {cpu_error}")
                raise
    
    def clean_text(self, text: str) -> str:
        """Remove unwanted phrases that might be hallucinations - exact implementation as specified"""
        words = text.split()
        return " ".join([w for w in words if w.lower() not in self.UNWANTED_PHRASES])
    
    def transcribe_audio(self, audio_path: str, session_id: str) -> List[Dict[str, Any]]:
        """
        Transcribe audio file with optimal settings for accuracy and hallucination prevention
        """
        if not self.model:
            raise RuntimeError("Whisper model not initialized")
        
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")
        
        try:
            logger.info(f"Starting transcription for {audio_path}")
            
            # Transcribe with optimal hyperparameters
            segments, info = self.model.transcribe(
                audio_path,
                
                # Decoding stability
                beam_size=8,                    # wider search → accuracy
                best_of=8,                      # rerank → fewer mistakes
                temperature=0.0,                # deterministic, no random guesses
                patience=1.2,                   # avoids early cut-offs
                
                # Stop Whisper from inventing text
                condition_on_previous_text=False,   # 🔑 prevents hallucinations across chunks
                no_repeat_ngram_size=3,         # stops phrase repetition
                
                # Noise & silence handling
                vad_filter=True,                # voice activity detection
                vad_parameters={"min_silence_duration_ms": 500},
                
                # Chunking for long meetings
                chunk_length=30,                # processes 30s chunks → memory safe
                
                # Word-level control
                word_timestamps=True            # aligns words to audio → helps filtering
            )
            
            logger.info(f"Transcription completed. Language: {info.language}, Duration: {info.duration:.2f}s")
            
            # Process segments and clean text
            transcripts = []
            for segment in segments:
                cleaned_text = self.clean_text(segment.text.strip())
                
                # Only add non-empty segments
                if cleaned_text and len(cleaned_text) > 3:  # Filter very short segments
                    transcript_data = {
                        "timestamp": segment.start,
                        "end_timestamp": segment.end,
                        "text": cleaned_text,
                        "confidence": getattr(segment, 'avg_logprob', 1.0),
                        "session_id": session_id,
                        "words": []
                    }
                    
                    # Add word-level timestamps if available
                    if hasattr(segment, 'words') and segment.words:
                        transcript_data["words"] = [
                            {
                                "word": word.word,
                                "start": word.start,
                                "end": word.end,
                                "probability": word.probability
                            }
                            for word in segment.words
                        ]
                    
                    transcripts.append(transcript_data)
            
            logger.info(f"Generated {len(transcripts)} clean transcript segments")
            return transcripts
            
        except Exception as e:
            logger.error(f"Transcription failed: {e}")
            raise
    
    def transcribe_and_save(self, audio_path: str, session_id: str, output_dir: str) -> str:
        """
        Transcribe audio and save individual transcript files
        """
        transcripts = self.transcribe_audio(audio_path, session_id)
        
        # Ensure output directory exists
        os.makedirs(output_dir, exist_ok=True)
        
        # Save individual transcript files
        saved_files = []
        for i, transcript in enumerate(transcripts):
            filename = f"transcript_{i:06d}.json"
            filepath = os.path.join(output_dir, filename)
            
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(transcript, f, indent=2, ensure_ascii=False)
            
            saved_files.append(filepath)
            logger.info(f"Saved transcript: {filepath}")
        
        # Also save a complete transcript file
        complete_transcript = {
            "session_id": session_id,
            "total_segments": len(transcripts),
            "transcripts": transcripts,
            "created_at": time.time()
        }
        
        complete_filepath = os.path.join(output_dir, "complete_transcript.json")
        with open(complete_filepath, 'w', encoding='utf-8') as f:
            json.dump(complete_transcript, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Saved complete transcript: {complete_filepath}")
        return complete_filepath
    
    def get_readable_transcript(self, transcripts: List[Dict[str, Any]]) -> str:
        """
        Convert transcript data to readable format - exact implementation as specified
        """
        transcript = ""
        for segment_data in transcripts:
            start_time = segment_data.get("timestamp", 0)
            end_time = segment_data.get("end_timestamp", start_time)
            text = segment_data.get("text", "")
            cleaned = self.clean_text(text)
            transcript += f"[{start_time:.2f}s -> {end_time:.2f}s] {cleaned}\n"
        
        return transcript
    
    def transcribe_and_format(self, audio_path: str) -> str:
        """
        Transcribe audio and return formatted transcript - matches user's exact example
        """
        if not self.model:
            raise RuntimeError("Whisper model not initialized")
        
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")
        
        # Transcribe with exact hyperparameters as specified
        segments, info = self.model.transcribe(
            audio_path,
            
            # Decoding stability
            beam_size=8,                   # wider search → accuracy
            best_of=8,                     # rerank → fewer mistakes
            temperature=0.0,               # deterministic, no random guesses
            patience=1.2,                  # avoids early cut-offs

            # Stop Whisper from inventing text
            condition_on_previous_text=False,   # 🔑 prevents hallucinations across chunks
            no_repeat_ngram_size=3,        # stops phrase repetition

            # Noise & silence handling
            vad_filter=True,               # voice activity detection
            vad_parameters={"min_silence_duration_ms": 500},

            # Chunking for long meetings
            chunk_length=30,               # processes 30s chunks → memory safe

            # Word-level control
            word_timestamps=True            # aligns words to audio → helps filtering
        )
        
        # Generate transcript with exact format as specified
        transcript = ""
        for segment in segments:
            cleaned = self.clean_text(segment.text)
            transcript += f"[{segment.start:.2f}s -> {segment.end:.2f}s] {cleaned}\n"
        
        return transcript

# Global instance
transcription_service = TranscriptionService()
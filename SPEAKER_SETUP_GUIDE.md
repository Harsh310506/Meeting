# Speaker Recognition System Setup Guide

## Overview
This guide will help you set up the pyannote.audio speaker diarization system integrated with your Meeting Monitor project.

## Features Implemented
✅ **Real-time Speaker Diarization** - Identify who is speaking when  
✅ **Speaker Enrollment** - Register speakers with their voice samples  
✅ **Persistent Speaker Database** - Speakers remembered across sessions  
✅ **Automatic Speaker Assignment** - Fallback to Speaker1, Speaker2, etc.  
✅ **Manual Speaker Editing** - Update speaker names in transcripts  
✅ **Session Management** - Track speakers per meeting session  
✅ **Enhanced UI** - Speaker-aware frontend components  

## Prerequisites

### 1. Hardware Requirements
- **GPU**: RTX 3050 Ti or better (4GB+ VRAM)
- **RAM**: 8GB+ recommended
- **Storage**: 2GB+ for models

### 2. Software Requirements
- Python 3.8+
- CUDA 11.8+ (for GPU acceleration)
- FFmpeg (for audio processing)
- Node.js 16+ (for frontend)

## Installation Steps

### Step 1: Update Dependencies
```bash
cd backend
pip install -r requirements_consolidated.txt
```

### Step 2: Hugging Face Token Setup
The pyannote.audio models require authentication:

1. Create account at [huggingface.co](https://huggingface.co)
2. Get your token from [Settings > Access Tokens](https://huggingface.co/settings/tokens)
3. Accept the terms for pyannote models:
   - Visit: https://huggingface.co/pyannote/speaker-diarization-3.1
   - Click "Agree and access repository"
   - Visit: https://huggingface.co/pyannote/segmentation-3.0
   - Click "Agree and access repository"

4. Set environment variable:

**Windows (PowerShell):**
```powershell
$env:HUGGINGFACE_TOKEN="your_token_here"
```

**Windows (Command Prompt):**
```cmd
set HUGGINGFACE_TOKEN=your_token_here
```

**Linux/Mac:**
```bash
export HUGGINGFACE_TOKEN="your_token_here"
```

### Step 3: Database Setup
```bash
cd backend
python speaker_database.py
```

### Step 4: Test Installation
```bash
python test_speaker_system.py
```

### Step 5: Start Backend Server
```bash
python main_speaker_enhanced.py
```

### Step 6: Setup Frontend
```bash
cd ../frontend
npm install
npm run dev
```

## Configuration

### Speaker Recognition Settings
Edit `speaker_recognition.py` to adjust:

```python
class SpeakerDiarizationConfig:
    # Model selection
    diarization_model = "pyannote/speaker-diarization-3.1"  # Latest model
    embedding_model = "speechbrain/spkrec-ecapa-voxceleb"   # Speaker embeddings
    
    # Recognition thresholds
    enrollment_threshold = 0.8      # Higher = stricter enrollment
    recognition_threshold = 0.75    # Higher = stricter recognition
    clustering_threshold = 0.7      # Speaker clustering sensitivity
    
    # Audio parameters
    sample_rate = 16000            # Audio sample rate
    min_segment_duration = 0.5     # Minimum speech segment (seconds)
    
    # Session parameters
    max_speakers = 10              # Maximum speakers per session
    enrollment_duration_min = 3.0  # Minimum enrollment audio (seconds)
```

### Database Configuration
Edit `speaker_database.py`:

```python
# SQLite (default, for development)
DATABASE_URL = "sqlite:///./meeting_speakers.db"

# PostgreSQL (for production)
# DATABASE_URL = "postgresql://user:pass@localhost/meeting_db"

# MySQL (alternative)
# DATABASE_URL = "mysql://user:pass@localhost/meeting_db"
```

## Usage Guide

### 1. Starting a Meeting Session
```javascript
// WebSocket message
{
    "type": "start_session",
    "session_id": "meeting_2024_001",
    "title": "Weekly Team Meeting"
}
```

### 2. Enrolling Speakers
```javascript
// Record 3-10 seconds of greeting audio, then:
{
    "type": "enroll_speaker",
    "audio_data": "base64_audio_data",
    "speaker_name": "john_doe",
    "display_name": "John Doe",
    "email": "john@company.com"
}
```

### 3. Real-time Audio Processing
```javascript
// Send audio chunks for transcription + speaker ID
{
    "type": "audio_data",
    "audio_data": "base64_audio_data"
}

// Response includes speaker information
{
    "type": "transcript_with_speakers",
    "transcript": [
        {
            "text": "Good morning everyone",
            "speaker_name": "John Doe",
            "speaker_id": 1,
            "confidence": 0.92,
            "start_time": 0.0,
            "end_time": 2.3
        }
    ]
}
```

### 4. Updating Speaker Names
```javascript
// Manually correct speaker assignment
{
    "type": "update_speaker",
    "utterance_id": 123,
    "new_speaker_name": "Jane Smith"
}
```

## API Endpoints

### Speaker Management
- `POST /api/speakers/enroll` - Enroll new speaker
- `GET /api/speakers/list` - List all speakers
- `DELETE /api/speakers/delete/{speaker_id}` - Delete speaker

### Session Management
- `POST /api/speakers/session/start` - Start session
- `POST /api/speakers/session/end` - End session
- `GET /api/speakers/sessions` - List all sessions

### Transcript Management
- `GET /api/speakers/session/{session_id}/transcript` - Get session transcript
- `PUT /api/speakers/utterance/update-speaker` - Update speaker assignment
- `GET /api/speakers/utterances/{session_id}` - Get utterances

### System Monitoring
- `GET /api/speakers/health` - System health check
- `GET /api/speakers/statistics` - System statistics

## Frontend Integration

### React Component Usage
```jsx
import SpeakerEnhancedApp from './SpeakerEnhancedApp';

function App() {
  return <SpeakerEnhancedApp />;
}
```

### Key Features
- **Speaker Enrollment Panel** - Record greetings for new speakers
- **Live Transcript** - Real-time transcription with speaker labels
- **Speaker Selector** - Manually correct speaker assignments
- **Session Management** - Start/stop meeting sessions
- **Statistics Display** - Speaker participation metrics

## Troubleshooting

### Common Issues

#### 1. Model Loading Errors
```
Error: Could not load pyannote model
```
**Solutions:**
- Verify HUGGINGFACE_TOKEN is set
- Accept model agreements on Hugging Face
- Check internet connection
- Ensure sufficient GPU memory

#### 2. Audio Processing Errors
```
Error: Invalid audio file format
```
**Solutions:**
- Install FFmpeg properly
- Check audio file format (use WAV/MP3)
- Verify sample rate (16kHz recommended)
- Check file size limits

#### 3. Database Connection Issues
```
Error: Database not accessible
```
**Solutions:**
- Run `python speaker_database.py` to initialize
- Check database file permissions
- Verify SQLAlchemy installation

#### 4. WebSocket Connection Issues
```
WebSocket connection failed
```
**Solutions:**
- Check backend server is running on port 8000
- Verify CORS settings
- Test with WebSocket client tools

### Performance Optimization

#### 1. GPU Memory Optimization
For RTX 3050 Ti (4GB VRAM):
```python
# In speaker_recognition.py
config.compute_type = "int8"  # Use quantization
config.max_speakers = 5       # Limit concurrent speakers
```

#### 2. Audio Processing Optimization
```python
# Reduce audio buffer size for real-time processing
config.chunk_length = 10      # Smaller chunks
config.buffer_duration = 3.0  # Shorter buffer
```

#### 3. Database Optimization
```python
# For high-volume usage, use PostgreSQL
DATABASE_URL = "postgresql://user:pass@localhost/meeting_db"
```

## Model Accuracy Tips

### 1. Speaker Enrollment
- **Duration**: 5-10 seconds of clear speech
- **Quality**: Minimize background noise
- **Content**: Natural conversation, not reading
- **Environment**: Consistent with meeting environment

### 2. Recognition Accuracy
- **Microphone**: Use consistent, good-quality microphones
- **Distance**: Keep speakers at similar distances from mic
- **Background**: Minimize noise and echo
- **Overlap**: Avoid speaker overlap for better accuracy

### 3. Fine-tuning Thresholds
```python
# Conservative (fewer false positives)
config.enrollment_threshold = 0.9
config.recognition_threshold = 0.85

# Aggressive (better recall)
config.enrollment_threshold = 0.7
config.recognition_threshold = 0.65
```

## Production Deployment

### 1. Environment Setup
```bash
# Production environment variables
export HUGGINGFACE_TOKEN="your_token"
export DATABASE_URL="postgresql://user:pass@host/db"
export ENVIRONMENT="production"
```

### 2. Server Configuration
```python
# Use production ASGI server
gunicorn main_speaker_enhanced:app -w 4 -k uvicorn.workers.UvicornWorker
```

### 3. Database Migration
```bash
# Setup production database
python -c "from speaker_database import init_database; init_database()"
```

## Support and Resources

### Documentation
- [pyannote.audio docs](https://github.com/pyannote/pyannote-audio)
- [SpeechBrain docs](https://speechbrain.github.io/)
- [FastAPI WebSocket docs](https://fastapi.tiangolo.com/advanced/websockets/)

### Model Performance
- **Diarization**: pyannote/speaker-diarization-3.1 (SOTA)
- **Embeddings**: SpeechBrain ECAPA-TDNN (robust)
- **Expected Accuracy**: 85-95% with good audio quality

### Community
- GitHub Issues for bug reports
- Discussions for feature requests
- Stack Overflow for implementation help

---

## Quick Start Checklist

- [ ] Install dependencies: `pip install -r requirements_consolidated.txt`
- [ ] Set up Hugging Face token: `export HUGGINGFACE_TOKEN="your_token"`
- [ ] Accept pyannote model agreements on Hugging Face
- [ ] Initialize database: `python speaker_database.py`
- [ ] Test system: `python test_speaker_system.py`
- [ ] Start backend: `python main_speaker_enhanced.py`
- [ ] Start frontend: `cd frontend && npm run dev`
- [ ] Open browser: `http://localhost:5173`
- [ ] Test speaker enrollment with greeting audio
- [ ] Start meeting session and test real-time transcription

🎉 **You're ready to use speaker-enhanced meeting monitoring!**
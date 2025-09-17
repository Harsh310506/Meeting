# Meeting Monitor

A real-time AI-powered meeting analysis system that captures audio and video streams from meetings (Google Meet, Zoom, Teams) or direct camera/microphone, processes them with AI models, and provides live insights during meetings.

## 🚀 Features

- **Multiple Capture Modes**: 
  - 📹 Camera + Microphone (direct input)
  - 🖥️ Screen Share + System Audio (capture meetings from other apps)
  - 🔊 System Audio Only (audio-only meeting monitoring)
- **Real-time Meeting Analysis**: Captures from Google Meet, Zoom, Teams, and other meeting platforms
- **Live Audio Streaming**: WebRTC + WebSocket for low-latency audio transmission  
- **Screen Capture**: Monitor meetings running in background applications
- **Modular AI Architecture**: Ready for Whisper, DistilBERT, BART integration
- **Beautiful Dashboard**: React-based UI with live captions and insights panels
- **Multi-Speaker Support**: Handles meeting audio with multiple participants

## 📁 Project Structure

```
DataQuest/
├── frontend/                 # React + Vite frontend
│   ├── src/
│   │   ├── App.jsx          # Main React component with WebRTC
│   │   ├── main.jsx         # React entry point
│   │   └── index.css        # Styling
│   ├── package.json
│   └── vite.config.js
├── backend/                  # FastAPI backend
│   ├── main.py              # FastAPI server with Socket.IO
│   ├── requirements.txt     # Python dependencies
│   └── .env                 # Configuration
└── README.md
```

## 🛠 Setup Instructions

### Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Create and activate virtual environment:**
   ```bash
   python -m venv venv
   venv\Scripts\activate  # Windows
   # or
   source venv/bin/activate  # macOS/Linux
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Start the backend server:**
   ```bash
   python main.py
   ```
   Backend will run on `http://localhost:8000`

### Frontend Setup

1. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```
   Frontend will run on `http://localhost:3000`

## 🎯 Usage

1. **Start both servers** (backend on :8000, frontend on :3000)
2. **Open browser** and navigate to `http://localhost:3000`
3. **Select capture mode**:
   - **Camera + Microphone**: Direct input analysis
   - **Screen Share + System Audio**: Capture meetings from Google Meet, Zoom, Teams
   - **System Audio Only**: Audio-only meeting monitoring
4. **Grant permissions** for camera/microphone/screen when prompted
5. **Click "Start Recording"** to begin streaming
6. **Monitor the dashboard** for real-time captions and AI insights

### 🖥️ Screen Capture Setup (New!)
To monitor meetings from other applications:
1. Select **"Screen Share + System Audio"** mode
2. Click **"Start Screen Capture"**
3. Choose **"Entire Screen"** and check **"Share system audio"** ✅
4. Open your meeting app (Google Meet, Zoom, Teams)
5. Join meeting - AI will analyze all participants and audio!

📖 **See [SCREEN_CAPTURE_GUIDE.md](./SCREEN_CAPTURE_GUIDE.md) for detailed setup instructions**

## 📊 API Endpoints

### REST Endpoints
- `GET /` - API information and status
- `GET /health` - Health check with connection stats  
- `GET /stats` - Detailed statistics about data flow

### WebSocket Events
- `audio_stream` - Receives audio chunks from frontend
- `video_stream` - Receives video frames from frontend
- `audio_received` - Acknowledges audio reception
- `video_received` - Acknowledges video reception

## 🧠 AI Integration Points

The system is designed for easy AI model integration:

### Audio Processing (Whisper)
```python
# In backend/main.py - audio_stream event
transcript = await process_with_whisper(audio_data, sample_rate)
```

### Sentiment Analysis (DistilBERT)
```python
# Process transcribed text
sentiment = await analyze_sentiment(transcript)
```

### Facial Expression Recognition
```python
# Process video frames
emotions = await analyze_facial_expressions(image_data)
```

### Meeting Summarization (BART)
```python
# Generate post-meeting summary
summary = await generate_meeting_summary(full_transcript)
```

## 🔧 Technical Details

### Frontend (React + WebRTC)
- **WebRTC MediaStream API** for camera/microphone access
- **Web Audio API** for real-time audio processing
- **Socket.IO Client** for WebSocket communication
- **Canvas API** for video frame capture
- **Responsive dashboard** with live status indicators

### Backend (FastAPI + Socket.IO)
- **FastAPI** for REST API endpoints
- **Socket.IO** for real-time WebSocket communication
- **Numpy** for audio data processing
- **CORS middleware** for cross-origin requests
- **Modular structure** for AI model integration

### Data Flow
1. **Frontend captures** audio/video using WebRTC
2. **Audio chunks** (4096 samples) sent every ~100ms
3. **Video frames** (JPEG) sent at 10 FPS
4. **Backend receives and acknowledges** all data
5. **Buffers maintain** recent data for processing
6. **AI models** (future) process and return insights

## 🚀 Next Steps

1. **Integrate Whisper** for speech-to-text conversion
2. **Add DistilBERT** for sentiment analysis
3. **Implement facial expression** recognition
4. **Add BART model** for meeting summarization
5. **Enhance dashboard** with real AI insights
6. **Add data persistence** for meeting history

## 🐛 Testing

### Data Flow Verification
- Backend logs show received audio/video data
- Frontend displays connection status
- Browser console shows WebSocket events
- `/stats` endpoint provides real-time metrics

### Browser Requirements
- Modern browser with WebRTC support
- Camera and microphone permissions
- JavaScript enabled

## 📝 Development Notes

- **Audio sampling**: 44.1kHz with 4096-sample chunks
- **Video capture**: 640x480 at 10 FPS, JPEG compressed
- **Buffer limits**: 100 audio chunks, 50 video frames
- **Error handling**: Comprehensive try-catch blocks
- **Logging**: Detailed backend logs for debugging

## 🤝 Contributing

This is a modular system designed for easy extension. Key areas for contribution:
- AI model integration
- UI/UX improvements  
- Performance optimization
- Additional analysis features

## 📄 License

MIT License - Feel free to use and modify for your projects!

# 💾 Recording Storage Documentation

## 📍 **Current Storage Status: NO PERMANENT STORAGE**

Your Meeting Monitor currently operates in **"Privacy-First Mode"** - recordings are **NOT** saved to your computer.

### 🔄 **How Data Currently Flows:**
```
Browser → WebSocket → Backend Memory → AI Processing → Insights
                          ↓
                    Temporary Buffers
                   (Auto-deleted after processing)
```

## 📊 **Where Your Data Currently Lives:**

### 1. **Frontend (Browser)**
- **Location**: Browser memory only
- **Duration**: While page is open
- **Data**: Live audio/video streams
- **Storage**: **❌ None** - streams directly to backend

### 2. **Backend Memory**
- **Location**: Python application memory
- **Duration**: Real-time processing only
- **Data**: Last 100 audio chunks + 50 video frames
- **Storage**: **❌ None** - overwritten continuously

### 3. **Processing Pipeline**
- **Location**: Backend functions
- **Duration**: Milliseconds during processing
- **Data**: AI analysis results
- **Storage**: **❌ None** - results sent as insights

## 🎯 **Current Data Lifecycle:**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Audio/Video   │───▶│  Memory Buffer  │───▶│  AI Processing  │
│   Captured      │    │  (Temporary)    │    │   (Real-time)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       │
                                ▼                       ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Auto-Delete   │    │    Insights     │
                       │  (After 100     │    │   Dashboard     │
                       │   chunks)       │    │   (Live Only)   │
                       └─────────────────┘    └─────────────────┘
```

## 💿 **OPTIONAL: Enable Recording Storage**

If you want to save recordings permanently, I've created an enhanced version:

### 🚀 **To Enable Recording Storage:**

1. **Use the enhanced backend:**
   ```bash
   cd backend
   python main_with_storage.py  # Instead of main.py
   ```

2. **Storage will be created at:**
   ```
   DataQuest/
   └── backend/
       └── recordings/           # ← New recordings folder
           └── session_abc123_20250910_143022/
               ├── audio/        # Audio chunks as JSON files
               ├── video/        # Video frames as JPG files
               ├── metadata/     # Session information
               └── recording_summary.json
   ```

### 📂 **Enhanced Storage Structure:**
```
recordings/
└── session_{client_id}_{timestamp}/
    ├── audio/
    │   ├── audio_chunk_000001.json
    │   ├── audio_chunk_000002.json
    │   └── ...
    ├── video/
    │   ├── frame_000001.jpg
    │   ├── frame_000001_meta.json
    │   ├── frame_000002.jpg
    │   └── ...
    ├── metadata/
    │   └── session_info.json
    └── recording_summary.json
```

### 🔧 **Storage Features:**
- **Automatic session management**: Each recording gets unique folder
- **Structured storage**: Separate folders for audio, video, metadata
- **JSON metadata**: Timestamps, capture modes, client info
- **Image extraction**: Video frames saved as individual JPG files
- **Session summaries**: Complete recording statistics
- **API endpoints**: View and manage recordings via REST API

### 📊 **New API Endpoints:**
- `GET /recordings` - List all saved recordings
- `GET /recordings/{session_id}` - Get specific recording details
- WebSocket events: `start_recording`, `stop_recording`

## 🔒 **Privacy & Security Considerations:**

### 🚫 **Current (No Storage) Mode:**
- ✅ **Maximum Privacy**: No recordings saved
- ✅ **GDPR Compliant**: No personal data retention
- ✅ **Memory Efficient**: Automatic cleanup
- ✅ **Secure**: No files to secure or accidentally share

### 💾 **Optional Storage Mode:**
- ⚠️ **Data Retention**: Recordings saved until manually deleted
- ⚠️ **Disk Space**: Can grow large with long meetings
- ⚠️ **Security**: Need to secure recording files
- ⚠️ **Compliance**: Must follow company data policies

## 🎛 **Control Your Storage:**

### **To Keep Current Behavior (No Storage):**
- ✅ Keep using `python main.py`
- ✅ Data processed in real-time only
- ✅ No files created on your computer

### **To Enable Storage:**
1. Switch to `python main_with_storage.py`
2. Edit `storage.env` to configure settings
3. Recordings will be saved to `backend/recordings/`

### **Storage Configuration:**
```env
# In storage.env
STORAGE_ENABLED=true     # false to disable
RECORDINGS_DIR=recordings
MAX_RECORDING_SIZE_MB=1000
COMPRESS_VIDEO_FRAMES=true
```

## 📈 **Storage Usage Examples:**

### **Meeting Recording Session:**
```
Session Duration: 30 minutes
Audio Chunks: ~1,800 (at 1 chunk/second)
Video Frames: ~1,500 (at 5 FPS for screen capture)
Estimated Size: 50-200 MB (depending on video resolution)
```

### **System Audio Only:**
```
Session Duration: 60 minutes
Audio Chunks: ~3,600
Video Frames: 0
Estimated Size: 10-30 MB (audio metadata only)
```

## 🔍 **Monitoring Storage:**

### **Check Storage Status:**
```bash
curl http://localhost:8000/
# Returns storage_enabled status
```

### **List Recordings:**
```bash
curl http://localhost:8000/recordings
# Returns all saved sessions
```

### **View Recording Details:**
```bash
curl http://localhost:8000/recordings/{session_id}
# Returns detailed session information
```

## 🛠 **Advanced Storage Options:**

### **Future Enhancements Available:**
- **Video file compilation**: Combine frames into MP4
- **Audio file generation**: Export as WAV/MP3
- **Automatic cleanup**: Delete old recordings
- **Cloud storage**: Upload to AWS S3, Google Drive
- **Encryption**: Encrypt recordings at rest
- **Compression**: Reduce file sizes

### **Custom Storage Locations:**
Edit `storage.env` to change where recordings are saved:
```env
RECORDINGS_DIR=/path/to/your/preferred/location
```

## ⚡ **Quick Decision Guide:**

### **Use Current Mode (No Storage) If:**
- ✅ You only need real-time insights
- ✅ Privacy is paramount
- ✅ You don't need to review meetings later
- ✅ Disk space is limited

### **Enable Storage Mode If:**
- ✅ You want to review meetings later
- ✅ You need to analyze meeting patterns
- ✅ You want to train custom AI models
- ✅ Company policy requires meeting records

---

**Current Status**: Your system is running in **Privacy-First Mode** with no permanent storage. To enable recording, switch to `main_with_storage.py`. 🛡️

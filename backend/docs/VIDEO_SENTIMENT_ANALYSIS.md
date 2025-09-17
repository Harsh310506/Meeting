# Video Recording Format & Sentiment Analysis Integration

## 📹 Current Video Recording System

### **Recording Format**
Your system currently records video in the following format:

#### **1. Frame Metadata (JSON)**
Each video frame is stored as a JSON file with metadata:
```json
{
    "timestamp": 1757623145342,
    "width": 640,
    "height": 480, 
    "frame_number": 2,
    "frame_size": 47043
}
```

#### **2. Frame Data Flow**
1. **Frontend Capture**: WebRTC captures video from user's camera
2. **Frame Extraction**: JavaScript canvas extracts frames as JPEG (Base64)
3. **Transmission**: Frames sent via WebSocket as `canvas.toDataURL('image/jpeg', 0.7-0.8)`
4. **Backend Storage**: Currently saves metadata only (actual image data is discarded)

#### **3. Current Limitations**
- ❌ **No actual image storage**: Only metadata is saved
- ❌ **No facial detection**: Raw frames without face analysis
- ❌ **No emotion recognition**: Missing sentiment analysis pipeline
- ❌ **Inefficient format**: Individual JSON files per frame

---

## 🎯 Enhanced Video System for Sentiment Analysis

### **Proposed Architecture**

```
📹 Video Stream → 🔍 Face Detection → 😊 Emotion Analysis → 💾 Storage → 📊 Analytics
```

### **1. Face Detection Integration**

Let me create an enhanced video processor with face detection:

```python
import cv2
import numpy as np
from deepface import DeepFace
import base64
from PIL import Image
import io

class VideoSentimentProcessor:
    def __init__(self):
        self.face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        self.emotion_model_loaded = False
        
    def process_frame(self, base64_frame, timestamp, frame_number):
        try:
            # Decode base64 image
            image_data = base64.b64decode(base64_frame.split(',')[1])
            image = Image.open(io.BytesIO(image_data))
            frame = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
            
            # Detect faces
            faces = self.detect_faces(frame)
            
            # Analyze emotions for each face
            emotions = []
            for face in faces:
                emotion_result = self.analyze_emotion(frame, face)
                emotions.append(emotion_result)
            
            return {
                'timestamp': timestamp,
                'frame_number': frame_number,
                'faces_detected': len(faces),
                'face_coordinates': faces,
                'emotions': emotions,
                'dominant_emotion': self.get_dominant_emotion(emotions)
            }
            
        except Exception as e:
            return {'error': str(e), 'timestamp': timestamp}
    
    def detect_faces(self, frame):
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = self.face_cascade.detectMultiScale(gray, 1.1, 4)
        return [{'x': x, 'y': y, 'width': w, 'height': h} for (x, y, w, h) in faces]
    
    def analyze_emotion(self, frame, face_coords):
        try:
            x, y, w, h = face_coords['x'], face_coords['y'], face_coords['width'], face_coords['height']
            face_roi = frame[y:y+h, x:x+w]
            
            # Use DeepFace for emotion analysis
            result = DeepFace.analyze(face_roi, actions=['emotion'], enforce_detection=False)
            return result[0]['emotion'] if isinstance(result, list) else result['emotion']
            
        except Exception as e:
            return {'error': str(e)}
```

### **2. Updated Backend Integration**

Update the `handle_video_stream` function:

```python
async def handle_video_stream(client_id: str, data: dict):
    \"\"\"Enhanced video stream handler with sentiment analysis.\"\"\"
    try:
        session = find_session_by_client(client_id)
        if not session:
            return
        
        session["video_frames"] += 1
        frame_data = data.get('frame')
        
        if frame_data and storage_enabled:
            # Process frame for sentiment analysis
            sentiment_result = video_sentiment_processor.process_frame(
                frame_data,
                data.get('timestamp'),
                session["video_frames"]
            )
            
            # Save comprehensive frame data
            frame_file = os.path.join(
                session["storage_path"], 
                "video", 
                f"frame_{session['video_frames']:06d}.json"
            )
            
            complete_frame_data = {
                'metadata': {
                    'timestamp': data.get('timestamp'),
                    'width': data.get('width'),
                    'height': data.get('height'),
                    'frame_number': session["video_frames"],
                    'frame_size': len(frame_data)
                },
                'sentiment_analysis': sentiment_result,
                'session_id': session.get('session_id')
            }
            
            with open(frame_file, 'w') as f:
                json.dump(complete_frame_data, f, indent=2)
            
            # Optionally save actual image for training/debugging
            if SAVE_ACTUAL_FRAMES:
                save_frame_image(frame_data, session["storage_path"], session["video_frames"])
                
            # Real-time emotion broadcast
            if sentiment_result.get('emotions'):
                await broadcast_emotion_update(session, sentiment_result)
    
    except Exception as e:
        logger.error(f"Error in video sentiment processing: {e}")
```

### **3. Storage Structure Enhancement**

Enhanced directory structure:
```
recorded_sessions/
└── session_1234567890_client_1/
    ├── audio/
    │   ├── chunk_000001.wav
    │   └── chunk_000002.wav
    ├── video/
    │   ├── frames/
    │   │   ├── frame_000001.json    # Metadata + sentiment
    │   │   ├── frame_000001.jpg     # Optional: actual image
    │   │   └── frame_000002.json
    │   ├── emotion_timeline.json    # Aggregated emotions
    │   └── sentiment_summary.json   # Session summary
    ├── transcripts/
    │   └── transcript_000001.json
    └── analytics/
        ├── emotion_analysis.json
        ├── engagement_metrics.json
        └── sentiment_trends.json
```

### **4. Real-time Emotion Dashboard**

Enhanced frame data format:
```json
{
  "metadata": {
    "timestamp": 1757623145342,
    "width": 640,
    "height": 480,
    "frame_number": 2,
    "frame_size": 47043
  },
  "sentiment_analysis": {
    "faces_detected": 1,
    "face_coordinates": [
      {"x": 120, "y": 80, "width": 200, "height": 200}
    ],
    "emotions": [
      {
        "angry": 0.02,
        "disgust": 0.01,
        "fear": 0.05,
        "happy": 0.75,
        "sad": 0.05,
        "surprise": 0.07,
        "neutral": 0.05
      }
    ],
    "dominant_emotion": "happy",
    "confidence": 0.75
  },
  "session_id": "session_1757623143_client_1"
}
```

---

## 📊 Sentiment Analysis Applications

### **1. Real-time Monitoring**
- **Live emotion detection** during meetings
- **Engagement tracking** - detect attention/distraction
- **Mood analysis** - overall sentiment trends

### **2. Post-Meeting Analytics**
- **Emotion timeline** - how sentiment changed over time
- **Key moments identification** - peaks in positive/negative emotions
- **Participant analysis** - individual vs group sentiment

### **3. Integration with Audio**
- **Multimodal sentiment** - combine facial emotions with speech tone
- **Correlation analysis** - how visual and audio sentiment align
- **Comprehensive insights** - holistic meeting analysis

### **4. Advanced Features**
- **Attention detection** - eye gaze and focus analysis
- **Fatigue monitoring** - detect when participants are tired
- **Engagement scoring** - quantify meeting effectiveness

---

## 🚀 Implementation Steps

### **Phase 1: Basic Enhancement**
1. ✅ Save actual frame images (not just metadata)
2. ✅ Implement face detection using OpenCV
3. ✅ Add basic emotion recognition with DeepFace

### **Phase 2: Advanced Analytics**
1. 🔄 Real-time emotion streaming to frontend
2. 🔄 Emotion timeline generation
3. 🔄 Integration with transcript sentiment

### **Phase 3: AI Integration**
1. 📋 Custom emotion model training
2. 📋 Advanced facial analysis (attention, fatigue)
3. 📋 Multimodal sentiment fusion

---

## 💾 Required Dependencies

Add to requirements.txt:
```
opencv-python>=4.8.0
deepface>=0.0.79
tensorflow>=2.13.0
pillow>=10.0.0
matplotlib>=3.7.0
pandas>=2.0.0
```

---

## 🎯 Current Status

**Your system is ready for enhancement!** 

✅ **Working**: Video capture, WebSocket streaming, metadata storage
🔄 **Next**: Implement face detection and emotion analysis
📋 **Future**: Advanced AI-powered sentiment insights

The foundation is solid - we just need to add the sentiment analysis layer to transform your meeting recorder into a comprehensive emotion intelligence platform.
import React, { useState, useRef, useEffect } from 'react';
import { io } from 'socket.io-client';
import './Beautiful.css';

const BACKEND_URL = 'http://localhost:8000';

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [captions, setCaptions] = useState([]);
  const [insights, setInsights] = useState([]);
  const [captureMode, setCaptureMode] = useState('screen');
  const [recordingStatus, setRecordingStatus] = useState('');
  const [storageEnabled, setStorageEnabled] = useState(false);
  const [dataFlowStatus, setDataFlowStatus] = useState({ audio: 0, video: 0 });
  
  const videoRef = useRef(null);
  const socketRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const videoIntervalRef = useRef(null);
  const isRecordingRef = useRef(false);

  useEffect(() => {
    socketRef.current = io(BACKEND_URL);
    
    socketRef.current.on('connect', () => {
      setIsConnected(true);
      
      fetch(`${BACKEND_URL}/`)
        .then(res => res.json())
        .then(data => {
          setStorageEnabled(data.storage_enabled || false);
        })
        .catch(err => console.log('Could not check storage status:', err));
    });

    socketRef.current.on('disconnect', () => {
      setIsConnected(false);
    });

    socketRef.current.on('recording_started', (data) => {
      setRecordingStatus(`Recording to: ${data.storage_location}`);
    });

    socketRef.current.on('recording_stopped', (data) => {
      setRecordingStatus(`Recording saved! Session: ${data.session_id}`);
      
      if (data.summary) {
        const summary = data.summary.session_summary;
        setTimeout(() => {
          alert(`Recording Saved Successfully!\n\nDuration: ${summary.duration}\nAudio chunks: ${summary.audio_chunks}\nVideo frames: ${summary.video_frames}\nSize: ${summary.files_created.total_size_mb} MB\n\nLocation: ${summary.storage_location}`);
        }, 500);
      }
    });

    socketRef.current.on('recording_error', (data) => {
      setRecordingStatus(`Error: ${data.message}`);
    });

    // Demo data based on capture mode
    if (captureMode === 'screen') {
      setCaptions([
        { id: 1, timestamp: '00:00:15', text: 'Welcome to our quarterly review meeting.', sentiment: 'neutral', source: 'System Audio' },
        { id: 2, timestamp: '00:00:32', text: 'Our Q3 performance shows significant growth.', sentiment: 'positive', source: 'System Audio' },
        { id: 3, timestamp: '00:01:05', text: 'Let\'s discuss the key metrics for this quarter.', sentiment: 'neutral', source: 'System Audio' }
      ]);

      setInsights([
        { id: 1, type: 'meeting-tone', text: 'Professional and focused meeting atmosphere' },
        { id: 2, type: 'engagement', text: 'High participant engagement detected' },
        { id: 3, type: 'topics', text: 'Key topics: Q3 performance, growth metrics, quarterly review' }
      ]);
    } else {
      setCaptions([
        { id: 1, timestamp: '00:00:15', text: 'Welcome everyone to our team meeting.', sentiment: 'neutral', source: 'User' },
        { id: 2, timestamp: '00:00:32', text: 'Let\'s start by discussing our project updates.', sentiment: 'positive', source: 'User' }
      ]);

      setInsights([
        { id: 1, type: 'emotion', text: 'User appears focused and engaged' },
        { id: 2, type: 'sentiment', text: 'Overall positive tone detected in speech' }
      ]);
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [captureMode]);

  const startRecording = async () => {
    try {
      setDataFlowStatus({ audio: 0, video: 0 });
      
      let stream;
      
      if (captureMode === 'screen') {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 10 }
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 44100,
            suppressLocalAudioPlayback: false
          }
        });
      } else if (captureMode === 'system-audio') {
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: false,
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              sampleRate: 44100,
              suppressLocalAudioPlayback: false
            }
          });
        } catch (error) {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true
          });
        }
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user'
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 44100
          }
        });
      }

      streamRef.current = stream;
      if (videoRef.current && stream.getVideoTracks().length > 0) {
        videoRef.current.srcObject = stream;
      }

      if (stream.getAudioTracks().length > 0) {
        setupAudioStreaming(stream);
      }

      if (stream.getVideoTracks().length > 0) {
        setupVideoCapture();
      }

      setIsRecording(true);
      isRecordingRef.current = true;

      if (socketRef.current && storageEnabled) {
        socketRef.current.emit('start_recording', {
          captureMode: captureMode,
          timestamp: Date.now()
        });
      }

    } catch (error) {
      console.error('Recording failed:', error);
      alert(`Recording failed: ${error.message}\n\nPlease make sure to:\n- Click "Allow" for permissions\n- Check "Share system audio" for screen capture`);
    }
  };

  const setupAudioStreaming = (stream) => {
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContextRef.current.createMediaStreamSource(stream);
    
    processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
    
    processorRef.current.onaudioprocess = (event) => {
      if (!isRecordingRef.current || !socketRef.current) return;
      
      const inputBuffer = event.inputBuffer;
      const inputData = inputBuffer.getChannelData(0);
      
      setDataFlowStatus(prev => ({ ...prev, audio: prev.audio + 1 }));
      
      const audioChunk = Array.from(inputData);
      
      socketRef.current.emit('audio_stream', {
        data: audioChunk,
        sampleRate: audioContextRef.current.sampleRate,
        timestamp: Date.now(),
        captureMode: captureMode,
        isSystemAudio: captureMode === 'screen' || captureMode === 'system-audio'
      });
    };

    source.connect(processorRef.current);
    processorRef.current.connect(audioContextRef.current.destination);
  };

  const setupVideoCapture = () => {
    const frameRate = captureMode === 'screen' ? 200 : 100;
    
    const captureFrame = () => {
      if (!isRecordingRef.current || !videoRef.current || !socketRef.current) return;

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (captureMode === 'screen') {
        canvas.width = videoRef.current.videoWidth || 1920;
        canvas.height = videoRef.current.videoHeight || 1080;
      } else {
        canvas.width = videoRef.current.videoWidth || 640;
        canvas.height = videoRef.current.videoHeight || 480;
      }
      
      context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      
      const quality = captureMode === 'screen' ? 0.5 : 0.8;
      const imageData = canvas.toDataURL('image/jpeg', quality);
      
      setDataFlowStatus(prev => ({ ...prev, video: prev.video + 1 }));
      
      socketRef.current.emit('video_stream', {
        data: imageData,
        width: canvas.width,
        height: canvas.height,
        timestamp: Date.now(),
        captureMode: captureMode,
        isScreenCapture: captureMode === 'screen'
      });
    };

    videoIntervalRef.current = setInterval(captureFrame, frameRate);
  };

  const stopRecording = () => {
    setIsRecording(false);
    isRecordingRef.current = false;
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    
    if (videoIntervalRef.current) {
      clearInterval(videoIntervalRef.current);
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    if (socketRef.current && storageEnabled) {
      socketRef.current.emit('stop_recording');
    }
    
    setRecordingStatus('Recording stopped');
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="header-left">
            <h1 className="header-title">Meeting Monitor</h1>
            <p className="header-subtitle">AI-Powered Meeting Analysis</p>
          </div>
          
          <div className="header-right">
            <div className="status-item">
              <div className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></div>
              <span className="status-text">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            
            {storageEnabled && (
              <div className="status-item">
                <div className="status-dot storage-enabled"></div>
                <span className="status-text">Storage Enabled</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="main-container">
        <div className="content-grid">
          
          {/* Left Column - Controls & Video */}
          <div className="left-column">
            
            {/* Recording Controls */}
            <div className="card controls-card">
              <h2 className="card-title">Recording Controls</h2>
              
              <div className="controls-content">
                <div className="form-group">
                  <label className="form-label">Capture Mode</label>
                  <select
                    value={captureMode}
                    onChange={(e) => setCaptureMode(e.target.value)}
                    disabled={isRecording}
                    className="form-select"
                  >
                    <option value="screen">🖥️ Screen + System Audio (for meetings)</option>
                    <option value="camera">📷 Camera + Microphone</option>
                    <option value="system-audio">🔊 System Audio Only</option>
                  </select>
                </div>

                <div className="controls-footer">
                  <div className="data-flow">
                    <div className="data-flow-text">
                      Data Flow: Audio: {dataFlowStatus.audio} | Video: {dataFlowStatus.video}
                    </div>
                    {recordingStatus && (
                      <div className="recording-status">{recordingStatus}</div>
                    )}
                  </div>
                  
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={!isConnected}
                    className={`record-button ${isRecording ? 'recording' : 'ready'} ${!isConnected ? 'disabled' : ''}`}
                  >
                    {isRecording ? '⏹️ Stop Recording' : '🎬 Start Recording'}
                  </button>
                </div>
              </div>
            </div>

            {/* Video Preview */}
            <div className="card video-card">
              <h2 className="card-title">
                {captureMode === 'screen' ? '🖥️ Screen Preview' : 
                 captureMode === 'system-audio' ? '🔊 Audio Only Mode' : '📷 Camera Preview'}
              </h2>
              
              {captureMode !== 'system-audio' ? (
                <div className="video-container">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    className="video-preview"
                  />
                  {!isRecording && (
                    <div className="video-overlay">
                      <div className="video-overlay-content">
                        <div className="video-icon">📹</div>
                        <div className="video-text">Click "Start Recording" to begin</div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="audio-only-preview">
                  <div className="audio-only-content">
                    <div className="audio-icon">🎵</div>
                    <div className="audio-title">Audio Only Mode</div>
                    <div className="audio-subtitle">System audio will be captured</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Live Analysis */}
          <div className="right-column">
            
            {/* Live Captions */}
            <div className="card captions-card">
              <h2 className="card-title">🗣️ Live Captions</h2>
              <div className="captions-list">
                {captions.map((caption) => (
                  <div key={caption.id} className="caption-item">
                    <div className="caption-header">
                      <span className="caption-timestamp">{caption.timestamp}</span>
                      <span className={`caption-sentiment ${caption.sentiment}`}>
                        {caption.sentiment}
                      </span>
                    </div>
                    <p className="caption-text">{caption.text}</p>
                    <div className="caption-source">{caption.source}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Insights */}
            <div className="card insights-card">
              <h2 className="card-title">🤖 AI Insights</h2>
              <div className="insights-list">
                {insights.map((insight) => (
                  <div key={insight.id} className="insight-item">
                    <div className="insight-type">
                      {insight.type.replace('-', ' ').toUpperCase()}
                    </div>
                    <p className="insight-text">{insight.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Session Status */}
            <div className="card status-card">
              <h2 className="card-title">📊 Session Status</h2>
              
              <div className="status-list">
                <div className="status-row">
                  <span className="status-label">Recording Status</span>
                  <span className={`status-badge ${isRecording ? 'recording' : 'inactive'}`}>
                    {isRecording ? '🔴 Recording' : '⭕ Inactive'}
                  </span>
                </div>
                
                <div className="status-row">
                  <span className="status-label">Capture Mode</span>
                  <span className="status-value">
                    {captureMode === 'screen' ? '🖥️ Screen + Audio' :
                     captureMode === 'system-audio' ? '🔊 System Audio' : '📷 Camera + Mic'}
                  </span>
                </div>
                
                <div className="status-row">
                  <span className="status-label">Backend Connection</span>
                  <span className={`status-badge ${isConnected ? 'connected' : 'disconnected'}`}>
                    {isConnected ? '✅ Connected' : '❌ Disconnected'}
                  </span>
                </div>

                {storageEnabled && (
                  <div className="status-row">
                    <span className="status-label">Storage</span>
                    <span className="status-badge enabled">✅ Enabled</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Instructions Footer */}
      <footer className="footer">
        <div className="footer-content">
          <h3 className="footer-title">Quick Start Guide</h3>
          <div className="footer-steps">
            <div className="footer-step">
              <span className="step-number">1</span>
              <span className="step-text">Select your capture mode</span>
            </div>
            <div className="footer-step">
              <span className="step-number">2</span>
              <span className="step-text">Click "Start Recording"</span>
            </div>
            <div className="footer-step">
              <span className="step-number">3</span>
              <span className="step-text">Grant permissions & check "Share system audio"</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;

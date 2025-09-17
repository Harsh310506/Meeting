import React, { useState, useRef, useEffect } from 'react';
import './Beautiful.css';

const BACKEND_URL = 'ws://localhost:8000/ws';

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [captions, setCaptions] = useState([]);
  const [insights, setInsights] = useState([]);
  const [captureMode, setCaptureMode] = useState('screen');
  const [recordingStatus, setRecordingStatus] = useState('');
  const [storageEnabled, setStorageEnabled] = useState(false);
  const [dataFlowStatus, setDataFlowStatus] = useState({ audio: 0, video: 0 });
  const [asrStatus, setAsrStatus] = useState('Initializing...');
  const [transcriptCount, setTranscriptCount] = useState(0);
  
  const videoRef = useRef(null);
  const websocketRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const videoIntervalRef = useRef(null);
  const isRecordingRef = useRef(false);

  useEffect(() => {
    connectWebSocket();
    
    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
    };
  }, []);

  const connectWebSocket = () => {
    try {
      websocketRef.current = new WebSocket(BACKEND_URL);
      
      websocketRef.current.onopen = () => {
        setIsConnected(true);
        setAsrStatus('ASR Ready');
        console.log('🔗 Connected to ASR backend');
      };

      websocketRef.current.onclose = () => {
        setIsConnected(false);
        setAsrStatus('Disconnected');
        console.log('❌ Disconnected from backend');
        
        // Reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
      };

      websocketRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleWebSocketMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      websocketRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setAsrStatus('Connection Error');
      };

    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
      setAsrStatus('Connection Failed');
    }
  };

  const handleWebSocketMessage = (message) => {
    const { type, data } = message;

    switch (type) {
      case 'connection_status':
        setIsConnected(data.connected);
        setAsrStatus(data.asr_status);
        setStorageEnabled(data.storage_enabled);
        break;

      case 'recording_started':
        setRecordingStatus(`Recording to: ${data.storage_location}`);
        setAsrStatus('ASR Active - Listening...');
        break;

      case 'recording_stopped':
        setRecordingStatus(`Recording saved! Session: ${data.session_id}`);
        setAsrStatus('ASR Ready');
        
        if (data.summary) {
          const summary = data.summary.session_summary;
          setTimeout(() => {
            alert(`Recording Saved Successfully!\n\nDuration: ${summary.duration}\nAudio chunks: ${summary.audio_chunks}\nVideo frames: ${summary.video_frames}\nTranscripts: ${summary.transcripts}\nSize: ${summary.files_created.total_size_mb} MB\n\nLocation: ${summary.storage_location}`);
          }, 500);
        }
        break;

      case 'recording_error':
        setRecordingStatus(`Error: ${data.message}`);
        setAsrStatus('ASR Error');
        break;

      case 'transcript':
        setTranscriptCount(prev => prev + 1);
        setAsrStatus(`Processing - ${transcriptCount} transcripts`);
        
        const newCaption = {
          id: Date.now(),
          timestamp: formatTimestamp(data.start),
          text: data.text,
          sentiment: classifySentiment(data.text),
          source: data.speaker,
          confidence: data.confidence || 0,
          start: data.start,
          end: data.end
        };
        
        setCaptions(prev => {
          const updated = [...prev, newCaption];
          return updated.slice(-10); // Keep only last 10
        });
        
        updateInsightsFromTranscript(data.text);
        break;

      default:
        console.log('Unknown message type:', type);
    }
  };

  const sendWebSocketMessage = (type, data) => {
    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
      websocketRef.current.send(JSON.stringify({ type, data }));
    }
  };

  const formatTimestamp = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const classifySentiment = (text) => {
    const positiveWords = ['good', 'great', 'excellent', 'awesome', 'fantastic', 'perfect', 'love', 'amazing'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'horrible', 'worst', 'problem', 'issue'];
    
    const words = text.toLowerCase().split(' ');
    const positiveCount = words.filter(word => positiveWords.includes(word)).length;
    const negativeCount = words.filter(word => negativeWords.includes(word)).length;
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  };

  const updateInsightsFromTranscript = (text) => {
    const words = text.toLowerCase();
    
    if (words.includes('meeting') || words.includes('agenda') || words.includes('discuss')) {
      setInsights(prev => {
        const existing = prev.find(i => i.type === 'meeting-tone');
        if (!existing) {
          return [...prev, {
            id: Date.now(),
            type: 'meeting-tone',
            text: 'Formal meeting detected in conversation'
          }];
        }
        return prev;
      });
    }
    
    if (words.includes('action') || words.includes('todo') || words.includes('task')) {
      setInsights(prev => {
        const existing = prev.find(i => i.type === 'action-items');
        if (!existing) {
          return [...prev, {
            id: Date.now(),
            type: 'action-items',
            text: 'Action items mentioned in discussion'
          }];
        }
        return prev;
      });
    }
    
    setInsights(prev => prev.slice(-5));
  };

  const startRecording = async () => {
    try {
      setDataFlowStatus({ audio: 0, video: 0 });
      setTranscriptCount(0);
      setCaptions([]);
      setInsights([]);
      
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
            sampleRate: 48000,
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
              sampleRate: 48000,
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
            sampleRate: 48000
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
      setAsrStatus('Starting ASR...');

      // Send start recording message
      sendWebSocketMessage('start_recording', {
        captureMode: captureMode,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('Recording failed:', error);
      setAsrStatus('ASR Error');
      alert(`Recording failed: ${error.message}\n\nPlease make sure to:\n- Click "Allow" for permissions\n- Check "Share system audio" for screen capture`);
    }
  };

  const setupAudioStreaming = (stream) => {
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContextRef.current.createMediaStreamSource(stream);
    
    processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
    
    processorRef.current.onaudioprocess = (event) => {
      if (!isRecordingRef.current) return;
      
      const inputBuffer = event.inputBuffer;
      const inputData = inputBuffer.getChannelData(0);
      
      setDataFlowStatus(prev => ({ ...prev, audio: prev.audio + 1 }));
      
      const audioChunk = Array.from(inputData);
      
      // Send audio via WebSocket
      sendWebSocketMessage('audio_stream', {
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
      if (!isRecordingRef.current || !videoRef.current) return;

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
      
      // Send video via WebSocket
      sendWebSocketMessage('video_stream', {
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
    setAsrStatus('Stopping ASR...');
    
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
    
    // Send stop recording message
    sendWebSocketMessage('stop_recording', {});
    
    setRecordingStatus('Recording stopped');
    setTimeout(() => setAsrStatus('ASR Ready'), 1000);
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="header-left">
            <h1 className="header-title">Meeting Monitor</h1>
            <p className="header-subtitle">AI-Powered Real-time Transcription</p>
          </div>
          
          <div className="header-right">
            <div className="status-item">
              <div className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></div>
              <span className="status-text">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            
            <div className="status-item">
              <div className={`status-dot ${asrStatus.includes('Active') ? 'recording' : isConnected ? 'connected' : 'disconnected'}`}></div>
              <span className="status-text">{asrStatus}</span>
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
                      Audio: {dataFlowStatus.audio} | Video: {dataFlowStatus.video} | Transcripts: {transcriptCount}
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
                  {isRecording && (
                    <div className="recording-indicator">
                      <div className="recording-dot"></div>
                      <span>LIVE</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="audio-only-preview">
                  <div className="audio-only-content">
                    <div className="audio-icon">🎵</div>
                    <div className="audio-title">Audio Only Mode</div>
                    <div className="audio-subtitle">Real-time transcription active</div>
                    {isRecording && (
                      <div className="audio-recording-indicator">
                        <div className="pulse-dot"></div>
                        <span>Listening...</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Live Analysis */}
          <div className="right-column">
            
            {/* Live Captions */}
            <div className="card captions-card">
              <h2 className="card-title">🗣️ Live Transcription ({transcriptCount})</h2>
              <div className="captions-list">
                {captions.length === 0 && isRecording && (
                  <div className="caption-placeholder">
                    <div className="processing-indicator">
                      <div className="spinner"></div>
                      <span>Listening for speech...</span>
                    </div>
                  </div>
                )}
                {captions.length === 0 && !isRecording && (
                  <div className="caption-placeholder">
                    <span>Start recording to see live transcriptions</span>
                  </div>
                )}
                {captions.map((caption) => (
                  <div key={caption.id} className="caption-item">
                    <div className="caption-header">
                      <span className="caption-timestamp">{caption.timestamp}</span>
                      <span className={`caption-sentiment ${caption.sentiment}`}>
                        {caption.sentiment}
                      </span>
                      {caption.confidence > 0 && (
                        <span className="caption-confidence">
                          {Math.round(caption.confidence * 100)}%
                        </span>
                      )}
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
                {insights.length === 0 && (
                  <div className="insight-placeholder">
                    <span>AI insights will appear as speech is analyzed</span>
                  </div>
                )}
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
                  <span className="status-label">ASR Status</span>
                  <span className={`status-badge ${asrStatus.includes('Active') ? 'recording' : 'ready'}`}>
                    {asrStatus}
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
          <h3 className="footer-title">Real-time ASR Guide</h3>
          <div className="footer-steps">
            <div className="footer-step">
              <span className="step-number">1</span>
              <span className="step-text">Select capture mode</span>
            </div>
            <div className="footer-step">
              <span className="step-number">2</span>
              <span className="step-text">Start recording</span>
            </div>
            <div className="footer-step">
              <span className="step-number">3</span>
              <span className="step-text">Speak and see live transcriptions</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;

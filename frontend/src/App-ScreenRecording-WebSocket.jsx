import React, { useState, useRef, useEffect } from 'react';
import './Beautiful.css';

// Use WebSocket instead of Socket.IO
const WS_URL = 'ws://localhost:8000/ws';

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [captions, setCaptions] = useState([]);
  const [asrStatus, setAsrStatus] = useState('Connecting...');
  const [recordingStatus, setRecordingStatus] = useState('');
  const [captureMode, setCaptureMode] = useState('screen');
  const [dataFlowStatus, setDataFlowStatus] = useState({ audio: 0, video: 0 });
  const [transcriptCount, setTranscriptCount] = useState(0);
  const [insights, setInsights] = useState([]);
  const [storageEnabled, setStorageEnabled] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  
  const socketRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const isRecordingRef = useRef(false);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const connectWebSocket = () => {
    socketRef.current = new WebSocket(WS_URL);
    
    socketRef.current.onopen = () => {
      setIsConnected(true);
      setAsrStatus('ASR Ready');
      console.log('🟢 WebSocket connected');
      
      // Send initial handshake
      socketRef.current.send(JSON.stringify({
        type: 'handshake',
        client_id: 'screen_recorder_' + Date.now()
      }));
      
      // Check storage status
      fetch('http://localhost:8000/status')
        .then(res => res.json())
        .then(data => {
          setStorageEnabled(data.storage_enabled || false);
        })
        .catch(err => console.log('Could not check storage status:', err));
    };

    socketRef.current.onclose = () => {
      setIsConnected(false);
      setAsrStatus('Disconnected');
      console.log('🔴 WebSocket disconnected');
      
      // Attempt reconnection after 3 seconds
      setTimeout(() => {
        if (!isConnected) {
          console.log('🔄 Attempting reconnection...');
          connectWebSocket();
        }
      }, 3000);
    };

    socketRef.current.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      setAsrStatus('Connection Error');
    };

    socketRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 Received:', data);
        
        switch (data.type) {
          case 'transcript':
            handleTranscript(data);
            break;
          case 'status':
            setAsrStatus(data.message || 'ASR Active');
            break;
          case 'recording_started':
            setRecordingStatus(`Recording to: ${data.storage_location || 'server'}`);
            setAsrStatus('ASR Active - Listening...');
            break;
          case 'recording_stopped':
            setRecordingStatus(`Recording saved! Session: ${data.session_id || 'unknown'}`);
            setAsrStatus('ASR Ready');
            break;
          case 'error':
            console.error('Backend error:', data.message);
            setAsrStatus('ASR Error: ' + data.message);
            break;
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };
  };

  const handleTranscript = (data) => {
    const newCaption = {
      id: Date.now(),
      text: data.text,
      timestamp: Date.now(),
      speaker: data.speaker || 'Speaker',
      confidence: data.confidence || 0
    };
    
    setCaptions(prev => [...prev.slice(-9), newCaption]);
    setTranscriptCount(prev => prev + 1);
    
    // Update insights
    updateInsightsFromTranscript(data.text);
    
    console.log('📝 New transcript:', data.text);
  };

  const updateInsightsFromTranscript = (text) => {
    const words = text.toLowerCase();
    
    // Meeting detection
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
    
    // Action items
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
  };

  const startRecording = async () => {
    try {
      setDataFlowStatus({ audio: 0, video: 0 });
      setTranscriptCount(0);
      setCaptions([]);
      setInsights([]);
      
      let stream;
      
      if (captureMode === 'screen') {
        // Request screen sharing with audio
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
        // System audio only
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
        // Camera + microphone
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
      
      // Set up video display
      if (videoRef.current && stream.getVideoTracks().length > 0) {
        videoRef.current.srcObject = stream;
      }

      // Set up audio processing
      if (stream.getAudioTracks().length > 0) {
        console.log('🎤 Setting up audio processing...');
        console.log('📊 Audio tracks found:', stream.getAudioTracks().length);
        stream.getAudioTracks().forEach((track, index) => {
          console.log(`🎵 Audio track ${index}:`, {
            kind: track.kind,
            label: track.label,
            enabled: track.enabled,
            readyState: track.readyState,
            settings: track.getSettings()
          });
        });
        setupAudioStreaming(stream);
      } else {
        console.warn('⚠️ No audio tracks found in stream!');
        alert('No audio detected! Make sure to:\n• Click "Share system audio" when sharing screen\n• Grant microphone permissions\n• Check audio settings in your browser');
      }

      // Set up video capture
      if (stream.getVideoTracks().length > 0) {
        setupVideoCapture();
      }

      setIsRecording(true);
      isRecordingRef.current = true;
      setAsrStatus('Starting ASR...');

      // Send start recording message via WebSocket
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: 'start_recording',
          data: {
            captureMode: captureMode,
            timestamp: Date.now(),
            session_id: 'screen_session_' + Date.now()
          }
        }));
      }

    } catch (error) {
      console.error('Recording failed:', error);
      setAsrStatus('ASR Error');
      
      let errorMsg = 'Recording failed: ' + error.message;
      if (error.name === 'NotAllowedError') {
        errorMsg += '\n\n🔧 Solutions:\n• Click "Allow" for permissions\n• For screen recording: check "Share system audio"\n• Grant microphone access in browser settings';
      }
      
      alert(errorMsg);
    }
  };

  const setupAudioStreaming = (stream) => {
    try {
      // Create audio context
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      
      // Create processor
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      
      processorRef.current.onaudioprocess = (event) => {
        if (!isRecordingRef.current || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
          return;
        }
        
        const inputBuffer = event.inputBuffer;
        const inputData = inputBuffer.getChannelData(0);
        
        // Check if there's actual audio data (not just silence)
        const rms = Math.sqrt(inputData.reduce((sum, sample) => sum + sample * sample, 0) / inputData.length);
        
        setDataFlowStatus(prev => ({ ...prev, audio: prev.audio + 1 }));
        
        const audioChunk = Array.from(inputData);
        
        // Send audio data via WebSocket
        socketRef.current.send(JSON.stringify({
          type: 'audio_chunk',
          data: {
            audio_data: audioChunk,
            sample_rate: audioContextRef.current.sampleRate,
            timestamp: Date.now(),
            rms_level: rms,
            captureMode: captureMode,
            isSystemAudio: captureMode === 'screen' || captureMode === 'system-audio'
          }
        }));
        
        // Update audio level for visual indicator
        setAudioLevel(rms * 100); // Convert to percentage
        
        // Enhanced debug logging
        if (rms > 0.001) {  // Lower threshold to catch more audio
          console.log('🎵 Audio detected, RMS:', rms.toFixed(6), 'Sample rate:', audioContextRef.current.sampleRate);
        }
        
        // Log every 100th audio chunk to show it's working
        const currentChunk = prev => prev.audio + 1;
        if (currentChunk % 100 === 0) {
          console.log('📊 Audio processing active - Chunk', currentChunk, 'RMS:', rms.toFixed(6));
        }
      };

      source.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);
      
      console.log('✅ Audio streaming setup complete');
      
    } catch (error) {
      console.error('❌ Error setting up audio:', error);
      setAsrStatus('Audio Setup Error');
    }
  };

  const setupVideoCapture = () => {
    const frameRate = captureMode === 'screen' ? 200 : 100; // ms between frames
    
    const captureFrame = () => {
      if (!isRecordingRef.current || !videoRef.current || !socketRef.current || 
          socketRef.current.readyState !== WebSocket.OPEN) {
        return;
      }

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
      
      // Send video frame via WebSocket
      socketRef.current.send(JSON.stringify({
        type: 'video_frame',
        data: {
          image_data: imageData,
          width: canvas.width,
          height: canvas.height,
          timestamp: Date.now(),
          captureMode: captureMode,
          isScreenCapture: captureMode === 'screen'
        }
      }));
      
      setTimeout(captureFrame, frameRate);
    };
    
    setTimeout(captureFrame, 1000); // Start after 1 second
  };

  const stopRecording = () => {
    setIsRecording(false);
    isRecordingRef.current = false;
    setAsrStatus('Stopping...');

    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('🛑 Stopped track:', track.kind);
      });
      streamRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Clear video
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    // Send stop message
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'stop_recording',
        data: {
          timestamp: Date.now()
        }
      }));
    }

    setAsrStatus('ASR Ready');
    setRecordingStatus('Recording stopped');
    setDataFlowStatus({ audio: 0, video: 0 });
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <h1 className="app-title">🎥 Meeting Monitor - Screen Recording</h1>
          <div className="connection-status">
            <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
              {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
            </div>
            <div className="asr-status">{asrStatus}</div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {/* Controls Panel */}
        <div className="controls-panel">
          <div className="recording-controls">
            <div className="capture-mode-selector">
              <label htmlFor="captureMode">📹 Capture Mode:</label>
              <select
                id="captureMode"
                value={captureMode}
                onChange={(e) => setCaptureMode(e.target.value)}
                disabled={isRecording}
                className="mode-select"
              >
                <option value="screen">🖥️ Screen + System Audio (for meetings)</option>
                <option value="system-audio">🔊 System Audio Only</option>
                <option value="camera">📹 Camera + Microphone</option>
              </select>
            </div>

            <div className="record-buttons">
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  disabled={!isConnected}
                  className="start-button"
                >
                  ▶️ Start Recording
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="stop-button"
                >
                  ⏹️ Stop Recording
                </button>
              )}
            </div>
          </div>

          {/* Status Indicators */}
          <div className="status-panel">
            <div className="status-row">
              <div className="status-item">
                <span className="status-label">Audio Chunks:</span>
                <span className="status-value">{dataFlowStatus.audio}</span>
              </div>
              <div className="status-item">
                <span className="status-label">Video Frames:</span>
                <span className="status-value">{dataFlowStatus.video}</span>
              </div>
              <div className="status-item">
                <span className="status-label">Transcripts:</span>
                <span className="status-value">{transcriptCount}</span>
              </div>
              <div className="status-item">
                <span className="status-label">Audio Level:</span>
                <span className="status-value">{audioLevel.toFixed(1)}%</span>
                <div className="audio-level-bar" style={{
                  width: '50px',
                  height: '10px',
                  backgroundColor: '#ddd',
                  marginLeft: '5px',
                  borderRadius: '5px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${Math.min(audioLevel * 10, 100)}%`,
                    height: '100%',
                    backgroundColor: audioLevel > 0.1 ? '#4CAF50' : '#f44336',
                    transition: 'width 0.1s ease'
                  }}></div>
                </div>
              </div>
            </div>
            {recordingStatus && (
              <div className="recording-status">{recordingStatus}</div>
            )}
          </div>
        </div>

        {/* Video Preview */}
        <div className="video-section">
          <div className="video-container">
            <h3 className="section-title">
              {captureMode === 'screen' ? '🖥️ Screen Preview' : 
               captureMode === 'system-audio' ? '🔊 Audio Only' :
               '📹 Camera Preview'}
            </h3>
            {captureMode !== 'system-audio' ? (
              <video
                ref={videoRef}
                autoPlay
                muted
                className="video-preview"
                style={{ 
                  width: captureMode === 'screen' ? '100%' : '400px',
                  maxHeight: captureMode === 'screen' ? '400px' : '300px'
                }}
              />
            ) : (
              <div className="audio-only-indicator">
                <div className="audio-visualizer">
                  <span>🎵 Audio Only Mode</span>
                  <div className="audio-level">Level: {dataFlowStatus.audio}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Live Captions */}
        <div className="captions-section">
          <h3 className="section-title">💬 Live Transcription</h3>
          <div className="captions-container">
            {captions.length === 0 ? (
              <div className="no-captions">
                {isRecording ? 'Listening for speech...' : 'Start recording to see transcriptions'}
              </div>
            ) : (
              captions.map((caption) => (
                <div key={caption.id} className="caption-item">
                  <div className="caption-header">
                    <span className="speaker">{caption.speaker}</span>
                    <span className="timestamp">
                      {new Date(caption.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="caption-text">{caption.text}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Insights */}
        {insights.length > 0 && (
          <div className="insights-section">
            <h3 className="section-title">💡 Meeting Insights</h3>
            <div className="insights-container">
              {insights.map((insight) => (
                <div key={insight.id} className={`insight-item ${insight.type}`}>
                  {insight.text}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <div className="tech-info">
            <span className="tech-item">
              <strong>Backend:</strong> WebSocket @ localhost:8000
            </span>
            <span className="tech-item">
              <strong>ASR:</strong> Whisper Medium (GPU Optimized)
            </span>
            <span className="tech-item">
              <strong>Mode:</strong> {captureMode === 'screen' ? '🖥️ Screen + Audio' :
                                  captureMode === 'system-audio' ? '🔊 System Audio' :
                                  '📹 Camera + Mic'}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
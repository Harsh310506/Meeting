import React, { useState, useRef, useEffect } from 'react';
import { io } from 'socket.io-client';

const BACKEND_URL = 'http://localhost:8000';

function DebugApp() {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [captureMode, setCaptureMode] = useState('screen');
  const [storageEnabled, setStorageEnabled] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState('Not recording');
  const [dataFlowStatus, setDataFlowStatus] = useState({ audio: 0, video: 0 });
  const [debugLogs, setDebugLogs] = useState([]);
  const [streamInfo, setStreamInfo] = useState({ video: null, audio: null });

  const videoRef = useRef(null);
  const socketRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const videoIntervalRef = useRef(null);
  const isRecordingRef = useRef(false); // Add ref for recording state

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLogs(prev => [...prev.slice(-20), { timestamp, message, type }]); // Keep last 20 logs
    console.log(`[${timestamp}] ${message}`);
  };

  useEffect(() => {
    // Initialize Socket.IO connection
    socketRef.current = io(BACKEND_URL);
    
    socketRef.current.on('connect', () => {
      addLog('✅ Connected to backend', 'success');
      setIsConnected(true);
      
      // Check if backend has storage enabled
      fetch(`${BACKEND_URL}/`)
        .then(res => res.json())
        .then(data => {
          setStorageEnabled(data.storage_enabled || false);
          addLog(`Storage enabled: ${data.storage_enabled}`, 'info');
        })
        .catch(err => addLog('Could not check storage status', 'warning'));
    });

    socketRef.current.on('disconnect', () => {
      addLog('❌ Disconnected from backend', 'error');
      setIsConnected(false);
    });

    socketRef.current.on('recording_started', (data) => {
      addLog(`📹 Recording started: ${data.session_id}`, 'success');
      setRecordingStatus(`Recording to: ${data.storage_location}`);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      addLog('🎬 Starting recording process...', 'info');
      
      // Reset counters
      setDataFlowStatus({ audio: 0, video: 0 });
      
      let stream;
      
      addLog(`Requesting ${captureMode} capture...`, 'info');
      
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
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 } },
          audio: { echoCancellation: true, sampleRate: 44100 }
        });
      }

      addLog('✅ Stream obtained successfully', 'success');
      
      // Analyze stream
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();
      
      setStreamInfo({
        video: videoTracks.length > 0 ? videoTracks[0].getSettings() : null,
        audio: audioTracks.length > 0 ? audioTracks[0].getSettings() : null
      });
      
      if (videoTracks.length > 0) {
        const settings = videoTracks[0].getSettings();
        addLog(`✅ Video track: ${settings.width}x${settings.height} at ${settings.frameRate}fps`, 'success');
      } else {
        addLog('⚠️ No video track available', 'warning');
      }

      if (audioTracks.length > 0) {
        const settings = audioTracks[0].getSettings();
        addLog(`✅ Audio track: ${settings.sampleRate}Hz, ${settings.channelCount} channels`, 'success');
      } else {
        addLog('❌ No audio track - forgot to check "Share system audio"?', 'error');
      }

      streamRef.current = stream;
      
      // Set up video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        addLog('✅ Video element connected to stream', 'success');
      }

      // Set up audio processing
      if (audioTracks.length > 0) {
        setupAudioStreaming(stream);
      }

      // Set up video capture
      if (videoTracks.length > 0) {
        setupVideoCapture();
      }

      setIsRecording(true);
      isRecordingRef.current = true; // Update ref
      addLog('🎯 Recording state set to TRUE', 'success');

      // Notify backend to start recording session
      if (socketRef.current && storageEnabled) {
        socketRef.current.emit('start_recording', {
          captureMode: captureMode,
          timestamp: Date.now()
        });
        addLog('📡 Sent start_recording to backend', 'info');
      }

    } catch (error) {
      addLog(`❌ Recording failed: ${error.message}`, 'error');
      if (error.name === 'NotAllowedError') {
        addLog('💡 Permission denied - click Allow and check "Share system audio"', 'warning');
      }
    }
  };

  const setupAudioStreaming = (stream) => {
    try {
      addLog('🎵 Setting up audio processing...', 'info');
      
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      
      processorRef.current.onaudioprocess = (event) => {
        // Debug: Log every time this function is called
        console.log('🔊 onaudioprocess called, isRecordingRef:', isRecordingRef.current, 'socketConnected:', !!socketRef.current);
        
        if (!isRecordingRef.current || !socketRef.current) {
          console.log('⚠️ Skipping audio processing - isRecording:', isRecordingRef.current, 'socket:', !!socketRef.current);
          return;
        }
        
        const inputBuffer = event.inputBuffer;
        const inputData = inputBuffer.getChannelData(0);
        
        // Update counter
        setDataFlowStatus(prev => {
          const newCount = prev.audio + 1;
          if (newCount % 50 === 0) { // Log every 50th chunk
            addLog(`🔊 Audio chunk ${newCount} processed`, 'info');
          }
          return { ...prev, audio: newCount };
        });
        
        // Send to backend
        socketRef.current.emit('audio_stream', {
          data: Array.from(inputData),
          sampleRate: audioContextRef.current.sampleRate,
          timestamp: Date.now(),
          captureMode: captureMode,
          isSystemAudio: captureMode === 'screen'
        });
      };

      source.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);
      
      addLog('✅ Audio processing started', 'success');
    } catch (error) {
      addLog(`❌ Audio setup failed: ${error.message}`, 'error');
    }
  };

  const setupVideoCapture = () => {
    addLog('🎥 Setting up video capture...', 'info');
    
    const captureFrame = () => {
      // Debug: Log every time this function is called
      console.log('🎬 captureFrame called, isRecordingRef:', isRecordingRef.current, 'videoElement:', !!videoRef.current, 'socket:', !!socketRef.current);
      
      if (!isRecordingRef.current || !videoRef.current || !socketRef.current) {
        console.log('⚠️ Skipping video capture - isRecording:', isRecordingRef.current, 'video:', !!videoRef.current, 'socket:', !!socketRef.current);
        return;
      }

      try {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        const video = videoRef.current;
        canvas.width = video.videoWidth || 1920;
        canvas.height = video.videoHeight || 1080;
        
        console.log('🎬 Video dimensions:', canvas.width, 'x', canvas.height);
        
        if (canvas.width === 0 || canvas.height === 0) {
          addLog('⚠️ Video dimensions are 0 - video not ready yet', 'warning');
          return;
        }
        
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = canvas.toDataURL('image/jpeg', 0.5);
        
        // Update counter
        setDataFlowStatus(prev => {
          const newCount = prev.video + 1;
          if (newCount % 10 === 0) { // Log every 10th frame
            addLog(`🎬 Video frame ${newCount} captured (${canvas.width}x${canvas.height})`, 'info');
          }
          return { ...prev, video: newCount };
        });
        
        // Send to backend
        socketRef.current.emit('video_stream', {
          data: imageData,
          width: canvas.width,
          height: canvas.height,
          timestamp: Date.now(),
          captureMode: captureMode,
          isScreenCapture: captureMode === 'screen'
        });
        
      } catch (error) {
        addLog(`❌ Video capture error: ${error.message}`, 'error');
      }
    };

    videoIntervalRef.current = setInterval(captureFrame, 200); // 5 FPS
    addLog('✅ Video capture started (5 FPS)', 'success');
  };

  const stopRecording = () => {
    addLog('🛑 Stopping recording...', 'info');
    
    setIsRecording(false);
    isRecordingRef.current = false; // Update ref
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        addLog(`🛑 Stopped ${track.kind} track`, 'info');
      });
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
      addLog('📡 Sent stop_recording to backend', 'info');
    }
    
    setRecordingStatus('Recording stopped');
    addLog('✅ Recording stopped successfully', 'success');
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>🔧 Meeting Monitor - Debug Version</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        
        {/* Status Panel */}
        <div style={{ border: '1px solid #ccc', padding: '15px', borderRadius: '5px' }}>
          <h3>📊 System Status</h3>
          <div>Backend: <span style={{ color: isConnected ? 'green' : 'red' }}>{isConnected ? '✅ Connected' : '❌ Disconnected'}</span></div>
          <div>Storage: <span style={{ color: storageEnabled ? 'green' : 'orange' }}>{storageEnabled ? '✅ Enabled' : '⚠️ Disabled'}</span></div>
          <div>Recording: <span style={{ color: isRecording ? 'green' : 'gray' }}>{isRecording ? '✅ Active' : '⭕ Inactive'}</span></div>
          <div>Data Flow: <strong>Audio: {dataFlowStatus.audio} | Video: {dataFlowStatus.video}</strong></div>
          
          {streamInfo.video && (
            <div style={{ marginTop: '10px', fontSize: '12px' }}>
              <strong>Video Stream:</strong> {streamInfo.video.width}x{streamInfo.video.height} @ {streamInfo.video.frameRate}fps
            </div>
          )}
          
          {streamInfo.audio && (
            <div style={{ fontSize: '12px' }}>
              <strong>Audio Stream:</strong> {streamInfo.audio.sampleRate}Hz, {streamInfo.audio.channelCount}ch
            </div>
          )}
        </div>

        {/* Controls Panel */}
        <div style={{ border: '1px solid #ccc', padding: '15px', borderRadius: '5px' }}>
          <h3>🎮 Controls</h3>
          
          <div style={{ marginBottom: '10px' }}>
            <label>Capture Mode: </label>
            <select value={captureMode} onChange={(e) => setCaptureMode(e.target.value)} disabled={isRecording}>
              <option value="screen">Screen + System Audio</option>
              <option value="camera">Camera + Microphone</option>
            </select>
          </div>
          
          <div>
            {!isRecording ? (
              <button onClick={startRecording} style={{ padding: '10px 20px', fontSize: '16px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px' }}>
                🎬 Start Recording
              </button>
            ) : (
              <button onClick={stopRecording} style={{ padding: '10px 20px', fontSize: '16px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '5px' }}>
                🛑 Stop Recording
              </button>
            )}
          </div>
          
          <div style={{ marginTop: '10px', fontSize: '12px' }}>
            Status: {recordingStatus}
          </div>
        </div>
      </div>

      {/* Video Preview */}
      <div style={{ marginBottom: '20px' }}>
        <h3>🎥 Video Preview</h3>
        <video 
          ref={videoRef} 
          autoPlay 
          muted 
          style={{ width: '100%', maxWidth: '600px', border: '1px solid #ccc', backgroundColor: '#000' }}
        />
      </div>

      {/* Debug Logs */}
      <div>
        <h3>📋 Debug Logs</h3>
        <div style={{ 
          height: '300px', 
          overflowY: 'scroll', 
          border: '1px solid #ccc', 
          padding: '10px', 
          backgroundColor: '#f8f9fa',
          fontSize: '12px',
          fontFamily: 'monospace'
        }}>
          {debugLogs.map((log, idx) => (
            <div key={idx} style={{ 
              color: log.type === 'error' ? 'red' : log.type === 'success' ? 'green' : log.type === 'warning' ? 'orange' : 'black',
              marginBottom: '2px'
            }}>
              <strong>[{log.timestamp}]</strong> {log.message}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default DebugApp;

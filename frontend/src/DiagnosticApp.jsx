import React, { useState, useRef, useEffect } from 'react';
import { io } from 'socket.io-client';

const BACKEND_URL = 'http://localhost:8000';

function DiagnosticApp() {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [captureMode, setCaptureMode] = useState('screen');
  const [diagnostics, setDiagnostics] = useState([]);
  const [permissions, setPermissions] = useState({ video: false, audio: false });
  
  const videoRef = useRef(null);
  const socketRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);

  const addDiagnostic = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setDiagnostics(prev => [...prev, { timestamp, message, type }]);
    console.log(`[${timestamp}] ${message}`);
  };

  useEffect(() => {
    // Initialize Socket.IO connection
    socketRef.current = io(BACKEND_URL);
    
    socketRef.current.on('connect', () => {
      addDiagnostic('✅ Connected to backend', 'success');
      setIsConnected(true);
    });

    socketRef.current.on('disconnect', () => {
      addDiagnostic('❌ Disconnected from backend', 'error');
      setIsConnected(false);
    });

    socketRef.current.on('audio_received', (data) => {
      addDiagnostic(`📢 Audio chunk received: ${data.chunk_duration?.toFixed(2)}s`, 'success');
    });

    socketRef.current.on('video_received', (data) => {
      addDiagnostic(`🎥 Video frame received: ${data.frame_size}`, 'success');
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const testBrowserCapabilities = async () => {
    addDiagnostic('🔍 Testing browser capabilities...', 'info');
    
    // Check if APIs are available
    if (!navigator.mediaDevices) {
      addDiagnostic('❌ MediaDevices API not available', 'error');
      return;
    }
    
    if (!navigator.mediaDevices.getDisplayMedia) {
      addDiagnostic('❌ getDisplayMedia not supported', 'error');
      return;
    }
    
    addDiagnostic('✅ Browser supports screen capture', 'success');
    addDiagnostic(`🌐 User Agent: ${navigator.userAgent}`, 'info');
  };

  const testScreenCapture = async () => {
    try {
      addDiagnostic('🎬 Starting screen capture test...', 'info');
      
      const stream = await navigator.mediaDevices.getDisplayMedia({
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

      addDiagnostic('✅ Screen capture permission granted', 'success');
      
      // Check video tracks
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length > 0) {
        const videoSettings = videoTracks[0].getSettings();
        addDiagnostic(`✅ Video track: ${videoSettings.width}x${videoSettings.height} at ${videoSettings.frameRate}fps`, 'success');
        setPermissions(prev => ({ ...prev, video: true }));
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } else {
        addDiagnostic('⚠️ No video track available', 'warning');
      }

      // Check audio tracks
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length > 0) {
        const audioSettings = audioTracks[0].getSettings();
        addDiagnostic(`✅ Audio track: ${audioSettings.sampleRate}Hz, ${audioSettings.channelCount} channels`, 'success');
        setPermissions(prev => ({ ...prev, audio: true }));
        
        // Test audio processing
        setupAudioTest(stream);
      } else {
        addDiagnostic('❌ No audio track available - did you check "Share system audio"?', 'error');
      }

      streamRef.current = stream;
      
    } catch (error) {
      addDiagnostic(`❌ Screen capture failed: ${error.message}`, 'error');
      
      if (error.name === 'NotAllowedError') {
        addDiagnostic('❌ Permission denied - click "Allow" and check "Share system audio"', 'error');
      }
    }
  };

  const setupAudioTest = (stream) => {
    try {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      
      let chunkCount = 0;
      processorRef.current.onaudioprocess = (event) => {
        chunkCount++;
        if (chunkCount % 10 === 0) { // Log every 10th chunk
          const inputBuffer = event.inputBuffer;
          const inputData = inputBuffer.getChannelData(0);
          const rms = Math.sqrt(inputData.reduce((sum, sample) => sum + sample * sample, 0) / inputData.length);
          addDiagnostic(`🔊 Audio level: ${(rms * 100).toFixed(1)}% (chunk ${chunkCount})`, 'info');
          
          // Send to backend if connected
          if (socketRef.current && isConnected) {
            socketRef.current.emit('audio_stream', {
              data: Array.from(inputData),
              sampleRate: audioContextRef.current.sampleRate,
              timestamp: Date.now(),
              captureMode: 'screen',
              isSystemAudio: true
            });
          }
        }
      };

      source.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);
      
      addDiagnostic('✅ Audio processing started', 'success');
    } catch (error) {
      addDiagnostic(`❌ Audio processing failed: ${error.message}`, 'error');
    }
  };

  const stopCapture = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        addDiagnostic(`🛑 Stopped ${track.kind} track`, 'info');
      });
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setPermissions({ video: false, audio: false });
    addDiagnostic('🛑 All capture stopped', 'info');
  };

  const clearDiagnostics = () => {
    setDiagnostics([]);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>🔧 Meeting Monitor - Diagnostics</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <h3>Status:</h3>
        <div>Backend: <span style={{ color: isConnected ? 'green' : 'red' }}>{isConnected ? '✅ Connected' : '❌ Disconnected'}</span></div>
        <div>Video Permission: <span style={{ color: permissions.video ? 'green' : 'red' }}>{permissions.video ? '✅ Granted' : '❌ Not granted'}</span></div>
        <div>Audio Permission: <span style={{ color: permissions.audio ? 'green' : 'red' }}>{permissions.audio ? '✅ Granted' : '❌ Not granted'}</span></div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button onClick={testBrowserCapabilities} style={{ marginRight: '10px', padding: '10px' }}>
          🔍 Test Browser
        </button>
        <button onClick={testScreenCapture} style={{ marginRight: '10px', padding: '10px' }}>
          🎬 Test Screen Capture
        </button>
        <button onClick={stopCapture} style={{ marginRight: '10px', padding: '10px' }}>
          🛑 Stop Capture
        </button>
        <button onClick={clearDiagnostics} style={{ padding: '10px' }}>
          🧹 Clear Logs
        </button>
      </div>

      <div style={{ display: 'flex', gap: '20px' }}>
        <div style={{ flex: 1 }}>
          <h3>🎥 Video Preview:</h3>
          <video 
            ref={videoRef} 
            autoPlay 
            muted 
            style={{ width: '100%', maxWidth: '400px', border: '1px solid #ccc' }}
          />
        </div>
        
        <div style={{ flex: 1 }}>
          <h3>📋 Diagnostic Log:</h3>
          <div style={{ 
            height: '300px', 
            overflowY: 'scroll', 
            border: '1px solid #ccc', 
            padding: '10px', 
            backgroundColor: '#f5f5f5',
            fontSize: '12px'
          }}>
            {diagnostics.map((log, idx) => (
              <div key={idx} style={{ 
                color: log.type === 'error' ? 'red' : log.type === 'success' ? 'green' : log.type === 'warning' ? 'orange' : 'black',
                marginBottom: '5px'
              }}>
                <strong>[{log.timestamp}]</strong> {log.message}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#e3f2fd', borderRadius: '5px' }}>
        <h4>📖 Instructions:</h4>
        <ol>
          <li><strong>Test Browser:</strong> Check if your browser supports screen capture</li>
          <li><strong>Test Screen Capture:</strong> Grant permissions and check "Share system audio"</li>
          <li><strong>Watch the logs:</strong> Look for "Audio level" messages indicating sound is being captured</li>
          <li><strong>Check video preview:</strong> Should show your screen content</li>
        </ol>
        
        <p><strong>Key Points:</strong></p>
        <ul>
          <li>Use Chrome 105+ for best results</li>
          <li>MUST check "Share system audio" checkbox</li>
          <li>Play some audio/video to see audio levels</li>
          <li>If audio levels are 0%, no system audio is being captured</li>
        </ul>
      </div>
    </div>
  );
}

export default DiagnosticApp;

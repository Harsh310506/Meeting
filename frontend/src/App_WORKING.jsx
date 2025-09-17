import React, { useState, useRef, useEffect } from 'react';
import './Beautiful.css';

// FRESH WebSocket URL - no caching issues
const WS_URL = 'ws://localhost:8000/ws';

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [status, setStatus] = useState('Initializing...');
  const [isRecording, setIsRecording] = useState(false);
  const wsRef = useRef(null);
  const streamRef = useRef(null);  
  const videoRef = useRef(null);
  const audioContextRef = useRef(null);

  // WebSocket Connection
  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const connectWebSocket = () => {
    console.log('🚀 CONNECTING TO WEBSOCKET:', WS_URL);
    
    wsRef.current = new WebSocket(WS_URL);
    
    wsRef.current.onopen = () => {
      console.log('✅ WebSocket Connected!');
      setIsConnected(true);
      setStatus('Connected - ASR Ready');
    };
    
    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 Received:', data);
        
        if (data.type === 'transcript') {
          setTranscription(prev => prev + ' ' + data.data.text);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    wsRef.current.onclose = () => {
      console.log('🔌 WebSocket Disconnected');
      setIsConnected(false);
      setStatus('Disconnected');
    };
    
    wsRef.current.onerror = (error) => {
      console.error('❌ WebSocket Error:', error);
      setStatus('Connection Error');
    };
  };

  const startRecording = async () => {
    try {
      console.log('🎬 Starting recording...');
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      streamRef.current = stream;
      setIsRecording(true);
      setStatus('Recording...');
      
      // Set up video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => console.log('Video play error:', e));
      }
      
      // Send start recording message
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'start_recording',
          data: {
            mode: 'screen',
            timestamp: Date.now()
          }
        }));
      }
      
      // Set up audio processing
      setupAudioProcessing(stream);
      
      // Set up video processing with delay to ensure video element is ready
      setTimeout(() => setupVideoProcessing(stream), 1000);
      
    } catch (error) {
      console.error('Error starting recording:', error);
      setStatus('Recording Error');
    }
  };

  const setupAudioProcessing = (stream) => {
    try {
      const audioTracks = stream.getAudioTracks();
      console.log('🎤 Setting up audio processing, tracks:', audioTracks.length);
      
      if (audioTracks.length === 0) {
        console.warn('⚠️ No audio track found');
        return;
      }

      const audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000
      });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (event) => {
        if (!isRecording) return;

        const inputData = event.inputBuffer.getChannelData(0);
        const audioData = Array.from(inputData);

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'audio_chunk',
            data: {
              audio: audioData,
              sample_rate: 16000,
              timestamp: Date.now()
            }
          }));
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      console.log('✅ Audio processing pipeline established');
    } catch (error) {
      console.error('Error setting up audio processing:', error);
    }
  };

  const setupVideoProcessing = (stream) => {
    const videoTracks = stream.getVideoTracks();
    console.log('🎥 Setting up video processing, tracks:', videoTracks.length);
    
    if (videoTracks.length === 0) {
      console.warn('⚠️ No video track found');
      return;
    }

    try {
      console.log('🎥 Video element state:', {
        exists: !!videoRef.current,
        readyState: videoRef.current?.readyState,
        videoWidth: videoRef.current?.videoWidth,
        videoHeight: videoRef.current?.videoHeight
      });

      // Create a canvas to capture video frames
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Set canvas size
      canvas.width = 640;
      canvas.height = 480;
      
      console.log('✅ Video canvas created:', canvas.width, 'x', canvas.height);
      
      let frameCount = 0;
      const captureVideoFrame = () => {
        if (!isRecording || !videoRef.current) {
          console.log('🎥 Video capture STOPPED - recording:', isRecording, 'videoRef:', !!videoRef.current);
          return;
        }
        
        frameCount++;
        
        // Capture frame every 30 frames (roughly 1 FPS)
        if (frameCount % 30 === 0) {
          try {
            // Check if video is ready
            if (videoRef.current.readyState >= 2) { // HAVE_CURRENT_DATA
              // Draw video frame to canvas
              ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
              
              // Convert to base64 image data
              const frameData = canvas.toDataURL('image/jpeg', 0.7);
              
              console.log(`🎥 SENDING video frame ${Math.floor(frameCount/30)}, size: ${frameData.length} bytes`);
              
              // Send video frame to backend
              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                  type: 'video_stream',
                  data: {
                    frame: frameData,
                    timestamp: Date.now(),
                    frame_number: Math.floor(frameCount/30),
                    width: canvas.width,
                    height: canvas.height
                  }
                }));
              } else {
                console.warn('🎥 WebSocket not ready for video transmission');
              }
            } else {
              console.log('🎥 Video not ready yet, readyState:', videoRef.current.readyState);
            }
          } catch (error) {
            console.error('❌ Error capturing video frame:', error);
          }
        }
        
        // Continue capturing frames
        if (isRecording) {
          requestAnimationFrame(captureVideoFrame);
        }
      };
      
      // Start video frame capture
      console.log('🎥 Starting video frame capture loop...');
      requestAnimationFrame(captureVideoFrame);
      console.log('✅ Video processing pipeline started');
      
    } catch (error) {
      console.error('❌ Error setting up video processing:', error);
    }
  };

  const stopRecording = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    
    setIsRecording(false);
    setStatus('Recording Stopped');
    
    // Send stop recording message
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'stop_recording',
        data: {}
      }));
    }
  };

  return (
    <div className="app">
      <div className="header">
        <h1>🎯 Meeting Monitor with Real-time ASR</h1>
        <div className={`status ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? '🟢' : '🔴'} {status}
        </div>
      </div>

      <div className="controls">
        <button 
          onClick={isRecording ? stopRecording : startRecording}
          className={`record-btn ${isRecording ? 'recording' : ''}`}
          disabled={!isConnected}
        >
          {isRecording ? '⏹️ Stop Recording' : '🎤 Start Recording'}
        </button>
      </div>

      <div className="video-section">
        <video 
          ref={videoRef} 
          autoPlay 
          muted 
          className="video-preview"
          style={{ width: '640px', height: '480px', border: '2px solid #007bff', borderRadius: '8px' }}
        />
      </div>

      <div className="transcription-section">
        <h3>📝 Live Transcription</h3>
        <div className="transcription-box">
          {transcription || 'Start recording to see transcription...'}
        </div>
      </div>

      <div className="debug-info">
        <p>WebSocket: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}</p>
        <p>Recording: {isRecording ? '🔴 Active' : '⚪ Inactive'}</p>
        <p>Backend: ws://localhost:8000/ws</p>
      </div>
    </div>
  );
}

export default App;

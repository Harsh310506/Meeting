import React, { useState, useRef, useEffect } from 'react';
import './Beautiful.css';

// FRESH WebSocket URL - no caching issues
const WS_URL = 'ws://localhost:8000/ws';

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [transcription, setTranscription] = useState([]);
  const [status, setStatus] = useState('Initializing...');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingMode, setRecordingMode] = useState('live'); // 'live' or 'save'
  const [processingMode, setProcessingMode] = useState('realtime'); // 'realtime' or 'offline'
  const [savedVideos, setSavedVideos] = useState([]);
  const [sessionStats, setSessionStats] = useState({
    audioChunks: 0,
    videoFrames: 0,
    transcripts: 0,
    duration: '00:00'
  });
  const [recordingStartTime, setRecordingStartTime] = useState(null);
  const wsRef = useRef(null);
  const streamRef = useRef(null);  
  const videoRef = useRef(null);
  const audioContextRef = useRef(null);
  const durationInterval = useRef(null);
  const isRecordingRef = useRef(false);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

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
          const newTranscript = {
            id: Date.now(),
            text: data.data.text,
            timestamp: new Date().toLocaleTimeString(),
            confidence: data.data.confidence || 0.9
          };
          setTranscription(prev => [...prev, newTranscript]);
          setSessionStats(prev => ({ ...prev, transcripts: prev.transcripts + 1 }));
        } else if (data.type === 'session_stats') {
          setSessionStats(prev => ({ 
            ...prev, 
            audioChunks: data.data.audio_chunks || prev.audioChunks,
            videoFrames: data.data.video_frames || prev.videoFrames
          }));
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

  // Update recording duration
  useEffect(() => {
    if (isRecording && recordingStartTime) {
      durationInterval.current = setInterval(() => {
        if (isRecordingRef.current) {
          const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
          const minutes = Math.floor(elapsed / 60);
          const seconds = elapsed % 60;
          setSessionStats(prev => ({ 
            ...prev, 
            duration: `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
          }));
        }
      }, 1000);
    } else {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
    }
    return () => {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
    };
  }, [isRecording, recordingStartTime]);

  const setupMediaRecorder = (stream) => {
    try {
      const options = { mimeType: 'video/webm; codecs=vp9' };
      
      // Try different mime types if vp9 not supported
      let mediaRecorder;
      if (MediaRecorder.isTypeSupported(options.mimeType)) {
        mediaRecorder = new MediaRecorder(stream, options);
      } else if (MediaRecorder.isTypeSupported('video/webm')) {
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      } else {
        mediaRecorder = new MediaRecorder(stream);
      }

      recordedChunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
          console.log(`💾 Video chunk recorded: ${event.data.size} bytes`);
        }
      };

      mediaRecorder.onstop = () => {
        console.log('💾 MediaRecorder stopped, creating video file...');
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const videoUrl = URL.createObjectURL(blob);
        
        const videoData = {
          id: Date.now(),
          url: videoUrl,
          blob: blob,
          timestamp: new Date().toLocaleString(),
          size: blob.size,
          duration: sessionStats.duration,
          processed: false
        };

        setSavedVideos(prev => [videoData, ...prev]);
        console.log('✅ Video saved successfully:', videoData);
        
        // If save mode, offer to process the video
        if (recordingMode === 'save') {
          setStatus('✅ Video Saved - Ready to Process');
        }
      };

      mediaRecorder.start(1000); // Record in 1-second chunks
      console.log('💾 MediaRecorder started');
    } catch (error) {
      console.error('❌ Error setting up MediaRecorder:', error);
    }
  };

  const processVideoFile = async (videoData) => {
    try {
      console.log('🔄 Processing saved video for transcription...');
      setStatus('🔄 Processing Video for Transcription...');
      
      // Create a video element to extract audio
      const video = document.createElement('video');
      video.src = videoData.url;
      video.muted = true;
      
      // Wait for video to load
      await new Promise((resolve) => {
        video.onloadedmetadata = resolve;
      });

      // Create audio context for processing
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaElementSource(video);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      const transcripts = [];
      let audioChunks = 0;

      processor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        const audioData = Array.from(inputData);
        audioChunks++;

        // Send audio chunk for transcription
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'process_audio_chunk',
            data: {
              audio: audioData,
              sample_rate: audioContext.sampleRate,
              timestamp: Date.now(),
              video_id: videoData.id,
              chunk_id: audioChunks
            }
          }));
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      // Play video (muted) to trigger audio processing
      video.play();

      // Update video as processed
      setSavedVideos(prev => 
        prev.map(v => 
          v.id === videoData.id ? { ...v, processed: true, transcripts } : v
        )
      );

      setStatus('✅ Video Processing Complete');
    } catch (error) {
      console.error('❌ Error processing video:', error);
      setStatus('❌ Video Processing Error');
    }
  };

  const startRecording = async (captureMode = 'camera') => {
    try {
      console.log('🎬 Starting recording - Capture:', captureMode, 'Processing:', processingMode);
      
      let stream;
      if (captureMode === 'screen') {
        // Screen capture
        stream = await navigator.mediaDevices.getDisplayMedia({ 
          video: { 
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }, 
          audio: { 
            sampleRate: 16000,
            echoCancellation: true,
            noiseSuppression: true 
          }
        });
      } else {
        // Camera capture
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 640, height: 480 }, 
          audio: { 
            sampleRate: 16000,
            echoCancellation: true,
            noiseSuppression: true 
          }
        });
      }
      
      streamRef.current = stream;
      setIsRecording(true);
      isRecordingRef.current = true;
      setRecordingStartTime(Date.now());
      
      // Clear previous session data
      setTranscription([]);
      setSessionStats({
        audioChunks: 0,
        videoFrames: 0,
        transcripts: 0,
        duration: '00:00'
      });
      
      // Set up video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => console.log('Video play error:', e));
      }

      // Set up MediaRecorder for video saving (always)
      if (recordingMode === 'save' || recordingMode === 'both') {
        setupMediaRecorder(stream);
      }

      // Set status based on mode
      if (recordingMode === 'live') {
        setStatus(`🔴 Live Recording ${captureMode === 'screen' ? 'Screen' : 'Camera'}`);
      } else if (recordingMode === 'save') {
        setStatus(`💾 Saving Video ${captureMode === 'screen' ? 'Screen' : 'Camera'}`);
      } else {
        setStatus(`🔴💾 Recording & Saving ${captureMode === 'screen' ? 'Screen' : 'Camera'}`);
      }
      
      // Send start recording message to backend
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'start_recording',
          data: {
            mode: captureMode === 'screen' ? 'screen' : 'video_audio',
            recordingMode: recordingMode,
            processingMode: processingMode,
            timestamp: Date.now(),
            settings: {
              video: captureMode === 'screen' ? { width: 1280, height: 720 } : { width: 640, height: 480 },
              audio: { sampleRate: 16000 }
            }
          }
        }));
      }
      
      // Set up real-time processing only for live mode
      if (recordingMode === 'live' || recordingMode === 'both') {
        setupAudioProcessing(stream);
        setTimeout(() => setupVideoProcessing(stream), 1000);
      }
      
    } catch (error) {
      console.error('Error starting recording:', error);
      
      // If screen recording failed due to permission, try camera recording
      if (mode === 'screen' && (error.name === 'NotAllowedError' || error.name === 'NotSupportedError')) {
        console.log('🎥 Screen recording failed, trying camera recording...');
        setStatus('⚠️ Screen recording denied, using camera...');
        
        try {
          const cameraStream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 640, height: 480 }, 
            audio: { 
              sampleRate: 16000,
              echoCancellation: true,
              noiseSuppression: true 
            }
          });
          
          streamRef.current = cameraStream;
          setIsRecording(true);
          isRecordingRef.current = true;
          setRecordingStartTime(Date.now());
          setStatus('🔴 Recording Camera (Screen denied)');
          
          // Set up video element
          if (videoRef.current) {
            videoRef.current.srcObject = cameraStream;
            videoRef.current.play().catch(e => console.log('Video play error:', e));
          }
          
          // Send start recording message
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'start_recording',
              data: {
                mode: 'video_audio',
                timestamp: Date.now(),
                settings: {
                  video: { width: 640, height: 480 },
                  audio: { sampleRate: 16000 }
                }
              }
            }));
          }
          
          setupAudioProcessing(cameraStream);
          setTimeout(() => setupVideoProcessing(cameraStream), 1000);
          
        } catch (cameraError) {
          console.error('Camera recording also failed:', cameraError);
          setStatus('❌ Recording Error: ' + cameraError.message);
        }
      } else {
        setStatus('❌ Recording Error: ' + error.message);
      }
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

      // Create audio context with proper sample rate
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;

      console.log('🎤 Audio context created, sample rate:', audioContext.sampleRate);

      const source = audioContext.createMediaStreamSource(stream);
      
      // Use createScriptProcessor with proper connection
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      let chunkCount = 0;
      processor.onaudioprocess = (event) => {
        if (!isRecordingRef.current) {
          console.log('🎤 Skipping audio chunk - not recording');
          return;
        }

        chunkCount++;
        const inputData = event.inputBuffer.getChannelData(0);
        const audioData = Array.from(inputData);

        console.log(`🎤 Processing audio chunk ${chunkCount}, size: ${audioData.length}`);

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'audio_chunk',
            data: {
              audio: audioData,
              sample_rate: audioContext.sampleRate,
              timestamp: Date.now(),
              chunk_id: chunkCount
            }
          }));
          
          console.log(`✅ Sent audio chunk ${chunkCount} to backend`);
          
          // Update audio chunk count
          setSessionStats(prev => ({ ...prev, audioChunks: prev.audioChunks + 1 }));
        } else {
          console.warn('🎤 WebSocket not ready for audio transmission');
        }
      };

      // Connect the audio pipeline
      source.connect(processor);
      processor.connect(audioContext.destination);

      console.log('✅ Audio processing pipeline established with sample rate:', audioContext.sampleRate);
    } catch (error) {
      console.error('❌ Error setting up audio processing:', error);
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
      // Wait for video element to be ready
      const waitForVideo = () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          console.log('🎥 Waiting for video element to be ready...');
          setTimeout(waitForVideo, 100);
          return;
        }

        console.log('🎥 Video element ready:', {
          readyState: videoRef.current.readyState,
          videoWidth: videoRef.current.videoWidth,
          videoHeight: videoRef.current.videoHeight
        });

        // Create a canvas to capture video frames
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Set canvas size based on video dimensions
        const videoWidth = videoRef.current.videoWidth || 640;
        const videoHeight = videoRef.current.videoHeight || 480;
        canvas.width = videoWidth;
        canvas.height = videoHeight;
        
        console.log('✅ Video canvas created:', canvas.width, 'x', canvas.height);
        
        let frameNumber = 0;
        const captureVideoFrame = () => {
          if (!isRecordingRef.current || !videoRef.current) {
            console.log('🎥 Video capture STOPPED - recording:', isRecordingRef.current, 'videoRef:', !!videoRef.current);
            return;
          }
          
          try {
            // Check if video is still ready
            if (videoRef.current.readyState >= 2) {
              frameNumber++;
              
              // Draw video frame to canvas
              ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
              
              // Convert to base64 image data
              const frameData = canvas.toDataURL('image/jpeg', 0.8);
              
              console.log(`🎥 CAPTURING video frame ${frameNumber}, size: ${frameData.length} bytes`);
              
              // Send video frame to backend
              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                  type: 'video_stream',
                  data: {
                    frame: frameData,
                    timestamp: Date.now(),
                    frame_number: frameNumber,
                    width: canvas.width,
                    height: canvas.height
                  }
                }));
                
                console.log(`✅ Sent video frame ${frameNumber} to backend`);
                
                // Update video frame count
                setSessionStats(prev => ({ ...prev, videoFrames: prev.videoFrames + 1 }));
              } else {
                console.warn('🎥 WebSocket not ready for video transmission');
              }
            } else {
              console.log('🎥 Video not ready, readyState:', videoRef.current.readyState);
            }
          } catch (error) {
            console.error('❌ Error capturing video frame:', error);
          }
          
          // Continue capturing frames at 2 FPS
          if (isRecordingRef.current) {
            setTimeout(() => requestAnimationFrame(captureVideoFrame), 500);
          }
        };
        
        // Start video frame capture
        console.log('🎥 Starting video frame capture loop...');
        captureVideoFrame();
      };
      
      // Start waiting for video
      waitForVideo();
      console.log('✅ Video processing pipeline initialized');
      
    } catch (error) {
      console.error('❌ Error setting up video processing:', error);
    }
  };

  const stopRecording = () => {
    // Stop MediaRecorder if active
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      console.log('💾 Stopping MediaRecorder...');
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    
    if (durationInterval.current) {
      clearInterval(durationInterval.current);
    }
    
    setIsRecording(false);
    isRecordingRef.current = false;
    setRecordingStartTime(null);
    
    // Set status based on mode
    if (recordingMode === 'live') {
      setStatus('✅ Live Recording Saved - ASR Ready');
    } else if (recordingMode === 'save') {
      setStatus('✅ Video Saved - Ready to Process');
    } else {
      setStatus('✅ Recording & Video Saved - ASR Ready');
    }
    
    // Send stop recording message
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'stop_recording',
        data: {
          timestamp: Date.now(),
          session_stats: sessionStats,
          recordingMode: recordingMode
        }
      }));
    }
  };

  return (
    <div className="app">
      <div className="header">
        <div className="header-content">
          <div className="header-left">
            <h1 className="header-title">🎯 Meeting Monitor</h1>
            <p className="header-subtitle">Real-time Audio & Video Recording with AI Transcription</p>
          </div>
          <div className="header-right">
            <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
              <div className="status-indicator">
                {isConnected ? '🟢' : '🔴'}
              </div>
              <div className="status-text">
                <div className="status-title">{isConnected ? 'Connected' : 'Disconnected'}</div>
                <div className="status-subtitle">{status}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="main-content">
        <div className="left-panel">
          {/* Video Section */}
          <div className="video-section">
            <div className="section-header">
              <h3>📹 Video Feed</h3>
              {isRecording && (
                <div className="recording-indicator">
                  <div className="pulse-dot"></div>
                  <span>REC</span>
                </div>
              )}
            </div>
            <div className="video-container">
              <video 
                ref={videoRef} 
                autoPlay 
                muted 
                className="video-preview"
                style={{ 
                  width: '100%', 
                  maxWidth: '640px',
                  height: 'auto',
                  borderRadius: '12px',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
                }}
              />
              {!isRecording && (
                <div className="video-placeholder">
                  <div className="placeholder-content">
                    <div className="placeholder-icon">📹</div>
                    <p>Click "Start Recording" to begin</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Recording Mode Selection */}
          {!isRecording && (
            <div className="mode-selection-section">
              <h4>🎯 Recording Mode</h4>
              <div className="mode-buttons">
                <button 
                  onClick={() => setRecordingMode('live')}
                  className={`mode-button ${recordingMode === 'live' ? 'active' : ''}`}
                >
                  <div className="mode-icon">🔴</div>
                  <div className="mode-text">
                    <div className="mode-title">Live Transcription</div>
                    <div className="mode-subtitle">Real-time transcription during recording</div>
                  </div>
                </button>
                
                <button 
                  onClick={() => setRecordingMode('save')}
                  className={`mode-button ${recordingMode === 'save' ? 'active' : ''}`}
                >
                  <div className="mode-icon">💾</div>
                  <div className="mode-text">
                    <div className="mode-title">Save & Process</div>
                    <div className="mode-subtitle">Save video first, then apply transcription</div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="controls-section">
            {!isRecording ? (
              <div className="recording-options">
                <button 
                  onClick={() => startRecording('camera')}
                  className="record-button ready"
                  disabled={!isConnected}
                >
                  <div className="button-icon">📹</div>
                  <div className="button-text">
                    <div className="button-title">Camera Recording</div>
                    <div className="button-subtitle">
                      {recordingMode === 'live' ? 'Live transcription' : 'Save & process later'}
                    </div>
                  </div>
                </button>
                
                <button 
                  onClick={() => startRecording('screen')}
                  className="record-button ready screen-record"
                  disabled={!isConnected}
                >
                  <div className="button-icon">🖥️</div>
                  <div className="button-text">
                    <div className="button-title">Screen Recording</div>
                    <div className="button-subtitle">
                      {recordingMode === 'live' ? 'Live transcription' : 'Save & process later'}
                    </div>
                  </div>
                </button>
              </div>
            ) : (
              <button 
                onClick={stopRecording}
                className="record-button recording"
                disabled={!isConnected}
              >
                <div className="button-icon">⏹️</div>
                <div className="button-text">
                  <div className="button-title">Stop Recording</div>
                  <div className="button-subtitle">Recording for {sessionStats.duration}</div>
                </div>
              </button>
            )}
          </div>

          {/* Session Stats */}
          {isRecording && (
            <div className="stats-section">
              <h4>📊 Recording Statistics</h4>
              <div className="stats-grid">
                <div className="stat-item">
                  <div className="stat-value">{sessionStats.audioChunks}</div>
                  <div className="stat-label">Audio Chunks</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{sessionStats.videoFrames}</div>
                  <div className="stat-label">Video Frames</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{sessionStats.transcripts}</div>
                  <div className="stat-label">Transcriptions</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{sessionStats.duration}</div>
                  <div className="stat-label">Duration</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="right-panel">
          {/* Live Transcription */}
          <div className="transcription-section">
            <div className="section-header">
              <h3>📝 Live Transcription</h3>
              {transcription.length > 0 && (
                <button 
                  className="clear-button"
                  onClick={() => setTranscription([])}
                >
                  Clear
                </button>
              )}
            </div>
            <div className="transcription-container">
              {transcription.length === 0 ? (
                <div className="transcription-placeholder">
                  <div className="placeholder-icon">🎤</div>
                  <p>Start speaking to see live transcription</p>
                  <p className="placeholder-subtitle">Powered by OpenAI Whisper</p>
                </div>
              ) : (
                <div className="transcription-list">
                  {transcription.map((item) => (
                    <div key={item.id} className="transcription-item">
                      <div className="transcript-header">
                        <span className="transcript-time">{item.timestamp}</span>
                        <span className="transcript-confidence">
                          {Math.round(item.confidence * 100)}%
                        </span>
                      </div>
                      <div className="transcript-text">{item.text}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Saved Videos */}
          {savedVideos.length > 0 && (
            <div className="saved-videos-section">
              <h4>💾 Saved Videos</h4>
              <div className="saved-videos-list">
                {savedVideos.map((video) => (
                  <div key={video.id} className="saved-video-item">
                    <div className="video-info">
                      <div className="video-header">
                        <span className="video-timestamp">{video.timestamp}</span>
                        <span className="video-size">{(video.size / 1024 / 1024).toFixed(1)} MB</span>
                      </div>
                      <div className="video-details">
                        <span>Duration: {video.duration}</span>
                        <span className={`process-status ${video.processed ? 'processed' : 'pending'}`}>
                          {video.processed ? '✅ Processed' : '⏳ Pending'}
                        </span>
                      </div>
                    </div>
                    <div className="video-actions">
                      <button 
                        onClick={() => window.open(video.url, '_blank')}
                        className="action-button view"
                      >
                        👁️ View
                      </button>
                      <button 
                        onClick={() => {
                          const a = document.createElement('a');
                          a.href = video.url;
                          a.download = `recording_${video.timestamp.replace(/[:/\s]/g, '_')}.webm`;
                          a.click();
                        }}
                        className="action-button download"
                      >
                        📥 Download
                      </button>
                      {!video.processed && (
                        <button 
                          onClick={() => processVideoFile(video)}
                          className="action-button process"
                        >
                          🔄 Process
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* System Info */}
          <div className="system-info">
            <h4>🔧 System Status</h4>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">WebSocket:</span>
                <span className={`info-value ${isConnected ? 'success' : 'error'}`}>
                  {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Recording:</span>
                <span className={`info-value ${isRecording ? 'recording' : 'idle'}`}>
                  {isRecording ? '🔴 Active' : '⚪ Idle'}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Recording Mode:</span>
                <span className="info-value">
                  {recordingMode === 'live' ? '🔴 Live' : '💾 Save & Process'}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Backend:</span>
                <span className="info-value">localhost:8000</span>
              </div>
              <div className="info-item">
                <span className="info-label">ASR Model:</span>
                <span className="info-value">Whisper Tiny</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

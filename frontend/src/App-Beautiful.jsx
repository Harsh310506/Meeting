import React, { useState, useRef, useEffect } from 'react';
import { io } from 'socket.io-client';

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-3xl font-bold text-gray-900">Meeting Monitor</h1>
                <p className="text-sm text-gray-500 mt-1">AI-Powered Meeting Analysis</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
                <span className="text-sm text-gray-600">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              
              {storageEnabled && (
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-blue-400"></div>
                  <span className="text-sm text-gray-600">Storage Enabled</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column - Controls & Video */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Recording Controls */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Recording Controls</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Capture Mode
                  </label>
                  <select
                    value={captureMode}
                    onChange={(e) => setCaptureMode(e.target.value)}
                    disabled={isRecording}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="screen">🖥️ Screen + System Audio (for meetings)</option>
                    <option value="camera">📷 Camera + Microphone</option>
                    <option value="system-audio">🔊 System Audio Only</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-700">
                      Data Flow: Audio: {dataFlowStatus.audio} | Video: {dataFlowStatus.video}
                    </div>
                    {recordingStatus && (
                      <div className="text-xs text-gray-500 mt-1">{recordingStatus}</div>
                    )}
                  </div>
                  
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={!isConnected}
                    className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 transform hover:scale-105 ${
                      isRecording
                        ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg'
                    } disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
                  >
                    {isRecording ? '⏹️ Stop Recording' : '🎬 Start Recording'}
                  </button>
                </div>
              </div>
            </div>

            {/* Video Preview */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                {captureMode === 'screen' ? '🖥️ Screen Preview' : 
                 captureMode === 'system-audio' ? '🔊 Audio Only Mode' : '📷 Camera Preview'}
              </h2>
              
              {captureMode !== 'system-audio' ? (
                <div className="relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    className="w-full h-64 lg:h-80 bg-gray-900 rounded-lg object-cover"
                  />
                  {!isRecording && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50 rounded-lg">
                      <div className="text-white text-center">
                        <div className="text-4xl mb-2">📹</div>
                        <div>Click "Start Recording" to begin</div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-64 lg:h-80 bg-gradient-to-br from-purple-400 to-pink-400 rounded-lg flex items-center justify-center">
                  <div className="text-white text-center">
                    <div className="text-6xl mb-4">🎵</div>
                    <div className="text-xl font-semibold">Audio Only Mode</div>
                    <div className="text-sm opacity-90 mt-2">System audio will be captured</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Live Analysis */}
          <div className="space-y-6">
            
            {/* Live Captions */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">🗣️ Live Captions</h2>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {captions.map((caption) => (
                  <div key={caption.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs text-gray-500">{caption.timestamp}</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        caption.sentiment === 'positive' ? 'bg-green-100 text-green-800' :
                        caption.sentiment === 'negative' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {caption.sentiment}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{caption.text}</p>
                    <div className="text-xs text-blue-600 mt-1">{caption.source}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Insights */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">🤖 AI Insights</h2>
              <div className="space-y-3">
                {insights.map((insight) => (
                  <div key={insight.id} className="p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-blue-600 text-sm font-medium capitalize">
                        {insight.type.replace('-', ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{insight.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Recording Status */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">📊 Session Status</h2>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Recording Status</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    isRecording ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {isRecording ? '🔴 Recording' : '⭕ Inactive'}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Capture Mode</span>
                  <span className="text-sm font-medium text-gray-900">
                    {captureMode === 'screen' ? '🖥️ Screen + Audio' :
                     captureMode === 'system-audio' ? '🔊 System Audio' : '📷 Camera + Mic'}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Backend Connection</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {isConnected ? '✅ Connected' : '❌ Disconnected'}
                  </span>
                </div>

                {storageEnabled && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Storage</span>
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      ✅ Enabled
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Instructions Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Quick Start Guide</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-gray-600">
              <div className="flex items-center justify-center space-x-2">
                <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded">1</span>
                <span>Select your capture mode</span>
              </div>
              <div className="flex items-center justify-center space-x-2">
                <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded">2</span>
                <span>Click "Start Recording"</span>
              </div>
              <div className="flex items-center justify-center space-x-2">
                <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded">3</span>
                <span>Grant permissions & check "Share system audio"</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;

import React, { useState, useRef, useEffect } from 'react';
import './MeetingMonitor.css';

// Generate unique client ID
const CLIENT_ID = `client_${Math.random().toString(36).substr(2, 9)}`;

// WebSocket connection URL - Fixed to match backend endpoint
const BACKEND_URL = `ws://localhost:8000/ws`;

const MeetingMonitor = () => {
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
  const [sessionData, setSessionData] = useState(null);
  const [showTranscriptResults, setShowTranscriptResults] = useState(false);
  
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
      console.log('🆕 NEW WEBSOCKET CONNECTION ATTEMPT to:', BACKEND_URL);
      console.log('🔥 FRESH CODE LOADED - No more Socket.IO!');
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
        
        // Store complete session data for transcript display
        setSessionData(data);
        setShowTranscriptResults(true);
        
        if (data.summary) {
          setInsights(prev => [...prev, {
            type: 'session_summary',
            content: data.summary,
            timestamp: new Date().toLocaleTimeString(),
            icon: '📊'
          }]);
        }
        break;

      case 'transcript':
        const transcriptInsight = {
          type: 'transcript',
          content: data.text,
          timestamp: new Date().toLocaleTimeString(),
          confidence: data.confidence || 0,
          speaker: data.speaker || 'Unknown',
          icon: '💬'
        };
        
        setCaptions(prev => [...prev.slice(-4), transcriptInsight]);
        setTranscriptCount(prev => prev + 1);
        
        // Add to insights if significant
        if (data.text.length > 10) {
          setInsights(prev => [...prev.slice(-9), transcriptInsight]);
        }
        break;

      case 'enhanced_analysis':
        if (data.sentiment) {
          setInsights(prev => [...prev.slice(-9), {
            type: 'sentiment',
            content: `Overall: ${data.sentiment.overall_sentiment} (${(data.sentiment.confidence * 100).toFixed(1)}%)`,
            details: data.sentiment,
            timestamp: new Date().toLocaleTimeString(),
            icon: data.sentiment.overall_sentiment === 'positive' ? '😊' : 
                  data.sentiment.overall_sentiment === 'negative' ? '😔' : '😐'
          }]);
        }

        if (data.tasks && data.tasks.length > 0) {
          data.tasks.forEach(task => {
            setInsights(prev => [...prev.slice(-9), {
              type: 'task',
              content: task.task,
              priority: task.priority,
              deadline: task.deadline,
              timestamp: new Date().toLocaleTimeString(),
              icon: '✅'
            }]);
          });
        }

        if (data.keywords && data.keywords.length > 0) {
          setInsights(prev => [...prev.slice(-9), {
            type: 'keywords',
            content: `Key topics: ${data.keywords.slice(0, 5).join(', ')}`,
            timestamp: new Date().toLocaleTimeString(),
            icon: '🔑'
          }]);
        }
        break;

      case 'data_flow':
        setDataFlowStatus({
          audio: data.audio_chunks || 0,
          video: data.video_frames || 0
        });
        break;

      default:
        console.log('Unknown message type:', type, data);
    }
  };

  const startRecording = async () => {
    try {
      let stream;
      
      if (captureMode === 'screen') {
        // Screen + audio capture
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { width: 1280, height: 720 },
          audio: { 
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 16000
          }
        });
      } else {
        // Camera + microphone
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
          audio: { 
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 16000
          }
        });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Start audio processing
      await startAudioProcessing(stream);
      
      // Start video processing
      if (captureMode !== 'audio') {
        startVideoProcessing();
      }

      setIsRecording(true);
      isRecordingRef.current = true;
      setRecordingStatus('Recording...');

      // Send start recording message
      if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
        websocketRef.current.send(JSON.stringify({
          type: 'start_recording',
          data: { 
            capture_mode: captureMode,
            storage_enabled: storageEnabled
          }
        }));
      }

    } catch (error) {
      console.error('Error starting recording:', error);
      setRecordingStatus('Error: Could not access media devices');
    }
  };

  const stopRecording = () => {
    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    // Clean up audio processing
    if (processorRef.current) {
      processorRef.current.disconnect();
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }

    // Clean up video processing
    if (videoIntervalRef.current) {
      clearInterval(videoIntervalRef.current);
    }

    setIsRecording(false);
    isRecordingRef.current = false;
    setRecordingStatus('Stopped');

    // Send stop recording message
    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
      websocketRef.current.send(JSON.stringify({
        type: 'stop_recording',
        data: {}
      }));
    }
  };

  const startAudioProcessing = async (stream) => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    audioContextRef.current = audioContext;

    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    processor.onaudioprocess = (event) => {
      if (!isRecordingRef.current || !websocketRef.current || websocketRef.current.readyState !== WebSocket.OPEN) {
        return;
      }

      const inputBuffer = event.inputBuffer.getChannelData(0);
      const audioData = new Float32Array(inputBuffer);

      // Send audio data to backend
      websocketRef.current.send(JSON.stringify({
        type: 'audio_data',
        data: {
          audio: Array.from(audioData),
          sample_rate: 16000
        }
      }));
    };

    source.connect(processor);
    processor.connect(audioContext.destination);
  };

  const startVideoProcessing = () => {
    videoIntervalRef.current = setInterval(() => {
      if (!isRecordingRef.current || !videoRef.current || !websocketRef.current || websocketRef.current.readyState !== WebSocket.OPEN) {
        return;
      }

      try {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 640;
        canvas.height = 480;

        context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const imageData = canvas.toDataURL('image/jpeg', 0.7);

        // Send video frame to backend
        websocketRef.current.send(JSON.stringify({
          type: 'video_frame',
          data: {
            image: imageData,
            timestamp: Date.now(),
            width: canvas.width,
            height: canvas.height
          }
        }));

      } catch (error) {
        console.error('Error processing video frame:', error);
      }
    }, 1000); // Send frame every second
  };

  const clearData = () => {
    setCaptions([]);
    setInsights([]);
    setTranscriptCount(0);
    setRecordingStatus('');
    setSessionData(null);
    setShowTranscriptResults(false);
  };

  return (
    <div className="meeting-monitor-page">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="title-section">
            <h1 className="title">🎙️ Meeting Monitor</h1>
            <p className="subtitle">AI-Powered Real-time Meeting Analysis</p>
          </div>
          
          <div className="status-section">
            <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
              <span className="status-dot"></span>
              <span className="status-text">{asrStatus}</span>
            </div>
            <div className="data-flow">
              <span>📊 Audio: {dataFlowStatus.audio} | Video: {dataFlowStatus.video}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="meeting-main-content">
        {/* Left Panel - Controls */}
        <div className="left-panel">
          <div className="control-panel">
            <h3>🎛️ Capture Settings</h3>
            
            <div className="capture-mode-section">
              <label>Capture Mode:</label>
              <div className="mode-selector">
                <button 
                  className={`mode-btn ${captureMode === 'screen' ? 'active' : ''}`}
                  onClick={() => setCaptureMode('screen')}
                >
                  🖥️ Screen + Audio
                </button>
                <button 
                  className={`mode-btn ${captureMode === 'camera' ? 'active' : ''}`}
                  onClick={() => setCaptureMode('camera')}
                >
                  📹 Camera + Mic
                </button>
                <button 
                  className={`mode-btn ${captureMode === 'audio' ? 'active' : ''}`}
                  onClick={() => setCaptureMode('audio')}
                >
                  🎤 Audio Only
                </button>
              </div>
            </div>

            <div className="storage-section">
              <label className="storage-toggle">
                <input 
                  type="checkbox" 
                  checked={storageEnabled}
                  onChange={(e) => setStorageEnabled(e.target.checked)}
                />
                <span>💾 Save Recording</span>
              </label>
            </div>

            <div className="recording-controls">
              {!isRecording ? (
                <button 
                  className="record-btn start"
                  onClick={startRecording}
                  disabled={!isConnected}
                >
                  ▶️ Start Recording
                </button>
              ) : (
                <button 
                  className="record-btn stop"
                  onClick={stopRecording}
                >
                  ⏹️ Stop Recording
                </button>
              )}
              
              <button 
                className="clear-btn"
                onClick={clearData}
              >
                🗑️ Clear Data
              </button>
            </div>

            {recordingStatus && (
              <div className="recording-status">
                <span>📊 {recordingStatus}</span>
              </div>
            )}
          </div>

          {/* Video Preview */}
          {captureMode !== 'audio' && (
            <div className="video-section">
              <h3>📹 Video Preview</h3>
              <video 
                ref={videoRef}
                autoPlay 
                muted 
                className="video-preview"
              />
            </div>
          )}
        </div>

        {/* Right Panel - Analysis */}
        <div className="right-panel">
          {/* Transcript Results Section - Shows after recording stops */}
          {showTranscriptResults && sessionData && (
            <div className="transcript-results-section">
              <div className="transcript-results-header">
                <h3>📄 Complete Meeting Transcript & Analysis</h3>
                <button 
                  className="hide-results-btn"
                  onClick={() => setShowTranscriptResults(false)}
                >
                  ✕ Hide Results
                </button>
              </div>
              
              <div className="transcript-tabs">
                <div className="transcript-tab-container">
                  {/* Original Transcript */}
                  <div className="transcript-tab">
                    <h4>📝 Original Transcript</h4>
                    <div className="transcript-content original">
                      <div className="transcript-meta">
                        <span>Session: {sessionData.session_id}</span>
                        <span>Duration: {sessionData.complete_transcripts?.session_stats?.duration}</span>
                        <span>Segments: {sessionData.complete_transcripts?.valid_transcript_count || 0}</span>
                      </div>
                      <div className="transcript-text">
                        {sessionData.enhanced_transcript_analysis?.['1_original_transcript'] || 'No original transcript available'}
                      </div>
                    </div>
                  </div>

                  {/* Formatted Transcript */}
                  <div className="transcript-tab">
                    <h4>📋 Formatted Transcript</h4>
                    <div className="transcript-content formatted">
                      <pre className="transcript-text formatted-text">
                        {sessionData.enhanced_transcript_analysis?.['2_combined_transcript'] || 'No formatted transcript available'}
                      </pre>
                    </div>
                  </div>

                  {/* Enhanced Analysis */}
                  <div className="transcript-tab">
                    <h4>🧠 Enhanced Analysis</h4>
                    <div className="transcript-content enhanced">
                      <div className="analysis-text">
                        <pre>
                          {sessionData.enhanced_transcript_analysis?.['3_enhanced_analysis_paragraph'] || 'Enhanced analysis not available'}
                        </pre>
                      </div>
                      {sessionData.enhanced_transcript_analysis?.analysis_data && (
                        <div className="analysis-details">
                          <h5>🔍 Detailed Analysis Data:</h5>
                          <div className="analysis-categories">
                            {sessionData.enhanced_transcript_analysis.analysis_data.entities && (
                              <div className="analysis-category">
                                <strong>📍 Entities:</strong>
                                <ul>
                                  {sessionData.enhanced_transcript_analysis.analysis_data.entities.slice(0, 5).map((entity, idx) => (
                                    <li key={idx}>{entity.text} ({entity.label})</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {sessionData.enhanced_transcript_analysis.analysis_data.keywords && (
                              <div className="analysis-category">
                                <strong>🔑 Keywords:</strong>
                                <span>{sessionData.enhanced_transcript_analysis.analysis_data.keywords.slice(0, 8).join(', ')}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sentiment Analysis */}
                  <div className="transcript-tab">
                    <h4>🎭 Sentiment Analysis</h4>
                    <div className="transcript-content sentiment">
                      <div className="sentiment-overview">
                        {sessionData.enhanced_transcript_analysis?.sentiment_data && (
                          <div className="sentiment-metrics">
                            <div className="sentiment-main">
                              <span className="sentiment-label">Overall Sentiment:</span>
                              <span className={`sentiment-value ${sessionData.enhanced_transcript_analysis.sentiment_data.overall_sentiment?.toLowerCase()}`}>
                                {sessionData.enhanced_transcript_analysis.sentiment_data.overall_sentiment}
                                {sessionData.enhanced_transcript_analysis.sentiment_data.overall_sentiment === 'POSITIVE' ? ' 😊' : 
                                 sessionData.enhanced_transcript_analysis.sentiment_data.overall_sentiment === 'NEGATIVE' ? ' 😔' : ' 😐'}
                              </span>
                              <span className="sentiment-confidence">
                                ({(sessionData.enhanced_transcript_analysis.sentiment_data.overall_confidence * 100).toFixed(1)}%)
                              </span>
                            </div>
                            {sessionData.enhanced_transcript_analysis.sentiment_data.statistics && (
                              <div className="sentiment-stats">
                                <div className="stat-item">
                                  <span>😊 Positive: {sessionData.enhanced_transcript_analysis.sentiment_data.statistics.positive_sentences || 0}</span>
                                </div>
                                <div className="stat-item">
                                  <span>😔 Negative: {sessionData.enhanced_transcript_analysis.sentiment_data.statistics.negative_sentences || 0}</span>
                                </div>
                                <div className="stat-item">
                                  <span>😐 Neutral: {sessionData.enhanced_transcript_analysis.sentiment_data.statistics.neutral_sentences || 0}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="sentiment-text">
                        <pre>
                          {sessionData.enhanced_transcript_analysis?.['4_sentiment_analysis_paragraph'] || 'Sentiment analysis not available'}
                        </pre>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Live Captions */}
          <div className="captions-section">
            <h3>💬 Live Captions ({transcriptCount} transcripts)</h3>
            <div className="captions-container">
              {captions.length === 0 ? (
                <div className="empty-state">
                  <p>🎤 Start recording to see live captions...</p>
                </div>
              ) : (
                captions.map((caption, index) => (
                  <div key={index} className="caption-item">
                    <div className="caption-header">
                      <span className="caption-speaker">{caption.speaker}</span>
                      <span className="caption-time">{caption.timestamp}</span>
                      {caption.confidence > 0 && (
                        <span className="caption-confidence">
                          {(caption.confidence * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                    <div className="caption-text">{caption.content}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* AI Insights */}
          <div className="insights-section">
            <h3>🧠 AI Insights</h3>
            <div className="insights-container">
              {insights.length === 0 ? (
                <div className="empty-state">
                  <p>🤖 AI insights will appear here during the meeting...</p>
                </div>
              ) : (
                insights.map((insight, index) => (
                  <div key={index} className={`insight-item ${insight.type}`}>
                    <div className="insight-header">
                      <span className="insight-icon">{insight.icon}</span>
                      <span className="insight-type">{insight.type.replace('_', ' ')}</span>
                      <span className="insight-time">{insight.timestamp}</span>
                    </div>
                    <div className="insight-content">
                      {insight.content}
                      {insight.priority && (
                        <span className={`priority-badge ${insight.priority}`}>
                          {insight.priority}
                        </span>
                      )}
                      {insight.deadline && (
                        <span className="deadline-badge">Due: {insight.deadline}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MeetingMonitor;
import React, { useState, useRef, useEffect } from 'react';

// Use WebSocket to match main_consolidated.py endpoint
const WS_URL = 'ws://localhost:8000/ws';

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [captions, setCaptions] = useState([
    // Sample data to match the UI with unique IDs
    {
      id: `sample_${Date.now()}_1`,
      text: "I'm doing fine Harsh. How are you doing these days?",
      timestamp: new Date().getTime(),
      confidence: 90,
      time: "12:02:49 PM"
    },
    {
      id: `sample_${Date.now()}_2`,
      text: "Yeah, same from my side. My exam also just ended. We have a lot of work pending",
      timestamp: new Date().getTime() - 60000,
      confidence: 90,
      time: "12:03:28 PM"
    },
    {
      id: `sample_${Date.now()}_3`,
      text: "and we have to do that right",
      timestamp: new Date().getTime() - 120000,
      confidence: 90,
      time: "12:03:59 PM"
    },
    {
      id: `sample_${Date.now()}_4`,
      text: "oh that's a lot let's finish this this week together",
      timestamp: new Date().getTime() - 180000,
      confidence: 90,
      time: "12:04:36 PM"
    }
  ]);
  const [recordingMode, setRecordingMode] = useState('live');
  const [currentMode, setCurrentMode] = useState(null);
  const [audioChunkCount, setAudioChunkCount] = useState(0);
  const [videoFrameCount, setVideoFrameCount] = useState(0);
  const [microphoneActive, setMicrophoneActive] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [audioSources, setAudioSources] = useState({ system: false, microphone: false });
  
  // Session and transcript management
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [sessionTranscripts, setSessionTranscripts] = useState([]);
  const [sessionStats, setSessionStats] = useState(null);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [showTranscriptViewer, setShowTranscriptViewer] = useState(false);
  const [transcriptSearchQuery, setTranscriptSearchQuery] = useState('');
  const [transcriptViewMode, setTranscriptViewMode] = useState('extracted'); // 'extracted' or 'detailed' - default to extracted
  
  // Video upload states
  const [uploadedVideo, setUploadedVideo] = useState(null);
  const [isProcessingVideo, setIsProcessingVideo] = useState(false);
  const [videoProcessingProgress, setVideoProcessingProgress] = useState(0);
  const [videoTranscript, setVideoTranscript] = useState(null);
  const [showVideoUpload, setShowVideoUpload] = useState(false);
  
  // Enhanced Analysis states
  const [enhancedAnalysis, setEnhancedAnalysis] = useState(null);
  const [originalTranscript, setOriginalTranscript] = useState('');
  const [combinedTranscript, setCombinedTranscript] = useState('');
  const [enhancedSummary, setEnhancedSummary] = useState('');
  
  // Sentiment Analysis states
  const [sentimentAnalysis, setSentimentAnalysis] = useState(null);
  const [sentimentSummary, setSentimentSummary] = useState('');
  
  const fileInputRef = useRef(null);
  const socketRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const isRecordingRef = useRef(false);

  useEffect(() => {
    connectWebSocket();
    
    // Add click handler to enable audio context (required by browser policy)
    const enableAudio = () => {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().then(() => {
          console.log('✅ Audio context resumed');
        });
      }
    };
    
    document.addEventListener('click', enableAudio);
    document.addEventListener('touchstart', enableAudio);
    
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
      document.removeEventListener('click', enableAudio);
      document.removeEventListener('touchstart', enableAudio);
    };
  }, []);

  const connectWebSocket = () => {
    socketRef.current = new WebSocket(WS_URL);
    
    socketRef.current.onopen = () => {
      setIsConnected(true);
      console.log('🟢 WebSocket connected');
      
      socketRef.current.send(JSON.stringify({
        type: 'handshake',
        client_id: 'modern_ui_' + Date.now()
      }));
    };

    socketRef.current.onclose = () => {
      setIsConnected(false);
      console.log('🔴 WebSocket disconnected');
      
      setTimeout(() => {
        if (!isConnected) {
          connectWebSocket();
        }
      }, 3000);
    };

    socketRef.current.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
    };

    socketRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 Received from backend:', data);
        
        switch (data.type) {
          case 'transcript':
            handleNewTranscript(data);
            break;
          case 'recording_started':
            handleRecordingStarted(data.data);
            break;
          case 'recording_stopped':
            handleRecordingStopped(data.data);
            break;
          case 'status':
            console.log('📊 Backend status:', data.message);
            break;
          case 'error':
            console.error('❌ Backend error:', data.message);
            break;
          default:
            console.log('📥 Unknown message type:', data.type, data);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error, event.data);
      }
    };
  };

  const handleNewTranscript = (message) => {
    console.log('🎯 Processing transcript:', message);
    
    // Extract transcript data from the message structure
    const transcriptData = message.data || message;
    const text = transcriptData.text || '';
    const labeledText = transcriptData.labeled_text || text;
    const speaker = transcriptData.speaker || 'unknown';
    const confidence = transcriptData.confidence || 0.9;
    
    if (text.trim()) {
      // Generate unique ID using timestamp and random number to avoid duplicates
      const uniqueId = Date.now() + Math.random() * 1000;
      
      const newCaption = {
        id: uniqueId,
        text: labeledText.trim(), // Use labeled text with speaker prefix
        originalText: text.trim(), // Keep original for duplicate checking
        speaker: speaker,
        timestamp: transcriptData.timestamp || Date.now(),
        confidence: Math.floor(confidence * 100),
        time: new Date().toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          second: '2-digit',
          hour12: true 
        })
      };
      
      // Check if this transcript is a duplicate (same original text within 3 seconds)
      setCaptions(prev => {
        const isDuplicate = prev.some(caption => 
          caption.originalText === newCaption.originalText && 
          caption.speaker === newCaption.speaker &&
          Math.abs(caption.timestamp - newCaption.timestamp) < 3000
        );
        
        if (isDuplicate) {
          console.log('🔄 Duplicate transcript ignored:', text);
          return prev;
        }
        
        console.log('✅ Adding new caption:', newCaption);
        return [newCaption, ...prev.slice(0, 9)];
      });
    }
  };

  const handleRecordingStarted = (data) => {
    console.log('🎬 New recording session started:', {
      sessionId: data.session_id,
      captureMode: data.capture_mode,
      recordingType: data.recording_type,
      asrEnabled: data.asr_enabled
    });
    
    setCurrentSessionId(data.session_id);
    setSessionCompleted(false);
    setSessionTranscripts([]);
    setSessionStats(null);
    setShowTranscriptViewer(false);
    
    // Show user feedback about new session
    if (data.recording_type) {
      console.log(`✅ Started ${data.recording_type} recording session: ${data.session_id}`);
    }
  };

  const handleRecordingStopped = (data) => {
    console.log('⏹️ Recording stopped:', data);
    
    // Handle the complete transcripts data
    if (data.complete_transcripts) {
      setSessionTranscripts(data.complete_transcripts.transcripts || []);
      setSessionStats(data.complete_transcripts.session_stats || null);
      setSessionCompleted(true);
      setShowTranscriptViewer(true);
      
      console.log('📝 Session transcripts loaded:', {
        count: data.complete_transcripts.total_count,
        sessionId: data.session_id
      });
    }
    
    // Handle the enhanced transcript analysis data
    if (data.enhanced_transcript_analysis) {
      const enhancedData = data.enhanced_transcript_analysis;
      setOriginalTranscript(enhancedData['1_original_transcript'] || '');
      setCombinedTranscript(enhancedData['2_combined_transcript'] || '');
      setEnhancedSummary(enhancedData['3_enhanced_analysis_paragraph'] || '');
      setEnhancedAnalysis(enhancedData.analysis_data || null);
      
      // Handle sentiment analysis data
      setSentimentSummary(enhancedData['4_sentiment_analysis_paragraph'] || '');
      setSentimentAnalysis(enhancedData.sentiment_data || null);
      
      console.log('🧠 Enhanced analysis loaded:', {
        originalLength: enhancedData['1_original_transcript']?.length || 0,
        combinedLength: enhancedData['2_combined_transcript']?.length || 0,
        summaryLength: enhancedData['3_enhanced_analysis_paragraph']?.length || 0,
        sentimentLength: enhancedData['4_sentiment_analysis_paragraph']?.length || 0,
        analysisStatus: enhancedData.analysis_status,
        sentimentStatus: enhancedData.sentiment_status
      });
    }
  };

  const exportTranscripts = () => {
    if (sessionTranscripts.length === 0) {
      alert('No transcripts to export');
      return;
    }

    // Create session information header
    const header = [
      `Session Transcript Report`,
      `=========================`,
      `Session ID: ${currentSessionId}`,
      `Generated: ${new Date().toLocaleString()}`,
      `View Mode: ${transcriptViewMode === 'extracted' ? 'Extracted Transcript' : transcriptViewMode === 'enhanced' ? 'Enhanced Analysis' : 'Detailed Transcript'}`,
      `Total Transcripts: ${sessionTranscripts.length}`,
      sessionStats?.duration ? `Duration: ${sessionStats.duration}` : '',
      sessionStats?.speakers ? `Speakers: ${sessionStats.speakers.join(', ')}` : '',
      sessionStats?.confidence_average ? `Average Confidence: ${Math.round(sessionStats.confidence_average * 100)}%` : '',
      ``,
      `${transcriptViewMode === 'extracted' ? 'Extracted Transcript:' : transcriptViewMode === 'enhanced' ? 'Enhanced Analysis Report:' : 'Detailed Transcript Content:'}`,
      `${'='.repeat(transcriptViewMode === 'extracted' ? 20 : transcriptViewMode === 'enhanced' ? 25 : 27)}`,
      ``
    ].filter(line => line !== '').join('\n');

    let exportContent;
    
    if (transcriptViewMode === 'extracted') {
      // Export as extracted paragraph
      exportContent = generateExtractedTranscript(sessionTranscripts);
    } else if (transcriptViewMode === 'enhanced') {
      // Export enhanced analysis
      if (enhancedAnalysis) {
        let enhancedContent = '';
        
        // Add enhanced transcript
        if (combinedTranscript || enhancedAnalysis.enhanced_transcript) {
          enhancedContent += 'ENHANCED TRANSCRIPT:\n';
          enhancedContent += '===================\n';
          enhancedContent += (combinedTranscript || enhancedAnalysis.enhanced_transcript).replace(/<[^>]*>/g, '') + '\n\n';
        }
        
        // Add key insights
        if (enhancedSummary) {
          enhancedContent += 'KEY INSIGHTS:\n';
          enhancedContent += '=============\n';
          enhancedContent += enhancedSummary + '\n\n';
        }
        
        // Add jargon definitions
        if (enhancedAnalysis.jargon_definitions && Object.keys(enhancedAnalysis.jargon_definitions).length > 0) {
          enhancedContent += 'JARGON & DEFINITIONS:\n';
          enhancedContent += '====================\n';
          Object.entries(enhancedAnalysis.jargon_definitions).forEach(([term, definition]) => {
            enhancedContent += `${term}: ${definition}\n`;
          });
          enhancedContent += '\n';
        }
        
        // Add important entities
        if (enhancedAnalysis.important_entities && enhancedAnalysis.important_entities.length > 0) {
          enhancedContent += 'IMPORTANT ENTITIES:\n';
          enhancedContent += '==================\n';
          enhancedAnalysis.important_entities.forEach((entity) => {
            enhancedContent += `${entity.text} (${entity.label})\n`;
          });
          enhancedContent += '\n';
        }
        
        exportContent = enhancedContent;
      } else {
        exportContent = 'No enhanced analysis available for this session.';
      }
    } else {
      // Export as detailed list
      exportContent = sessionTranscripts.map((transcript, index) => {
        const speaker = transcript.speaker || 'Unknown';
        const time = transcript.formatted_time || 'Unknown time';
        const text = transcript.text || '';
        return `${index + 1}. [${time}] ${speaker}: ${text}`;
      }).join('\n\n');
    }

    const fullContent = header + exportContent;

    // Create and download file
    const blob = new Blob([fullContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const filenameSuffix = transcriptViewMode === 'extracted' ? 'extracted' : transcriptViewMode === 'enhanced' ? 'enhanced' : 'detailed';
    a.href = url;
    a.download = `transcript_${currentSessionId || 'session'}_${filenameSuffix}_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyTranscriptsToClipboard = () => {
    if (sessionTranscripts.length === 0) {
      alert('No transcripts to copy');
      return;
    }

    let textContent;
    
    if (transcriptViewMode === 'extracted') {
      // Copy as extracted paragraph with header
      textContent = `EXTRACTED TRANSCRIPT\n${'='.repeat(20)}\n\n${generateExtractedTranscript(sessionTranscripts)}`;
    } else if (transcriptViewMode === 'enhanced') {
      // Copy enhanced analysis
      if (enhancedAnalysis) {
        let enhancedContent = 'ENHANCED ANALYSIS\n=================\n\n';
        
        // Add enhanced transcript
        if (combinedTranscript || enhancedAnalysis.enhanced_transcript) {
          enhancedContent += 'ENHANCED TRANSCRIPT:\n';
          enhancedContent += (combinedTranscript || enhancedAnalysis.enhanced_transcript).replace(/<[^>]*>/g, '') + '\n\n';
        }
        
        // Add key insights
        if (enhancedSummary) {
          enhancedContent += 'KEY INSIGHTS:\n' + enhancedSummary + '\n\n';
        }
        
        // Add jargon definitions
        if (enhancedAnalysis.jargon_definitions && Object.keys(enhancedAnalysis.jargon_definitions).length > 0) {
          enhancedContent += 'JARGON & DEFINITIONS:\n';
          Object.entries(enhancedAnalysis.jargon_definitions).forEach(([term, definition]) => {
            enhancedContent += `${term}: ${definition}\n`;
          });
          enhancedContent += '\n';
        }
        
        // Add important entities
        if (enhancedAnalysis.important_entities && enhancedAnalysis.important_entities.length > 0) {
          enhancedContent += 'IMPORTANT ENTITIES:\n';
          enhancedAnalysis.important_entities.forEach((entity) => {
            enhancedContent += `${entity.text} (${entity.label})\n`;
          });
        }
        
        textContent = enhancedContent;
      } else {
        textContent = 'ENHANCED ANALYSIS\n=================\n\nNo enhanced analysis available for this session.';
      }
    } else {
      // Copy as detailed list
      textContent = sessionTranscripts.map(transcript => {
        const speaker = transcript.speaker || 'Unknown';
        const time = transcript.formatted_time || 'Unknown time';
        const text = transcript.text || '';
        return `[${time}] ${speaker}: ${text}`;
      }).join('\n');
    }

    navigator.clipboard.writeText(textContent).then(() => {
      alert(`${transcriptViewMode === 'extracted' ? 'Extracted transcript' : transcriptViewMode === 'enhanced' ? 'Enhanced analysis' : 'Detailed transcripts'} copied to clipboard!`);
    }).catch(err => {
      console.error('Failed to copy to clipboard:', err);
      alert('Failed to copy transcripts to clipboard');
    });
  };

  const startCameraRecording = async () => {
    try {
      console.log('� Requesting microphone access for audio-only recording...');
      
      // Audio-only constraints for better quality audio capture
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: { ideal: 48000, min: 16000 },
          channelCount: { ideal: 1 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      console.log('✅ Audio stream obtained:', {
        audioTracks: stream.getAudioTracks().length,
        audioSettings: stream.getAudioTracks()[0]?.getSettings()
      });
      
      // Log audio track details
      if (stream.getAudioTracks().length > 0) {
        const audioTrack = stream.getAudioTracks()[0];
        console.log('🎤 Audio track details:', {
          label: audioTrack.label,
          enabled: audioTrack.enabled,
          readyState: audioTrack.readyState,
          muted: audioTrack.muted
        });
      }
      
      setCurrentMode('microphone');
      startRecording(stream, 'microphone');
    } catch (error) {
      console.error('❌ Microphone access error:', error);
      
      if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        alert('Microphone not found. Please check your microphone connection.');
      } else if (error.name === 'NotAllowedError') {
        alert('Microphone access denied. Please allow access and try again.');
      } else {
        alert('Microphone access error: ' + error.message);
      }
    }
  };

  const startScreenRecording = async () => {
    try {
      console.log('🖥️ Starting screen audio recording for meeting capture...');
      
      // Step 1: Request screen share with audio (better approach for system audio)
      let systemAudioStream = null;
      try {
        console.log('🎵 Requesting screen share with system audio...');
        
        // First attempt: Try with video enabled to get reliable audio capture
        const screenShare = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1 },  // Minimal video to enable audio
            height: { ideal: 1 }
          },
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            suppressLocalAudioPlayback: false,
            sampleRate: { ideal: 48000 },
            channelCount: { ideal: 2 } // Stereo for better meeting audio
          }
        });
        
        // Extract only the audio tracks and stop video
        const audioTracks = screenShare.getAudioTracks();
        const videoTracks = screenShare.getVideoTracks();
        
        // Stop video tracks immediately since we don't need video
        videoTracks.forEach(track => track.stop());
        
        if (audioTracks.length > 0) {
          // Create new stream with only audio
          systemAudioStream = new MediaStream(audioTracks);
          console.log('✅ System audio extracted successfully:', {
            audioTracks: systemAudioStream.getAudioTracks().length,
            systemAudioSettings: systemAudioStream.getAudioTracks()[0]?.getSettings()
          });
        } else {
          console.warn('⚠️ No audio tracks found in screen share');
        }
        
      } catch (systemError) {
        console.warn('⚠️ Could not capture system audio:', systemError.message);
        
        // Fallback: Try audio-only approach
        try {
          console.log('🔄 Trying fallback audio-only approach...');
          systemAudioStream = await navigator.mediaDevices.getDisplayMedia({
            video: false,
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
              suppressLocalAudioPlayback: false,
              sampleRate: { ideal: 48000 },
              channelCount: { ideal: 2 }
            }
          });
        } catch (fallbackError) {
          console.warn('⚠️ Fallback also failed:', fallbackError.message);
        }
      }
      
      // Step 2: Check if we got system audio and provide user guidance
      if (!systemAudioStream || systemAudioStream.getAudioTracks().length === 0) {
        const retryChoice = confirm(
          '⚠️ No meeting audio captured!\n\n' +
          'To record meeting participants:\n\n' +
          '1. Click "OK" to try again\n' +
          '2. In the screen sharing dialog:\n' +
          '   • Select the TAB with your meeting (not entire screen)\n' +
          '   • ✅ Check "Share audio" checkbox\n' +
          '   • Click "Share"\n\n' +
          'This is essential for capturing other participants!\n\n' +
          'Click "Cancel" to record microphone only'
        );
        
        if (retryChoice) {
          // Recursive retry
          return startScreenRecording();
        } else {
          console.log('📝 User chose to continue without system audio');
        }
      } else {
        console.log('✅ System audio captured successfully - meeting participants will be recorded');
        // Show success message
        console.log('🎉 Meeting audio capture successful! Other participants will be recorded.');
      }
      
      // Step 3: Always try to get microphone (for your voice)
      let micStream = null;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: { ideal: 48000, min: 16000 },
            channelCount: { ideal: 1 }
          }
        });
        
        console.log('✅ Microphone stream obtained:', {
          audioTracks: micStream.getAudioTracks().length,
          micSettings: micStream.getAudioTracks()[0]?.getSettings()
        });
      } catch (micError) {
        console.warn('⚠️ Microphone access denied:', micError.message);
      }
      
      // Step 4: Combine audio streams based on what's available
      let finalStream;
      
      if (systemAudioStream && systemAudioStream.getAudioTracks().length > 0) {
        // Has system audio - this captures meeting participants
        if (micStream && micStream.getAudioTracks().length > 0) {
          // Setup separate audio processing for speaker identification
          finalStream = setupSeparateAudioProcessing(systemAudioStream, micStream);
          console.log('🎵 Using separate audio processing (System Audio + Microphone)');
          console.log('🎤 Recording: Meeting participants + Your voice');
        } else {
          // System audio only (meeting participants but not your mic)
          finalStream = systemAudioStream;
          console.log('🎵 Using system audio only (meeting participants)');
          console.log('🎤 Recording: Meeting participants only');
        }
      } else if (micStream && micStream.getAudioTracks().length > 0) {
        // Microphone only as fallback
        finalStream = micStream;
        console.log('🎵 Using microphone audio only (fallback)');
        alert('⚠️ Recording microphone only. Meeting participants will NOT be captured.\n\nTo capture meeting audio:\n1. Stop recording\n2. Restart and enable "Share audio" when sharing your screen');
      } else {
        // No audio at all
        alert('❌ No audio sources available. Please allow microphone access or enable system audio sharing.');
        return;
      }
      
      // Store streams for cleanup
      if (micStream) {
        finalStream.microphoneStream = micStream;
      }
      if (systemAudioStream) {
        finalStream.screenStream = systemAudioStream;
      }
      
      // Set audio sources status for UI
      setAudioSources({
        system: systemAudioStream && systemAudioStream.getAudioTracks().length > 0,
        microphone: micStream && micStream.getAudioTracks().length > 0
      });
      
      // Set mode and start recording with explicit mode parameter
      setCurrentMode('screen');
      startRecording(finalStream, 'screen');
      
    } catch (error) {
      console.error('❌ Screen audio recording error:', error);
      alert('Screen audio recording failed: ' + error.message + '\n\nTroubleshooting:\n1. Make sure you\'re using Chrome/Edge (Firefox has limited support)\n2. Allow screen sharing when prompted\n3. ✅ Check "Share audio" in the sharing dialog\n4. Select the TAB with your meeting (not entire screen)\n5. Allow microphone access');
    }
  };

  // Function to setup separate audio processing for speaker identification
  const setupSeparateAudioProcessing = (screenStream, micStream) => {
    try {
      // Setup separate audio contexts for each source
      const systemAudioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 48000,
        latencyHint: 'interactive'
      });
      
      const micAudioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 48000,  
        latencyHint: 'interactive'
      });

      // Create separate processors for system audio (meeting participants)
      if (screenStream.getAudioTracks().length > 0) {
        const systemSource = systemAudioContext.createMediaStreamSource(screenStream);
        const systemProcessor = systemAudioContext.createScriptProcessor(4096, 1, 1);
        
        systemProcessor.onaudioprocess = (event) => {
          if (!isRecordingRef.current || !socketRef.current || 
              socketRef.current.readyState !== WebSocket.OPEN) {
            return;
          }
          
          try {
            const inputData = event.inputBuffer.getChannelData(0);
            const audioChunk = Array.from(inputData);
            const rms = Math.sqrt(inputData.reduce((sum, sample) => sum + sample * sample, 0) / inputData.length);
            
            // Send system audio with lower threshold (meeting audio is often quieter)
            if (rms > 0.000001) { // Lower threshold for meeting audio
              socketRef.current.send(JSON.stringify({
                type: 'audio_chunk',
                data: {
                  audio: audioChunk,
                  sample_rate: systemAudioContext.sampleRate,
                  timestamp: Date.now(),
                  mode: 'screen',
                  rms_level: rms,
                  speaker: 'other'
                }
              }));
              
              if (rms > 0.00001) {
                console.log('🔊 System audio (Other):', rms.toFixed(6));
              }
            }
          } catch (err) {
            console.error('❌ System audio processing error:', err);
          }
        };
        
        systemSource.connect(systemProcessor);
        systemProcessor.connect(systemAudioContext.destination);
      }

      // Create separate processor for microphone (your voice)
      if (micStream && micStream.getAudioTracks().length > 0) {
        const micSource = micAudioContext.createMediaStreamSource(micStream);
        const micProcessor = micAudioContext.createScriptProcessor(4096, 1, 1);
        
        micProcessor.onaudioprocess = (event) => {
          if (!isRecordingRef.current || !socketRef.current || 
              socketRef.current.readyState !== WebSocket.OPEN) {
            return;
          }
          
          try {
            const inputData = event.inputBuffer.getChannelData(0);
            const audioChunk = Array.from(inputData);
            const rms = Math.sqrt(inputData.reduce((sum, sample) => sum + sample * sample, 0) / inputData.length);
            
            // Update UI with microphone activity
            const isActive = rms > 0.00001;
            setMicrophoneActive(isActive);
            setAudioLevel(Math.min(rms * 10000, 100));
            setAudioChunkCount(prev => prev + 1);
            
            // Only send if there's significant audio (you speaking)
            if (rms > 0.00001) {
              socketRef.current.send(JSON.stringify({
                type: 'audio_chunk',
                data: {
                  audio: audioChunk,
                  sample_rate: micAudioContext.sampleRate,
                  timestamp: Date.now(),
                  mode: 'screen',
                  rms_level: rms,
                  speaker: 'you'
                }
              }));
              
              console.log('🎤 Microphone audio (You):', rms.toFixed(6));
            }
          } catch (err) {
            console.error('❌ Microphone audio processing error:', err);
          }
        };
        
        micSource.connect(micProcessor);
        micProcessor.connect(micAudioContext.destination);
      }
      
      // Store audio contexts for cleanup
      const finalStream = new MediaStream([
        ...screenStream.getVideoTracks()
      ]);
      
      finalStream.systemAudioContext = systemAudioContext;
      finalStream.micAudioContext = micAudioContext;
      
      console.log('✅ Separate audio processing setup complete');
      return finalStream;
      
    } catch (error) {
      console.error('❌ Error setting up separate audio processing:', error);
      return screenStream;
    }
  };

  const startRecording = (stream, mode = null) => {
    // If already recording, stop the previous session first
    if (isRecording && socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      console.log('🔄 Stopping previous recording session to start new one');
      socketRef.current.send(JSON.stringify({
        type: 'stop_recording',
        data: { 
          timestamp: Date.now(),
          reason: 'new_session_started'
        }
      }));
    }

    streamRef.current = stream;
    
    const recordingMode = mode || currentMode;
    
    // Audio-only setup - no video handling
    console.log('🎤 Setting up audio-only recording mode');

    // Setup audio streaming with speaker identification
    if (stream.getAudioTracks().length > 0) {
      if (recordingMode === 'microphone') {
        // For microphone recording, everything is "you" 
        setupAudioStreamingWithSpeaker(stream, 'you', recordingMode);
      } else if (recordingMode === 'screen' && !stream.systemAudioContext && !stream.micAudioContext) {
        // Screen recording fallback if separate processing failed
        setupAudioStreamingWithSpeaker(stream, 'mixed', recordingMode);
      }
    }

    setIsRecording(true);
    isRecordingRef.current = true;

    // Reset counters and session state when starting new recording
    setAudioChunkCount(0);
    setVideoFrameCount(0); // Keep for compatibility but won't be used
    
    // Clear any existing captions to prevent key conflicts
    setCaptions([]);
    
    // Reset session state for new recording
    setSessionCompleted(false);
    setSessionTranscripts([]);
    setSessionStats(null);
    setShowTranscriptViewer(false);
    setCurrentSessionId(null); // Will be set when backend responds

    // Send start recording message - audio only, no file saving
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const startMessage = {
        type: 'start_recording',
        data: {
          mode: recordingMode,
          captureMode: recordingMode,
          timestamp: Date.now(),
          recordingType: mode === 'microphone' ? 'microphone' : mode === 'screen' ? 'screen_audio' : 'audio',
          audioOnly: true
        }
      };
      
      console.log('🎬 Starting new audio-only recording session:', startMessage);
      socketRef.current.send(JSON.stringify(startMessage));
    }
  };

  const setupAudioStreamingWithSpeaker = (stream, speaker = 'you', mode = null) => {
    try {
      console.log(`🎤 Setting up audio streaming for speaker: ${speaker}`);
      
      const audioMode = mode || currentMode;
      
      // Close existing audio context if it exists
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 48000,
        latencyHint: 'interactive'
      });
      
      // Resume audio context if suspended
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      
      // Check if audio tracks are active and have audio
      const audioTracks = stream.getAudioTracks();
      console.log('🎤 Audio tracks:', audioTracks.length, audioTracks.map(t => ({ 
        label: t.label, 
        enabled: t.enabled, 
        readyState: t.readyState 
      })));
      
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      
      processorRef.current.onaudioprocess = (event) => {
        if (!isRecordingRef.current || !socketRef.current || 
            socketRef.current.readyState !== WebSocket.OPEN) {
          return;
        }
        
        try {
          const inputBuffer = event.inputBuffer;
          const inputData = inputBuffer.getChannelData(0);
          const audioChunk = Array.from(inputData);
          
          // Debug: Check audio level
          const rms = Math.sqrt(inputData.reduce((sum, sample) => sum + sample * sample, 0) / inputData.length);
          
          // Send audio data with speaker identification
          socketRef.current.send(JSON.stringify({
            type: 'audio_chunk',
            data: {
              audio: audioChunk,
              sample_rate: audioContextRef.current.sampleRate,
              timestamp: Date.now(),
              mode: audioMode,
              rms_level: rms,
              speaker: speaker // Include speaker identification
            }
          }));
          
          // Update audio chunk counter
          setAudioChunkCount(prev => prev + 1);
          
          // Update microphone activity status and audio level
          const isActive = rms > 0.00001;
          setMicrophoneActive(isActive);
          setAudioLevel(Math.min(rms * 10000, 100)); // Scale for visualization (0-100)
          
          // Log every 10th chunk to monitor activity
          if (audioChunkCount % 10 === 0) {
            console.log(`🎤 Audio (${speaker}) RMS:`, rms.toFixed(8), 'Level:', Math.round(rms * 10000), 'Active:', isActive);
          }
          
          if (rms > 0.00001) {
            console.log(`🎵 Audio detected (${speaker}) - RMS:`, rms.toFixed(6), 'Samples:', audioChunk.length);
          }
        } catch (err) {
          console.error('❌ Error in audio processing:', err);
        }
      };

      source.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);
      
      console.log('✅ Audio context setup complete:', {
        state: audioContextRef.current.state,
        sampleRate: audioContextRef.current.sampleRate,
        speaker: speaker
      });
      
    } catch (error) {
      console.error('❌ Error setting up audio:', error);
      // Try alternative setup
      setupAudioStreamingFallback(stream, speaker);
    }
  };

  // Keep old function for compatibility/fallback
  const setupAudioStreaming = (stream) => {
    setupAudioStreamingWithSpeaker(stream, 'unknown');
  };

  const setupAudioStreamingFallback = (stream, speaker = 'unknown') => {
    try {
      console.log(`🔄 Trying fallback audio setup for speaker: ${speaker}...`);
      
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      
      // Simple user interaction to resume context
      document.addEventListener('click', () => {
        if (audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume();
        }
      }, { once: true });
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      processorRef.current = audioContextRef.current.createScriptProcessor(2048, 1, 1);
      
      processorRef.current.onaudioprocess = (event) => {
        if (!isRecordingRef.current || !socketRef.current) return;
        
        try {
          const inputData = event.inputBuffer.getChannelData(0);
          const audioChunk = Array.from(inputData);
          const rms = Math.sqrt(inputData.reduce((sum, sample) => sum + sample * sample, 0) / inputData.length);
          
          socketRef.current.send(JSON.stringify({
            type: 'audio_chunk',
            data: {
              audio: audioChunk,
              sample_rate: audioContextRef.current.sampleRate,
              timestamp: Date.now(),
              mode: currentMode,
              rms_level: rms,
              speaker: speaker // Include speaker identification in fallback too
            }
          }));
          
          setAudioChunkCount(prev => prev + 1);
          
          if (rms > 0.0001) {
            console.log(`🎵 Fallback audio (${speaker}) - RMS:`, rms.toFixed(6));
          }
        } catch (err) {
          console.error('❌ Fallback audio error:', err);
        }
      };
      
      source.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);
      
    } catch (error) {
      console.error('❌ Fallback audio setup failed:', error);
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    isRecordingRef.current = false;
    setCurrentMode(null);
    
    // Reset microphone status
    setMicrophoneActive(false);
    setAudioLevel(0);
    setAudioSources({ system: false, microphone: false });

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      
      // Clean up microphone stream if it exists
      if (streamRef.current.microphoneStream) {
        streamRef.current.microphoneStream.getTracks().forEach(track => track.stop());
      }
      
      // Clean up screen stream if it exists  
      if (streamRef.current.screenStream) {
        streamRef.current.screenStream.getTracks().forEach(track => track.stop());
      }
      
      // Clean up separate audio contexts if they exist
      if (streamRef.current.systemAudioContext) {
        streamRef.current.systemAudioContext.close();
      }
      if (streamRef.current.micAudioContext) {
        streamRef.current.micAudioContext.close();
      }
      // Clean up mixed audio context if it exists (fallback)
      if (streamRef.current.audioContext) {
        streamRef.current.audioContext.close();
      }
      
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // No video capture interval to clean up in audio-only mode

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'stop_recording',
        data: { timestamp: Date.now() }
      }));
    }
  };

  const clearTranscripts = () => {
    setCaptions([]);
  };

  // Video upload functions
  const handleVideoUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Check if file is a video
      if (!file.type.startsWith('video/')) {
        alert('Please select a valid video file');
        return;
      }

      // Check file size (limit to 500MB)
      const maxSize = 500 * 1024 * 1024; // 500MB
      if (file.size > maxSize) {
        alert('File size too large. Please select a video smaller than 500MB');
        return;
      }

      setUploadedVideo(file);
      setVideoTranscript(null);
      setVideoProcessingProgress(0);
    }
  };

  const processUploadedVideo = async () => {
    if (!uploadedVideo) return;

    setIsProcessingVideo(true);
    setVideoProcessingProgress(0);

    try {
      const formData = new FormData();
      formData.append('video', uploadedVideo);

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setVideoProcessingProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + Math.random() * 15;
        });
      }, 1000);

      const response = await fetch('http://localhost:8001/api/video/extract-transcript', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setVideoTranscript(result.transcript);
        setVideoProcessingProgress(100);
        
        // Add transcript segments to captions for display
        if (result.transcript && result.transcript.segments) {
          const newCaptions = result.transcript.segments.map((segment, index) => ({
            id: `video_${Date.now()}_${index}`,
            text: segment.text,
            originalText: segment.text,
            speaker: segment.speaker || 'Speaker',
            timestamp: segment.start * 1000, // Convert to milliseconds
            confidence: Math.floor((segment.confidence || 0.9) * 100),
            time: new Date(segment.start * 1000).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: true
            }),
            isFromVideo: true
          }));
          
          setCaptions(prev => [...newCaptions, ...prev]);
        }
      } else {
        // Handle specific error cases with helpful messages
        if (result.error === 'FFmpeg Required for Video Transcription') {
          const instructions = result.instructions || {};
          const message = `${result.message}\n\nTo enable video transcription:\n1. ${instructions.step1 || 'Download FFmpeg'}\n2. ${instructions.step2 || 'Add to system PATH'}\n3. ${instructions.step3 || 'Restart server'}\n\nAlternative: ${instructions.alternative || 'Use package manager'}`;
          alert(message);
        } else {
          throw new Error(result.error || 'Failed to process video');
        }
      }
    } catch (error) {
      console.error('Error processing video:', error);
      const errorMessage = error.message.includes('FFmpeg') 
        ? `Video Transcription Setup Required:\n\n${error.message}\n\nPlease install FFmpeg to extract transcripts from video files.`
        : `Error processing video: ${error.message}`;
      alert(errorMessage);
      setVideoProcessingProgress(0);
    } finally {
      setIsProcessingVideo(false);
    }
  };

  const clearUploadedVideo = () => {
    setUploadedVideo(null);
    setVideoTranscript(null);
    setVideoProcessingProgress(0);
    setIsProcessingVideo(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const generateExtractedTranscript = (transcripts) => {
    if (!transcripts || transcripts.length === 0) return '';
    
    // Combine all transcript text into a single paragraph
    const combinedText = transcripts
      .map(transcript => transcript.text || '')
      .filter(text => text.trim() !== '')
      .join(' ')
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();
    
    return combinedText;
  };

  // Transcript Viewer Component
  const TranscriptViewer = () => {
    if (!showTranscriptViewer || !sessionCompleted) return null;

    const filteredTranscripts = sessionTranscripts.filter(transcript => 
      !transcriptSearchQuery || 
      transcript.text.toLowerCase().includes(transcriptSearchQuery.toLowerCase()) ||
      (transcript.speaker && transcript.speaker.toLowerCase().includes(transcriptSearchQuery.toLowerCase()))
    );

    return (
      <div style={{
        position: 'fixed',
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        zIndex: '1000',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          width: '90%',
          maxWidth: '1000px',
          height: '90%',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
        }}>
          {/* Header */}
          <div style={{
            padding: '24px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <h2 style={{
                margin: '0 0 8px 0',
                fontSize: '24px',
                fontWeight: '600',
                color: '#111827'
              }}>
                📝 Session Transcript
              </h2>
              <div style={{
                display: 'flex',
                gap: '16px',
                fontSize: '14px',
                color: '#6b7280'
              }}>
                <span>Session: {currentSessionId}</span>
                <span>Total: {sessionTranscripts.length} transcripts</span>
                {sessionStats?.duration && <span>Duration: {sessionStats.duration}</span>}
                {sessionStats?.speakers && sessionStats.speakers.length > 0 && (
                  <span>Speakers: {sessionStats.speakers.join(', ')}</span>
                )}
                {sessionStats?.confidence_average && (
                  <span>Avg Confidence: {Math.round(sessionStats.confidence_average * 100)}%</span>
                )}
              </div>
            </div>
            <button
              onClick={() => setShowTranscriptViewer(false)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '6px',
                color: '#6b7280'
              }}
            >
              ✕
            </button>
          </div>

          {/* Controls */}
          <div style={{
            padding: '16px 24px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            gap: '12px',
            alignItems: 'center'
          }}>
            {/* View Mode Toggle */}
            <div style={{
              display: 'flex',
              gap: '4px',
              marginRight: '12px'
            }}>
              <button
                onClick={() => setTranscriptViewMode('extracted')}
                style={{
                  padding: '6px 12px',
                  backgroundColor: transcriptViewMode === 'extracted' ? '#667eea' : '#f3f4f6',
                  color: transcriptViewMode === 'extracted' ? 'white' : '#374151',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                📄 Extracted
              </button>
              <button
                onClick={() => setTranscriptViewMode('detailed')}
                style={{
                  padding: '6px 12px',
                  backgroundColor: transcriptViewMode === 'detailed' ? '#667eea' : '#f3f4f6',
                  color: transcriptViewMode === 'detailed' ? 'white' : '#374151',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                📋 Detailed
              </button>
              <button
                onClick={() => setTranscriptViewMode('enhanced')}
                style={{
                  padding: '6px 12px',
                  backgroundColor: transcriptViewMode === 'enhanced' ? '#667eea' : '#f3f4f6',
                  color: transcriptViewMode === 'enhanced' ? 'white' : '#374151',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                🧠 Enhanced
              </button>
            </div>
            
            {transcriptViewMode === 'detailed' && (
              <input
                type="text"
                placeholder="Search transcripts..."
                value={transcriptSearchQuery}
                onChange={(e) => setTranscriptSearchQuery(e.target.value)}
                style={{
                  flex: '1',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            )}
            
            {transcriptViewMode === 'extracted' && (
              <div style={{ flex: 1, color: '#6b7280', fontSize: '14px' }}>
                Extracted Transcript - All session text combined into a single paragraph
              </div>
            )}
            {transcriptViewMode === 'detailed' && (
              <div style={{ flex: 1, color: '#6b7280', fontSize: '14px' }}>
                Detailed Transcript - Individual transcript segments with timestamps and speakers
              </div>
            )}
            {transcriptViewMode === 'enhanced' && (
              <div style={{ flex: 1, color: '#6b7280', fontSize: '14px' }}>
                Enhanced Analysis - AI-powered insights with jargon detection, important highlights, and definitions
              </div>
            )}
            
            <button
              onClick={exportTranscripts}
              style={{
                padding: '8px 16px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              📁 Export
            </button>
            <button
              onClick={copyTranscriptsToClipboard}
              style={{
                padding: '8px 16px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              📋 Copy
            </button>
          </div>

          {/* Transcript Content */}
          <div style={{
            flex: '1',
            overflow: 'auto',
            padding: '16px'
          }}>
            {sessionTranscripts.length === 0 ? (
              <div style={{
                textAlign: 'center',
                color: '#6b7280',
                padding: '40px',
                fontSize: '16px'
              }}>
                No transcripts available for this session.
              </div>
            ) : transcriptViewMode === 'extracted' ? (
              // Extracted Transcript View - Single Paragraph
              <div style={{
                backgroundColor: '#f8fafc',
                border: '2px solid #e2e8f0',
                borderRadius: '12px',
                padding: '24px'
              }}>
                <h3 style={{
                  margin: '0 0 16px 0',
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#1e293b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  📄 Extracted Transcript
                </h3>
                <div style={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '20px',
                  fontSize: '16px',
                  lineHeight: '1.7',
                  color: '#374151',
                  fontFamily: 'Georgia, serif',
                  maxHeight: '500px',
                  overflow: 'auto'
                }}>
                  {generateExtractedTranscript(sessionTranscripts) || 'No transcript content available.'}
                </div>
                <div style={{
                  marginTop: '16px',
                  fontSize: '14px',
                  color: '#64748b',
                  textAlign: 'right'
                }}>
                  Combined from {sessionTranscripts.length} transcript segments
                  {sessionStats?.duration && ` • Duration: ${sessionStats.duration}`}
                  {sessionStats?.confidence_average && ` • Avg. Confidence: ${Math.round(sessionStats.confidence_average * 100)}%`}
                </div>
              </div>
            ) : transcriptViewMode === 'enhanced' ? (
              // Enhanced Analysis View - AI-Powered Insights
              <div style={{
                backgroundColor: '#f8fafc',
                border: '2px solid #e2e8f0',
                borderRadius: '12px',
                padding: '24px'
              }}>
                {(enhancedAnalysis || sentimentAnalysis || sentimentSummary) ? (
                  <div>
                    <h3 style={{
                      margin: '0 0 20px 0',
                      fontSize: '18px',
                      fontWeight: '600',
                      color: '#1e293b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      🧠 Enhanced Analysis
                    </h3>
                    
                    {/* Enhanced Transcript with Highlighting */}
                    <div style={{ marginBottom: '24px' }}>
                      <h4 style={{ 
                        margin: '0 0 12px 0', 
                        color: '#374151', 
                        fontSize: '16px', 
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        📝 Enhanced Transcript
                      </h4>
                      <div style={{
                        backgroundColor: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '20px',
                        fontSize: '15px',
                        lineHeight: '1.7',
                        color: '#374151',
                        maxHeight: '400px',
                        overflow: 'auto'
                      }}>
                        <div dangerouslySetInnerHTML={{ 
                          __html: combinedTranscript || enhancedAnalysis.enhanced_transcript || 'No enhanced transcript available'
                        }} />
                      </div>
                    </div>

                    {/* Important Information Summary */}
                    {enhancedSummary && (
                      <div style={{ marginBottom: '24px' }}>
                        <h4 style={{ 
                          margin: '0 0 12px 0', 
                          color: '#374151', 
                          fontSize: '16px', 
                          fontWeight: '600',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          ⭐ Key Insights
                        </h4>
                        <div style={{
                          backgroundColor: '#fef9e7',
                          border: '1px solid #fbbf24',
                          borderRadius: '8px',
                          padding: '20px',
                          fontSize: '13px',
                          lineHeight: '1.5',
                          color: '#92400e',
                          fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                          whiteSpace: 'pre-line',
                          overflow: 'auto',
                          maxHeight: '600px'
                        }}>
                          {enhancedSummary}
                        </div>
                      </div>
                    )}

                    {/* Jargon & Definitions */}
                    {enhancedAnalysis.jargon_definitions && Object.keys(enhancedAnalysis.jargon_definitions).length > 0 && (
                      <div style={{ marginBottom: '24px' }}>
                        <h4 style={{ 
                          margin: '0 0 12px 0', 
                          color: '#374151', 
                          fontSize: '16px', 
                          fontWeight: '600',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          📚 Jargon & Definitions
                        </h4>
                        <div style={{ display: 'grid', gap: '10px' }}>
                          {Object.entries(enhancedAnalysis.jargon_definitions).map(([term, definition]) => (
                            <div key={term} style={{ 
                              padding: '12px 16px', 
                              backgroundColor: '#e0f2fe', 
                              borderRadius: '8px',
                              borderLeft: '4px solid #0277bd'
                            }}>
                              <strong style={{ color: '#01579b', fontSize: '14px' }}>{term}:</strong>
                              <span style={{ marginLeft: '8px', color: '#374151', fontSize: '14px' }}>{definition}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Important Entities */}
                    {enhancedAnalysis.important_entities && enhancedAnalysis.important_entities.length > 0 && (
                      <div style={{ marginBottom: '24px' }}>
                        <h4 style={{ 
                          margin: '0 0 12px 0', 
                          color: '#374151', 
                          fontSize: '16px', 
                          fontWeight: '600',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          🏷️ Important Entities
                        </h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {enhancedAnalysis.important_entities.map((entity, idx) => (
                            <span key={idx} style={{
                              padding: '6px 12px',
                              backgroundColor: '#fef3c7',
                              color: '#92400e',
                              borderRadius: '16px',
                              fontSize: '13px',
                              fontWeight: '500',
                              border: '1px solid #fbbf24'
                            }}>
                              {entity.text} ({entity.label})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Sentiment Analysis */}
                    {(sentimentSummary || sentimentAnalysis) && (
                      <div style={{ marginBottom: '24px' }}>
                        <h4 style={{ 
                          margin: '0 0 12px 0', 
                          color: '#374151', 
                          fontSize: '16px', 
                          fontWeight: '600',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          🎭 Sentiment Analysis
                        </h4>
                        
                        {/* Sentiment Summary */}
                        {sentimentSummary && (
                          <div style={{
                            backgroundColor: '#f0fdf4',
                            border: '1px solid #22c55e',
                            borderRadius: '8px',
                            padding: '20px',
                            fontSize: '14px',
                            lineHeight: '1.6',
                            color: '#166534',
                            marginBottom: sentimentAnalysis ? '16px' : '0'
                          }}>
                            <div dangerouslySetInnerHTML={{ __html: sentimentSummary }} />
                          </div>
                        )}
                        
                        {/* Detailed Sentiment Data */}
                        {sentimentAnalysis && (
                          <div style={{
                            backgroundColor: 'white',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            padding: '16px'
                          }}>
                            <div style={{ display: 'grid', gap: '12px' }}>
                              {/* Overall Sentiment */}
                              {sentimentAnalysis.overall_sentiment && (
                                <div style={{ 
                                  display: 'flex', 
                                  justifyContent: 'space-between', 
                                  alignItems: 'center',
                                  padding: '8px 12px',
                                  backgroundColor: sentimentAnalysis.overall_sentiment === 'POSITIVE' ? '#dcfce7' : 
                                                 sentimentAnalysis.overall_sentiment === 'NEGATIVE' ? '#fef2f2' : '#f3f4f6',
                                  borderRadius: '6px',
                                  border: `1px solid ${sentimentAnalysis.overall_sentiment === 'POSITIVE' ? '#22c55e' : 
                                                     sentimentAnalysis.overall_sentiment === 'NEGATIVE' ? '#ef4444' : '#9ca3af'}`
                                }}>
                                  <span style={{ fontWeight: '600' }}>Overall Sentiment:</span>
                                  <span style={{ 
                                    color: sentimentAnalysis.overall_sentiment === 'POSITIVE' ? '#166534' : 
                                           sentimentAnalysis.overall_sentiment === 'NEGATIVE' ? '#dc2626' : '#374151',
                                    fontWeight: '600'
                                  }}>
                                    {sentimentAnalysis.overall_sentiment} 
                                    {sentimentAnalysis.overall_confidence && 
                                      ` (${(sentimentAnalysis.overall_confidence * 100).toFixed(1)}%)`}
                                  </span>
                                </div>
                              )}
                              
                              {/* Sentence-level Analysis */}
                              {sentimentAnalysis.sentence_sentiments && sentimentAnalysis.sentence_sentiments.length > 0 && (
                                <div>
                                  <h5 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                                    Sentence-level Analysis:
                                  </h5>
                                  <div style={{ maxHeight: '200px', overflow: 'auto' }}>
                                    {sentimentAnalysis.sentence_sentiments.map((sentence, idx) => (
                                      <div key={idx} style={{
                                        padding: '8px 12px',
                                        margin: '4px 0',
                                        backgroundColor: sentence.sentiment === 'POSITIVE' ? '#f0fdf4' : 
                                                       sentence.sentiment === 'NEGATIVE' ? '#fef2f2' : '#f9fafb',
                                        borderRadius: '4px',
                                        fontSize: '13px',
                                        borderLeft: `3px solid ${sentence.sentiment === 'POSITIVE' ? '#22c55e' : 
                                                                sentence.sentiment === 'NEGATIVE' ? '#ef4444' : '#9ca3af'}`
                                      }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                          <span style={{ fontWeight: '500' }}>
                                            {sentence.sentiment} ({(sentence.confidence * 100).toFixed(1)}%)
                                          </span>
                                        </div>
                                        <div style={{ color: '#6b7280', fontSize: '12px' }}>
                                          "{sentence.text || sentence.sentence}"
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {/* Statistics */}
                              {sentimentAnalysis.statistics && (
                                <div style={{
                                  backgroundColor: '#f8fafc',
                                  padding: '12px',
                                  borderRadius: '6px',
                                  fontSize: '13px'
                                }}>
                                  <div style={{ fontWeight: '600', marginBottom: '8px' }}>Statistics:</div>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' }}>
                                    {sentimentAnalysis.statistics.positive_count !== undefined && (
                                      <div>Positive: {sentimentAnalysis.statistics.positive_count}</div>
                                    )}
                                    {sentimentAnalysis.statistics.negative_count !== undefined && (
                                      <div>Negative: {sentimentAnalysis.statistics.negative_count}</div>
                                    )}
                                    {sentimentAnalysis.statistics.neutral_count !== undefined && (
                                      <div>Neutral: {sentimentAnalysis.statistics.neutral_count}</div>
                                    )}
                                    {sentimentAnalysis.statistics.average_confidence !== undefined && (
                                      <div>Avg Confidence: {(sentimentAnalysis.statistics.average_confidence * 100).toFixed(1)}%</div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Analysis Statistics */}
                    <div style={{
                      marginTop: '20px',
                      fontSize: '13px',
                      color: '#64748b',
                      textAlign: 'right',
                      paddingTop: '16px',
                      borderTop: '1px solid #e2e8f0'
                    }}>
                      Enhanced analysis completed • 
                      {enhancedAnalysis.jargon_definitions && ` ${Object.keys(enhancedAnalysis.jargon_definitions).length} definitions found`}
                      {enhancedAnalysis.important_entities && ` • ${enhancedAnalysis.important_entities.length} entities identified`}
                    </div>
                  </div>
                ) : (
                  <div style={{
                    textAlign: 'center',
                    color: '#6b7280',
                    padding: '60px 20px',
                    fontSize: '16px'
                  }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🧠</div>
                    <h3 style={{ margin: '0 0 8px 0', color: '#374151' }}>Enhanced Analysis</h3>
                    <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.5' }}>
                      No enhanced analysis available yet.<br />
                      Start recording to see AI-powered insights with jargon detection, important highlights, definitions, and sentiment analysis!
                    </p>
                  </div>
                )}
              </div>
            ) : (
              // Detailed View - Individual Transcript Items
              filteredTranscripts.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  color: '#6b7280',
                  padding: '40px',
                  fontSize: '16px'
                }}>
                  {transcriptSearchQuery ? 'No transcripts match your search.' : 'No transcripts available.'}
                </div>
              ) : (
                filteredTranscripts.map((transcript, index) => (
                  <div
                    key={transcript.sequence_number || index}
                    style={{
                      backgroundColor: '#f9fafb',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '16px',
                      marginBottom: '12px'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '8px'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                      }}>
                        <span style={{
                          backgroundColor: transcript.speaker === 'Speaker A' ? '#dbeafe' : '#fef3c7',
                          color: transcript.speaker === 'Speaker A' ? '#1e40af' : '#92400e',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '500'
                        }}>
                          {transcript.speaker || 'Unknown'}
                        </span>
                        <span style={{
                          fontSize: '12px',
                          color: '#6b7280'
                        }}>
                          {transcript.formatted_time || 'Unknown time'}
                        </span>
                        {transcript.confidence && (
                          <span style={{
                            fontSize: '12px',
                            color: transcript.confidence > 80 ? '#059669' : transcript.confidence > 60 ? '#d97706' : '#dc2626',
                            fontWeight: '500'
                          }}>
                            {Math.round(transcript.confidence * 100)}% confidence
                          </span>
                        )}
                      </div>
                      <span style={{
                        fontSize: '12px',
                        color: '#9ca3af',
                        backgroundColor: '#f3f4f6',
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}>
                        #{transcript.sequence_number}
                      </span>
                    </div>
                    <p style={{
                      margin: '0',
                      fontSize: '15px',
                      color: '#374151',
                      lineHeight: '1.6'
                    }}>
                      {transcript.text}
                    </p>
                  </div>
                ))
              )
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
          }
        `}
      </style>
      <div style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        backgroundColor: '#f5f7fa',
        minHeight: '100vh',
        padding: '20px'
      }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px'
      }}>
        <div>
          <h1 style={{
            fontSize: '32px',
            fontWeight: '600',
            color: '#667eea',
            margin: '0',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span style={{ fontSize: '28px' }}>🎯</span>
            Meeting Monitor
          </h1>
          <p style={{
            color: '#6b7280',
            margin: '5px 0 0 0',
            fontSize: '14px'
          }}>
            Real-time Audio & Video Recording with AI Transcription
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* Current Session Status */}
          {currentSessionId && isRecording && (
            <div style={{
              backgroundColor: '#e0f2fe',
              color: '#0277bd',
              padding: '6px 12px',
              borderRadius: '16px',
              border: '1px solid #81d4fa',
              fontSize: '12px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span style={{ color: '#1976d2' }}>🎯</span>
              Session: {currentSessionId.split('_')[1]?.substr(-4) || 'Active'}
            </div>
          )}
          
          {/* Transcript Available Notification */}
          {sessionCompleted && sessionTranscripts.length > 0 && (
            <button
              onClick={() => setShowTranscriptViewer(true)}
              style={{
                backgroundColor: '#fef3c7',
                color: '#92400e',
                padding: '8px 16px',
                borderRadius: '20px',
                border: '1px solid #fcd34d',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                animation: 'pulse 2s infinite'
              }}
            >
              📝 {sessionTranscripts.length} Transcripts Available - Click to View
            </button>
          )}
          
          {/* Connection Status */}
          <div style={{
            backgroundColor: isConnected ? '#d1fae5' : '#fee2e2',
            color: isConnected ? '#065f46' : '#991b1b',
            padding: '8px 16px',
            borderRadius: '20px',
            border: `1px solid ${isConnected ? '#a7f3d0' : '#fecaca'}`,
            fontSize: '14px',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isConnected ? '#10b981' : '#ef4444'
            }}></div>
            {isConnected ? 'Connected' : 'Disconnected'}
            {isRecording && (
              <div style={{ marginLeft: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: '#dc2626' }}>🔴</span>
                Recording
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px', height: '70vh' }}>
        {/* Left Panel */}
        <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Video Feed */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e5e7eb',
            flex: '1'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px'
            }}>
              <span style={{ fontSize: '20px' }}>📹</span>
              <h3 style={{
                margin: '0',
                fontSize: '18px',
                fontWeight: '600',
                color: '#374151'
              }}>Video Feed</h3>
            </div>
            
            <div style={{
              backgroundColor: '#f9fafb',
              borderRadius: '12px',
              minHeight: '240px',
              maxHeight: '360px',
              aspectRatio: '16/9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px dashed #d1d5db',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {isRecording ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  padding: '20px',
                  color: '#374151'
                }}>
                  <div style={{ 
                    fontSize: '64px', 
                    marginBottom: '16px',
                    animation: microphoneActive ? 'pulse 1s infinite' : 'none'
                  }}>
                    {microphoneActive ? '🎤' : '�'}
                  </div>
                  <h3 style={{ 
                    margin: '0 0 8px 0', 
                    fontSize: '18px', 
                    fontWeight: '600' 
                  }}>
                    Audio Recording Active
                  </h3>
                  <p style={{ 
                    margin: '0', 
                    fontSize: '14px', 
                    color: '#6b7280' 
                  }}>
                    {microphoneActive ? 'Detecting audio...' : 'Listening for audio...'}
                  </p>
                  
                  {/* Audio Level Indicator */}
                  <div style={{
                    width: '200px',
                    height: '8px',
                    backgroundColor: '#e5e7eb',
                    borderRadius: '4px',
                    marginTop: '16px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${audioLevel}%`,
                      height: '100%',
                      backgroundColor: microphoneActive ? '#10b981' : '#6b7280',
                      borderRadius: '4px',
                      transition: 'width 0.1s ease'
                    }} />
                  </div>
                  
                  {/* Audio Sources Status */}
                  <div style={{
                    display: 'flex',
                    gap: '12px',
                    marginTop: '16px',
                    fontSize: '12px'
                  }}>
                    {audioSources.microphone && (
                      <span style={{
                        background: '#dcfce7',
                        color: '#166534',
                        padding: '4px 8px',
                        borderRadius: '12px'
                      }}>
                        🎤 Microphone
                      </span>
                    )}
                    {audioSources.system && (
                      <span style={{
                        background: '#dbeafe',
                        color: '#1e40af',
                        padding: '4px 8px',
                        borderRadius: '12px'
                      }}>
                        🖥️ System Audio
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{
                  textAlign: 'center',
                  color: '#6b7280'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎤</div>
                  <p style={{ margin: '0', fontSize: '16px', fontWeight: '500' }}>
                    Click "Start Recording" to begin audio recording
                  </p>
                  <p style={{ margin: '8px 0 0 0', fontSize: '14px', opacity: '0.8' }}>
                    Audio-only mode - No video recording
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Recording Mode */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '20px'
            }}>
              <span style={{ fontSize: '20px' }}>🎬</span>
              <h3 style={{
                margin: '0',
                fontSize: '18px',
                fontWeight: '600',
                color: '#374151'
              }}>Recording Mode</h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div 
                onClick={() => setRecordingMode('live')}
                style={{
                  background: recordingMode === 'live' 
                    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                    : '#f3f4f6',
                  color: recordingMode === 'live' ? 'white' : '#374151',
                  padding: '16px 20px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  border: recordingMode === 'live' ? '2px solid #667eea' : '2px solid #e5e7eb'
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{ fontSize: '20px' }}>🔴</div>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '16px' }}>Live Transcription</div>
                    <div style={{ fontSize: '14px', opacity: '0.8' }}>Real-time transcription during recording</div>
                  </div>
                </div>
              </div>
              
              <div 
                onClick={() => setRecordingMode('process')}
                style={{
                  background: recordingMode === 'process' 
                    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                    : '#f3f4f6',
                  color: recordingMode === 'process' ? 'white' : '#374151',
                  padding: '16px 20px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  border: recordingMode === 'process' ? '2px solid #667eea' : '2px solid #e5e7eb'
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{ fontSize: '20px' }}>🔄</div>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '16px' }}>Save & Process</div>
                    <div style={{ fontSize: '14px', opacity: '0.8' }}>Save video first, then apply transcription</div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Audio Sources Status Display */}
            <div style={{
              backgroundColor: '#f8fafc',
              padding: '16px',
              borderRadius: '12px',
              marginTop: '16px',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{
                fontWeight: '600',
                fontSize: '14px',
                color: '#374151',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>🎵</span>
                Audio Sources Status
              </div>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                fontSize: '13px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: audioSources.microphone ? '#10b981' : '#6b7280'
                  }}></span>
                  Microphone: {audioSources.microphone ? 'Active' : 'Not detected'}
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: audioSources.system ? '#10b981' : '#6b7280'
                  }}></span>
                  System Audio: {audioSources.system ? 'Active (Meeting audio captured)' : 'Not captured'}
                </div>
                {!audioSources.system && isRecording && currentMode === 'screen' && (
                  <div style={{
                    fontSize: '12px',
                    color: '#dc2626',
                    fontWeight: '500',
                    marginTop: '4px'
                  }}>
                    ⚠️ Meeting participants may not be audible
                  </div>
                )}
              </div>
            </div>
            
            {/* Recording Buttons */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              marginTop: '24px'
            }}>
              {!isRecording ? (
                <>
                  <button
                    onClick={startCameraRecording}
                    disabled={!isConnected}
                    style={{
                      background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                      color: 'white',
                      border: 'none',
                      padding: '14px 20px',
                      borderRadius: '12px',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: isConnected ? 'pointer' : 'not-allowed',
                      opacity: isConnected ? '1' : '0.5',
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <span>🎤</span> Microphone Recording
                    <span style={{
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '12px'
                    }}>Audio only - Live transcription</span>
                  </button>
                  
                  <button
                    onClick={startScreenRecording}
                    disabled={!isConnected}
                    style={{
                      background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                      color: 'white',
                      border: 'none',
                      padding: '14px 20px',
                      borderRadius: '12px',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: isConnected ? 'pointer' : 'not-allowed',
                      opacity: isConnected ? '1' : '0.5',
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <span>🖥️</span> Screen Audio Recording
                    <span style={{
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '12px'
                    }}>Audio only - Live transcription</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={stopRecording}
                  style={{
                    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                    color: 'white',
                    border: 'none',
                    padding: '14px 20px',
                    borderRadius: '12px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <span>⏹️</span> Stop Recording
                </button>
              )}
            </div>
          </div>

          {/* Video Upload Section */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontSize: '20px' }}>📁</span>
                <h3 style={{
                  margin: '0',
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#374151'
                }}>Video Upload & Extract</h3>
              </div>
              
              <button
                onClick={() => setShowVideoUpload(!showVideoUpload)}
                style={{
                  backgroundColor: showVideoUpload ? '#3b82f6' : '#f3f4f6',
                  color: showVideoUpload ? 'white' : '#6b7280',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: '500',
                  transition: 'all 0.3s ease'
                }}
              >
                {showVideoUpload ? 'Hide' : 'Show'}
              </button>
            </div>

            {showVideoUpload && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* File Upload Area */}
                <div style={{
                  border: uploadedVideo ? '2px solid #10b981' : '2px dashed #d1d5db',
                  borderRadius: '12px',
                  padding: '24px',
                  textAlign: 'center',
                  backgroundColor: uploadedVideo ? '#f0f9ff' : '#f9fafb',
                  transition: 'all 0.3s ease'
                }}>
                  {!uploadedVideo ? (
                    <div>
                      <div style={{ fontSize: '48px', marginBottom: '12px' }}>📹</div>
                      <p style={{
                        margin: '0 0 16px 0',
                        fontSize: '16px',
                        fontWeight: '500',
                        color: '#374151'
                      }}>
                        Upload a recorded video to extract transcript
                      </p>
                      <p style={{
                        margin: '0 0 20px 0',
                        fontSize: '14px',
                        color: '#6b7280'
                      }}>
                        Supports: MP4, AVI, MOV, WebM (Max: 500MB)
                      </p>
                      
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleVideoUpload}
                        accept="video/*"
                        style={{ display: 'none' }}
                      />
                      
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          color: 'white',
                          border: 'none',
                          padding: '12px 24px',
                          borderRadius: '10px',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease'
                        }}
                      >
                        Choose Video File
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
                      <p style={{
                        margin: '0 0 8px 0',
                        fontSize: '16px',
                        fontWeight: '500',
                        color: '#10b981'
                      }}>
                        Video Selected
                      </p>
                      <p style={{
                        margin: '0 0 16px 0',
                        fontSize: '14px',
                        color: '#6b7280',
                        wordBreak: 'break-word'
                      }}>
                        {uploadedVideo.name} ({(uploadedVideo.size / (1024 * 1024)).toFixed(2)} MB)
                      </p>
                      
                      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                        <button
                          onClick={processUploadedVideo}
                          disabled={isProcessingVideo}
                          style={{
                            background: isProcessingVideo 
                              ? 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)'
                              : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                            color: 'white',
                            border: 'none',
                            padding: '12px 24px',
                            borderRadius: '10px',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: isProcessingVideo ? 'not-allowed' : 'pointer',
                            transition: 'all 0.3s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}
                        >
                          {isProcessingVideo ? (
                            <>
                              <span>⏳</span> Processing...
                            </>
                          ) : (
                            <>
                              <span>🎯</span> Extract Transcript
                            </>
                          )}
                        </button>
                        
                        <button
                          onClick={clearUploadedVideo}
                          disabled={isProcessingVideo}
                          style={{
                            backgroundColor: '#f3f4f6',
                            color: '#6b7280',
                            border: 'none',
                            padding: '12px 16px',
                            borderRadius: '10px',
                            fontSize: '14px',
                            fontWeight: '500',
                            cursor: isProcessingVideo ? 'not-allowed' : 'pointer',
                            opacity: isProcessingVideo ? 0.5 : 1,
                            transition: 'all 0.3s ease'
                          }}
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Processing Progress */}
                {isProcessingVideo && (
                  <div style={{
                    backgroundColor: '#f8fafc',
                    borderRadius: '12px',
                    padding: '16px',
                    border: '1px solid #e2e8f0'
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '8px'
                    }}>
                      <span style={{
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#374151'
                      }}>
                        Processing Video...
                      </span>
                      <span style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#3b82f6'
                      }}>
                        {Math.round(videoProcessingProgress)}%
                      </span>
                    </div>
                    
                    <div style={{
                      backgroundColor: '#e2e8f0',
                      borderRadius: '6px',
                      height: '8px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        backgroundColor: '#3b82f6',
                        height: '100%',
                        width: `${videoProcessingProgress}%`,
                        transition: 'width 0.3s ease',
                        borderRadius: '6px'
                      }} />
                    </div>
                  </div>
                )}

                {/* Transcript Result */}
                {videoTranscript && !isProcessingVideo && (
                  <div style={{
                    backgroundColor: '#f0f9ff',
                    borderRadius: '12px',
                    padding: '16px',
                    border: '1px solid #bae6fd'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '12px'
                    }}>
                      <span style={{ fontSize: '16px' }}>✅</span>
                      <span style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#0369a1'
                      }}>
                        Transcript Extracted Successfully!
                      </span>
                    </div>
                    
                    <div style={{
                      fontSize: '12px',
                      color: '#0369a1',
                      marginBottom: '8px'
                    }}>
                      Duration: {videoTranscript.duration ? `${videoTranscript.duration.toFixed(1)}s` : 'Unknown'} | 
                      Segments: {videoTranscript.segments ? videoTranscript.segments.length : 0} | 
                      Language: {videoTranscript.language || 'Auto-detected'}
                    </div>
                    
                    <p style={{
                      margin: '0',
                      fontSize: '14px',
                      color: '#374151',
                      fontStyle: 'italic'
                    }}>
                      Transcript has been added to the live transcription panel above ↑
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Live Transcription */}
        <div style={{
          width: '400px',
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e5e7eb',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{ fontSize: '20px' }}>🎙️</span>
              <h3 style={{
                margin: '0',
                fontSize: '18px',
                fontWeight: '600',
                color: '#374151'
              }}>Live Transcription</h3>
            </div>
            
            <button
              onClick={clearTranscripts}
              style={{
                backgroundColor: '#f3f4f6',
                color: '#6b7280',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              Clear
            </button>
          </div>

          {/* Live Statistics */}
          {isRecording && (
            <div style={{
              backgroundColor: '#f8fafc',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px',
              border: '1px solid #e2e8f0'
            }}>
              <h4 style={{
                margin: '0 0 12px 0',
                fontSize: '14px',
                fontWeight: '600',
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>📊</span> Live Statistics
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px'
                }}>
                  <span>{microphoneActive ? '🎤' : '🔇'}</span>
                  <div style={{
                    color: microphoneActive ? '#10b981' : '#ef4444',
                    fontWeight: '500'
                  }}>
                    {microphoneActive ? 'Mic Active' : 'Mic Silent'}
                  </div>
                  <div style={{
                    width: '40px',
                    height: '8px',
                    backgroundColor: '#e5e7eb',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${audioLevel}%`,
                      height: '100%',
                      backgroundColor: microphoneActive ? '#10b981' : '#ef4444',
                      transition: 'width 0.1s ease'
                    }}></div>
                  </div>
                </div>
              </h4>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px'
              }}>
                <div style={{
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  padding: '12px',
                  textAlign: 'center',
                  border: '1px solid #e2e8f0'
                }}>
                  <div style={{
                    fontSize: '20px',
                    fontWeight: '700',
                    color: '#3b82f6'
                  }}>{audioChunkCount}</div>
                  <div style={{
                    fontSize: '12px',
                    color: '#64748b',
                    fontWeight: '500'
                  }}>Audio Chunks</div>
                </div>
              </div>
              <div style={{
                marginTop: '12px',
                backgroundColor: 'white',
                borderRadius: '8px',
                padding: '12px',
                textAlign: 'center',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{
                  fontSize: '20px',
                  fontWeight: '700',
                  color: '#8b5cf6'
                }}>{captions.length}</div>
                <div style={{
                  fontSize: '12px',
                  color: '#64748b',
                  fontWeight: '500'
                }}>Transcripts</div>
              </div>

              {/* Audio Sources Status */}
              {currentMode === 'screen' && (
                <div style={{
                  marginTop: '12px',
                  padding: '8px',
                  backgroundColor: 'white',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0'
                }}>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#475569',
                    marginBottom: '6px'
                  }}>Audio Sources:</div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '11px'
                  }}>
                    <div style={{
                      color: audioSources.system ? '#10b981' : '#ef4444'
                    }}>
                      {audioSources.system ? '🔊' : '🔇'} System Audio
                    </div>
                    <div style={{
                      color: audioSources.microphone ? '#10b981' : '#ef4444'
                    }}>
                      {audioSources.microphone ? '🎤' : '🔇'} Microphone
                    </div>
                  </div>
                </div>
              )}

              {/* Microphone Test Button */}
              <button
                onClick={() => {
                  navigator.mediaDevices.getUserMedia({ audio: true })
                    .then(stream => {
                      console.log('✅ Microphone test successful');
                      const tracks = stream.getAudioTracks();
                      console.log('🎤 Audio tracks:', tracks.map(t => ({
                        label: t.label,
                        enabled: t.enabled,
                        readyState: t.readyState,
                        settings: t.getSettings()
                      })));
                      stream.getTracks().forEach(track => track.stop());
                      alert('Microphone access successful! Check console for details.');
                    })
                    .catch(error => {
                      console.error('❌ Microphone test failed:', error);
                      alert('Microphone test failed: ' + error.message);
                    });
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  marginTop: '8px',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                🔧 Test Microphone
              </button>
            </div>
          )}
          
          <div style={{
            flex: '1',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {captions.length === 0 ? (
              <div style={{
                textAlign: 'center',
                color: '#9ca3af',
                padding: '40px 20px',
                fontSize: '14px'
              }}>
                Start recording to see transcriptions
              </div>
            ) : (
              captions.map((caption) => {
                // Speaker-specific styling
                const isYou = caption.speaker === 'you';
                const isOther = caption.speaker === 'other';
                
                const speakerColors = {
                  you: {
                    background: '#eff6ff',
                    border: '#3b82f6',
                    badge: '#3b82f6',
                    icon: '🎤'
                  },
                  other: {
                    background: '#f0fdf4',
                    border: '#10b981',
                    badge: '#10b981',
                    icon: '🔊'
                  },
                  unknown: {
                    background: '#f8fafc',
                    border: '#6b7280',
                    badge: '#6b7280',
                    icon: '❓'
                  }
                };
                
                // Special styling for video transcripts
                if (caption.isFromVideo) {
                  speakerColors.unknown = {
                    background: '#fef3c7',
                    border: '#f59e0b',
                    badge: '#f59e0b',
                    icon: '📹'
                  };
                }
                
                const colors = speakerColors[caption.speaker] || speakerColors.unknown;
                
                return (
                  <div key={caption.id} style={{
                    backgroundColor: colors.background,
                    padding: '16px',
                    borderRadius: '12px',
                    border: `1px solid ${colors.border}20`,
                    borderLeft: `4px solid ${colors.border}`
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '8px'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <span style={{ fontSize: '12px' }}>{colors.icon}</span>
                        <span style={{
                          fontSize: '12px',
                          color: '#6b7280',
                          fontWeight: '500'
                        }}>
                          {caption.time}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {caption.isFromVideo && (
                          <span style={{
                            backgroundColor: '#f59e0b',
                            color: 'white',
                            padding: '2px 6px',
                            borderRadius: '10px',
                            fontSize: '10px',
                            fontWeight: '600'
                          }}>
                            VIDEO
                          </span>
                        )}
                        <span style={{
                          backgroundColor: colors.badge,
                          color: 'white',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '600'
                        }}>
                          {caption.confidence}%
                        </span>
                      </div>
                    </div>
                    <p style={{
                      margin: '0',
                      fontSize: '14px',
                      color: '#374151',
                      lineHeight: '1.5'
                    }}>
                      {caption.text}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Transcript Viewer Modal */}
      <TranscriptViewer />
    </div>
    </>
  );
}

export default App;
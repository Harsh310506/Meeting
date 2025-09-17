# Enhanced ASR Integration Guide

## Overview

This enhanced ASR system integrates the advanced Whisper optimization techniques from your provided code with your existing WebSocket-based meeting monitor. The system is specifically optimized for RTX 3050 Ti 4GB VRAM with maximum accuracy settings.

## Key Features

### 🎯 Advanced Whisper Optimization
- **Large-v2 model** with int8 quantization for 4GB VRAM compatibility
- **Hyperparameters tuned for accuracy**: beam_size=10, best_of=10, temperature=0.0
- **Hallucination prevention**: condition_on_previous_text=False, no_repeat_ngram_size=3
- **Voice Activity Detection**: Filters silence and noise automatically
- **Confidence filtering**: Removes low-quality segments based on avg_logprob

### 🔧 Audio Preprocessing 
- **FFmpeg integration** for optimal audio format conversion
- **16kHz mono conversion** (Whisper's preferred format)
- **Noise reduction and normalization** options
- **Real-time audio buffering** with overlap for continuity

### ⚡ Performance Optimization
- **GPU memory management** for RTX 3050 Ti constraints  
- **Asynchronous processing** for real-time transcription
- **Configurable quality vs speed** trade-offs
- **Memory cleanup** and session management

## Installation

1. **Install FFmpeg** (required for audio preprocessing):
   ```powershell
   # Using chocolatey (recommended)
   choco install ffmpeg
   
   # Or download from https://ffmpeg.org/download.html
   # Add to PATH environment variable
   ```

2. **Install Python dependencies**:
   ```powershell
   cd backend
   pip install -r requirements.txt
   ```

3. **Verify GPU setup** (optional but recommended):
   ```python
   import torch
   print(f"CUDA available: {torch.cuda.is_available()}")
   print(f"GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'None'}")
   ```

## Configuration

### Quick Start
```python
from asr_config import asr_config

# Print current configuration
asr_config.print_config_summary()

# Apply RTX 3050 Ti optimizations
config = asr_config.get_optimized_config_for_hardware(gpu_memory_gb=4.0)

# Apply accuracy preset
config = asr_config.get_accuracy_preset("accuracy")  # or "balanced", "speed"
```

### Custom Configuration
```python
from asr_config import update_config, save_config

# Increase accuracy (slower but more precise)
update_config("transcription", 
              beam_size=15, 
              best_of=15, 
              patience=1.5)

# Adjust confidence filtering
update_config("quality",
              min_confidence_threshold=-0.8,
              filter_hallucinations=True)

# Enable advanced preprocessing
update_config("preprocessing",
              normalize_audio=True,
              high_pass_freq=200,
              low_pass_freq=3000)

# Save changes
save_config()
```

## Usage Examples

### 1. WebSocket Integration (Existing Backend)

Your existing `main_websocket_asr.py` should work with minimal changes:

```python
from asr_processor import ASRProcessor
from asr_config import get_model_config, get_transcription_config

# Initialize with enhanced processor
asr_processor = ASRProcessor(
    sample_rate=48000,
    **get_model_config(),
    enable_preprocessing=True
)

# Your existing WebSocket code works the same
@websocket_endpoint("/ws")
async def websocket_endpoint(websocket: WebSocket):
    # ... existing code ...
    
    # Process audio chunks as before
    transcript = await asr_processor.process_audio_chunk(audio_data, timestamp)
    
    if transcript:
        await websocket.send_text(json.dumps(transcript))
```

### 2. File Upload Processing

```python
# Process uploaded files with enhanced accuracy
@app.post("/upload-audio")
async def upload_audio(file: UploadFile):
    # Save uploaded file
    temp_path = f"temp_{file.filename}"
    with open(temp_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    # Process with enhanced ASR
    result = await asr_processor.process_uploaded_file(temp_path)
    
    # Return enhanced transcript
    return {
        "success": not result.get("error"),
        "transcripts": result.get("transcripts", []),
        "summary": result.get("summary", {})
    }
```

### 3. Configuration Monitoring

```python
@app.get("/asr/status")
async def get_asr_status():
    return {
        "model_info": asr_processor.get_model_info(),
        "performance": asr_processor.get_performance_report(),
        "ready": asr_processor.enhanced_whisper.is_ready()
    }

@app.post("/asr/config")
async def update_asr_config(config_updates: dict):
    # Update configuration at runtime
    for section, params in config_updates.items():
        update_config(section, **params)
    
    # Apply to processor
    asr_processor.update_model_config(**get_transcription_config())
    
    return {"status": "updated"}
```

## Performance Tuning

### For Maximum Accuracy
```python
# Apply these settings for highest quality (slower)
update_config("transcription",
              beam_size=15,
              best_of=15,
              temperature=0.0,
              patience=1.5,
              chunk_length=25)

update_config("quality",
              min_confidence_threshold=-0.5,
              min_word_confidence=0.6,
              filter_hallucinations=True)
```

### For Real-Time Performance  
```python
# Apply these settings for speed (lower quality)
update_config("transcription",
              beam_size=5,
              best_of=5,
              temperature=0.1,
              chunk_length=15)

update_config("quality",
              min_confidence_threshold=-1.5,
              filter_hallucinations=False)
```

### Memory Optimization (RTX 3050 Ti)
```python
# Optimize for 4GB VRAM
update_config("model",
              compute_type="int8",
              num_workers=1)

update_config("performance",
              max_concurrent_transcriptions=1,
              enable_gpu_memory_fraction=0.9,
              memory_cleanup_interval=30)
```

## Monitoring and Debugging

### 1. Performance Metrics
```python
# Get detailed performance report
report = asr_processor.get_performance_report()
print(f"Success rate: {report['processing_stats']['success_rate']:.1f}%")
print(f"Average processing time: {report['processing_stats']['average_processing_time']:.2f}s")
print(f"Segments filtered: {report['whisper_stats']['filter_rate']:.1f}%")
```

### 2. Export Transcripts
```python
# Export session transcripts in different formats
txt_transcript = asr_processor.export_session_transcript("txt")
json_transcript = asr_processor.export_session_transcript("json") 
srt_transcript = asr_processor.export_session_transcript("srt")

# Save to file
with open("meeting_transcript.txt", "w") as f:
    f.write(txt_transcript)
```

### 3. Configuration Validation
```python
from asr_config import asr_config

# Check for configuration issues
warnings = asr_config.validate_config()
if warnings:
    print("Configuration warnings:")
    for warning in warnings:
        print(f"  - {warning}")
```

## Troubleshooting

### Common Issues

1. **Model not loading on GPU**
   - Check CUDA availability: `torch.cuda.is_available()`
   - Try fallback: set `device="cpu"` and `compute_type="int8"`
   - Reduce model size: use "medium" instead of "large-v2"

2. **Out of memory errors**
   - Reduce `beam_size` and `best_of` parameters
   - Set `compute_type="int8"` for lower memory usage
   - Decrease `chunk_length` for smaller processing batches

3. **Poor transcription quality**
   - Increase `beam_size` and `best_of` (if memory allows)
   - Lower `min_confidence_threshold` to keep more segments
   - Enable `filter_hallucinations` to remove false content
   - Check audio quality and enable preprocessing

4. **FFmpeg not found**
   - Install FFmpeg: `choco install ffmpeg`
   - Add to PATH or set `enable_preprocessing=False`

### Performance Tips

1. **For meetings/conversations**: Use "balanced" or "accuracy" preset
2. **For noisy environments**: Enable preprocessing and increase confidence thresholds  
3. **For multiple languages**: Set `language=null` in transcription config
4. **For technical content**: Increase `patience` parameter for better handling

## Advanced Configuration

The `asr_config.json` file allows fine-tuning of all parameters:

```json
{
  "model": {
    "model_size": "large-v2",
    "device": "cuda", 
    "compute_type": "int8"
  },
  "transcription": {
    "beam_size": 10,
    "best_of": 10,
    "temperature": 0.0,
    "patience": 1.3,
    "condition_on_previous_text": false,
    "no_repeat_ngram_size": 3,
    "chunk_length": 20,
    "language": "en"
  },
  "quality": {
    "min_confidence_threshold": -1.0,
    "filter_hallucinations": true
  }
}
```

This configuration will be automatically loaded on startup and can be modified at runtime through the API or configuration functions.
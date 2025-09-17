# ASR Configuration Update - Medium Model with GPU Optimization

## Overview
The ASR (Automatic Speech Recognition) system has been upgraded from the `tiny` model to the `medium` model with enhanced hyperparameters for better accuracy, specifically optimized for GPU usage.

## Changes Made

### 1. Model Configuration
- **Model Size**: Upgraded from `tiny` to `medium`
- **Device**: Changed from `cpu` to `cuda` (GPU)
- **Compute Type**: Set to `float16` for optimal GPU performance and memory usage

### 2. Enhanced Hyperparameters

The transcription now uses the following optimized parameters:

```python
# 🔹 Decoding strategy for better accuracy
beam_size=8                    # wider beam search → more accurate (slower but worth it)
best_of=8                      # rerank multiple candidates → avoids wrong word choices
temperature=0.0                # deterministic → no random "hallucinations"

# 🔹 Stability & accuracy for longer speech
patience=1.2                   # allows longer sequences if model is unsure
condition_on_previous_text=True # uses past context for better continuity
no_repeat_ngram_size=3         # prevents "repeated phrases"

# 🔹 Noise & silence handling
vad_filter=True                # voice activity detection → cuts background noise
vad_parameters={"min_silence_duration_ms": 500}

# 🔹 Chunking for memory stability
chunk_length=30                # process in 30s chunks → avoids memory overflow
```

### 3. Fallback Mechanism
Added automatic fallback to CPU with `float32` if CUDA is not available:
- Primary: `medium` model on `cuda` with `float16`
- Fallback: `medium` model on `cpu` with `float32`

### 4. Updated Dependencies
Added the following packages to `requirements.txt`:
- `faster-whisper>=0.10.0`
- `soundfile>=0.12.1`
- `webrtcvad>=2.0.10`

## Benefits

### Accuracy Improvements
- **Medium model**: Significantly better transcription accuracy compared to tiny model
- **Enhanced beam search**: More thorough exploration of possible transcriptions
- **Context awareness**: Better handling of longer conversations
- **Noise reduction**: Improved performance in noisy environments

### Performance Optimizations
- **GPU acceleration**: Much faster processing with CUDA
- **FP16 precision**: Reduced memory usage while maintaining quality
- **Chunking**: Stable processing of long audio streams
- **VAD integration**: Efficient processing by focusing on speech segments

## Hardware Requirements

### Minimum GPU Requirements
- **VRAM**: 2-3 GB for medium model with float16
- **CUDA**: Compatible NVIDIA GPU with CUDA support
- **Compute Capability**: 6.0 or higher recommended

### Fallback (CPU)
- **RAM**: 4-6 GB available for medium model
- **Performance**: Significantly slower than GPU but still functional

## Testing

Run the test script to verify the configuration:

```bash
cd backend
python test_medium_asr.py
```

This will:
1. Check CUDA availability
2. Load the medium model
3. Process test audio
4. Display performance metrics

## Usage

The ASR processor now automatically uses the medium model configuration:

```python
from asr_processor import ASRProcessor

# Creates ASR with medium model on GPU by default
asr = ASRProcessor(sample_rate=48000)
asr.set_session("my_session")

# Process audio chunks
result = await asr.process_audio_chunk(audio_data, timestamp)
```

## Performance Expectations

### Medium Model vs Tiny Model
- **Accuracy**: 15-25% improvement in word error rate
- **Language Detection**: More reliable language identification
- **Technical Terms**: Better handling of domain-specific vocabulary
- **Processing Speed**: 2-3x faster on GPU vs CPU, ~30% slower than tiny model

### GPU vs CPU Performance
- **GPU (CUDA + FP16)**: ~5-10x faster than CPU
- **Memory Usage**: ~2-3 GB VRAM vs 4-6 GB RAM
- **Power Efficiency**: More efficient for continuous processing

## Troubleshooting

### Common Issues

1. **CUDA Out of Memory**
   - Reduce `chunk_length` parameter
   - Use smaller batch sizes
   - Close other GPU applications

2. **Model Loading Fails**
   - Check CUDA installation
   - Verify GPU compatibility
   - System will automatically fallback to CPU

3. **Slow Performance**
   - Ensure proper GPU drivers
   - Check for CPU fallback in logs
   - Monitor GPU utilization

### Configuration Tuning

For different use cases, you can adjust:

```python
# For real-time processing (faster, less accurate)
beam_size=5
best_of=5
chunk_length=15

# For high accuracy (slower, more accurate)
beam_size=10
best_of=10
patience=2.0
chunk_length=45
```

## Files Modified

1. `asr_processor.py` - Main ASR implementation
2. `requirements.txt` - Added dependencies
3. `test_medium_asr.py` - New test script
4. `ASR_UPGRADE_README.md` - This documentation

## Next Steps

Consider these additional enhancements:
1. **Speaker Diarization**: Identify different speakers
2. **Custom Vocabulary**: Fine-tune for domain-specific terms
3. **Real-time Streaming**: Reduce latency for live applications
4. **Multi-language**: Support automatic language detection
5. **Quality Metrics**: Add confidence scoring and quality assessment
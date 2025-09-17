# CUDA Installation Guide for Meeting Monitor

## Overview
To use GPU acceleration for faster transcription and sentiment analysis, you need to install CUDA and cuDNN libraries that are compatible with your PyTorch version.

## Current System Requirements
- **PyTorch Version**: 2.8.0
- **Required CUDA Version**: 12.4
- **Required cuDNN Version**: 9.1.0

## Step-by-Step Installation

### 1. Check Your GPU
First, verify you have a CUDA-compatible NVIDIA GPU:
```powershell
nvidia-smi
```
If this command doesn't work, install/update your NVIDIA drivers first.

### 2. Install CUDA Toolkit 12.4
1. Download from: https://developer.nvidia.com/cuda-12-4-0-download-archive
2. Choose: Windows > x86_64 > 11 > exe (network)
3. Run the installer as Administrator
4. Select "Express Installation" (recommended)
5. Default installation path: `C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.4`

### 3. Install cuDNN 9.1.0
1. Download from: https://developer.nvidia.com/cudnn-downloads
2. Create NVIDIA Developer account if needed
3. Download "cuDNN v9.1.0 for CUDA 12.x"
4. Extract the ZIP file
5. Copy files to CUDA installation:
   ```
   Copy from cuDNN ZIP:
   ├── bin\cudnn*.dll → C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.4\bin\
   ├── include\cudnn*.h → C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.4\include\
   └── lib\x64\cudnn*.lib → C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.4\lib\x64\
   ```

### 4. Update System PATH
Add to System Environment Variables > PATH:
```
C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.4\bin
C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.4\libnvvp
```

### 5. Restart and Verify
1. **Restart your computer** (important!)
2. **Restart VS Code/terminal**
3. Test CUDA installation:
```powershell
nvcc --version
```

### 6. Verify in Meeting Monitor
Run this to check if CUDA is working:
```powershell
cd backend
python -c "import torch; print(f'CUDA available: {torch.cuda.is_available()}'); print(f'CUDA version: {torch.version.cuda}'); print(f'GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else \"None\"}')"
```

## Alternative: CPU-Only Mode
If you prefer to skip GPU setup or encounter issues, you can force CPU mode by setting this environment variable:
```powershell
$env:FORCE_CPU_MODE="true"
python main_consolidated.py
```

## Troubleshooting

### "Could not locate cudnn_ops64_9.dll"
- cuDNN not properly installed
- Check that DLL files are in CUDA\v12.4\bin folder
- Verify PATH includes CUDA bin directory
- Restart terminal after PATH changes

### "CUDA out of memory"
- Close other GPU applications (games, video editing, etc.)
- Use smaller Whisper model: set `model_size="small"` in code
- Restart computer to free GPU memory

### "No CUDA-capable device"
- Update NVIDIA drivers
- Check GPU is CUDA-compatible: https://developer.nvidia.com/cuda-gpus
- Verify GPU is properly seated and powered

### "CUDA Runtime Error"
- Uninstall and reinstall CUDA Toolkit
- Ensure PyTorch CUDA version matches installed CUDA
- Check for Windows updates

## Performance Benefits
With proper CUDA setup, you'll see:
- **3-5x faster** Whisper transcription
- **2-3x faster** DistilBERT sentiment analysis  
- **Real-time processing** for longer meetings
- **Lower CPU usage** (work moved to GPU)

## Version Compatibility Table
| PyTorch | CUDA Toolkit | cuDNN | Status |
|---------|-------------|--------|---------|
| 2.8.0   | 12.4        | 9.1.0  | ✅ Recommended |
| 2.7.x   | 12.1        | 8.9.x  | ⚠️ May work |
| 2.6.x   | 11.8        | 8.8.x  | ❌ Not recommended |

Your system currently uses PyTorch 2.8.0, so CUDA 12.4 + cuDNN 9.1.0 is the optimal combination.
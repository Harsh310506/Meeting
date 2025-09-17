# Files to Remove After Consolidation

## Essential Files (KEEP)
- main_consolidated.py      # 🔥 NEW - Main consolidated backend
- requirements_consolidated.txt  # 🔥 NEW - Essential dependencies only
- .env / .env.example      # Environment configuration
- requirements.txt         # Original (can be kept for reference)

## Files to Remove (Redundant after consolidation)
- main_websocket_asr.py         # ❌ Merged into consolidated
- main_websocket_asr_backup.py  # ❌ Backup version
- main_websocket_asr_live_video.py # ❌ Video-specific version  
- main_with_asr.py             # ❌ Older ASR version
- main_with_storage.py         # ❌ Storage-focused version
- main_simple_asr.py           # ❌ Simple version
- main.py                      # ❌ Basic version
- asr_processor.py            # ❌ Now embedded in consolidated
- simple_asr.py               # ❌ Simple ASR version
- video_sentiment_processor.py # ❌ Experimental feature

## Test Files (Can be removed)
- test_*.py (all test files)
- fix_syntax.py

## Documentation (Can be moved to docs/ folder)
- ASR_UPGRADE_README.md
- VIDEO_SENTIMENT_ANALYSIS.md

## Directories to Keep
- app/ (if has important modules)
- recorded_sessions/ (data)
- recordings/ (data)
- venv/ (virtual environment)
- __pycache__/ (auto-generated)
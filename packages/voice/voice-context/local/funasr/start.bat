@echo off
chcp 65001 >nul
cd /d "%~dp0"

if not exist .venv (
  echo [first run] creating the Python virtual environment...
  python -m venv .venv
)
call .venv\Scripts\activate.bat

python -c "import fastapi, funasr" >nul 2>&1
if errorlevel 1 (
  echo [dependencies] installing FunASR and the API server...
  python -m pip install --upgrade pip
  python -m pip install -r requirements.txt
)

python -c "import torch, torchaudio" >nul 2>&1
if errorlevel 1 (
  echo [dependencies] installing CPU torch for FunASR...
  python -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu --extra-index-url https://pypi.org/simple
)

python -c "import faster_whisper" >nul 2>&1
if errorlevel 1 (
  echo [dependencies] installing faster-whisper...
  python -m pip install -r requirements-faster-whisper.txt
)

echo.
echo Starting local STT at http://127.0.0.1:8000
echo Models: iic/SenseVoiceSmall, small, medium, large-v3
echo.
python server.py

#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

if [ ! -d .venv ]; then
  echo "[first run] creating the Python virtual environment..."
  python3 -m venv .venv
fi
source .venv/bin/activate

if ! python -c "import fastapi, funasr" >/dev/null 2>&1; then
  echo "[dependencies] installing FunASR and the API server..."
  python -m pip install --upgrade pip
  python -m pip install -r requirements.txt
fi

if ! python -c "import torch, torchaudio" >/dev/null 2>&1; then
  echo "[dependencies] installing CPU torch for FunASR..."
  python -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu --extra-index-url https://pypi.org/simple
fi

if ! python -c "import faster_whisper" >/dev/null 2>&1; then
  echo "[dependencies] installing faster-whisper..."
  python -m pip install -r requirements-faster-whisper.txt
fi

echo
echo "Starting local STT at http://127.0.0.1:8000"
echo "Models: iic/SenseVoiceSmall, small, medium, large-v3"
echo
python server.py

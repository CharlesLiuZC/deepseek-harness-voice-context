# Local speech-to-text server

English | [中文](README.zh.md)

This directory contains the companion OpenAI-compatible speech-to-text server for Voice Context. It supports FunASR SenseVoiceSmall and local faster-whisper CTranslate2 models behind one `POST /v1/audio/transcriptions` endpoint.

## Supported models

| Public model id | Engine | Intended use | Download behavior |
|---|---|---|---|
| `iic/SenseVoiceSmall` | FunASR | Fast Chinese-first transcription | FunASR downloads it on first use |
| `small` | faster-whisper | Fast multilingual transcription | Run `download_models.py small` |
| `medium` | faster-whisper | Higher multilingual accuracy | Run `download_models.py medium` |
| `large-v3` | faster-whisper | Highest-quality local Whisper option | Run `download_models.py large-v3` |

The server accepts only these ids. It does not treat caller-provided paths or repository names as models.

## Quick start

Windows:

```bat
start.bat
```

Linux or macOS:

```sh
bash start.sh
```

The script creates `.venv`, installs the server, both inference engines, and CPU torch, then listens on `http://127.0.0.1:8000`. Replace the torch installation in the script with a compatible CUDA build when GPU inference is required.

SenseVoiceSmall downloads automatically on first use. Download faster-whisper weights explicitly after the virtual environment exists:

```powershell
.venv\Scripts\python download_models.py small
.venv\Scripts\python download_models.py medium large-v3
.venv\Scripts\python download_models.py all
```

```sh
.venv/bin/python download_models.py small
.venv/bin/python download_models.py medium large-v3
.venv/bin/python download_models.py all
```

The helper downloads from the allowlisted `Systran/faster-whisper-*` Hugging Face repositories with one worker. Model files remain under `models/faster-whisper/` and are ignored by Git.

## Health and model discovery

```sh
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/v1/models
```

`/health` reports the default model, currently loaded model, installed model ids, and inference device. `/v1/models` returns an OpenAI-style model list containing only models available to this server.

## Transcribe audio

```sh
curl http://127.0.0.1:8000/v1/audio/transcriptions \
  -F "file=@audio.wav" \
  -F "model=small" \
  -F "language=zh"
```

Supported audio suffixes are WAV, MP3, FLAC, OGG, M4A, OPUS, and AAC. The server preserves the uploaded suffix for decoder selection, removes SenseVoice tag prefixes, and returns clean transcript text. See [`client_example.py`](client_example.py) for a Python client.

## Connect to DeepSeek Harness

Point the Voice Context entry at the same loopback port:

```yaml
- id: voice-context
  name: '@deepseek-ai/dsh-voice-context'
  config:
    baseUrl: http://127.0.0.1:8000
    model: iic/SenseVoiceSmall
    language: zh
    localPort: 8000
```

The browser's explicit local selection uses `localPort`; `baseUrl` remains the deployment's configured cloud origin when cloud mode is enabled. Loopback requests never receive the cloud bearer credential.

The `/voice-local status|install|start|stop` command can install and manage this server as a child of the DeepSeek Harness process. A server started by the command stops with its owning Harness process.

## Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `STT_MODEL` | `iic/SenseVoiceSmall` | Fallback used when the request sends `model=local` |
| `STT_MODEL_ROOT` | `./models/faster-whisper` | CTranslate2 model directory |
| `STT_DEVICE` | `cpu` | faster-whisper device: `cpu` or `cuda` |
| `STT_HOST` | `127.0.0.1` | Listening interface when running `server.py` |
| `STT_PORT` | `8000` | Listening port when running `server.py` |

Copy `.env.example` to `.env` to persist local overrides. The `.env` file is ignored by Git.

## Runtime behavior and security

- Model loading and inference are serialized. One model remains resident; selecting another evicts it after the replacement loads.
- CPU faster-whisper uses `int8`; non-CPU devices use `float16`.
- An unavailable but allowlisted faster-whisper model returns HTTP 400. A model load or inference failure returns HTTP 503.
- The service has no authentication and binds to loopback by default. Exposing it with `STT_HOST=0.0.0.0` requires a trusted reverse proxy, authentication, and transport security.
- FunASR does not install torch because torch builds are hardware-specific. The start scripts install the CPU wheels explicitly; custom GPU deployments must choose their own compatible torch build.

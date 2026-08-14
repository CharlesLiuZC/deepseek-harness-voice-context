"""Local OpenAI-compatible speech-to-text server.

The ``model`` multipart field selects one of the installed local models for
each request. Only one model stays resident at a time, which keeps switching
between SenseVoiceSmall and the larger Whisper variants practical on a
workstation with bounded memory.
"""

import gc
import os
import re
import tempfile
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from starlette.concurrency import run_in_threadpool

ROOT = Path(__file__).resolve().parent
CONFIGURED_MODEL_ROOT = Path(
    os.environ.get("STT_MODEL_ROOT", "models/faster-whisper")
)
MODEL_ROOT = (
    CONFIGURED_MODEL_ROOT
    if CONFIGURED_MODEL_ROOT.is_absolute()
    else ROOT / CONFIGURED_MODEL_ROOT
)
SENSEVOICE_MODEL = "iic/SenseVoiceSmall"
WHISPER_MODELS = ("small", "medium", "large-v3")
LEGACY_ENGINE = os.environ.get("STT_ENGINE", "funasr")
LEGACY_DEFAULT = "small" if LEGACY_ENGINE == "faster-whisper" else SENSEVOICE_MODEL
DEFAULT_MODEL = os.environ.get("STT_MODEL", LEGACY_DEFAULT)
DEVICE = os.environ.get("STT_DEVICE", "cpu")

app = FastAPI(title="DeepSeek Harness local STT", version="2.0.0")

_model_lock = threading.RLock()
_loaded_key: str | None = None
_loaded_model: Any = None

# SenseVoiceSmall prefixes transcripts with tags such as
# <|zh|><|NEUTRAL|><|Speech|><|withitn|>.
_TAG_RE = re.compile(r"^(?:<\|[^|]*\|>)+\s*")


@dataclass(frozen=True)
class ModelSpec:
    """One safe, server-owned model selection."""

    model_id: str
    engine: str
    source: str


def _available_whisper(model_id: str) -> bool:
    return (MODEL_ROOT / model_id / "model.bin").is_file()


def available_model_ids() -> list[str]:
    """Return selectable model ids whose local files are installed."""
    return [
        SENSEVOICE_MODEL,
        *(model_id for model_id in WHISPER_MODELS if _available_whisper(model_id)),
    ]


def resolve_model(model_id: str) -> ModelSpec:
    """Resolve a public id without allowing arbitrary paths or downloads."""
    selected = DEFAULT_MODEL if model_id in ("", "local") else model_id
    if selected in (SENSEVOICE_MODEL, "sensevoice-small"):
        return ModelSpec(SENSEVOICE_MODEL, "funasr", SENSEVOICE_MODEL)
    if selected in WHISPER_MODELS:
        source = MODEL_ROOT / selected
        if not _available_whisper(selected):
            raise HTTPException(
                status_code=400,
                detail=f"local model {selected!r} is not installed",
            )
        return ModelSpec(selected, "faster-whisper", str(source))
    raise HTTPException(
        status_code=400,
        detail=(
            f"unsupported local model {selected!r}; "
            f"choose one of {available_model_ids()}"
        ),
    )


def _load_funasr(source: str):
    from funasr import AutoModel

    return AutoModel(model=source, disable_update=True)


def _load_faster_whisper(source: str):
    from faster_whisper import WhisperModel

    compute_type = "int8" if DEVICE == "cpu" else "float16"
    return WhisperModel(source, device=DEVICE, compute_type=compute_type)


def get_model(spec: ModelSpec):
    """Lazily load the requested model and evict the previous resident model."""
    global _loaded_key, _loaded_model
    with _model_lock:
        if _loaded_key == spec.model_id and _loaded_model is not None:
            return _loaded_model
        loaded = (
            _load_funasr(spec.source)
            if spec.engine == "funasr"
            else _load_faster_whisper(spec.source)
        )
        _loaded_key = spec.model_id
        _loaded_model = loaded
        gc.collect()
        return loaded


def _temporary_audio(audio: bytes, filename: str | None):
    suffix = Path(filename or "").suffix.lower()
    if suffix not in (".wav", ".mp3", ".flac", ".ogg", ".m4a", ".opus", ".aac"):
        suffix = ".wav"
    return tempfile.NamedTemporaryFile(suffix=suffix, delete=False)


def _transcribe_sync(
    audio: bytes,
    filename: str | None,
    language: str,
    spec: ModelSpec,
) -> dict[str, str]:
    """Load and run one model under the shared inference lock."""
    with _model_lock:
        loaded = get_model(spec)
        with _temporary_audio(audio, filename) as temporary:
            temporary.write(audio)
            path = temporary.name
        try:
            if spec.engine == "funasr":
                result = loaded.generate(
                    input=path,
                    language=language or "auto",
                    use_itn=True,
                )
                if not result:
                    return {"text": "", "model": spec.model_id}
                first = result[0]
                text = first.get("text", "") if isinstance(first, dict) else str(first)
                return {
                    "text": _TAG_RE.sub("", text).strip(),
                    "model": spec.model_id,
                }

            language_hint = None if language in ("", "auto") else language
            segments, info = loaded.transcribe(path, language=language_hint)
            return {
                "text": "".join(segment.text for segment in segments).strip(),
                "language": info.language,
                "model": spec.model_id,
            }
        finally:
            os.unlink(path)


@app.post("/v1/audio/transcriptions")
async def transcribe(
    file: UploadFile = File(...),
    model: str = Form("local"),
    language: str = Form("auto"),
):
    """Transcribe through the model explicitly selected by the caller."""
    audio = await file.read()
    if not audio:
        return {"text": "", "model": resolve_model(model).model_id}
    spec = resolve_model(model)
    try:
        return await run_in_threadpool(
            _transcribe_sync,
            audio,
            file.filename,
            language,
            spec,
        )
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=503,
            detail=f"model {spec.model_id!r} failed: {error}",
        ) from error


@app.get("/v1/models")
async def models():
    return {
        "object": "list",
        "data": [
            {
                "id": model_id,
                "object": "model",
                "created": 0,
                "owned_by": "local-stt",
            }
            for model_id in available_model_ids()
        ],
    }


@app.get("/health")
async def health():
    return {
        "ok": True,
        "defaultModel": resolve_model(DEFAULT_MODEL).model_id,
        "loadedModel": _loaded_key,
        "availableModels": available_model_ids(),
        "device": DEVICE,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host=os.environ.get("STT_HOST", "127.0.0.1"),
        port=int(os.environ.get("STT_PORT", "8000")),
    )

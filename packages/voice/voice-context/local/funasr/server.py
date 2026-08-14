"""
OpenAI-compatible local STT server for dsh-voice-context.

Runs Alibaba FunASR's SenseVoiceSmall (``iic/SenseVoiceSmall``) — the small
model with the best Chinese accuracy — behind the OpenAI
``POST /v1/audio/transcriptions`` shape that the plugin's node half already
calls. Point the plugin's ``baseUrl`` at this server and speech never leaves
the machine.

Run it:

    cd local/funasr
    pip install -r requirements.txt
    uvicorn server:app --host 127.0.0.1 --port 8080

The first start downloads the SenseVoiceSmall weights from ModelScope
(~1 GB). CPU inference works out of the box and is fast for the small model;
a CUDA torch build runs faster still.
"""

import os
import re
import tempfile

from fastapi import FastAPI, File, Form, UploadFile

from funasr import AutoModel

MODEL_ID = os.environ.get("FUNASR_MODEL", "iic/SenseVoiceSmall")

# disable_update=True skips the ModelScope update check at startup.
model = AutoModel(model=MODEL_ID, disable_update=True)

app = FastAPI(title="dsh-voice-context local STT", version="0.1.0")

# SenseVoiceSmall prefixes its transcript with tag tokens:
#   <|zh|><|NEUTRAL|><|Speech|><|woitn|>实际转写文本
# Strip the leading run of tags so only the transcript survives.
_TAG_RE = re.compile(r"^(?:<\|[^|]*\|>)+\s*")


def _clean(text: str) -> str:
    return _TAG_RE.sub("", text).strip()


@app.post("/v1/audio/transcriptions")
async def transcribe(
    file: UploadFile = File(...),
    model_name: str = Form("sensevoice-small", alias="model"),
    language: str = Form("zh"),
) -> dict:
    """
    Accept the multipart fields the plugin sends (``file``, ``model``,
    ``language``), run SenseVoiceSmall, and answer ``{ "text": ... }``.
    """
    audio = await file.read()
    if not audio:
        return {"text": ""}

    # FunASR's frontend is happiest with a file path; the plugin sends WAV.
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp.write(audio)
        path = tmp.name
    try:
        result = model.generate(input=path, language=language or "auto", use_itn=True)
    finally:
        os.unlink(path)

    if not result:
        return {"text": ""}
    first = result[0]
    text = first.get("text", "") if isinstance(first, dict) else str(first)
    return {"text": _clean(text)}


@app.get("/health")
async def health() -> dict:
    return {"ok": True, "model": MODEL_ID}

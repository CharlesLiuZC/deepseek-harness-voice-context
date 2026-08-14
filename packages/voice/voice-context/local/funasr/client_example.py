"""Call the local OpenAI-compatible transcription endpoint."""

from pathlib import Path

import requests

BASE_URL = "http://127.0.0.1:8000/v1/audio/transcriptions"


def transcribe(
    path: Path,
    language: str = "zh",
    model: str = "iic/SenseVoiceSmall",
) -> str:
    """Transcribe one local audio file and return its text."""
    with path.open("rb") as audio:
        response = requests.post(
            BASE_URL,
            files={"file": audio},
            data={"model": model, "language": language},
            timeout=120,
        )
    response.raise_for_status()
    return str(response.json()["text"])


if __name__ == "__main__":
    print(transcribe(Path("audio.wav")))

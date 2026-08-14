"""Download allowlisted faster-whisper CTranslate2 model directories."""

import argparse
import os
from pathlib import Path

from huggingface_hub import snapshot_download

ROOT = Path(__file__).resolve().parent
MODEL_REPOSITORIES = {
    "small": "Systran/faster-whisper-small",
    "medium": "Systran/faster-whisper-medium",
    "large-v3": "Systran/faster-whisper-large-v3",
}


def model_root() -> Path:
    """Return the configured model root resolved from this script's directory."""
    configured = Path(os.environ.get("STT_MODEL_ROOT", "models/faster-whisper"))
    return configured if configured.is_absolute() else ROOT / configured


def download(model_id: str) -> Path:
    """Download one allowlisted model and return its local directory."""
    destination = model_root() / model_id
    destination.mkdir(parents=True, exist_ok=True)
    snapshot_download(
        repo_id=MODEL_REPOSITORIES[model_id],
        local_dir=destination,
        max_workers=1,
    )
    return destination


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Download local faster-whisper weights without committing them.",
    )
    parser.add_argument(
        "models",
        nargs="+",
        choices=(*MODEL_REPOSITORIES, "all"),
        help="one or more model sizes, or all",
    )
    args = parser.parse_args()
    selected = (
        list(MODEL_REPOSITORIES)
        if "all" in args.models
        else list(dict.fromkeys(args.models))
    )
    for model_id in selected:
        destination = download(model_id)
        print(f"{model_id}: {destination}")


if __name__ == "__main__":
    main()

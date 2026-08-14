# Agent Note: Selectable Voice Transcription Backends

Status: implemented

English | [中文](2026-08-14-selectable-voice-transcription-backends.zh.md)

## Problem

Voice-Context accepts an OpenAI-compatible model field but the companion local server ignores it and loads only the process-wide `STT_MODEL`. A deployment configured for the local server also has no safe request-level route back to its cloud provider. The Web settings page only manages a cloud API key, so a user cannot choose local processing or trade speed, memory, and accuracy among installed Whisper sizes.

Buzz stores native OpenAI Whisper `.pt` checkpoints, while faster-whisper requires CTranslate2 directories containing `model.bin`. Treating the checkpoints as interchangeable would produce a deployment that appears populated but cannot load through faster-whisper.

## Decision

The Remote request carries optional controlled `backend` and `model` ids. `backend: local` resolves on the Host to `127.0.0.1:${localPort}` and permits SenseVoiceSmall plus faster-whisper `small`, `medium`, and `large-v3`. `backend: cloud` resolves to the configured non-loopback origin, or SiliconFlow when the deployment default is local, and permits the bundled cloud SenseVoiceSmall id. An omitted backend retains the configured route for compatibility. The browser never supplies a URL.

The settings surface persists one validated backend/model pair in browser local storage. Local SenseVoiceSmall is the first-use default. The mic reads the preference for each completed recording, so a newly saved choice applies without a Host restart. The cloud credential remains in the credentials domain and is neither copied into local storage nor read back by the page.

The local server resolves the multipart `model` field through an allowlist. It loads SenseVoiceSmall through FunASR and loads faster-whisper only from server-owned CTranslate2 directories. It keeps one model resident and serializes model loading and inference, bounding memory while model switches remain available. `/v1/models` and `/health` expose the installed choices without forcing model loading.

The published companion server includes dependency bootstrap scripts and an allowlisted `download_models.py` helper. Git excludes its virtual environment, caches, logs, and model directory; clones obtain model weights from their original repositories instead of carrying runtime artifacts in source control. The server and Host share port `8000` as the local default and bind to loopback unless the operator explicitly changes `STT_HOST`.

The Buzz `small.pt`, `medium.pt`, and `large-v3-turbo.pt` files are copied into a clearly named archival directory and verified by SHA-256. Separate CTranslate2 `small`, `medium`, and `large-v3` model directories back actual inference; `large-v3-turbo.pt` is not presented as `large-v3` runtime data.

## Alternatives considered

**Convert the Buzz checkpoints in place.** Conversion adds another toolchain and risks conflating `large-v3-turbo` with the requested `large-v3`. Keeping verified source checkpoints and explicit runtime artifacts preserves provenance.

**Let the browser configure arbitrary provider URLs and model strings.** This moves an outbound request boundary into untrusted browser state. Host-owned routing and allowlisted ids preserve the existing trust fence.

**Run one server process per model.** Separate ports simplify residency but multiply launch, health, and deployment state. Request-level dispatch keeps the OpenAI-compatible endpoint stable.

**Cache every loaded model.** Switching becomes faster, but medium and large-v3 can remain resident together and consume several gigabytes. A one-model residency policy better matches a CPU deployment.

## Consequences

- A browser can switch between cloud and four local choices without restarting DSH or changing deployment YAML.
- First inference after changing a local model includes load cost, and concurrent local inference is serialized.
- Browser preferences are per profile and do not synchronize between browsers.
- Custom cloud model ids still require deployment configuration and the compatibility path; the first-party selector deliberately exposes only known combinations.
- Native Buzz checkpoints remain available for provenance or future conversion, but faster-whisper never attempts to load them directly.
- Source distributions contain the model downloader but no model weights; operators choose which faster-whisper sizes to store.

## Testing

Host tests cover explicit local routing, cloud routing from a local-default deployment, credential boundaries, model forwarding, and rejection of mismatched cloud models. Client tests cover first-use defaults, persistence of each controlled model size, invalid-pair rejection, and untrusted stored JSON. Real OpenAI-compatible endpoint tests transcribe the same English and Chinese samples through SenseVoiceSmall and faster-whisper `small`, `medium`, and `large-v3`, and verify `/health` plus `/v1/models` report all installed choices.

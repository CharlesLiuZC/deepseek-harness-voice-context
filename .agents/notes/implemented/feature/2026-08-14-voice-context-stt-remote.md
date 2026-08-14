# Agent Note: Voice-Context speech-to-text as a Typert Remote

Status: implemented

English | [中文](2026-08-14-voice-context-stt-remote.zh.md)

## Problem

A user speaking to the Web UI needed a path from browser audio to transcribed text that (1) crossed the same `/api` browser-trust fence as every first-party Host capability, (2) accepted a user-typed API key without a restart, and (3) degraded to an optional local offline backend when the host can run one. The pre-integration standalone plugin reached the Host through a raw `webServer` route outside `/api`, bypassing the trust fence, and read the credential from `cordis.yml`/environment only.

## Decision

Ship Voice-Context as two first-party packages plus one Client-assembly mount:

- **`packages/voice/voice-context`** — `VoiceContextService extends TypertRemoteService` (`ctx.voiceContext`) exposing `@Remote('transcribe')`. Audio crosses the Remote as base64 JSON (`TranscribeRequest.audio`), decoded Host-side and forwarded to an OpenAI-compatible `/v1/audio/transcriptions` endpoint. The credential resolves per call through `ctx.credentials` → literal config → process environment; a loopback `baseUrl` is forwarded unauthenticated. The same service conditionally mounts `/voice-local` (`ctx.inject(['commands'])`) managing an offline FunASR SenseVoiceSmall backend (detect hardware, `pip install`, spawn uvicorn).
- **`packages/client/ui-voice-context`** — the browser surface: a mic button in `conversation.input.left` that records → WAV → base64 → `ctx.remote.voiceContext.transcribe(...)`, plus a `settings.section` page writing the key through `credentials.set`.
- **`packages/api/remotes`** mounts `voiceContextRemote`, wiring the namespace into `ctx.remote.voiceContext`.

## Transport

The Remote wire is JSON only, so binary audio is base64-encoded (+33%). The `/api` bridge buffers bodies up to 160 MiB, comfortably above a short WAV utterance (~1 MiB for 30 s at 16 kHz mono 16-bit).

## Alternatives considered

**A raw `webServer` route outside `/api`** (the standalone prototype) — rejected: it skips the browser-trust fence the connection plugin applies to every `/api` request.

**The settings seam for the API key** — rejected: `WEB_SETTINGS_NAMESPACES` in `dsh-host-apiproxy` is a closed allowlist; a namespace is not remotely readable/writable without editing that list. The credentials seam (`credentials.set`/`describe`) is general for any reference, so the key goes there.

**A model-facing tool** — rejected: transcription is human input, not a tool the agent calls mid-turn.

## Consequences

- The credential is a write-only, per-request-resolved secret; rotating it reaches the next request without a restart.
- Binary audio inflates by base64; a dedicated streaming upload path remains future work for long recordings.
- The local backend is a child process of the dsh host; it stops with the harness unless `/voice-local stop` runs first.
- `voice/` is a new package group, added to the `tsconfig.base.json` path wildcards.

## Testing

`packages/voice/voice-context/tests/transcribe.spec.ts` pins the forwarder: base64→text, credential-seam resolution, loopback-unauthenticated, cloud-without-credential throws, and upstream error surfacing.

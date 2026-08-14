# @deepseek-ai/dsh-voice-context

English | [中文](README.zh.md)

Voice-Context speech-to-text capability: a Typert Remote-exposed service (`ctx.voiceContext`) that transcribes browser audio through an OpenAI-compatible `/v1/audio/transcriptions` endpoint. The [original Voice-Context Agent Note](../../../.agents/notes/implemented/feature/2026-08-14-voice-context-stt-remote.md) and the [selectable-backends Agent Note](../../../.agents/notes/implemented/feature/2026-08-14-selectable-voice-transcription-backends.md) own the design rationale.

## Config

```yaml
- id: voice-context
  name: '@deepseek-ai/dsh-voice-context'
  config:
    baseUrl: https://api.siliconflow.cn
    model: FunAudioLLM/SenseVoiceSmall
    language: zh
    localPort: 8000
```

`apiKeyEnv` (default `SILICONFLOW_API_KEY`) names a credential reference resolved through `ctx.credentials` per request; `apiKey` is a literal fallback for non-interactive deployments. A loopback `baseUrl` is forwarded unauthenticated. An explicit `backend: local` request always uses `127.0.0.1:${localPort}`; an explicit `backend: cloud` request uses the configured non-loopback origin or the bundled SiliconFlow origin when the deployment default is local.

The [companion local server](local/funasr/README.md) ships with one-click dependency setup and an allowlisted faster-whisper downloader. Model weights, virtual environments, caches, and logs remain outside the Git distribution.

## Service contract

`ctx.voiceContext.transcribe(request)` is the `@Remote('transcribe')` method; audio crosses the Remote as base64 JSON (`TranscribeRequest.audio`). Optional `backend` and `model` fields select cloud SenseVoiceSmall or local SenseVoiceSmall/faster-whisper `small`, `medium`, or `large-v3`. The Host chooses the trusted URL, decodes and forwards the audio, and returns `TranscribeResult.text`; the browser cannot provide an arbitrary upstream URL. The same service conditionally mounts `/voice-local` (`status|install|start|stop`) when a command adapter exists.

## Model Experience

None, as transcription is human input and reaches a model request only when the user submits the resulting composer draft.

#### KV Cache effect

None; the service never assembles or sends a model request.

## Known Limitations and Deferred Work

- **Base64 transport** — the Remote wire is JSON, so audio inflates by base64; a dedicated streaming upload path is future work for long recordings.
- **Local backend is a child process** — it stops with the harness unless `/voice-local stop` runs first.
- **Process-wide credential** — one reference serves every request; per-session or per-provider credentials are not modeled.
- **Serialized local model switching** — the companion server keeps one model resident, so the first request after changing a large model is slower while keeping memory bounded.

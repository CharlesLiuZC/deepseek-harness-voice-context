# @deepseek-ai/dsh-voice-context

English | [中文](README.zh.md)

Voice-Context speech-to-text capability: a Typert Remote-exposed service (`ctx.voiceContext`) that transcribes browser audio through an OpenAI-compatible `/v1/audio/transcriptions` endpoint. The [Voice-Context Agent Note](../../../.agents/notes/implemented/feature/2026-08-14-voice-context-stt-remote.md) owns the design rationale.

## Config

```yaml
- id: voice-context
  name: '@deepseek-ai/dsh-voice-context'
  config:
    baseUrl: https://api.siliconflow.cn
    model: FunAudioLLM/SenseVoiceSmall
    language: zh
```

`apiKeyEnv` (default `SILICONFLOW_API_KEY`) names a credential reference resolved through `ctx.credentials` per request; `apiKey` is a literal fallback for non-interactive deployments. A loopback `baseUrl` is forwarded unauthenticated.

## Service contract

`ctx.voiceContext.transcribe(request)` is the `@Remote('transcribe')` method; audio crosses the Remote as base64 JSON (`TranscribeRequest.audio`). The service decodes it, forwards it to the configured provider, and returns `TranscribeResult.text`. The same service conditionally mounts `/voice-local` (`status|install|start|stop`) when a command adapter exists, managing a local FunASR SenseVoiceSmall backend (hardware detection, `pip install`, tracked uvicorn child).

## Model Experience

None — transcription is human input and produces no model tokens; the transcript lands in the composer draft and reaches a model request only when the user submits it.

#### KV Cache effect

None; the service never assembles or sends a model request.

## Known Limitations and Deferred Work

- **Base64 transport** — the Remote wire is JSON, so audio inflates by base64; a dedicated streaming upload path is future work for long recordings.
- **Local backend is a child process** — it stops with the harness unless `/voice-local stop` runs first.
- **Process-wide credential** — one reference serves every request; per-session or per-provider credentials are not modeled.

# @deepseek-ai/dsh-client-ui-voice-context

English | [中文](README.zh.md)

Voice-Context Web surface, browser half: a mic button in the `conversation.input.left` composer tool row (order 100) that records an utterance, encodes it to base64, transcribes it through `ctx.remote.voiceContext.transcribe(...)`, and appends the transcript to the draft via `inputActions.setDraft`. A `settings.section` page (order 40) writes the STT API key through `credentials.set` addressed by `SILICONFLOW_API_KEY`; the page reads only the configured/writable state, never the value. Recording captures through MediaRecorder, then decodes and re-encodes a 16 kHz mono 16-bit PCM WAV so every ASR backend accepts the container.

## Model Experience

Indirectly: the transcript lands in the composer draft and reaches a model request only when the user submits it as an ordinary prompt.

#### KV Cache effect

None unless the user submits the transcribed draft; it then extends history like any other user message.

## Known Limitations and Deferred Work

- **Inline status only** — transcription errors surface on the mic button's tooltip, not through the composer notice channel.
- **No live transcript preview** — the final transcript appears only after the Remote settles; streaming results are future work.

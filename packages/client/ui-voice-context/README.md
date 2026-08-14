# @deepseek-ai/dsh-client-ui-voice-context

English | [中文](README.zh.md)

Voice-Context Web surface, browser half: a mic button in the `conversation.input.left` composer tool row (order 100) records an utterance, encodes it to base64, transcribes through `ctx.remote.voiceContext.transcribe(...)`, and appends the text through `inputActions.setDraft`. A `settings.section` page (order 40) provides first-time routing between the cloud API and local SenseVoiceSmall/faster-whisper `small`, `medium`, or `large-v3`. The controlled backend/model pair is stored in browser local storage; no URL is browser-configurable. The cloud API key is written through `credentials.set` under `SILICONFLOW_API_KEY`; the page reads only configured/writable state, never the value. MediaRecorder output is decoded and re-encoded as 16 kHz mono 16-bit PCM WAV so every ASR backend accepts the container.

## Model Experience

Indirectly, through the composer draft that reaches a model request only when the user submits it as an ordinary prompt.

#### KV Cache effect

None unless the user submits the transcribed draft; it then extends history like any other user message.

## Known Limitations and Deferred Work

- **Inline status only** — transcription errors surface on the mic button's tooltip, not through the composer notice channel.
- **No live transcript preview** — the final transcript appears only after the Remote settles; streaming results are future work.
- **Browser-local selection** — backend/model preference does not synchronize between browsers or profiles.

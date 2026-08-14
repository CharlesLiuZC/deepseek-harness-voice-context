# @deepseek-ai/dsh-voice-context

[English](README.md) | 中文

Voice-Context 语音转文字能力：一个经 Typert Remote 暴露的服务（`ctx.voiceContext`），把浏览器音频通过 OpenAI 兼容的 `/v1/audio/transcriptions` 端点转写为文本。设计取舍见 [原始 Voice-Context Agent Note](../../../.agents/notes/implemented/feature/2026-08-14-voice-context-stt-remote.md) 与[可选后端 Agent Note](../../../.agents/notes/implemented/feature/2026-08-14-selectable-voice-transcription-backends.md)。

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

`apiKeyEnv`（默认 `SILICONFLOW_API_KEY`）命名一个凭据引用，每次请求经 `ctx.credentials` 解析；`apiKey` 是非交互部署的字面量兜底。loopback `baseUrl` 免鉴权转发。显式 `backend: local` 请求固定使用 `127.0.0.1:${localPort}`；显式 `backend: cloud` 请求使用已配置的非 loopback 源，若部署默认是本地则使用内置 SiliconFlow 源。

[配套本地服务](local/funasr/README.md)提供一键依赖配置和采用白名单的 faster-whisper 下载工具。模型权重、虚拟环境、缓存和日志不会进入 Git 发行内容。

## Service contract

`ctx.voiceContext.transcribe(request)` 是 `@Remote('transcribe')` 方法；音频以 base64 JSON （`TranscribeRequest.audio`）穿越 Remote。可选 `backend` 和 `model` 字段可选择云端 SenseVoiceSmall，或本地 SenseVoiceSmall/faster-whisper `small`、`medium`、`large-v3`。Host 选择可信 URL、解码并转发音频，然后返回 `TranscribeResult.text`；浏览器不能提供任意上游 URL。同一服务在存在命令适配器时条件挂载 `/voice-local` （`status|install|start|stop`）。

## Model Experience

无，因为转写是人工输入，仅在用户提交所得输入框草稿时才进入模型请求。

#### KV Cache effect

无；该服务从不组装或发送模型请求。

## Known Limitations and Deferred Work

- **Base64 传输**——Remote 线缆只承载 JSON，音频因 base64 膨胀；长录音的专用流式上传通道留作后续工作。
- **本地后端是子进程**——除非先运行 `/voice-local stop`，否则随宿主退出。
- **进程级凭据**——一个引用服务所有请求；未建模按会话或按提供商的凭据。
- **本地模型串行切换**——配套服务只让一个模型驻留；切换大模型后的首个请求较慢，但内存占用有界。

# @deepseek-ai/dsh-voice-context

[English](README.md) | 中文

Voice-Context 语音转文字能力：一个经 Typert Remote 暴露的服务（`ctx.voiceContext`），把浏览器音频通过 OpenAI 兼容的 `/v1/audio/transcriptions` 端点转写为文本。设计取舍见 [Voice-Context Agent Note](../../../.agents/notes/implemented/feature/2026-08-14-voice-context-stt-remote.md)。

## Config

```yaml
- id: voice-context
  name: '@deepseek-ai/dsh-voice-context'
  config:
    baseUrl: https://api.siliconflow.cn
    model: FunAudioLLM/SenseVoiceSmall
    language: zh
```

`apiKeyEnv`（默认 `SILICONFLOW_API_KEY`）命名一个凭据引用，每次请求经 `ctx.credentials` 解析；`apiKey` 是非交互部署的字面量兜底。loopback `baseUrl` 免鉴权转发。

## Service contract

`ctx.voiceContext.transcribe(request)` 是 `@Remote('transcribe')` 方法；音频以 base64 JSON（`TranscribeRequest.audio`）穿越 Remote。服务解码后转发给所配置的提供商并返回 `TranscribeResult.text`。同一服务在存在命令适配器时条件挂载 `/voice-local`（`status|install|start|stop`），管理本地 FunASR SenseVoiceSmall 后端（硬件检测、`pip install`、受跟踪的 uvicorn 子进程）。

## Model Experience

无——转写是人工输入，不产生模型 token；转写文本落在输入框草稿，仅在用户提交时才进入模型请求。

#### KV Cache effect

无；该服务从不组装或发送模型请求。

## Known Limitations and Deferred Work

- **Base64 传输**——Remote 线缆只承载 JSON，音频因 base64 膨胀；长录音的专用流式上传通道留作后续工作。
- **本地后端是子进程**——除非先运行 `/voice-local stop`，否则随宿主退出。
- **进程级凭据**——一个引用服务所有请求；未建模按会话或按提供商的凭据。

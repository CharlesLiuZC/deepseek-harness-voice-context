# @deepseek-ai/dsh-client-ui-voice-context

[English](README.md) | 中文

Voice-Context Web 界面，浏览器侧：`conversation.input.left` 输入框工具行里的麦克风按钮（order 100），录音后编码为 base64，经 `ctx.remote.voiceContext.transcribe(...)` 转写，再通过 `inputActions.setDraft` 把文本追加到草稿。 一个 `settings.section` 页面（order 40）提供首次配置，可在云端 API、本地 SenseVoiceSmall 与 faster-whisper `small`、`medium`、`large-v3` 之间选择。受控的后端/模型组合保存在浏览器 local storage，浏览器不能配置 URL。云端 API Key 通过 `credentials.set` 以 `SILICONFLOW_API_KEY` 为引用写入；页面只读取「已配置/可写」 状态，从不读取值。录音经 MediaRecorder 采集，再解码并重编码为 16 kHz 单声道 16-bit PCM WAV，使所有 ASR 后端都能接受该容器。

## Model Experience

间接，通过输入框草稿；仅在用户将其作为普通提示提交时才进入模型请求。

#### KV Cache effect

除非用户提交转写草稿，否则无；提交后像其他用户消息一样扩展历史。

## Known Limitations and Deferred Work

- **仅内联状态**——转写错误显示在麦克风按钮的 tooltip 上，不经输入框通知通道。
- **无实时转写预览**——最终文本只在 Remote 落定后出现；流式结果是后续工作。
- **浏览器本地选择**——后端/模型偏好不会在不同浏览器或 profile 间同步。

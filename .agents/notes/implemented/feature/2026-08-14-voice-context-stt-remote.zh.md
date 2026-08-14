# Agent Note: Voice-Context 语音转文字作为 Typert Remote

Status: implemented

[English](2026-08-14-voice-context-stt-remote.md) | 中文

## Problem

用户在 Web 界面对话时，需要一条从浏览器音频到转写文本的路径，且要满足：(1) 与所有一等公民宿主能力一样经过 `/api` 浏览器信任闸门；(2) 接受用户填写的 API Key 而无需重启；(3) 当宿主硬件能跑本地模型时，可退化为可选的本地离线后端。集成前的独立插件通过 `/api` 之外的裸 `webServer` 路由触达宿主，绕过了信任闸门，且密钥只从 `cordis.yml`/环境变量读取。

## Decision

把 Voice-Context 作为两个一等公民包 + 一处客户端组装挂载落地：

- **`packages/voice/voice-context`** — `VoiceContextService extends TypertRemoteService`（`ctx.voiceContext`），暴露 `@Remote('transcribe')`。音频以 base64 JSON（`TranscribeRequest.audio`）穿越 Remote，宿主解码后转发到 OpenAI 兼容的 `/v1/audio/transcriptions`。密钥每次调用按 `ctx.credentials` → 字面量配置 → 进程环境 解析；loopback `baseUrl` 免鉴权转发。同一服务通过 `ctx.inject(['commands'])` 条件挂载 `/voice-local`，管理离线 FunASR SenseVoiceSmall 后端（检测硬件、`pip install`、spawn uvicorn）。
- **`packages/client/ui-voice-context`** — 浏览器侧：`conversation.input.left` 里的麦克风按钮（录音 → WAV → base64 → `ctx.remote.voiceContext.transcribe(...)`），以及一个通过 `credentials.set` 写入密钥的 `settings.section` 页面。
- **`packages/api/remotes`** 挂载 `voiceContextRemote`，把命名空间接入 `ctx.remote.voiceContext`。

## Transport

Remote 线缆只承载 JSON，因此二进制音频做 base64 编码（+33%）。`/api` 桥最多缓冲 160 MiB，远高于短句 WAV（16 kHz 单声道 16-bit，30 秒约 1 MiB）。

## Alternatives considered

**`/api` 之外的裸 `webServer` 路由**（独立原型）——否决：绕过了 connection 插件施加于每个 `/api` 请求的浏览器信任闸门。

**用 settings 缝承载 API Key**——否决：`dsh-host-apiproxy` 里的 `WEB_SETTINGS_NAMESPACES` 是封闭白名单，不编辑该列表命名空间就无法被远程读写。credentials 缝（`credentials.set`/`describe`）对任意引用通用，密钥走那里。

**做成模型可调用的工具**——否决：转写是人工输入，不是 agent 在轮次中调用的工具。

## Consequences

- 密钥是只写、逐请求解析的秘密；轮换后下一个请求即生效，无需重启。
- 二进制音频因 base64 膨胀；长录音的专用流式上传通道留作后续工作。
- 本地后端是 dsh 宿主的子进程；除非先运行 `/voice-local stop`，否则随宿主退出。
- `voice/` 是新分组，已加入 `tsconfig.base.json` 的路径通配。

## Testing

`packages/voice/voice-context/tests/transcribe.spec.ts` 固定转发器行为：base64→文本、credentials 缝解析、loopback 免鉴权、云端无密钥抛错、上游错误透出。

# DeepSeek Harness + Voice-Context（语音转文字）集成

本 zip 是 **DeepSeek Harness 完整工程源码**，已集成 Voice-Context 能力（一等公民 Typert Remote 集成）。

## 新增/改动一览

- **新增宿主包** `packages/voice/voice-context`：`VoiceContextService` 经 Typert Remote 暴露 `voiceContext/transcribe`（走 `/api` 信任闸门），`/voice-local` 命令管理本地 FunASR SenseVoiceSmall 后端。
- **新增客户端包** `packages/client/ui-voice-context`：输入框麦克风按钮 + APIKey 设置页。
- **改动**：`packages/api/remotes`（挂载 remote）、`packages/bundle/web-app`（两行接线）、`tsconfig.{base,host,client}.json`、`scripts/check-workspace-constraints.ts`、Agent Note。
- **文档**：本目录 `HANDOVER.md`（完整交接）、`VOICE_CONTEXT_PR.md`（PR/commit 拆分）、`CHECKOUT_DRIFT.md`（既有漂移说明）。

## 快速开始（真实语音转文字）

```sh
# 1. 安装依赖（Node >= 22.19）
pnpm install

# 2. 构建（host + client + web 前端）
pnpm run build

# 3. 配置语音识别密钥（Windows 用户环境变量，或启动后在设置页填）
#    PowerShell: [Environment]::SetEnvironmentVariable("SILICONFLOW_API_KEY","sk-...","User")

# 4. 启动（默认 3080）
pnpm dsh web

# 5. 浏览器打开 http://127.0.0.1:3080
#    → 输入框左侧点麦克风 → 授权 → 说话 → 转写文本填入草稿
#    → 设置 →「语音输入 / Voice input」页可填/查 API Key
```

## 本地离线部署（可选，无需云）

```sh
# 在输入框运行（检测硬件 → 装依赖 → 启动本地 SenseVoiceSmall）
/voice-local status
/voice-local install
/voice-local start
# 然后把 baseUrl 指向 http://127.0.0.1:8080（见 local/ 目录与 HANDOVER.md）
```

## 依赖说明

- 语音转文字：SiliconFlow `FunAudioLLM/SenseVoiceSmall`（中文小模型最优），或任意 OpenAI 兼容 ASR。
- 对话回复：另需 `DEEPSEEK_API_KEY`（仅影响「把转写提交给 agent」；麦克风→转写→草稿不依赖）。

详见 `VOICE_CONTEXT/HANDOVER.md`。

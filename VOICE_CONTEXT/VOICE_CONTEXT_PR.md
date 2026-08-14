# Voice-Context（语音转文字）PR 描述 + commit 拆分

> 针对 `D:\deepseek-harness`（DSH monorepo）的一等公民集成改动。设计取舍见 Agent Note：
> `.agents/notes/implemented/feature/2026-08-14-voice-context-stt-remote.md`。

## PR 描述（正文草稿）

**标题**：`feat(voice): Voice-Context speech-to-text as a Typert Remote`

**Summary**：把浏览器语音转文字作为一等公民能力接入 Harness。用户在 Web 输入框点麦克风录音，音频经 **Typert Remote（`voiceContext/transcribe`，走 `/api` 浏览器信任闸门）** 由宿主转发到 OpenAI 兼容 ASR（默认 SiliconFlow `FunAudioLLM/SenseVoiceSmall`，中文小模型最优），文本写回草稿。API Key 在 Web 设置页填写（走 credentials 域，逐请求解析、热更新）。`/voice-local` 命令支持离线 FunASR SenseVoiceSmall 后端（检测硬件 → pip install → 启动 uvicorn）。

**设计要点**：
- 音频以 base64 穿越 JSON Remote（+33%，160MiB 上限内）。
- 密钥走 credentials 域而非 settings（`WEB_SETTINGS_NAMESPACES` 是封闭白名单）。
- 本地后端为 dsh 子进程，`local/` 经 `packageFileExtras` 随包发布。

**验证**：`build:lib:host` + `build:lib:client` + `build:web` 全过；17 个单测；`verify-cordis-config`/`constraints`/`knip`/两个 invariant 闸门/`verify-node-next-types`/`verify-runtime-closure`/`verify-dsh-package-licenses` 全过。

## commit 拆分（每步可独立构建）

建议按依赖顺序拆 4 个 commit（或 4 个 stacked PR）：

### commit 1 — 宿主能力包 `packages/voice/voice-context`
- `src/{index,config,transcribe,local,types,client,invariant}.ts`
- `local/funasr/{server.py,requirements.txt,README.md}`
- `tests/{transcribe,local,config}.spec.ts`
- `README.md` / `README.zh.md` / `README.i18n.yaml`
- `package.json` / `tsconfig.json` / `tsdown.config.ts`
- 依赖：`tsconfig.base.json`（新增 `voice` 组 paths + `voice-context/{types,client}` 映射）、`tsconfig.host.json`（新引用）、`scripts/check-workspace-constraints.ts`（`packageFileExtras` 加 `local/`）

### commit 2 — Remote 组装挂载 `packages/api/remotes`
- `src/client/index.ts`（import + mount + re-export `voiceContextRemote`）
- `tsconfig.client.json`（引用 `../../voice/voice-context`）
- `package.json`（加 `@deepseek-ai/dsh-voice-context` 依赖）

### commit 3 — 客户端界面包 `packages/client/ui-voice-context`
- `src/index.ts`（node half）、`src/client/{index.ts,VoiceInput.tsx,VoiceSettings.tsx,recorder.ts}`、`src/invariant.ts`
- `tests/recorder.client.spec.ts`
- `README.md` / `README.zh.md` / `README.i18n.yaml`
- `package.json` / `tsconfig.json` / `tsdown.config.ts`
- 依赖：`tsconfig.base.json`（`dsh-client-ui-voice-context` 映射）、`tsconfig.client.json`（新引用）

### commit 4 — 上线接线 + 决策记录
- `packages/bundle/web-app/cordis.patch.yml`（`voice-context` + `ui-voice-context` 两行）
- `packages/bundle/web-app/package.json`（两依赖）
- `.agents/notes/implemented/feature/2026-08-14-voice-context-stt-remote.{md,zh.md,i18n.yaml}`

> 注：commit 1 的 `tsconfig.base.json` 改动也可拆出单独 commit，但为保持每步可构建，建议与宿主包同 commit。

## 运行验证（真实语音转文字）

```sh
cd D:\deepseek-harness
pnpm install && pnpm run build
$env:SILICONFLOW_API_KEY = "sk-xxxx"   # 或启动后在 设置 → 语音输入 页填写
pnpm dsh web    # http://127.0.0.1:3080，输入框左侧点麦克风 → 说话 → 自动转写进草稿
# 离线：/voice-local status → install → start，baseUrl 指向 127.0.0.1:8080
```

## 遗留（合入前）

1. 真实 key + 麦克风端到端冒烟（本环境无凭证/浏览器）。
2. 每文件 100% 覆盖率（`index.ts`/`invariant.ts`/`VoiceInput.tsx`/`VoiceSettings.tsx`/`recorder.ts` 非全路径）。
3. 模型/用户可见行为的 keyless snapshot（需 web snapshot harness）。
4. `rescope-vendor:check` 26 处既有假阳性（见 `D:\DSH\CHECKOUT_DRIFT.md`，另修，不混入）。

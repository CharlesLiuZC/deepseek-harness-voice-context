# Handover — DeepSeek Harness Voice-Context (语音转文字) 集成

> 用途：跨上下文/跨会话交接。目标读者是继续此工作的下一个 agent。
> 工作目录：`D:\DSH`（会话工作区）；代码 checkout：`D:\deepseek-harness`（无 `.git`，已 `git init` 供闸门用）。

## 一、总体目标与最终状态

把 **Voice-Context（浏览器录音 → 语音转文字）** 作为一等公民能力嵌入 DeepSeek Harness：

- 浏览器输入框加麦克风按钮 → 录音 → WAV → 经 **Typert Remote（走 `/api` 浏览器信任闸门）** 调宿主 STT 服务 → 返回文本写回草稿。
- API Key 在 Web 设置页直接填写（走 credentials 域，逐请求解析、热更新）。
- 本地离线部署：`/voice-local` 命令（检测硬件 → pip install → 启动 FunASR SenseVoiceSmall 本地服务）。

**状态：代码完整、`build:lib:host` + `build:lib:client` 通过、17 个测试通过、除 `rescope-vendor:check` 外全部 hygiene 子闸门通过。** 尚未做的真实端到端验证是「真实 API Key + 麦克风」的运行测试（本环境无凭证/浏览器）。

## 二、逐轮对话摘要

1. **搭建插件**：调研 DSH 架构（Cordis 热拔插、PTC=Code Mode、自建插件=双面包）、STT 选型（SenseVoiceSmall 中文最优）；在 `D:\DSH\dsh-voice-context` 建了**独立双面包**（宿主 STT 代理路由 + 浏览器麦克风 + 设置页）。
2. **本地离线后端**：加 `local/funasr/server.py`（SenseVoiceSmall OpenAI 兼容）、`requirements.txt`、三方案对比、`local/cordis.patch.local.yml`。
3. **APIKey 填 UI + 本地化**：调研发现 settings 命名空间对第三方不暴露（apiproxy 硬编码 allowlist）、credentials 域通用、Typert 需一等公民；实现 APIKey 走 credentials 域 + `/voice-local` 命令。
4. **走 Typert Remote 移入 monorepo**：建 `packages/voice/voice-context`（宿主 Remote 服务）+ `packages/client/ui-voice-context`（客户端）；改 api-remotes、web-app bundle、tsconfig 聚合；宿主+客户端构建通过、Typert 契约生成成功。
5. **继续**：修 `verify-cordis-config`（tsconfig.base.json paths 加 `voice` 组）、写 transcribe 测试、写 Agent Note。
6. **按顺序补齐**：写两包 README 双语 + i18n、补 local/config/recorder 测试、修 constraints（invariant 伴随 + files + packageFileExtras）与 knip（zod 引用 + 删冗余 devDeps + 补测试文件）。
7. **跑完整 hygiene**：因无 `.git` 卡在 `rescope-vendor:check`；其余 9 个非 git 子闸门全过（含两个 invariant 闸门，**空 invariant 伴随被接受**）。
8. **初始化临时 git**：`git init` + `git add -A`（7455 源文件）；`verify-vendored-links` ✅；`rescope-vendor:check` ❌ 26 残留（既有）。
9. **抽查残留 token**：确认为 `cordis/*` 事件名、`'cordis'` 运行时标识、prose 被朴素正则误判的**假阳性**，与 Voice-Context 零交集。
10. **（本轮）写 Handover + 漂移说明 + PR 描述/拆分 + 验证 build:web**。

## 三、代码变更清单（monorepo，`D:\deepseek-harness`）

**新增包：**
- `packages/voice/voice-context/` — 宿主：`src/{index,config,transcribe,local,types,client,invariant}.ts`、`local/funasr/{server.py,requirements.txt,README.md}`、`tests/{transcribe,local,config}.spec.ts`、README 双语 + i18n、package.json、tsconfig.json、tsdown.config.ts
- `packages/client/ui-voice-context/` — 客户端：`src/index.ts`（node half）、`src/client/{index.ts,VoiceInput.tsx,VoiceSettings.tsx,recorder.ts}`、`src/invariant.ts`、`tests/recorder.client.spec.ts`、README 双语 + i18n、package.json、tsconfig.json、tsdown.config.ts

**修改文件：**
- `packages/api/remotes/src/client/index.ts` + `tsconfig.client.json` + `package.json`（挂载 `voiceContextRemote`）
- `packages/bundle/web-app/cordis.patch.yml` + `package.json`（加 `voice-context` + `ui-voice-context` 两行）
- `tsconfig.host.json`、`tsconfig.client.json`、`tsconfig.base.json`（新包引用 + paths 通配 + 显式映射）
- `scripts/check-workspace-constraints.ts`（`packageFileExtras` 加 `local/`）
- `.agents/notes/implemented/feature/2026-08-14-voice-context-stt-remote.{md,zh.md,i18n.yaml}`（Agent Note）

**关键架构决策（已在 Agent Note）：**
- STT 走 Typert Remote（`voiceContext/transcribe`），音频 base64 穿越 JSON 线缆。
- APIKey 走 credentials 域（`SILICONFLOW_API_KEY`），非 settings（第三方不暴露）。
- `/voice-local` 命令经 `ctx.inject(['commands'])` 条件挂载。
- 本地后端为 dsh 子进程，`local/` 随包发布（constraints 例外登记）。

## 四、如何运行（真实语音转文字）

```sh
cd D:\deepseek-harness
pnpm install
pnpm run build          # build:lib:host + build:lib:client + build:web
# 云端：
$env:SILICONFLOW_API_KEY = "sk-xxxx"     # 或启动后在设置页填
pnpm dsh web           # http://127.0.0.1:3080，输入框左侧出现麦克风
# 本地离线：
/voice-local status|install|start|stop  # 或手动 local/funasr 部署后 baseUrl 指向 127.0.0.1:8080
```

## 五、尚未完成 / 风险点

1. **真实端到端**：未用真实 key + 麦克风跑通（环境无凭证）。逻辑链已测试覆盖。
2. **`rescope-vendor:check` 26 残留**：既有假阳性（详见 `D:\DSH\CHECKOUT_DRIFT.md`），非本改动。
3. **每文件 100% 覆盖率**：`index.ts`/`invariant.ts`/`VoiceInput.tsx`/`VoiceSettings.tsx`/`recorder.ts` 非全路径覆盖（CI 门槛，未做）。
4. **快照测试**：DSH 要求模型/用户可见行为带 keyless snapshot，未做。
5. **临时 git**：`D:\deepseek-harness\.git` 是为闸门而建，非真实历史（`git init` 后未 commit，仅 staged）。
6. **独立原型** `D:\DSH\dsh-voice-context`（第 1-3 轮的独立 bundle）已被 monorepo 版本取代，仅作参考。

## 六、端到端 Smoke 测试（真实 API）✅

- 环境变量：`SILICONFLOW_API_KEY` 已写入 **Windows User 作用域**（持久；新终端 `dsh web` 可继承）。值不写入任何仓库文件。
- 样本：`D:\DSH\jfk.wav`（公开 JFK 演讲，352KB，来自 whisper.cpp samples）。
- 方法：实例化真实的 `VoiceContextService`（built `lib/index.js`），调用 `transcribe({audio: base64(jfk.wav), mimeType:'audio/wav', language:'en'})`。
- 结果：**成功**，1.7s 返回 `"And so my fellow Americans. Ask not. What your country can do for you, ask what you can do for your country."`
- 证明：凭据解析 → base64 解码 → SiliconFlow SenseVoiceSmall 转发 → 解析 → 文本，全链打通。中文走同一模型（`language:'zh'` 仅提示）。

## 七、验证记录

- `build:lib:host` ✅（含 Typert 生成 `lib/typert.host.js` + `typert.remote-client.js`）
- `build:lib:client` ✅（ui-voice-context `lib/client.js` + api-remotes 内联 remote 挂载）
- `vitest`：宿主 12 + 客户端 5 = 17 ✅
- `verify-cordis-config` 120 ✅ / `constraints` ✅ / `knip` ✅ / `publint`（仅全仓 `./src/*` 告警）
- `verify-package-invariants` 221 ✅ / `verify-built-package-invariants` 221 ✅
- `verify-dsh-package-licenses` 224 ✅ / `verify-node-next-types` 230 ✅ / `verify-runtime-closure` 109 ✅
- `verify-vendored-links` 9 ✅ / `verify-agent-note-format` 542 ✅
- `rescope-vendor:check` ❌ 26 假阳性（既有）

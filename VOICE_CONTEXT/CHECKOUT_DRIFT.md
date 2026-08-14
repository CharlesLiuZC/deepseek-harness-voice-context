# Checkout 漂移说明 — `rescope-vendor:check` 26 处残留

> 独立记录，与 Voice-Context 改动无关。本 checkout（`D:\deepseek-harness`）是一份无 `.git` 的源码快照；为跑 git 相关闸门临时 `git init` + `git add -A` 后，`rescope-vendor:check` 报 26 处「pre-rescope name token」残留。

## 结论先行

**26 处全是假阳性**：朴素正则把「cordis」作运行时标识（事件名、命名空间、插件名、prose）误判成「未 rescope 的包引用」。没有一处是真正的 `import ... from 'cordis'` / `'@cordisjs/plugin-*'`。这是**脚本与快照的既有漂移**，非本次改动引入。

## 残留 token 的三类形态

1. **Cordis 框架事件名**（`cordis/` 前缀是事件域，不是包名）：
   - `packages/api/remotes/src/remote-events.ts`：`'cordis/request-run'`、`'cordis/dynamic-package'`、`'cordis/inspect-query'`…
   - `packages/extensions/tool-cordis/src/api-catalog.ts`（生成物）：`name: 'cordis/dynamic-package'`、`signature: '\'cordis/dynamic-package\'(…): void'`
   - `docs/subsystems/extensions.md`：`#### \`cordis/dynamic-package\` — emit`
   - `packages/extensions/cordis-host-runner/src/index.ts`、`cordis-client-runner/src/client/*`

2. **「cordis」作运行时标识/键**：
   - `packages/extensions/ui-cordis/src/client/locales.ts`：`export const NS = 'cordis'`
   - `packages/extensions/ui-cordis/src/client/index.ts`：`name: 'cordis'`
   - `scripts/gen-cordis-catalog.ts`：`'cordis': 'extensions.md'`（事件域→文档页映射键）

3. **描述性 prose**（字符串里出现「cordis/schemastery」一词）：
   - `api-catalog.ts` 多处 `"...cordis' standard duplicate-service behavior..."`

## 误判机理

`scripts/rescope-vendor.ts` 的通用 token 正则：

```ts
token: new RegExp(`(['"\`])${from}((?:/[^'"\`\\s]*)?)\\1`, 'g')
```

对 `from = 'cordis'`，它匹配**被引号包裹、以裸名 `cordis` 开头、可选带 `/子路径` 的字符串**（如 `'cordis/request-run'`），一律当作「包 `cordis` 的 `/子路径` 导入」应改写为 `@deepseek-ai/cordis/…`。但 `cordis/*` 事件名恰好也是这个形状，正则无法区分「包导入」与「事件命名空间」。

这些 `cordis/dynamic-package`、`cordis/request-run` 等事件词汇是「动态 cordis」功能（cordis-host-runner）**较新**加入的；`rescope-vendor.ts` 里的 `GENERIC_SKIPS` / `EXACT_EDITS` 白名单尚未覆盖它们，于是 `--check` 报残留。

## 与 Voice-Context 的关系

零交集。被标记的 `packages/api/remotes/src/remote-events.ts` 只改过同包的 `src/client/index.ts`；其余残留文件（tool-cordis / ui-cordis / cordis-host-runner / cordis-client-runner / docs / gen-cordis-catalog）本次均未触碰。Voice-Context 两个新包全部使用 `@deepseek-ai/*` 正确名，未被标记。

## 处置建议（供真实仓库 PR 参考）

- 在真实 git 仓库里若同样报这 26 处，属上游 `rescope-vendor.ts` 与「动态 cordis」事件名的既有漂移，**应单独修**（把 `cordis/*` 事件名文件加进 `GENERIC_SKIPS` 或 `EXACT_EDITS`），**不混入 Voice-Context 改动**。
- 本快照不做任何修改（避免污染快照的既有状态）。

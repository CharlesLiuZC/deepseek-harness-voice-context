# Agent Note: 可选择的语音转写后端

Status: implemented

[English](2026-08-14-selectable-voice-transcription-backends.md) | 中文

## 问题

Voice-Context 接受 OpenAI 兼容的 model 字段，但配套本地服务会忽略它，只加载进程级 `STT_MODEL`。部署一旦默认 配置到本地服务，也没有安全的请求级通道切回云端提供商。Web 设置页只管理云端 API Key，用户无法选择本地处理， 也无法在已安装的 Whisper 尺寸之间权衡速度、内存与准确率。

Buzz 保存的是原生 OpenAI Whisper `.pt` 检查点，而 faster-whisper 需要包含 `model.bin` 的 CTranslate2 目录。 若把两者当作可互换文件，部署表面上已有模型，实际却无法通过 faster-whisper 加载。

## 决策

Remote 请求携带可选的受控 `backend` 与 `model` id。`backend: local` 在 Host 上解析到 `127.0.0.1:${localPort}`，允许 SenseVoiceSmall 以及 faster-whisper `small`、`medium`、`large-v3`。 `backend: cloud` 解析到已配置的非 loopback 源；若部署默认是本地，则解析到 SiliconFlow，并只允许内置的云端 SenseVoiceSmall id。省略 backend 时保留已配置路由，维持兼容。浏览器始终不能提供 URL。

设置界面把一组通过校验的后端/模型组合保存在浏览器 local storage。本地 SenseVoiceSmall 是首次使用默认值。 麦克风在每段录音完成时读取偏好，所以新保存的选择无需重启 Host 即可生效。云端凭据仍属于 credentials 域，既不 复制进 local storage，也不会被页面读回。

本地服务通过白名单解析 multipart `model` 字段。SenseVoiceSmall 经 FunASR 加载；faster-whisper 只从服务端持有的 CTranslate2 目录加载。服务只保留一个驻留模型，并串行执行模型加载与推理，在允许切换的同时限制内存占用。 `/v1/models` 与 `/health` 无需强制加载模型即可暴露已安装选择。

发布的配套服务包含依赖初始化脚本和采用白名单的 `download_models.py` 下载工具。Git 会排除虚拟环境、缓存、日志和模型目录；克隆者从模型的原始仓库获取权重，源码控制中不携带运行时产物。本地服务与 Host 统一使用端口 `8000` 作为默认值，并且除非操作方明确修改 `STT_HOST`，否则只绑定回环地址。

Buzz 的 `small.pt`、`medium.pt`、`large-v3-turbo.pt` 被复制到名称明确的归档目录并通过 SHA-256 校验。实际推理由 独立的 CTranslate2 `small`、`medium`、`large-v3` 模型目录支撑；`large-v3-turbo.pt` 不会被伪装成 `large-v3` 运行时数据。

## 考虑过的替代方案

**原地转换 Buzz 检查点。** 转换会引入另一套工具链，也可能混淆 `large-v3-turbo` 与用户要求的 `large-v3`。 保留已校验的源检查点和明确的运行时产物可以维持来源可追溯性。

**让浏览器配置任意提供商 URL 与模型字符串。** 这会把出站请求边界移入不可信浏览器状态。Host 持有路由并采用 白名单 id，可保留现有信任边界。

**为每个模型运行一个服务进程。** 独立端口简化驻留，但会成倍增加启动、健康检查与部署状态。请求级分派可保持 OpenAI 兼容端点稳定。

**缓存所有已加载模型。** 切换会更快，但 medium 与 large-v3 可能同时驻留并占用数 GB 内存。单模型驻留策略更适合 CPU 部署。

## 后果

- 浏览器无需重启 DSH 或修改部署 YAML，即可在云端与四个本地选择之间切换。
- 切换本地模型后的首次推理包含加载成本，并发本地推理会串行执行。
- 浏览器偏好按 profile 保存，不会在不同浏览器之间同步。
- 自定义云端模型 id 仍需部署配置并走兼容路径；第一方选择器只暴露已知组合。
- 原生 Buzz 检查点继续保留以供追溯或未来转换，但 faster-whisper 不会直接尝试加载它们。
- 源码发行版包含模型下载工具，但不包含模型权重；操作方自行选择需要保存的 faster-whisper 尺寸。

## 测试

Host 测试覆盖显式本地路由、本地默认部署切换云端、凭据边界、模型转发，以及拒绝不匹配的云端模型。客户端测试 覆盖首次使用默认值、受控模型尺寸持久化、无效组合拒绝与不可信已存 JSON。真实 OpenAI 兼容端点测试用同一组英文 和中文样本跑通 SenseVoiceSmall 与 faster-whisper `small`、`medium`、`large-v3`，并验证 `/health` 与 `/v1/models` 报告所有已安装选择。

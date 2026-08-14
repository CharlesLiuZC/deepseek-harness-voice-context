# 本地语音转文字服务

[English](README.md) | 中文

本目录包含 Voice Context 的配套 OpenAI 兼容语音转文字服务。它在同一个 `POST /v1/audio/transcriptions` 端点后支持 FunASR SenseVoiceSmall 和本地 faster-whisper CTranslate2 模型。

## 支持的模型

| 公开模型 id | 引擎 | 适用场景 | 下载方式 |
|---|---|---|---|
| `iic/SenseVoiceSmall` | FunASR | 快速的中文优先转写 | 首次使用时由 FunASR 下载 |
| `small` | faster-whisper | 快速的多语言转写 | 运行 `download_models.py small` |
| `medium` | faster-whisper | 更高的多语言准确率 | 运行 `download_models.py medium` |
| `large-v3` | faster-whisper | 质量最高的本地 Whisper 选项 | 运行 `download_models.py large-v3` |

服务只接受这些 id，不会把调用方提供的路径或仓库名当作模型。

## 快速启动

Windows：

```bat
start.bat
```

Linux 或 macOS：

```sh
bash start.sh
```

脚本会创建 `.venv`，安装服务端、两个推理引擎和 CPU 版 torch，然后监听 `http://127.0.0.1:8000`。如果需要 GPU 推理，请把脚本中的 torch 安装命令替换为兼容的 CUDA 构建。

SenseVoiceSmall 会在首次使用时自动下载。虚拟环境创建后，请显式下载 faster-whisper 权重：

```powershell
.venv\Scripts\python download_models.py small
.venv\Scripts\python download_models.py medium large-v3
.venv\Scripts\python download_models.py all
```

```sh
.venv/bin/python download_models.py small
.venv/bin/python download_models.py medium large-v3
.venv/bin/python download_models.py all
```

下载工具使用单个工作线程，从白名单内的 `Systran/faster-whisper-*` Hugging Face 仓库下载模型。模型文件保存在 `models/faster-whisper/` 下，Git 会忽略该目录。

## 健康检查与模型发现

```sh
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/v1/models
```

`/health` 报告默认模型、当前已加载模型、已安装模型 id 和推理设备。`/v1/models` 返回 OpenAI 风格的模型列表，其中只包含本服务可用的模型。

## 转写音频

```sh
curl http://127.0.0.1:8000/v1/audio/transcriptions \
  -F "file=@audio.wav" \
  -F "model=small" \
  -F "language=zh"
```

服务支持 WAV、MP3、FLAC、OGG、M4A、OPUS 和 AAC 后缀。服务会保留上传文件的后缀，供解码器选择格式；同时移除 SenseVoice 标签前缀，并返回干净的转写文本。Python 调用示例见 [`client_example.py`](client_example.py)。

## 接入 DeepSeek Harness

把 Voice Context 配置项指向同一个回环端口：

```yaml
- id: voice-context
  name: '@deepseek-ai/dsh-voice-context'
  config:
    baseUrl: http://127.0.0.1:8000
    model: iic/SenseVoiceSmall
    language: zh
    localPort: 8000
```

浏览器明确选择本地后端时会使用 `localPort`；启用云端模式时，`baseUrl` 仍表示部署配置的云端地址。系统不会向回环请求发送云端 Bearer 凭据。

`/voice-local status|install|start|stop` 命令可以安装本服务，并把它作为 DeepSeek Harness 的子进程管理。由该命令启动的服务会随所属 Harness 进程停止。

## 环境变量

| 变量 | 默认值 | 含义 |
|---|---|---|
| `STT_MODEL` | `iic/SenseVoiceSmall` | 请求发送 `model=local` 时使用的回退模型 |
| `STT_MODEL_ROOT` | `./models/faster-whisper` | CTranslate2 模型目录 |
| `STT_DEVICE` | `cpu` | faster-whisper 设备：`cpu` 或 `cuda` |
| `STT_HOST` | `127.0.0.1` | 运行 `server.py` 时监听的网卡地址 |
| `STT_PORT` | `8000` | 运行 `server.py` 时监听的端口 |

把 `.env.example` 复制为 `.env` 可以持久保存本地覆盖配置。Git 会忽略 `.env` 文件。

## 运行行为与安全

- 模型加载和推理会串行执行。服务只驻留一个模型；选择另一个模型时，会在替代模型加载后释放原模型。
- CPU 上的 faster-whisper 使用 `int8`，非 CPU 设备使用 `float16`。
- 选择尚未安装但位于白名单内的 faster-whisper 模型会返回 HTTP 400。模型加载或推理失败会返回 HTTP 503。
- 服务不提供鉴权，并默认绑定回环地址。如果使用 `STT_HOST=0.0.0.0` 暴露服务，需要在前方部署可信反向代理、鉴权和传输加密。
- FunASR 不安装 torch，因为 torch 构建与硬件相关。启动脚本会明确安装 CPU wheel；自定义 GPU 部署必须自行选择兼容的 torch 构建。

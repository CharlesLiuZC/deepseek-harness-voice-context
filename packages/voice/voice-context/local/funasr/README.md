# 本地 STT：FunASR + SenseVoiceSmall

中文准确率最高的离线方案：阿里 FunASR 的 **SenseVoiceSmall**（`iic/SenseVoiceSmall`，~234M 参数），
用 40 行 FastAPI 包装成插件宿主面已经在调的 OpenAI 兼容 `/v1/audio/transcriptions`。

## 1. 安装

```sh
cd local/funasr
python -m venv .venv
. .venv/Scripts/activate          # Windows（Linux/macOS 用 source .venv/bin/activate）
pip install -r requirements.txt
```

> 依赖里 `funasr` 会带出 `torch`。默认是 CPU 版即可跑 SenseVoiceSmall；有 NVIDIA 显卡想提速，
> 按 PyTorch 官网换成 CUDA 版 torch。首次启动会从 ModelScope 下载 ~1GB 权重。

## 2. 启动

```sh
uvicorn server:app --host 127.0.0.1 --port 8080
```

自检：

```sh
curl http://127.0.0.1:8080/health
# {"ok":true,"model":"iic/SenseVoiceSmall"}
```

## 3. 接到 dsh

用仓库里现成的 overlay 把 `baseUrl` 指向本地：

```sh
cd dsh-voice-context
pnpm dsh web --patch ./local/cordis.patch.local.yml
```

或手动在 `cordis.patch.yml` 里覆盖：

```yaml
- id: voice-context
  config:
    baseUrl: http://127.0.0.1:8080
    model: sensevoice-small
    apiKey: local          # 本地后端忽略鉴权，填非空即可
```

## 4. 可选

- 换模型：`FUNASR_MODEL=iic/SenseVoiceSmall`（默认）已是最优中文小模型；也可用
  `iic/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-pytorch`（Paraformer 中文大模型）。
- 换 HF 源：把 `AutoModel(model=..., hub="hf")` 改成 `"FunAudioLLM/SenseVoiceSmall"` 可从 HuggingFace 拉取。
- 中文标点/数字归一：`use_itn=True` 已开启（口语数字→阿拉伯数字）。

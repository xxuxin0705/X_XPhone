# asr-ja：小手机的日语语音识别语言包

不是插件本体，别在酒馆里切到这个分支。小手机在 设置 → 语音识别语言包 里点「下载」时从这里拿文件，解压后存进浏览器，以后不用再下。

- `ja/off.wasm.gz` + `ja/ja-main.js`：[sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) v1.13.7 网页版离线识别（vad-asr 版，本仓库 `asr-build` 分支用 GitHub Actions 编译），Apache-2.0（`LICENSE-sherpa-onnx`）。`ja-main.js` 里的文件清单改成了下面这个模型包的偏移
- `ja/ja.data.0.gz` … `ja.data.3.gz`：`sherpa-onnx-moonshine-tiny-ja-quantized-2026-02-27`（Moonshine v2 tiny 日语，量化）的 encoder_model.ort + decoder_model_merged.ort + tokens.txt 按顺序拼起来，切成 20MB 一块再各自 gzip 压缩
- 日语模型是 Moonshine AI Community License（个人、非商业使用免费），见 `LICENSE-moonshine` 和 `NOTICE`。Powered by Moonshine AI

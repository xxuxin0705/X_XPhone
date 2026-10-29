# 本地语音识别（通话用）

小手机通话的「本地识别」：在你自己的浏览器里把声音转成文字，不联网、不花钱、不要任何密钥，边说边出字。

- 程序：[sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) v1.13.7 的网页版（WebAssembly）识别，Apache-2.0（见 LICENSE）
- 模型：`sherpa-onnx-streaming-zipformer-small-bilingual-zh-en-2023-02-16`（流式、中英双语），Apache-2.0；编码器 / 连接器用 int8，解码器用 fp32（int8 解码器会漏字）
- `asr.data` 是 decoder.onnx + encoder.onnx + joiner.onnx + tokens.txt 按顺序拼起来的包，`asr-main.js` 里的文件清单（loadPackage）已经改成这个包的偏移；`asr.wasm` 就是原版的 sherpa-onnx-wasm-main-asr.wasm
- 酒馆里装在扩展文件夹里，浏览器从同一个网址读，不受跨域限制；读一次以后浏览器会缓存

# 本地语音识别（通话用）

小手机通话的「本地识别」：在你自己的浏览器里把声音转成文字，不联网、不花钱、不要任何密钥，边说边出字。

- 程序：[sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) v1.13.7 的网页版（WebAssembly）流式识别，Apache-2.0（见 LICENSE）
- 内置中文模型：`sherpa-onnx-streaming-zipformer-small-ctc-zh-int8-2025-04-01`（小号流式中文 CTC，int8），Apache-2.0
- `zh.data` 是 model.onnx + tokens.txt 按顺序拼起来的包（26MB），`zh-main.js` 里的文件清单（loadPackage）已经改成这个包的偏移；`asr.wasm` 就是原版的 sherpa-onnx-wasm-main-asr.wasm（13MB）
- 别的语言（日语等）不放在这里：在 设置 → 语音识别语言包 里另外装，或者用云端识别
- 酒馆里装在扩展文件夹里，浏览器从同一个网址读，不受跨域限制；读一次以后浏览器会缓存

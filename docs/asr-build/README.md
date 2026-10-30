# 怎么重新编译语言包用的识别程序

日语语言包（`asr-ja` 分支）里的 `off.wasm` 是 sherpa-onnx v1.13.7 的网页版离线识别（vad-asr 版），插件本体里那个 `asr/asr.wasm` 是流式版，两个不一样。
要重编（比如升级 sherpa-onnx 版本）：

1. 新建一个孤儿分支，只放 `.github/workflows/build-asr-wasm.yml`（就是旁边这个文件），推上去，GitHub Actions 会自动编译（约 15 分钟），产物推到 `asr-wasm-out` 分支
2. 拿 `sherpa-onnx-wasm-main-vad-asr.wasm`，改名 `off.wasm`，gzip 后替换 `asr-ja` 分支里的 `ja/off.wasm.gz`；`ja-main.js` 用新的 `sherpa-onnx-wasm-main-vad-asr.js`，把里面 `loadPackage({files:[…]})` 那段改成模型包的文件偏移（看 `asr-ja` 分支的 README）
3. 编完把那两个临时分支删掉，别留着

模型包里的 `ja.data.N.gz` 不用动（只要不换模型）。注意：模型文件里偶尔有一串随机字节长得像 Hugging Face 密钥，直接推 GitHub 会被密钥扫描拦下，所以要 gzip 了再推。

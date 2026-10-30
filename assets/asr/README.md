# 免费本地语音识别

Vosk-Browser 0.0.8（Apache-2.0）：https://github.com/ccoreilly/vosk-browser

Alpha Cephei 的小模型，均为 Apache-2.0：https://alphacephei.com/vosk/models

- zh.tar.gz：vosk-model-small-cn-0.22
- ja.tar.gz：vosk-model-small-ja-0.22
- en.tar.gz：vosk-model-small-en-us-0.15

从官方 zip 原样重新打包为浏览器运行库要求的 tar.gz，未修改模型。
下载后在 Web Worker 内运行，不调用云端识别服务；一次只加载一种语言。

运行库适配：独立 XPhoneVosk 名称避免其它扩展撞名；最终结果增加 final 标记，防止前一个端点结果误确认；各语言使用独立 IDBFS 挂载，避免切换时把全部语言包载入内存；终止时立即停止 Worker。原版权声明保留。

重建：`python tools/build-local-asr.py`。重打包时 gzip 元数据时间可能不同，模型文件内容不变。

# 小手机测试

这个文件夹只用来测试，酒馆不会加载它（酒馆只认 `manifest.json` 里列的文件）。

## 怎么跑

```bash
node tests/run.cjs            # 全部
node tests/run.cjs unit ct    # 只跑某几组
```

- 需要 Node 22 以上。
- 浏览器测试用 Playwright 的 Chromium（`npm i -g playwright && npx playwright install chromium`）。
- 截图会存到 `tests/out/`，不进仓库。

## 各组测的是什么

| 名字 | 内容 |
| --- | --- |
| unit | 逻辑测试，不开浏览器：联系人行解析、API 调用与超时、媒体存储、正文 `<手机>` 块同步等 |
| e2e | 基本流程：开手机、聊天、生成、同步开关 |
| ms | 消息列表长按多选、批量删除 |
| rv4 | AI 生成联系人的审阅单 |
| grp | 群头衔、群人数、非好友成员、加好友 |
| fp2 | 锁屏：密码三选一、指纹、备用密码 0000 |
| send | 发送键、等待方块、自动回复、停止回复 |
| stp | 酒馆连接配置、状态栏、字体大小 |
| ct | 四种风格的通讯录和加好友页 |
| prov | 生图 / 语音服务商页、Fish 网页接口、ElevenLabs |
| snow | 锁屏「雪夜」的各种互动 |

除了 `real/` 以外，这些测试都是在一个模拟的酒馆（`e2e/st.html`）里跑的，模型接口也是假的，不花额度，也不需要 API Key。

## real/：在真的 SillyTavern 里测

- `real/mock.cjs`：假的 OpenAI 兼容接口（端口 5001），会记录每次请求用的是哪个模型。
- `real/real.cjs`：在真酒馆（端口 8000）里测连接配置、正文同步、手机里回复、四种风格、AI 生成联系人。

用法：

1. 装好官方 SillyTavern，把本仓库放进 `data/default-user/extensions/X_XPhone`。
2. 把酒馆的 API 设成 Chat Completion → Custom，地址填 `http://127.0.0.1:5001/v1`。
3. 先运行 `node tests/real/mock.cjs`，再启动酒馆，然后运行 `node tests/real/real.cjs`。

这套脚本还没在真酒馆里完整跑通过，第一次用可能需要按实际情况调一下。

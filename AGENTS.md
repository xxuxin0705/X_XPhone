# 小手机 X_XPhone · 给 AI 的项目说明

SillyTavern（酒馆）扩展：在酒馆页面里放一部虚拟手机，有桌面、锁屏、聊天、音乐、心屿等 App，和正文剧情联动。
作者自用，仓库公开只是为了方便在手机（安卓 TauriTavern）上更新调试。

动手前读完这一份。改界面再读 `DESIGN.md`（主题变量、尺寸、动效、不要做的事）。测试说明在 `tests/README.md`。

---

## 一、作者定下的规矩（必须遵守）

**工作方式**
- 每轮做完提交并推送到 `GPT` 分支，等待用户要求再合并到 `main`（不开 PR）。不止一个 AI 在推这个仓库，所以：**动手前先 `git pull`，推之前只运行本次修改及直接受影响功能的测试，通过后推送**，推送失败就先 pull 再合并，不要强推。
- 提交作者邮箱用 noreply（`git -c user.email=...noreply...`），**不要用真实邮箱**——仓库是公开的。也不要提交任何密钥、token、个人路径。
- 回复用中文，讲清楚为什么这么做。

**界面**
- 界面上不放解释性的提示文字。
- 能拖、能点的别让人打字：数值用滑块，颜色用色板（`form` 的 `color` 字段）。
- 官方接口 / API 地址都要能在设置里改（例：音乐的三个音源地址）。

**花钱的事**
- 表情包（搜索、识别导入的表情）必须免费，绝不能调用作者自己的 API。
- 生图不能额外调一次聊天模型来写提示词。
- 翻译不能额外花 API：角色的译文跟回复一起生成；只有用户自己的消息可以走免费机翻。
- 能本地做的不调模型：正文联动、音乐卡、心屿的互动都是本地解析。

**写代码：解法要懒，活儿不能懒**（整理自 DietrichGebert/ponytail，MIT）
- 动手前把这次改动要碰到的地方列全：调用方、测试、旧数据迁移、正文注入。这是范围；没人要的功能不是。
- 按顺序找第一个够用的办法：① 这事真的要做吗（没人要的选项、开关、「以后可能用到」一律不加）→ ② 项目里已经有的（`core.js` 的 `page` / `sheet` / `form` / `fx` / `task` / `llm`、现成的样式类）→ ③ 浏览器原生能力 → ④ 已经在用的库，绝不为几行代码加依赖 → ⑤ 一行能看懂就一行 → ⑥ 最后才写最少的新代码。
- 不加没人要的封装、配置项、兼容层；能删就删；沿用这个仓库现有的写法和分层，不另起一套。
- 修 bug 先搜这个函数的所有调用方，在共用的地方修一次根因，不在每个调用点各打一个补丁。
- 搬动 / 合并代码时，原来的校验和错误处理一起带走。
- **永远不省**：用户数据不丢（迁移、删除前确认）、外来内容的过滤（模型吐出来的 HTML、导入的文件）、密钥不外泄、能点到能看清。
- 明知有局限的偷懒写法，留一行注释：`// 偷懒：<局限>，<什么时候要升级>`。
- 回复结尾用一两句说清楚：这次没做什么、没验证什么、作者要真机看哪里。

**生成内容不要有 AI 味**
- 替角色说话的模块（私聊 / 群聊回复、动态、动态评论、论坛）都在用户可换的提示词后面固定接上 `mods.js` 的 `NOAI`。新加这类模块也接上；改它要想清楚会影响所有角色的说话方式。


---

## 二、文件地图

```
preview/         预览页：不进酒馆直接在浏览器里玩小手机（假装成酒馆，数据存 localStorage）；GitHub Pages 开在 main 根目录后地址是 /X_XPhone/preview/
index.js         入口：建手机外壳、悬浮球 / 魔法棒、绑定酒馆事件（收到消息、切换聊天）
core.js          核心（所有 App 都依赖它）：设置与数据、页面栈、表单、AI 调用、媒体文件、正文注入
desk.js          桌面：多页 4×7 网格、Dock、文件夹、小组件（WK）、长按编辑拖拽
desk-layout.js   桌面网格的纯计算（放得下吗、挪到哪），有单元测试
lock.js          锁屏：上滑解锁、数字 / 手势 / 指纹密码
lockfx.js        动态锁屏场景（Canvas）
mods.js          模块配置：每个调用模型的功能（模块）登记默认提示词（regMod），mp(模块) 取当前生效的提示词；llm 的 o.mod 套用该模块的模型 / 流式 / 低思考
glass.js         液态玻璃效果（SVG 位移滤镜 + backdrop-filter），桌面底栏在用
ball.js          悬浮球造型
style.css        全部全局样式（App 自带的样式除外，比如 apps/music/music.css）
apps/chat/       聊天 App
  chat.js          消息列表、通讯录、动态、「我」、AI 生成联系人；正文 <手机> 块解析（inlineSync）
  talk.js          聊天窗口：回复协议（parseReply / replyP）、生成、翻译、拍一拍、表情、引用、撤回、音乐卡片
  data.js          联系人 / 群 / 消息的增删改（addMsg、applyDelta）
  sticker*.js      表情包：免费表情库、表情商店、我的表情
  voice.js ocr.js  语音、识图
  pay.js           转账 / 红包（照真机录屏）：发红包页 / 转账页（自带数字键盘，红包单个 ≤200）→ 微信支付弹层 → 转账支付成功页；拆红包「開」→ 红包详情页；转账详情（待你收款 → 你已收款，回执消息 rcpt）
  feed.js          动态：微信朋友圈（毛玻璃卡片）/ QQ空间 / Moments（Kakao、LINE）、个人相册、生成动态弹窗（条数 / 必定出现的人）
  wx.js            微信样式外壳：底栏（微信/通讯录/发现/我）图标、「我」页及个人信息/服务/设置子页、朋友资料页（发现 = 直接进朋友圈；点头像 → 资料 → 朋友圈相册）
apps/music/      音乐 App
  music.js         小手机这边的入口和适配：存储、图层壳、音乐卡、灵动岛、给聊天用的 G.mz*
  music-view.js    界面（首页 / 搜索 / 笔记 / 我的、播放页、一起听、各种弹层）
  music-data.js    播放器和数据（队列、喜欢、歌单、笔记、歌词）
  music-api.js     音源：vkeys 搜索 + Meting 播放 / 歌词 / 歌单 + 备用音源脚本
  music-share.js   和聊天联动：分享卡片、一起听会话
  music.css        音乐 App 自己的样式（打开时加载）
apps/isle/       心屿：每个角色一座果冻球里的 3D 小岛（three.js，打开时才加载 assets/three），天气 = 心情，风景随机换
apps/eye/        窥探之眼：全是生成的图（assets/eye：客厅 / 戴面具 / 手机特写 / 帷幕后 / 周边柜 / 前景 / 电视画面 / 引导面板），不另画；第一次进来先选形态，电视亮起对应画面；手机 = 官方平台（随形态）/ 论坛 / 周边店 / 同人圈 / 另一条线（同人=原著线，原创=IF线）；点哪儿镜头推过去或整张换图，全息屏浮出。论坛（forum.js）是真的生成：模型写页面 / 一楼 / 一条楼中楼三个 HTML 模板 + CSS（版式随平台变）+ 省字的楼层文本，本地把数据填进模板，放进 sandbox iframe；模型在 设置 → API 的 eyef 单独选（llm 的 o.use），历史按聊天存在 D().eye.forum；其余内容是样例
apps/street/     商业街：横着滑的马卡龙色小街（SVG 插画，线条干净），大头贴机 / 一番赏 / 烘焙店 / 娃娃机；目前只有样子，功能待接
  isle.js          数据和页面（心情、风景什么时候换、AI 导演的风景词、按角色卡偏时代）
  gen.js           风景配方（纯逻辑，Node 可测）：时代 × 气候 × 地形 × 地标套件 × 植物 × 动物 × 配色；hintOf 把风景词翻成配方，eraOf 认时代
  jelly.js         果冻球：玻璃、软体变形、手势（戳、拖着转、翻面、双指缩放）、拍一下乱弹、画质自动降档；
                   渲染器 / 场景 / 编译好的着色器常驻（每次打开把同一块画布挪进页面），打开手机时 warm() 预热
  build.js         装配球里的世界：地形、烘焙 AO、水、天空、天气、粒子、动的零件
  kits.js          建筑和道具套件（寺庙、神社、街道、学校、医院、咖啡馆、木屋……），按材质合并成少数网格
  flora.js         植物：分枝生长的树 + 实例化叶片、草地、灌木、野花
  mats.js          程序化材质：噪声 GLSL 注进 three.js 的 PBR 材质（草、岩、木、瓦、金属…），不用贴图；
                   所有实体表面共用一个着色器程序（uSurf 选表面）——手机上编译着色器最慢，别再按表面拆成多个程序
  parts.js         零件累加器（按材质合并几何）
assets/three/    three.js r170（MIT，带 LICENSE），只有心屿用
apps/theme/      主题：壁纸、图标、气泡、小组件（时钟 clock、CCD 相机、吧唧 badge、画图相框）
apps/settings/   设置：API、联动模式、时间、世界书、显示、日志、数据
tests/           测试（见第五节）
```

---

## 三、核心约定（core.js）

**两份数据**
- `S`：全局设置，存在酒馆 `extensionSettings.st_phone`，所有聊天共用（API、主题、桌面、素材、音乐的喜欢 / 歌单）。改完调 `save()`。
- `D()`：当前酒馆聊天的手机数据，存在 `chatMetadata.st_phone`，每个酒馆聊天各一份（联系人、手机里的聊天、动态、心屿、音乐的推荐歌）。改完调 `saveD()`（会顺带刷新正文注入）。
- **开机顺序**：`index.js` 先 import 所有模块，酒馆就绪后 `init()` 里才执行 `initS()` 读出真正的 `S`。
  所以**模块被 import 时不要读写 `S`**（那时还是默认值），要读的放到 `init()` 之后做（例：`initMusic()`）。

**页面和交互**
- `page({ title, cls, body, right, foot, after, acts, live, onClose, onBack, noBack })` 压一页；`back()` 退一页；`home()` 全退。
  `onBack` 返回 true 表示页面自己处理了返回（比如音乐 App 先退回内层），`back(true)` 强制关。
- `sheet` / `menu` / `form` / `ok` / `toast`：底部弹层、选项菜单、表单（`data-k` 自动双向绑定）、确认框、提示。
- 点击用 `data-a="动作名" data-x="参数"`，长按用 `data-lp`；动作先在页面的 `acts` 里找，再到全局 `G` 里找。
- 右滑返回会跳过 `input`、色板、`.phone-gesture-control` 和 `[data-no-swipe-back]` 里的元素。
- 事件总线 `on` / `emit`：`chat`（聊天数据变了）、`stk`（表情包）、`cfg`（设置项变了）、`badge`、`home`、`open-chat`、`isle` / `isle-mood`、`phone-open`（手机从收起变成打开，心屿用它趁空闲预热 3D）。

**AI 和费用**
- `llm(系统, 用户, 描述, signal, { aux, images, mod })`：mod 是模块名（见 mods.js），设置 → 应用配置 里给它设的模型 / 流式 / 低思考会盖过默认；新加调用模型的功能都要 regMod 登记，可换的「内容 / 风格」段用 mp() 取，输出格式写死在代码里。
- `llm(系统, 用户, 描述, signal, { aux, images })`：调聊天模型，自动记日志；`aux: 1` 走设置里的「生成用模型」（生成联系人、读心情这类活；没设就用聊天模型），`images` 一起发图片。
- `task(标题, async signal => …)`：带转圈、计时、取消的任务条；出错用 `fail(msg)`。
- `sysCtx({ n, rc, wi, desc })`：拼角色卡 + 最近剧情 + 世界书的上下文。

**正文联动（不额外调 API）**
- 主模型在回复末尾写块，本地解析后从正文里删掉：
  - `<手机>…</手机>`：一行一件事（私聊 / 群聊 / 朋友圈 / 加好友 / 拉群 / 转账 / 拍一拍 / 心情），`apps/chat/chat.js` 的 `inlineSync` 解析。
  - `<音乐卡>…</音乐卡>`：角色此刻的音乐状态，`apps/music/music.js` 的 `cardSync` 解析。
- 要往正文提示词里加格式说明：往 `INJ` 里 push 一个函数（返回文本），`syncInject()` 会统一带上。新功能用这个，不要再改 `syncInject` 本身。
  （心屿的「心情」行目前还写在 `syncInject` 里，是历史遗留。）

**媒体文件**
- 上传的图片 / 视频用 `putMedia(src, kind)` 存进酒馆的 `user/images/XPhone/`，数据里只存路径；`gc()` 会删掉没人用的文件，删东西时调 `drop(旧值)`。
- 字体存浏览器 IndexedDB（`putMedia(file, 'font')`）。

**App 注册**
- `reg({ id, name, icon, open })` 注册；桌面图标、`openApp(id)` 都靠它。新 App 默认放到桌面的迁移写在 `desk.js` 的 `initDesk`。

---

## 四、模块边界

- App 只通过 `core.js` 和事件 / `G` 动作互相联系，尽量不要直接 import 别的 App 的内部文件。
  现有的例外（以后有机会就收掉，不要再加新的）：
  - `apps/chat/talk.js` → `apps/music/music-share.js`（聊天里的音乐卡片）
  - `apps/music/music-share.js` → `apps/chat/data.js`
  - `apps/settings/settings.js` → `apps/chat/` 下三个文件
- 音乐 App 的样式自成一套（`.mz-*`）。`style.css` 里有几条全局规则（`input` / `svg` / `p` / `.empty` / `.sheet`）用 `:not(:where(.mz-app *, …))` 跳过了它；
  新加全局规则时，注意别用 `#stp` 这种高权重选择器去盖 App 内部的类名。
- `core.js` 已经很大，新功能不要往里塞，放到自己的 App 文件夹里。

---

## 五、测试

- `node tests/run.cjs music isle` 按改动范围选择测试组，不默认运行全量测试。修改部分及直接受影响流程测试通过后推送；只有用户要求时才运行 `node tests/run.cjs` 全量测试。
- `tests/unit/*.mjs`：纯逻辑（Node 直接跑）。`tests/e2e/*.cjs`：Playwright + 模拟酒馆 `tests/e2e/st.html`，外网接口一律 `page.route` 模拟。
- 每个 e2e 文件自己起一个本地服务，**端口不能重复**（已用到 8821，新文件用 8822 起往上）。新文件要在 `tests/run.cjs` 和 `tests/README.md` 里登记。
- 模拟 AI：`core.S.api.chat.src = 'tavern'` 后替换 `SillyTavern.getContext().generateRaw`。
- 模拟开机前已有的设置：`page.addInitScript(() => { window.__preset = { st_phone: {…} } })`。
- 截图输出在 `tests/out/`（不提交）。
- 测试跑的是电脑上的 Chromium，作者真机是安卓 WebView：动画、`backdrop-filter`、新 CSS 选择器在真机上可能不一样，改了这些要提醒作者真机看一眼。
- 检查语法用 `node --experimental-default-type=module --check 文件`（普通 `node --check` 对 ES 模块查不出括号错）。

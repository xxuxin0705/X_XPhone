// 一键跑全部测试：node tests/run.cjs        只跑某几组：node tests/run.cjs unit ct send
// 浏览器测试需要 Playwright（Chromium）。截图在 tests/out/ 里（不进仓库）。
const { spawnSync } = require('child_process'), path = require('path');
const ALL = {
  feed: ['e2e/feed.cjs', '动态生成发布者过滤、多图、配图中英描述、顶栏变实心、评论表情、看大图、三种皮肤'],
  badge: ['unit/badge.mjs', '圆形和爱心磨砂吧唧：固定哑光银边、完整照片、裁切 ID 与照片设置'],
  gesture: ['unit/desk-gesture.mjs', '编辑模式：轻扫翻页、按住拖动、点按、取消和底栏手势'],
  paint: ['unit/paint-frame.mjs', 'Windows 画图相框：固定配色、照片位置和装饰工具'],
  layout: ['unit/desk-layout.mjs', '桌面固定 4×7：容量、形状、改尺寸、换页和旧内容迁移'],
  wide: ['unit/ccd-wide.mjs', '横版 CCD：默认银色、自定义颜色、共用背景、照片视频、视频资源释放'],
  tint: ['unit/ccd-tint.mjs', 'CCD 浅色机壳：选色还原、高光阴影、暗框与透明度'],
  color: ['unit/color-drag.mjs', '取色圆圈：初始化、拖动、灰度、页面重画与取消'],
  wpreview: ['unit/widget-preview.mjs', '小组件设置：实时样式预览、尺寸、保存与取消'],
  unit: ['unit/test.mjs', '逻辑测试：数据、解析、API 调用、内联同步（不开浏览器）'],
  mods: ['e2e/mods.cjs', '设置 → 应用配置：按应用列模块、每个模块单独选模型 / 流式 / 低思考、系统默认提示词只读、新增 / 切换 / 删除自己的、生成时按选中的走'],
  eyef: ['e2e/eyef.cjs', '窥探之眼 · 论坛：登录窗、加载窗、生成 50+ 楼（模拟 AI）、楼中楼展开 / 点赞、历史按聊天存、提示词避开上次平台、过滤脚本'],
  e2e: ['e2e/e2e.cjs', '基本流程：开手机、聊天、生成、同步开关'],
  ms: ['e2e/ms.cjs', '消息列表长按多选、批量删除'],
  rv4: ['e2e/rv4.cjs', 'AI 生成联系人的审阅单（编辑、勾选、群资料）'],
  grp: ['e2e/grp.cjs', '群头衔、群人数、非好友成员、加好友'],
  fp2: ['e2e/fp2.cjs', '锁屏：密码三选一、指纹录入与解锁、备用密码'],
  send: ['e2e/send.cjs', '发送键：默认不自动回复（✦ 让对方回）、停止、可选自动回复；对方能看懂我发的表情包（名字 + 识图，不支持看图自动退回文字）'],
  stp: ['e2e/stp.cjs', '酒馆连接配置、状态栏高度、字体大小（百分比）'],
  ct: ['e2e/ct.cjs', '四种风格的通讯录和加好友页、搜索、推荐'],
  snow: ['e2e/snow.cjs', '锁屏雪夜：照片底图、点树亮灯、雪地写字、雪人、抖雪、结霜、底部上滑解锁、打开第一帧不黑屏'],
  stk: ['e2e/stk.cjs', '表情包：面板图标栏、表情商店、表情包组详情、搜索（可爱风优先）、AI 表情配图、线路兜底；翻译按钮、Kakao 未读 1'],
  mine: ['e2e/mine.cjs', '我的表情：长按管理；导入表情包（上传图片 / 链接 / Word 文件）前挑选保留、起名字、本地读图里的字；动态页；机翻不再报错'],
  msel: ['e2e/msel.cjs', '聊天长按菜单（编辑、拍一拍提示可删）、多选（颜色跟风格）、转发（逐条 / 合并，只写网名）、长按图片不弹大图、翻译补漏、拍一拍格式、Kakao 输入栏和未读 1、点聊天收起面板'],
  cssname: ['e2e/cssname.cjs', '样式撞名检查：style.css 里的规则不能选中酒馆自己的元素（不开浏览器，1 秒）'],
  calllocal: ['e2e/calllocal.cjs', '免费本地识别：真实中文录音、增量草稿、中日英实际模型加载', 300e3],
  callflow: ['unit/call-flow.mjs', '通话：稳定台词、情绪、音频分块与播放确认'],
  callear: ['unit/call-ear.mjs', '通话：自动断句、插话与识别取消'],
  call: ['e2e/call.cjs', '聊天「＋」：语音 / 视频通话（拨号、接通、打字说、流式回、挂断存通话内容）、收藏、个人名片'],
  wxst: ['e2e/wxst.cjs', '微信「状态」：我页入口、状态列表分组、全屏看状态、设个状态；个人信息改名回显；地区地图选点'],
  wxset: ['e2e/wxset.cjs', '微信样式：美化只有日间 / 夜间 + 背景、每条带头像；基本信息整段显示；个人信息改微信号、性别 / 地区 / 签名'],
  pay: ['e2e/pay.cjs', '微信转账 / 红包（照录屏）：发红包键盘 / 祝福语表情 / 支付弹层、转账支付成功页、拆红包 → 详情页、收转账 → 回执、消息列表红字预览'],
  trq: ['e2e/trq.cjs', '翻译跟着设置变：引用条显示被引用消息现在的样子、我的消息跟着目标语言重新机翻、旧引用找回'],
  cset: ['e2e/cset.cjs', '聊天设置：专属音色（服务商 / 朗读语言 / 各家音色 / 名字读音）、翻译（私聊 / 群聊跟随或统一）、回复设置、拍一拍「拍了拍你」、语音渠道模式'],
  lock2: ['e2e/lock2.cjs', '锁屏：自定义锁屏图片 / 视频 / 实况（打开手机时动一下）、随机锁屏、随机壁纸'],
  ball: ['e2e/ball.cjs', '悬浮窗图标：12 个造型，主题美化里选（排在最前），设置 → 显示方式 显示当前的、可以换'],
  clk: ['e2e/clk.cjs', '时间样式：锁屏时间字体可选 / 日期在上或下 / 12・24 小时 / 中英文 / 粗细 / 颜色；桌面「时间」小组件'],
  music: ['e2e/music.cjs', '音乐 App：四个页签 / 播放页 / 摘录 / 歌单 / 心动模式 / 分享与一起听 / 角色邀请 / 正文音乐卡 / 音源地址 / 旧数据迁移'],
  isle: ['e2e/isle.cjs', '心屿：心情天气 / 随机风景（时代 × 气候 × 地标套件）/ 戳 / 拖着转能翻过来 / 双指缩放 / 拍一下乱弹 / AI 导演按剧情选风景 / 潮汐记录', 1500e3], // 3D 用软件渲染，着色器编译慢，给它更长时间
  ccd: ['e2e/ccd.cjs', '桌面小组件：只剩 CCD；添加按尺寸筛选带预览；调整大小只能同比例；CCD 相机组件（机身颜色、照片、背景透明 / 毛玻璃 / 纯色 / 渐变 + 透明度、编辑模式换照片）'],
  prov: ['e2e/prov.cjs', '生图 / 语音服务商页：迁移、切换、快选拉取、Fish 网页接口、ElevenLabs'],
};
const pick = process.argv.slice(2).filter(k => ALL[k]), keys = pick.length ? pick : Object.keys(ALL);
let bad = 0; const sum = [];
for (const k of keys) {
  const [f, d, to] = ALL[k]; process.stdout.write(`\n== ${k} · ${d}\n`);
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { encoding: 'utf8', timeout: to || 300e3 });
  const out = (r.stdout || '') + (r.stderr || ''), m = out.match(/(\d+) passed, (\d+) failed/);
  out.split('\n').filter(l => /✗|errors?:|Error|FATAL/.test(l)).forEach(l => console.log(l));
  const okk = m && +m[2] == 0 && r.status == 0; okk || bad++;
  sum.push(`${okk ? '✓' : '✗'} ${k.padEnd(5)} ${m ? m[1] + ' 通过 / ' + m[2] + ' 失败' : '没跑完（看上面的报错）'}`);
}
console.log('\n' + sum.join('\n')); process.exit(bad ? 1 : 0);



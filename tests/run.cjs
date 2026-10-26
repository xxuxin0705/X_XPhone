// 一键跑全部测试：node tests/run.cjs        只跑某几组：node tests/run.cjs unit ct send
// 浏览器测试需要 Playwright（Chromium）。截图在 tests/out/ 里（不进仓库）。
const { spawnSync } = require('child_process'), path = require('path');
const ALL = {
  layout: ['unit/desk-layout.mjs', '桌面固定 4×6：容量、形状、改尺寸、换页和旧内容迁移'],
  wide: ['unit/ccd-wide.mjs', '横版 CCD：默认银色、自定义颜色、共用背景、照片视频、视频资源释放'],
  tint: ['unit/ccd-tint.mjs', 'CCD 浅色机壳：选色还原、高光阴影、暗框与透明度'],
  color: ['unit/color-drag.mjs', '取色圆圈：初始化、拖动、灰度、页面重画与取消'],
  wpreview: ['unit/widget-preview.mjs', '小组件设置：实时样式预览、尺寸、保存与取消'],
  unit: ['unit/test.mjs', '逻辑测试：数据、解析、API 调用、内联同步（不开浏览器）'],
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
  cset: ['e2e/cset.cjs', '聊天信息：专属音色（服务商 / 朗读语言 / 各家音色 / 名字读音）、翻译（私聊 / 群聊跟随或统一）、回复设置、拍一拍「拍了拍你」、语音渠道模式'],
  lock2: ['e2e/lock2.cjs', '锁屏：自定义锁屏图片 / 视频 / 实况（打开手机时动一下）、随机锁屏、随机壁纸'],
  ball: ['e2e/ball.cjs', '悬浮窗图标：12 个造型，主题美化里选（排在最前），设置 → 显示方式 显示当前的、可以换'],
  clk: ['e2e/clk.cjs', '时间样式：锁屏时间字体可选 / 日期在上或下 / 12・24 小时 / 中英文 / 粗细 / 颜色；桌面「时间」小组件'],
  ccd: ['e2e/ccd.cjs', '桌面小组件：只剩 CCD；添加按尺寸筛选带预览；调整大小只能同比例；CCD 相机组件（机身颜色、照片、背景透明 / 毛玻璃 / 纯色 / 渐变 + 透明度、点一下换照片）'],
  prov: ['e2e/prov.cjs', '生图 / 语音服务商页：迁移、切换、快选拉取、Fish 网页接口、ElevenLabs'],
};
const pick = process.argv.slice(2).filter(k => ALL[k]), keys = pick.length ? pick : Object.keys(ALL);
let bad = 0; const sum = [];
for (const k of keys) {
  const [f, d] = ALL[k]; process.stdout.write(`\n== ${k} · ${d}\n`);
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { encoding: 'utf8', timeout: 300e3 });
  const out = (r.stdout || '') + (r.stderr || ''), m = out.match(/(\d+) passed, (\d+) failed/);
  out.split('\n').filter(l => /✗|errors?:|Error|FATAL/.test(l)).forEach(l => console.log(l));
  const okk = m && +m[2] == 0 && r.status == 0; okk || bad++;
  sum.push(`${okk ? '✓' : '✗'} ${k.padEnd(5)} ${m ? m[1] + ' 通过 / ' + m[2] + ' 失败' : '没跑完（看上面的报错）'}`);
}
console.log('\n' + sum.join('\n')); process.exit(bad ? 1 : 0);


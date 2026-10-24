// 一键跑全部测试：node tests/run.cjs        只跑某几组：node tests/run.cjs unit ct send
// 浏览器测试需要 Playwright（Chromium）。截图在 tests/out/ 里（不进仓库）。
const { spawnSync } = require('child_process'), path = require('path');
const ALL = {
  unit: ['unit/test.mjs', '逻辑测试：数据、解析、API 调用、内联同步（不开浏览器）'],
  e2e: ['e2e/e2e.cjs', '基本流程：开手机、聊天、生成、同步开关'],
  ms: ['e2e/ms.cjs', '消息列表长按多选、批量删除'],
  rv4: ['e2e/rv4.cjs', 'AI 生成联系人的审阅单（编辑、勾选、群资料）'],
  grp: ['e2e/grp.cjs', '群头衔、群人数、非好友成员、加好友'],
  fp2: ['e2e/fp2.cjs', '锁屏：密码三选一、指纹录入与解锁、备用密码'],
  send: ['e2e/send.cjs', '发送键：单个图标、等待方块、自动回复、停止'],
  stp: ['e2e/stp.cjs', '酒馆连接配置、状态栏高度、字体大小'],
  ct: ['e2e/ct.cjs', '四种风格的通讯录和加好友页、搜索、推荐'],
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

// 小手机 · 语音 / 视频通话（照微信录屏的样子；流式的做法参考 StarHub 的思路）
// 10-31 重写：提示词、切句、语言检查都搬到 call-brain.js；这里只管界面、麦克风、播放。接通那句由模型按剧情写（响铃时就在写），不再固定「喂？」
// 低延迟：①模型用流式返回，一句话一出来就送去合成（不等整段写完）；②下一句在上一句播放时就提前合成；③对方说话时不开麦（避免把自己的声音录进去），说完马上接着听；
// ④通话就是纯聊天，不让模型同时干别的；⑤通话内容结束后存成一条「通话」消息，聊天回复时带一段摘录，私聊知道电话里聊了什么但不会塞满上下文。
// 听我说话（默认「模型听」）：浏览器自带识别要连谷歌、国内基本用不了，所以自己开麦克风，按音量判断我开口 / 说完（停 1 秒），
// 把这段录音跟本轮请求一起发给模型（Gemini 能听音频），模型先写一行 HEARD: 听到的原话再回答——不多调用一次、不用谷歌识别。也可以切回「浏览器识别」。
// 自动接话（默认，照 StarHub 示例）：对方说完马上开麦听我说，我停下约 1.2 秒就自动轮到 TA，不用按键；也可以切成「点着说」。
// 听我说话：点一下「点这里说」开始，浏览器自带的语音识别（Web Speech，免费，不走你的 API）把话实时写在屏幕上，点「说完了」才轮到 TA；用不了（没有麦克风权限 / 网络不通）就打字说。
// 等得久：对方正在想的秒数一直显示；超过 2.5 秒先垫一句「嗯…」（接通时提前合成好的）；20 秒给出原因提示；2 分钟没动静就当这轮失败，可以再说一遍。
// 对方说话：用你在设置里配的语音服务（这个人的专属音色）；没配语音就只显示字幕。
import { voiceOf, pickVoice, ttsCfg, stProf, curStream } from '../../core.js';
import { S, D, save, saveD, esc, ui, toast, avOf, meObj, nm, rn, now, llm, tts, emit, menu, mt } from '../../core.js';
import { regMod } from '../../mods.js';
import { lname } from './data.js';
import { LANG, base, tail, messages, flat, parser, fixLang, cues, cueStyle } from './call-brain.js';
import { makeEar, wav, asrCfg } from './ear.js';
import { asrFor, localAsr } from './local-asr.js';
import { packOn } from '../settings/lang-packs.js';
regMod({ k: 'chat.call', app: '聊天', n: '语音通话', def: '像真人打电话那样：口语，会接话、会追问、会吐槽；有时一句话，有时说一大段。', vars: [['对方', '通话的人'], ['我', '我的网名']] });

const IC = n => new URL(`../../assets/wx/call/${n}.png`, import.meta.url).href;
const msk = (n, c = '') => `<i class="xc-i ${c}" style="--ci:url('${IC(n)}')"></i>`;
const SPK_ON = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 9.2h3.6L12.4 5v14l-4.8-4.2H4z"/><path d="M15.2 8.6a4.6 4.6 0 0 1 0 6.8M17.6 6.2a8 8 0 0 1 0 11.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
// 我说什么语言：本地模型一个只认一种（中文内置、日语装包）；「混着说」要靠云端识别（硅基流动的 SenseVoice 本身就是多语言的，中日英混着说也认）
// 我说要走了（这时 TA 写 [挂断] 才当真）
const BYE = /拜拜|再见|晚安|挂了|先这样|睡了|睡觉了|去睡|要睡|去忙|bye|good ?night|おやすみ|じゃあね|またね|バイバイ|잘\s*자|안녕/i;
const inName = v => v == 'mix' ? '混着说' : IN.find(x => x[0] == v)?.[1] || v;
const IN = [['zh-CN', '中文'], ['ja-JP', '日语'], ['mix', '混着说（中日英韩粤）'], ['en-US', '英语'], ['ko-KR', '韩语'], ['yue-Hant-HK', '粤语']];
const OUT = [['auto', '跟聊天设置'], ['zh', '中文'], ['en', '英语'], ['ja', '日语'], ['ko', '韩语']];
const outName = L => !L || L == 'zh' ? '中文' : lname(L);
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAABErAAABAAgAZGF0YQAAAAA=';
const SR = () => globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
const mmss = s => `${String(s / 60 | 0).padStart(2, '0')}:${String(s % 60 | 0).padStart(2, '0')}`;
let CALL = null; // 同一时间只有一通电话
const shortErr = m => { m = String(m || ''); const x = m.match(/"message"\s*:\s*"([^"]+)"/); return (x ? x[1] : m).replace(/\s*\(request id[^)]*\)/i, '').slice(0, 90); }; // 报错只留一句人话
const SIL = 1200; // 自动接话：我停下多久算说完（毫秒）
// TauriTavern（安卓 App）没有申请录音权限，网页里拿不到麦克风，浏览器识别也用不了 → 改用手机输入法自带的语音输入（键盘上的话筒）：
// 轮到我就弹出输入框，输入法把话写进框里；看过、改好了按发送才发（10-31：不再停一下就自动发）
const TAU = () => !!(globalThis.__TAURI_INTERNALS__ || globalThis.__TAURI__);
const EAR_END = 1.0, EAR_MIN = .35, EAR_MAX = 30; // 模型听：停多久算说完 / 太短的不算（咳嗽、碰到手机）/ 一句最长（秒）

// 「＋」面板 → 视频通话：先选 视频通话 / 语音通话（照录屏）
export async function callSheet(ch) {
  if (ch.type != 'p') return toast('群通话还没有做');
  const k = await menu([['video', '<span class="xc-mi">' + msk('p-video') + '视频通话</span>'], ['voice', '<span class="xc-mi">' + svgTel + '语音通话</span>']]); k && startCall(ch, k);
}
const svgTel = '<svg class="xc-ms" viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 3.5c.5-.3 1.2-.2 1.6.3l2 2.6c.4.5.4 1.2 0 1.7L9 9.4a12 12 0 0 0 5.6 5.6l1.3-1.2c.5-.4 1.2-.4 1.7 0l2.6 2c.5.4.6 1.1.3 1.6l-1.1 1.8c-.5.8-1.5 1.2-2.4.9C10.6 18.6 5.4 13.4 3.9 7.1c-.2-.9.1-1.9.9-2.4z"/></svg>';

// so.story：「枕边故事」——接通后 TA 问想听什么（不调用模型），我说一句，TA 一次请求讲一个长故事，慢慢念给我听；讲完我不出声 30 秒就自己挂（多半睡着了）
// 进私聊就在后台先把本地识别模型读好（同一个网页里只读一次），拨电话时不用再等「正在准备本地识别」
export function warmEar() { const w = S.callEar2 ?? 'local'; if (w != 'local' || !navigator.mediaDevices?.getUserMedia || CALL) return; const L = S.callLang || 'zh-CN', en = packOn(L) && asrFor(L) || localAsr; en.loaded || en.load().catch(() => { }); }
export function startCall(ch, kind = 'voice', so = {}) {
  if (CALL) return CALL.el.classList.remove('mini'), toast('正在通话中');
  const c = ch, me = meObj(), A = { ch, kind, st: 'dial', t0: 0, mic: true, spk: kind == 'video', log: [], cap: '', who: '', q: [], ac: null, rec: null, au: null, ring: null, cam: null, typing: false, ttsBad: false, inL: S.callLang || 'zh-CN', outL: undefined, ph: 'dial', thinkAt: 0, lastSaid: null, mem: S.callMem ?? true }; // mem：这通电话挂了以后记不记进 TA 的记忆
  // 走酒馆「当前连接」时拿不到流式：整段想完才开口，所以会慢；在 应用配置 → 语音通话 里选一个「连接配置」或自己的 API 才能一句一句出
  A.raw = !(S.mods?.['chat.call']?.use) && S.api.chat.src == 'tavern' && !stProf(S.api.chat.stp) && !curStream(); // 酒馆当前连接是聊天补全时也能流式（见 core 的 curReq）
  A.story = so.story ? 1 : 0; // 1：等我说想听什么；2：讲过了
  A.auto = S.callAuto ?? true; A.kbv = false; A.ear = (w => w == 'web' || !navigator.mediaDevices?.getUserMedia ? 'web' : w)(S.callEar2 ?? 'local'); // 默认本地识别（不联网、不花钱） // Tauri 也先试麦克风（以后 TauriTavern 加了录音权限就能直接用），拿不到再换输入法说 // Tauri：用输入法说（输入框常驻，不随重画重建，输入法的语音面板才不会被关掉）
  // 播放用的音频时钟：在这次点击里建好（浏览器要求有用户操作才能出声），整通电话共用一个
  // 手机浏览器 / 酒馆 App 的内置网页默认「没点过就不许出声」：这里趁着这次点击，把音频时钟和一个常驻的播放器都先「解锁」（各放一段静音），后面整通电话都用它们
  try { A.ctx = new (globalThis.AudioContext || globalThis.webkitAudioContext)(); A.gain = A.ctx.createGain(); A.gain.gain.value = A.spk ? 1 : .85; A.gain.connect(A.ctx.destination);
    const z = A.ctx.createBufferSource(); z.buffer = A.ctx.createBuffer(1, 1, 22050); z.connect(A.gain); z.start(0); A.ctx.resume?.(); } catch { }
  A.au = new Audio(SILENT); A.au.play().catch(() => { });
  isEar() ? setTimeout(() => { earOn(); fitLang(); A.ear == 'sf' && !asrCfg().key && askKey(); A.ear == 'local' && loadLocal(); }, 0) : TAU() && setTimeout(() => kbMode(), 0); // 趁这次点击开麦克风（第一次会弹权限）；Tauri 里浏览器识别用不了
  A.lines = []; // 字幕：这通电话里谁说了什么（外语带中文）
  // 本地识别只认内置的中文和装了语言包的语言：说别的语言时换成云端识别（硅基流动免费的 SenseVoice，听得懂中英日韩粤），换回中文再换回本地
  function fitLang(say) { if (!isEar() && !A.earBack) return; const loc = packOn(A.inL), ln = inName(A.inL);
    if (!loc && A.ear == 'local') { A.earBack = 'local'; if (asrCfg().key) { A.ear = 'sf'; say && toast(`说${ln}用云端识别（硅基流动，免费）；中文还是本地认`); } else { A.ear = 'model'; askKey(); } }
    else if (loc && A.earBack) { A.ear = A.earBack; A.earBack = null; A.ear == 'local' && loadLocal(); say && toast('换回本地识别'); }
    else if (loc && A.ear == 'local') loadLocal(); // 中文 ↔ 装了包的语言：换个模型
    A.earBad = ''; }
  function isEar() { return A.ear == 'model' || A.ear == 'sf' || A.ear == 'local'; } // 自己开麦克风听（不是浏览器识别 / 输入法）
  const ear = makeEar({ ctx: A.ctx, kind: () => A.ear == 'model' ? 'model' : A.ear, playing: () => (A.playN || 0) > 0, local: cb => eng().loaded ? eng().session(cb) : null, polish: () => (S.callPolish ?? true) && !!asrCfg().key && navigator.onLine !== false,
    mode: () => !A.mic || A.st != 'talk' || CALL != A || A.recog || A.fixing || !isEar() || A.ear == 'local' && !eng().loaded || performance.now() < (A.quiet || 0) ? 'off' : A.ph == 'think' || A.ph == 'speak' ? 'off' : 'listen' } /* 轮流说（照 StarHub 教程）：TA 想和说的时候麦克风关着，外放的声音录不进去、杂音也不会打断；想让 TA 停就点一下屏幕 */, (t, v) => earEv(t, v));
  A.earObj = ear;
  const el = Object.assign(document.createElement('div'), { className: `xc xc-${kind}` }); A.el = el; CALL = A;
  const V = Object.assign(document.createElement('div'), { className: 'xc-v' }); el.append(V); // 每次重画只换这一层
  let KB = null; // 输入法说的输入框（常驻，不随重画重建）
  // 输入法说（TauriTavern 没有录音权限时）：弹一个常驻的框，用键盘上的话筒说；只有框里有焦点（键盘开着）时才说「在听…」，不骗人
  function kbMode() { if (KB || CALL != A) return; A.kbv = true; A.ear = 'web'; earOff(); A.earBad = '';
    KB = Object.assign(document.createElement('label'), { className: 'xc-kb', innerHTML: '<input enterkeyhint="send" autocomplete="off" placeholder="点这里，用键盘上的🎤说话">' }); el.append(KB);
    const i = KB.querySelector('input'); i.onfocus = () => { A.kbF = 1; draw(); }; i.onblur = () => { A.kbF = 0; draw(); };
    const send = () => { clearTimeout(A.kt); const v = i.value.trim(); if (!v || A.ph == 'think' || A.ph == 'speak' || A.st == 'dial') return; i.value = ''; A.kbU = 1; heard(v); }; // 发完清空但不失焦：输入法的语音面板接着听
    i.onkeydown = e => e.key == 'Enter' && (e.preventDefault(), send());
    i.oninput = () => { clearTimeout(A.kt); if (A.ph == 'speak' || A.ph == 'think') A.echo = 1; }; // 不自动发：看一眼认得对不对，改好了按键盘上的「发送」
    KB.onclick = e => e.stopPropagation(); draw(); }
  const draw = () => {
    const dial = A.st == 'dial', rec = A.ph == 'rec', cap = A.lines.length || rec ? `<div class="xc-tx">${A.lines.slice(-8).map((x, i, L) => `<p class="${x.f == 'me' ? 'me' : ''} ${x == A.pend?.line ? 'pend' : ''} ${i == L.length - 1 && A.ph == 'speak' && x.f != 'me' ? 'now' : ''}"${x.f == 'me' && x.t != '…' ? ` data-k="fix" data-i="${A.lines.length - L.length + i}"` : ''}>${x == A.rv ? `<span class="xc-r">${esc(x.t.slice(0, x.sh))}</span>` : esc(x.t)}${x.tr && x.tr != x.t ? `<em${x == A.rv ? ' class="xc-r2"' : ''}>${esc(x == A.rv ? x.tr.slice(0, Math.ceil(x.tr.length * x.sh / Math.max(1, x.t.length))) : x.tr)}</em>` : ''}</p>`).join('')}${rec ? isEar() ? `<p class="me ing xc-lvp"><span class="xc-pt">${esc(A.heard || '')}</span> <span class="xc-lv"><i></i><i></i><i></i><i></i><i></i></span></p>` : `<p class="me ing"><span>${esc(A.heard || '')}</span><i class="xc-cur"></i></p><p class="xc-dg">${esc(diag())}</p>` : ''}</div>` : '';
    const thinkS = A.ph == 'think' ? Math.round((performance.now() - A.thinkAt) / 1e3) : 0;
    const ph = A.story && !dial && (A.ph == 'idle' || A.ph == 'speak' || A.ph == 'think' && !A.recog) ? { idle: A.story == 1 ? '想听什么故事？直接说' : '讲完啦，晚安', speak: `${esc(nm(c))} 在讲故事`, think: `${esc(nm(c))} 在想故事…` }[A.ph] : { idle: A.kbv ? A.kbF ? '在听…' : A.kbU ? '点下面的框，接着说' : '点下面的框，按键盘上的🎤说话' : isEar() && A.mic ? A.ear == 'local' && !eng().loaded ? `正在准备本地识别…${A.lp != null ? ` ${A.lp}%` : ''}` : ear.ms ? '在听…' : '正在打开麦克风…' : A.mic ? A.auto ? '点「点这里说」接着聊' : '点下面「点这里说」，说完点「说完了」' : '麦克风已关', rec: A.auto ? '在听…' : '在听你说… 说完点「说完了」', think: A.recog ? '在认你说的话…' : `${esc(nm(c))} 在想…${thinkS >= 5 ? ` <i class="xc-ts">${tsTxt(thinkS)}</i>` : ''}`, speak: `${esc(nm(c))} 正在说`, fail: '这轮没接上，可以再说一遍' }[A.ph] || '';
    const hint = A.kbv && !A.kbU && A.ph != 'think' && A.ph != 'speak' && !dial ? '<p class="xc-hint">酒馆 App（Tauri）没有给网页麦克风权限，直接对着手机说它听不到；借键盘自带的语音输入说，认出来的字看一眼，对了按键盘上的「发送」</p>' : A.ph == 'fail' && A.why ? `<p class="xc-hint">${esc(A.why)}</p>` : isEar() && A.earBad ? `<p class="xc-hint">${esc(A.earBad)}</p>` : A.ph == 'think' && thinkS >= 20 ? `<p class="xc-hint">${A.raw ? '酒馆当前连接是文本补全（或酒馆版本太旧），拿不到流式，要等整段想完才开口。在 设置 → 应用配置 → 聊天 → 语音通话 里选一个「连接配置」或自己的 API，并把「低思考」打开，会快很多' : `模型想得有点久${A.thk ? `（已经想了 ${A.thk} 字）` : ''}。${(S.mods?.['chat.call']?.think || 'low') == 'full' ? '在 设置 → 应用配置 → 语音通话 里把「低思考」打开会快一些' : '「低思考」已经开着它还这么想，是这个模型关不掉思考：打电话换个不思考的模型吧（设置 → 应用配置 → 语音通话 → 挑一个免费模型，比如 GLM-4.7-Flash）'}`}</p>` : '';
    const pill = dial ? '' : A.pend && (A.ph != 'think' && A.ph != 'speak' || A.recog) ? `<div class="xc-talk"><b class="xc-pill go" data-k="psend">${A.sending ? '等这句认完就发…' : '发送'}</b><b class="xc-pill sub" data-k="pdel">重说</b></div>` : (A.kbv || isEar()) && !(A.ph == 'think' && thinkS >= 20) && A.ph != 'fail' ? '' : rec ? `<div class="xc-talk"><b class="xc-pill go" data-k="done">说完了</b><b class="xc-pill sub" data-k="recx">取消</b></div>`
      : A.ph == 'think' ? `<div class="xc-talk"><b class="xc-pill sub" data-k="stop">${thinkS >= 20 ? '不等了，我再说' : '打断'}</b></div>`
      : A.ph == 'speak' ? '' : `<div class="xc-talk">${A.typing || isEar() ? '' : `<b class="xc-pill ${A.mic ? '' : 'dis'}" data-k="talk">${msk('mic', 'sm')}${A.ph == 'fail' && A.lastSaid ? '再说一遍' : '点这里说'}</b>`}${A.ph == 'fail' && A.lastSaid ? `<b class="xc-pill sub" data-k="retry">重发刚才那句</b>` : ''}</div>`;
    const keep = el.querySelector('.xc-type input')?.value || '';
    V.innerHTML = `<div class="xc-bg" style="background-image:url('${esc(avOf(c))}')"></div><div class="xc-dim"></div>
<b class="xc-min" data-k="min">${msk('mini')}</b>${kind == 'video' ? `<div class="xc-me">${A.cam ? '<video autoplay muted playsinline></video>' : `<img src="${esc(avOf(me))}">`}</div>` : ''}
<div class="xc-mid${pill ? ' pl' : ''}"><img class="xc-av" src="${esc(avOf(c))}"><b class="xc-nm">${esc(nm(c))}</b><p class="xc-st">${dial ? '<span class="xc-dots"><i></i><i></i><i></i></span>' : `<span class="xc-tm">${mmss(A.t0 ? (now() - A.t0) / 1e3 : 0)}</span>`}</p>${dial ? '' : `<p class="xc-ph">${A.pend && A.ph == 'idle' ? '对的话点「发送」；听错了点那行字改，接着说会接在后面' : ph}</p>${hint}`}${cap}</div>

<div class="xc-ctl">${A.typing ? `<div class="xc-type"><input placeholder="${A.kbv ? '按输入法上的🎤说话，看过按发送' : '打字说给 TA 听'}" enterkeyhint="send"><b data-k="send">说</b></div>` : ''}${pill}${kind == 'video' && !dial ? '<b class="xc-sw" data-k="tov">切到语音通话</b>' : ''}<div class="xc-bts">
<b data-k="mic" class="${A.mic ? 'on' : ''}"><i class="xc-c">${msk('mic', A.mic ? '' : 'off')}</i><small>${A.mic ? '麦克风已开' : '麦克风已关'}</small></b>
<b data-k="end"><i class="xc-c red">${msk('hang')}</i><small>${dial ? '取消' : '挂断'}</small></b>
<b data-k="spk" class="${A.spk ? 'on' : ''}"><i class="xc-c">${A.spk ? SPK_ON : msk('spk-off')}</i><small>${A.spk ? '扬声器已开' : '扬声器已关'}</small></b></div>
${dial ? '' : `<div class="xc-lang"><b data-k="inl">我说 ${esc(inName(A.inL))}</b><i></i><b data-k="outl">TA 说 ${esc(outName(A.outL ?? (ch.cfg?.lang || '')))}</b>${A.kbv ? '' : `<i></i><b data-k="ear">${{ local: '本地识别', model: '模型听', sf: '硅基识别', web: '浏览器识别' }[A.ear]}</b>`}${isEar() ? '' : `<i></i><b data-k="auto">${A.auto ? '自动接话' : '点着说'}</b>`}${A.kbv ? '' : `<i></i><b data-k="kb">${A.typing ? '收起键盘' : '⌨ 打字说'}</b>`}<i></i><b data-k="mem">${A.mem ? '记住这通' : '不记这通'}</b></div>`}</div>`;
    el.classList.toggle('pl', !!pill);
    if (A.cam) { const v = el.querySelector('video'); v && (v.srcObject = A.cam); }
    const tx = el.querySelector('.xc-tx'); tx && (tx.scrollTop = tx.scrollHeight);
    const ip = el.querySelector('.xc-type input'); if (ip) { ip.value = keep; ip.onkeydown = e => e.key == 'Enter' && sendTyped(); setTimeout(() => ip.focus(), 30); }
  };
  A.draw = draw;
  const tick = setInterval(() => { const t = el.querySelector('.xc-tm'); t && A.t0 && (t.textContent = mmss((now() - A.t0) / 1e3)); const m = el.querySelector('.xc-mt'); m && A.t0 && (m.textContent = mmss((now() - A.t0) / 1e3));
    if (A.ph == 'rec') dg();
    if (A.story == 2 && A.st == 'talk' && A.ph == 'idle' && A.idleAt && performance.now() - A.idleAt > 30e3) return hang(); // 枕边故事讲完 30 秒没动静：多半睡着了，轻轻挂掉
    // 追问（学 Brielle 的通话系统）：TA 说完我一直不出声，TA 问一句「还在吗」，最多两次；我一开口就重新算
    if ((S.callNudge ?? true) && !A.story && A.st == 'talk' && A.ph == 'idle' && !A.pend && !A.recog && !ear.on && A.idleAt && A.lines.length && (A.nudge || 0) < 2 && !el.querySelector('.xc-fix') && !(A.kbv && KB?.querySelector('input').value)) { const w = A.kbv ? 15 : 8, s = (performance.now() - A.idleAt) / 1e3; if (s >= w) { A.nudge = (A.nudge || 0) + 1; turn(null, { nudge: Math.round(s) }); } }
    if (A.earBad && /一点声音/.test(A.earBad) && ear.vmax > .004) { A.earBad = ''; draw(); }
    if (isEar() && ear.ms && A.st == 'talk' && !A.earBad && performance.now() - ear.at > 6e3 && ear.vmax < .002) { A.earBad = '麦克风开着，但一点声音都没进来：如果在录屏并且录了麦克风，录屏会把麦克风占走（录屏时关掉「录制麦克风声音」再试）'; draw(); }
    if (A.ph == 'think') { const sN = Math.round((performance.now() - A.thinkAt) / 1e3), ts = el.querySelector('.xc-ts'); ts && (ts.textContent = tsTxt(sN)); (sN == 5 || sN == 20) && draw(); } }, 1000); // 想到 20 秒：换上提示和「不等了」
  const tsTxt = sN => `${sN}s${A.thk ? ` · 模型思考了 ${A.thk} 字` : A.got ? '' : ''}`;
  const sendTyped = () => { clearTimeout(A.kt); const ip = el.querySelector('.xc-type input'), v = ip?.value.trim(); if (!v) return; if (A.ph == 'think') return toast('等 TA 想好，或者先点「打断」'); ip.value = ''; stopRec(); heard(v); }; // 对方思考时不收新的话（不然会叠出两份回答）
  el.onclick = e => { const k = e.target.closest('[data-k]')?.dataset.k;
    if (el.classList.contains('mini')) { el.classList.remove('mini'); return; }
    if (k == 'min') { el.classList.add('mini'); el.querySelector('.xc-mini')?.remove(); el.insertAdjacentHTML('beforeend', `<div class="xc-mini"><img src="${esc(avOf(c))}"><span class="xc-mt">${A.t0 ? mmss((now() - A.t0) / 1e3) : '等待接听'}</span></div>`); return; }
    if (k == 'end') return hang();
    if (k == 'mic') { A.mic = !A.mic; ear.reset(); A.ph == 'rec' && isEar() && (A.ph = 'idle'); if (!A.mic && A.ph == 'rec') { stopRec(); A.ph = 'idle'; A.heard = ''; } return draw(); }
    if (k == 'talk') { if (!A.mic) return toast('先打开麦克风'); if (A.kbv) { KB.querySelector('input').focus(); return; } return listen(); }
    if (k == 'done') return finishRec();
    if (k == 'recx') { stopRec(); A.heard = ''; A.ph = 'idle'; return draw(); }
    if (k == 'stop') { const w = Math.round((performance.now() - A.thinkAt) / 1e3); interrupt(); A.ph = 'fail'; A.why = `刚才等了 ${w} 秒没等 TA 想完${A.thk ? `（模型思考了 ${A.thk} 字还没开口）` : '（模型一个字都还没回）'}。${(S.mods?.['chat.call']?.think || 'low') == 'full' ? '想得久多半是开着深度思考：设置 → 应用配置 → 语音通话 打开「低思考」' : '「低思考」开着还这么慢，是这个模型关不掉思考，打电话换个不思考的模型吧（设置 → 应用配置 → 语音通话 → 挑一个免费模型）'}`; return next(); }
    if (k == 'retry') { if (A.lastSaid) { A.lines.push({ f: 'me', t: A.lastSaid }); A.log.push({ f: 'me', t: A.lastSaid }); turn(A.lastSaid); } return; }
    if (k == 'spk') { A.spk = !A.spk; A.au && (A.au.volume = A.spk ? 1 : .85); A.gain && (A.gain.gain.value = A.spk ? 1 : .85); A.ctx?.resume?.(); return draw(); }
    if (k == 'mem') { A.mem = S.callMem = !A.mem; save(); toast(A.mem ? '挂了以后记进 TA 的记忆：之后聊天、打电话 TA 会记得（以最新剧情为准）' : '这通电话挂了就忘：TA 之后不会记得聊过什么'); return draw(); }
    if (k == 'inl') { const how = v => !(A.ear == 'local' || A.earBack == 'local') ? '' : packOn(v) ? v == 'zh-CN' ? ' · 本地' : ' · 本地包' : ' · 云端识别' + (v == 'mix' ? '，不用换来换去' : '');
      return menu(IN.map(([v, n]) => [v, n + how(v)]), '我说什么语言').then(v => { if (!v || CALL != A) return; A.inL = S.callLang = v; save(); fitLang(true); draw(); }); } // 只影响之后的识别
    if (k == 'outl') return menu(OUT, 'TA 用什么语言回答').then(v => { if (v == null) return; A.outL = v == 'auto' ? undefined : v; draw(); toast('下一句开始生效'); }); // 本轮不变，下一轮才换
    if (k == 'kb') { A.typing = !A.typing; return draw(); }
    if (k == 'auto') { A.auto = S.callAuto = !A.auto; save(); toast(A.auto ? '自动接话：你停下来 TA 就接着说' : '点着说：点「点这里说」开始，点「说完了」才轮到 TA'); if (A.auto && A.ph == 'idle') return listen(); return draw(); }
    if (k == 'ear') return menu([['local', '本地识别（推荐：手机上直接认，不联网、不花钱、边说边出字）'], ['model', '模型听（录音交给聊天模型听，要 Gemini 这类能听音频的）'], ['sf', '硅基识别（免费识别模型，边说边出字）'], ['web', '浏览器识别（要能连上谷歌）'], ['gap', `说完等多久：${+S.callGap || 1} 秒`], ['pol', `本地认完再让云端校对一遍：${(S.callPolish ?? true) ? '开' : '关'}${asrCfg().key ? '' : '（要硅基密钥）'}`]], '怎么听你说话').then(v => { if (!v || CALL != A) return;
      if (v == 'pol') { S.callPolish = !(S.callPolish ?? true); save(); return toast(S.callPolish ? '开了：说完把录音交给硅基流动再认一遍（免费），以它为准；没回就用本地的' : '关了：只用本地认的'); }
      if (v == 'gap') return menu([['0.6', '0.6 秒（说话利索）'], ['1', '1 秒（默认）'], ['1.6', '1.6 秒（爱停顿）'], ['2.5', '2.5 秒（慢慢想）']], '你停多久算说完').then(g => { if (!g) return; S.callGap = +g; save(); toast(`停 ${g} 秒算说完（说得长会再多等 0.5 秒）`); });
      if (v == A.ear) return; earOff(); stopRec(); A.ear = S.callEar2 = v; save(); A.earBad = ''; A.earBack = null; A.ph == 'rec' && (A.ph = 'idle');
      if (isEar()) { earOn(); fitLang(true); A.ear != v ? 0 : v == 'local' ? loadLocal() : v == 'sf' && !asrCfg().key ? askKey() : toast(v == 'sf' ? '硅基识别：边说边出字' : '模型听：录音直接交给聊天模型听'); } else { toast('浏览器识别：要能连上谷歌的识别服务'); if (A.ph == 'idle') next(); } draw(); });
    if (k == 'fix') return fixLine(A.lines[+e.target.closest('[data-k]').dataset.i]);
    if (k == 'send') return sendTyped();
    if (k == 'psend') { if (!A.pend) return; A.sending = 1; draw(); return flush(); } // 认出来的话我看过了：发
    if (k == 'pdel') { const p = A.pend; if (!p) return; A.pend = null; A.sending = 0; A.lines = A.lines.filter(x => x != p.line); A.ph == 'rec' || (A.ph = 'idle'); draw(); return A.kbv || isEar() || !A.auto || listen(); } // 不要了，重新说
    if (k == 'tov') { A.cam?.getTracks().forEach(t => t.stop()); A.cam = null; A.kind = 'voice'; el.className = 'xc xc-voice in'; return draw(); }
    A.ctx?.state == 'suspended' && A.ctx.resume(); // 随便点一下也顺手把声音唤醒（点屏幕不打断 TA：轮流说，调音量碰到屏幕也不会断）
  };
  ui.scr.append(el); draw(); requestAnimationFrame(() => el.classList.add('in'));
  if (kind == 'video') navigator.mediaDevices?.getUserMedia?.({ video: { facingMode: 'user' }, audio: false }).then(s => { if (CALL != A) return s.getTracks().forEach(t => t.stop()); A.cam = s; draw(); }).catch(() => { });

  // ===== 接通（10-31 重写）：响铃的同时就让模型按剧情写第一句、把声音合成好，好了才接起来（最少响 1.5 秒，最多等 15 秒）。不再有固定的「喂？」
  // 背景（人设、世界书、剧情）也在这时算一次，整通电话都用它
  A.ring = ringTone(); A.ringAt = performance.now(); A.ctxP = base(c).catch(() => ''); // 背景（A.base 这个名字被浏览器识别的拼接用了，别撞）。旧版存过的「每分钟几次」限额：不要了
  delete S.callRpmBy; delete S.callRpm;
  const pickUp = () => A.picked ||= (async () => { const w = 1500 - (performance.now() - A.ringAt); w > 0 && await new Promise(r => setTimeout(r, w)); if (CALL != A) return; stopRing(); A.st = 'talk'; A.t0 = +now(); draw(); noVoice() && toast(`${nm(c)} 还没配音色，只显示字幕（聊天设置 → 专属音色）`); })();
  A.pickUp = pickUp;
  // 接通永远是 TA 先说：一直响到 TA 第一句的声音做好了才接（不等一整段——接起来以后 TA 边说，模型边往下写、后面几句边合成）
  // 响久了（模型在思考）响铃界面下面写着在想几秒，免得以为卡了；2 分钟一个字都没有才接起来报错（turn 里的保底）
  A.story ? pickUp().then(() => CALL == A && turn(null, { canned: storyAsk() })) : turn(null, { open: 1 });
  // 枕边故事：接通先问想听什么（不调用模型）
  function storyAsk() { const L = LANG(A.outL ?? ch.cfg?.lang), g = { ja: ['何のお話が聞きたい？ゆっくり話してあげる。', '想听什么故事？我慢慢讲给你。'], ko: ['무슨 이야기 듣고 싶어? 천천히 들려줄게.', '想听什么故事？我慢慢讲给你。'], en: ['What story do you want to hear? I\'ll tell you slowly.', '想听什么故事？我慢慢讲给你。'] }[L]; return !L ? '想听什么故事？说给我听，我慢慢讲给你。' : g ? `「${g[0]}」（${g[1]}）` : '「What story do you want to hear?」（想听什么故事？）'; }
  function noVoice() { try { const vo = voiceOf(c); return pickVoice(c, ttsCfg(vo.pv)).from == 'none'; } catch { return false; } }
  function stopRing() { A.ring?.(); A.ring = null; }
  function stopRec() { clearTimeout(A.sil); try { A.rec?.abort(); } catch { } A.rec = null; }
  function interrupt() { A.ac?.abort(); A.ac = null; A.next = 0; A.au?.pause(); if (A.rv) { A.rv.sh = A.rv.t.length; A.rv = null; } }
  // 轮到我：自动接话就马上开麦（半双工：TA 想和说的时候麦是关着的，不会把外放的声音录进去当成我说的）
  function next() { A.idleAt = performance.now(); if (A.kbv) { const i = KB.querySelector('input'); if (A.echo) { i.value = ''; A.echo = 0; } draw(); return; } /* 输入法说：TA 说话时进来的字多半是外放的回声，丢掉 */ if (isEar()) { A.quiet = performance.now() + 250; return draw(); } /* 自己听：一直开着，TA 刚说完的回声尾巴（约 0.25 秒）先不算 */ draw(); if (A.auto && A.mic && CALL == A && (A.ph == 'idle' || A.ph == 'fail')) setTimeout(() => CALL == A && (A.ph == 'idle' || A.ph == 'fail') && listen(), 250); }
  // 字幕跟着声音一个字一个字出来（照示例）：按这句音频的时长匀速放字，外语下面的中文释义同步按比例出
  function reveal(ln, ms, wait = 0) { const t0 = performance.now() + wait, n = ln.t.length, s0 = ln.sh || 0; // 从已经露出的字接着往下露（一段话分几小句念，字幕接着长）
    const f = () => { if (A.rv != ln || CALL != A) return; const k = Math.max(0, Math.min(1, (performance.now() - t0) / Math.max(200, ms))); ln.sh = Math.max(s0 + 1, s0 + Math.ceil((n - s0) * k));
      const a = el.querySelector('.xc-r'), b = el.querySelector('.xc-r2'); a && (a.textContent = ln.t.slice(0, ln.sh)); b && ln.tr && (b.textContent = ln.tr.slice(0, Math.ceil(ln.tr.length * ln.sh / Math.max(1, n))));
      k < 1 && requestAnimationFrame(f); }; requestAnimationFrame(f); }
  function hang() {
    clearInterval(tick); stopRing(); stopRec(); earOff(); interrupt(); A.cam?.getTracks().forEach(t => t.stop()); try { A.ctx?.close(); } catch { }
    const dur = A.t0 ? Math.round((now() - A.t0) / 1e3) : 0, cancel = A.st == 'dial';
    ch.msgs.push({ f: 'me', t: 'call', kind: A.kind, c: cancel ? '已取消' : `${A.story ? '枕边故事' : '通话时长'} ${mmss(dur)}`, ...(A.story && { story: 1 }), dur, ...(cancel && { st: 'cancel' }), ...(A.log.length && { log: A.log.slice(-40) }), ...(A.mem && A.log.length && { mem: 1 }), ts: +now() });
    saveD(); emit('chat'); CALL = null; el.classList.remove('in'); setTimeout(() => el.remove(), 220);
  }
  A.hang = hang;
  // 点「点这里说」：开始听，话实时写在屏幕上；手机识别常常几秒没声就自己停，那就接着再开，把前面听到的拼起来；点「说完了」才发
  function listen() {
    if (CALL != A || A.ph == 'think' || A.ph == 'speak') return; A.ctx?.resume?.(); if (isEar()) return earOn();
    const R = A.kbv ? null : SR(); if (!R) { if (!A.typing) { A.typing = true; draw(); toast(A.kbv ? '酒馆 App 里网页拿不到麦克风：点输入框，用输入法的🎤说' : '这个浏览器不支持语音识别，可以打字说'); } return; }
    A.ph = 'rec'; A.nudge = 0; A.acc = ''; A.mid = ''; A.heard = ''; A.rs = { t: performance.now(), on: 0, au: 0, snd: 0, sp: 0, res: 0, n: 0, err: '', thr: '' }; draw(); startRec();
  }
  // 麦克风诊断：识别没出字的时候，直接写出卡在哪一步（开没开起来 / 有没有声音进来 / 认没认出话 / 报了什么错）
  function diag() { const r = A.rs; if (!r || A.heard) return ''; const s = (performance.now() - r.t) / 1e3;
    if (r.thr) return `识别启动失败：${r.thr}`;
    if (r.err && /not-allowed|service-not-allowed/.test(r.err)) return '没有麦克风权限（浏览器或酒馆 App 没允许用麦克风）';
    if (r.err == 'network') return '识别服务连不上（浏览器自带识别要连谷歌的服务器）';
    if (s < 3) return r.on ? '麦克风已打开，说吧' : '正在打开麦克风…';
    if (!r.on) return '语音识别没有启动（这个环境多半不支持浏览器识别，比如 App 里的内置网页），可以点下面「打字说」';
    if (!r.au) return '识别开起来了，但麦克风没接上（可能被录屏 / 别的应用占着）';
    if (!r.snd) return `麦克风接上了，但一点声音都没收到（录屏在录麦克风时会把它占走）${r.err ? ' · ' + r.err : ''}`;
    if (!r.res) return `听到声音了，但没认出字${r.err ? '（' + r.err + '）' : ''}${r.n > 1 ? ` · 已重开 ${r.n} 次` : ''}`;
    return ''; }
  const dg = () => { const d = el.querySelector('.xc-dg'); d && (d.textContent = diag()); };
  function startRec() {
    const R = SR(); if (!R || CALL != A || A.ph != 'rec') return;
    stopRec(); const r = new R(); A.rec = r; r.lang = A.inL == 'mix' ? 'zh-CN' : A.inL; r.interimResults = true; r.continuous = true; const rs = A.rs || (A.rs = { t: performance.now() }); rs.n = (rs.n || 0) + 1;
    const mark = k => () => { if (A.rec == r) { rs[k] = 1; dg(); } }; r.onstart = mark('on'); r.onaudiostart = mark('au'); r.onsoundstart = mark('snd'); r.onspeechstart = mark('sp');
    r.onresult = e => { let fin = '', mid = ''; for (const x of e.results) (x.isFinal ? (fin += x[0].transcript) : (mid += x[0].transcript)); A.acc = (A.base || '') + fin; A.mid = mid; rs.res = 1; A.heard = (A.acc + mid).trim(); const p = el.querySelector('.xc-tx .ing span'); p ? (p.textContent = A.heard) : draw(); hush(); };
    r.onerror = e => { rs.err = e.error || 'error'; dg(); if (/not-allowed|service-not-allowed|audio-capture/.test(e.error)) { A.rec = null; A.ph = 'idle'; A.typing = true; draw(); toast('没有麦克风权限，可以打字说'); } else if (e.error == 'network') { A.rec = null; A.ph = 'idle'; A.typing = true; draw(); toast('语音识别连不上网络，可以打字说'); } };
    r.onend = () => { if (A.rec != r || CALL != A) return; A.rec = null; if (A.ph != 'rec') return; A.base = (A.acc + (A.mid || '')); A.mid = ''; setTimeout(() => A.ph == 'rec' && !A.rec && startRec(), 120); }; // 没按「说完了」就自己停了：接着听
    try { r.start(); } catch (e) { rs.thr = e?.message || String(e); dg(); }
  }
  // 自动接话：每来一次识别结果就重新计时，安静 1.2 秒（一个字都没变）就当我说完了
  function hush() { clearTimeout(A.sil); if (A.auto && A.heard) A.sil = setTimeout(() => A.ph == 'rec' && CALL == A && finishRec(), SIL); }
  function finishRec() { clearTimeout(A.sil); const t = (A.heard || '').trim(); stopRec(); A.base = ''; A.heard = ''; if (!t) { A.ph = 'idle'; draw(); return toast('没听到你说话，再试一次'); } hold(t); } // 认出来的先放着给我看，点「发送」才发
  // 听错了能改（学 Companion Voice Runtime）：点字幕里我说的那句，就地改字；通话内容跟着改，TA 之后按改过的理解
  function fixLine(x) { if (!x || el.querySelector('.xc-fix')) return; A.fixing = 1; const w = Object.assign(document.createElement('div'), { className: 'xc-fix', innerHTML: `<small>听错了？改成你真正说的</small><input value="${esc(x.t.replace(/^（(没听清|语音)）$/, ''))}" enterkeyhint="done"><div><b data-f="n">取消</b><b data-f="y" class="ok">改好了</b></div>` }); el.append(w);
    const i = w.querySelector('input'), end = ok => { A.fixing = 0; const v = i.value.trim(); if (ok && v) { x.t = v; if (A.pend?.line == x) A.pend.t = v; /* 还没发：改好了再发 */ else if (x.lg) x.lg.t = v; else if (!A.log.includes(x)) { x.lg = { f: 'me', t: v }; A.log.push(x.lg); } A.lastSaid = v; } w.remove(); draw(); };
    w.onclick = e => { e.stopPropagation(); const f = e.target.dataset.f; f && end(f == 'y'); }; i.onkeydown = e => e.key == 'Enter' && end(true); setTimeout(() => i.focus(), 30); }
  // ---- 耳朵（ear.js，照 evolia）：模型听 / 硅基识别都走这个 ----
  function earOn() { if (ear.ms || A.earP || CALL != A) return; ear.at = performance.now();
    A.earP = ear.start().then(() => { A.earP = null; if (CALL != A || !isEar()) return ear.stop(); draw(); }).catch(e => { A.earP = null; if (CALL != A) return; if (TAU()) return kbMode(); const n = e?.name || ''; A.earBad = /NotAllowed|Security/.test(n) ? '没有麦克风权限：浏览器设置里允许这个网页用麦克风（网址要是 https 或 localhost，局域网 IP 打开的 http 网页浏览器不给麦克风）' : /NotReadable|Abort/.test(n) ? '麦克风被别的应用占着（比如录屏在录麦克风），关掉它再试' : /NotFound/.test(n) ? '没找到麦克风' : '麦克风打不开：' + (e?.message || n); A.typing = true; draw(); }); }
  function earOff() { ear.stop(); }
  // 本地识别：第一次要读约 39MB 的程序和中文模型（插件 asr/ 文件夹里，读过浏览器会缓存），读的时候显示进度；读不了就换成「模型听」
  // 说日语且装了日语包：用日语包（同一时间只开一个模型，换语言时会重新读一下）
  function eng() { return packOn(A.inL) && asrFor(A.inL) || localAsr; }
  function loadLocal() { const en = eng(); if (en.loaded) return; A.lp = 0; draw();
    en.load(p => { if (CALL != A || eng() != en) return; const n = p.pct; if (n != A.lp) { A.lp = n; const e = el.querySelector('.xc-ph'); e && A.ear == 'local' && (e.textContent = `正在准备本地识别… ${n}%`); } })
      .then(() => { if (CALL != A || eng() != en) return; A.lp = null; draw(); })
      .catch(e => { if (CALL != A || eng() != en) return; A.lp = null; if (A.ear == 'local') { const cloud = en != localAsr && asrCfg().key; A.earBack = cloud ? 'local' : A.earBack; A.ear = cloud ? 'sf' : 'model'; A.earBad = e.message + (cloud ? '。先用云端识别' : '。先换成「模型听」'); } draw(); }); }
  function earEv(t, v) {
    if (CALL != A) return;
    if (t == 'start') { A.ph = 'rec'; A.heard = ''; A.nudge = 0; A.idleAt = performance.now(); draw(); } /* 我开口了：「没出声」重新计时 */
    else if (t == 'level') { const lv = el.querySelector('.xc-lv'); lv && lv.style.setProperty('--lv', v.toFixed(2)); }
    else if (t == 'partial') { A.heard = v; const p = el.querySelector('.xc-tx .ing .xc-pt'); p ? (p.textContent = v) : draw(); } // 硅基识别：边说边出字
    else if (t == 'end') { A.ph = 'think'; A.recog = 1; A.thinkAt = performance.now(); draw(); } // 说完了，最后一段还在认
    else if (t == 'short') { if (A.ph == 'rec') { A.ph = 'idle'; draw(); } }
    else if (t == 'final') { A.recog = 0; const m = null;
      if (A.ear == 'sf' || A.ear == 'local') { let tx = String(v.text || '').trim(); if (m?.text) tx = m.text + (tx ? '，' + tx : ''); if (!tx) { A.ph = 'idle'; draw(); return toast('没听清，再说一遍'); } hold(tx, v.tone); }
      else { const ch = m?.chunks ? [...m.chunks, new Float32Array(Math.round(.3 * v.sr)), ...v.chunks] : v.chunks; heardAudio(wav(ch, v.sr)); } }
    else if (t == 'asrerr') { A.recog = 0; if (/密钥/.test(v.message)) askKey(); else toast(v.message); }
  }
  // 硅基识别要密钥（硅基流动免费注册，识别模型免费）：通话界面里就地填
  function askKey() { if (el.querySelector('.xc-fix')) return; const c = asrCfg(), w = Object.assign(document.createElement('div'), { className: 'xc-fix', innerHTML: `<small>${A.earBack ? `说${esc(inName(A.inL))}要用云端识别（硅基流动免费的 ${esc(c.model.split('/').pop())}，听得懂中英日韩粤），填一个硅基流动的 API 密钥就行（cloud.siliconflow.cn 手机号免费注册）。想不联网：以后在 设置 → 语音识别语言包 装本地包` : `「硅基识别」用硅基流动的免费识别模型（${esc(c.model)}），要一个硅基流动的 API 密钥（siliconflow.cn 免费注册）。画图那里填过就会自动用`}</small><input placeholder="sk-…" value="${esc(S.callAsr?.key || '')}" enterkeyhint="done"><div><b data-f="n">先不用</b><b data-f="y" class="ok">保存</b></div>` }); el.append(w);
    const i = w.querySelector('input'), end = ok => { const v = i.value.trim(); if (ok && v) { (S.callAsr ||= {}).key = v; save(); A.earBack && A.ear == 'model' && (A.ear = 'sf'); toast('保存了，开口说话就行'); } else if (!asrCfg().key) { A.ear = 'model'; toast('先用「模型听」（要 Gemini 这类能听录音的模型）'); } w.remove(); draw(); };
    w.onclick = e => { e.stopPropagation(); const f = e.target.dataset.f; f && end(f == 'y'); }; i.onkeydown = e => e.key == 'Enter' && end(true); setTimeout(() => i.focus(), 30); }
  // 认出来的话先不发（10-31）：放在字幕里给我看，对就点「发送」，听错了点那行字改；接着说会接在后面
  function hold(tx, tone) { if (CALL != A) return;
    if (A.pend) { A.pend.t += '，' + tx; A.pend.line.t = A.pend.t; A.pend.tone = tone || A.pend.tone; } else { const e = { f: 'me', t: tx }; A.lines.push(e); A.pend = { t: tx, tone, line: e }; }
    clearTimeout(A.pendT); A.ph = 'idle'; A.idleAt = performance.now(); draw(); A.sending && (A.pendT = setTimeout(flush, 0)); }
  // 点了「发送」：我还在说 / 最后一段还在认，就等它认完一起发
  function flush() { const p = A.pend; if (!p || CALL != A) return; clearTimeout(A.pendT); if (ear.on || A.ph == 'rec' || A.recog) { A.pendT = setTimeout(flush, 300); return; }
    A.pend = null; A.sending = 0; A.lastSaid = p.t; A.nudge = 0; A.log.push(p.line); const st = A.story == 1; st && (A.story = 2); turn(p.t, { tone: p.tone, hl: p.line, asr: 1, story: st }); }
  function heardAudio(url) { interrupt(); const ln = { f: 'me', t: '…' }; A.lines.push(ln); A.hl = ln; turn(null, { au: url, hl: ln }); }
  function heard(t, tone) { stopRec(); interrupt(); A.heard = ''; A.lastSaid = t; A.nudge = 0; const e = { f: 'me', t }; A.log.push(e); A.lines.push(e); const st = A.story == 1; st && (A.story = 2); turn(t, { tone, story: st }); }
  // 对方说（10-31 重写）：背景 + 这通电话的多轮对话发给模型 → 流式拿字 → call-brain 切成小句 → 每句过语言检查（设成日语就必须是日语，混了中文先翻成日语）→ 合成 → 按顺序播
  // 一段话（「」里的 / 一行）是一条字幕，里面的小句一句一句念、字幕接着长；最多比正在播的领先 3 句去合成（还没轮到的后几句，同一段里的短句并成一次合成）；挂断 / 打断后迟到的文字和音频一律丢掉
  const sleepSg = (ms, sg) => new Promise(r => { const tm = setTimeout(r, ms); sg.addEventListener('abort', () => (clearTimeout(tm), r()), { once: true }); });
  async function turn(said, o = {}) { const { au, hl, tone, nudge, canned, story, open } = o; // au：我这句话的录音（模型听）；hl：字幕里我那一行，等模型写出听到的话再填上；tone：语气；nudge：我多久没出声；open：接通第一句
    if (CALL != A) return; A.ph = 'think'; A.thinkAt = performance.now(); A.thk = 0; A.why = ''; draw();
    const ac = new AbortController(), sg = ac.signal; A.ac = ac; const t0 = performance.now(); let first = false;
    const guard = setTimeout(() => { if (!first && !sg.aborted) { ac.abort(); A.ph = 'fail'; A.why = `TA 那边 2 分钟一个字都没出${A.thk ? `（模型一直在思考，想了 ${A.thk} 字）` : ''}，可能模型卡住了；可以在 设置 → 应用配置 → 语音通话 换个模型或把「低思考」打开`; A.st == 'dial' ? pickUp() : draw(); } }, 120e3);
    const L = LANG(A.outL ?? ch.cfg?.lang), style = cueStyle(c); // 语言快照：中途切换只影响下一轮
    const M = messages(c, A, L, { open, said, nudge, story, au, tone }), P = flat(c, M);
    // Q：切出来的小句按顺序排队 { u 所属的那段, t 字幕, v 念的文字, lang, ready 语言检查（可能要翻译）, b 音频 }
    const Q = []; let played = -1, done = false, capped = false; const MAXP = story ? 1e9 : 40, lac = new AbortController(), lsg = AbortSignal.any ? AbortSignal.any([sg, lac.signal]) : sg; // 40 小句只防模型失控
    const synth = () => { for (let k = played + 1; k <= Math.min(Q.length - 1, played + 3); k++) { const q = Q[k]; if (q.b !== undefined) continue; q.lock = 1;
      q.b = q.ready.then(() => A.ttsBad || !q.v ? null : tts(q.v, '', c.sex, sg, { c, blob: 1, lang: q.lang }).catch(e => { if (!sg.aborted && !A.ttsBad) { A.ttsBad = true; toast('语音合成不可用，只显示字幕：' + e.message); } return null; })); } };
    let wake = null; const kick = () => { wake?.(); wake = null; };
    const join = q => Promise.all(q.ps.map(x => x.ready)).then(() => { const ps = q.ps; q.t = ps.map(x => x.t).join(''); q.v = ps.map(x => x.v).join(''); q.lang = ps.some(x => x.bad) ? '' : L; q.fixed = ps.some(x => x.fixed) ? ps.map(x => x.fixed || x.t).join('') : ''; });
    const PR = parser(!!L, {
      unit: () => ({ t: '', tr: '', n: 0 }),
      part: (u, raw) => { if (capped || sg.aborted) return; if (Q.length >= MAXP) { capped = true; lac.abort(); return; } const { t, v } = cues(raw, style); if (!t) return;
        const pc = { t, v }; pc.ready = fixLang(t, L).then(r => { if (!r.ok) pc.bad = 1; /* 翻不了：不指定语言，让语音服务自己认 */ else if (r.fixed) { pc.t = pc.v = r.t; pc.fixed = r.fixed; } }).catch(() => { });
        const pv = Q.at(-1); if (Q.length > 1 && pv && !pv.lock && pv.u == u && pv.ps.reduce((n, x) => n + x.t.length, 0) + t.length <= 60) { pv.ps.push(pc); pv.ready = join(pv); return; } // 第一句永远单独（越短越快出声）
        const q = { u, ps: [pc], lang: L }; q.ready = join(q); Q.push(q); synth(); kick(); },
      tr: (u, x) => { u.tr = x; u.ln && (u.ln.tr = x, draw()); u.lg && (u.lg.tr = x); },
      end: u => { L && setTimeout(() => { if (u.tr || sg.aborted || CALL != A || !u.t) return; mt(u.t, 'zh-CN').then(x => { if (!u.tr && x && x != u.t) { u.tr = x; u.ln && (u.ln.tr = x, CALL == A && draw()); u.lg && (u.lg.tr = x); } }).catch(() => { }); }, 1500); }, // 模型忘了写（中文意思）：机翻一个只做字幕
      bye: () => { A.bye = 1; },
      stop: () => { capped = true; lac.abort(); }, // 模型开始替我说话了：掐掉
    }, { me: me.nick, who: rn(c) });
    // 模型听：回答前先有一行 HEARD: 我说的原话 → 填进字幕里我那一行、记进通话内容；其余照常切句
    let hd = !au, hb = ''; const HR = /^\s*HEARD\s*[:：]\s*(.*)$/i;
    const gotHeard = t => { t = String(t || '').replace(/\*[^*]*\*|【[^】]*】/g, '').trim().replace(/^[「“"]|[」”"]$/g, ''); if (!hl) return; if (!t || /^[?？]+$/.test(t)) { hl.t = '（没听清）'; } else { hl.t = t; A.lastSaid = t; hl.lg = { f: 'me', t }; A.log.push(hl.lg); } draw(); }; // 听到的话里（笑）（叹气）要留着
    const miss = () => { hl && (hl.t = '（语音）'); };
    const P2 = { feed: d => { if (hd) return PR.feed(d); hb += d; const i = hb.indexOf('\n'); if (i < 0 && hb.length < 300) return; const l = i < 0 ? hb : hb.slice(0, i), m = l.match(HR); hd = true; if (m) { gotHeard(m[1]); PR.feed(i < 0 ? '' : hb.slice(i + 1)); } else { miss(); PR.feed(hb); } hb = ''; },
      finish: () => { if (!hd) { hd = true; const m = hb.match(HR); if (m) gotHeard(m[1]); else { miss(); PR.feed(hb); } hb = ''; } PR.finish(); } };
    const player = (async () => { // 按顺序播；下一句在这一句播放时就已经在合成
      for (let k = 0; ; k++) {
        while (k >= Q.length && !done && !sg.aborted) await new Promise(r => wake = r);
        if (sg.aborted || CALL != A || k >= Q.length) return;
        const q = Q[k]; q.lock = 1; await q.ready; synth(); const b = await q.b; if (sg.aborted || CALL != A) return;
        if (A.st == 'dial') { await pickUp(); if (sg.aborted || CALL != A) return; } // 第一句准备好了才接起来
        first = true; played = k - 1; A.ph = 'speak'; const u = q.u;
        if (!u.ln) { u.ln = { f: 'c', t: '', tr: u.tr, sh: 0 }; A.lines.push(u.ln); u.lg = { f: 'c', t: '', ...(u.tr && { tr: u.tr }), ...(k == 0 && { ms: Math.round(performance.now() - t0) }) }; A.log.push(u.lg); } // 记下首声等了多久
        const ln = u.ln; ln.sh = ln.t.length; ln.t += q.t; u.lg.t = ln.t; q.fixed && !u.tr && (u.tr = ln.tr = u.lg.tr = q.fixed); A.rv = ln; draw(); // 字幕接着这段往下长；翻过的句子把原来的中文当释义
        await playBlob(b, q.t, sg, (ms, wait) => reveal(ln, ms, wait)); ln.sh = ln.t.length; A.rv == ln && (A.rv = null); played = k; synth();
        const nx = Q[k + 1], gap = story ? 650 : /[…]$|……$/.test(q.t) ? 450 : nx && nx.u != u ? 220 : 0; gap && !sg.aborted && await sleepSg(gap, sg); // 停顿：省略号停久一点，换一段停一下，讲故事更慢
      } })();
    try {
      if (canned) { P2.feed(canned + '\n'); P2.finish(); done = true; kick(); await player; return endTurn(); } // 枕边故事开头那句（不调用模型）
      let last = '';
      const T = A.tl?.L === L ? A.tl.t : (A.tl = { L, t: tail(c, A, L) }).t; // 电话专属那段也整通不变（只有中途换了语言才重算）：前缀一样，模型那边的缓存才能命中
      const full = await llm((await A.ctxP) + T, P, '通话', lsg, { stream: true, fast: 1, mod: 'chat.call', msgs: M, ...(au && { audio: au }), onThink: th => { A.thk = th; }, onText: t => { if (sg.aborted) return; first ||= !!t; P2.feed(t.slice(last.length)); last = t; } });
      if (!sg.aborted && !capped) { const f2 = String(full || ''); f2.length > last.length && P2.feed(f2.slice(last.length)); P2.finish(); }
      done = true; kick(); await player;
    } catch (e) { if (capped && !sg.aborted) { P2.finish(); done = true; kick(); await player; return endTurn(); } // 句数够了、主动掐断请求：照常收尾
      done = true; kick(); clearTimeout(guard); if (sg.aborted) return;
      // 模型那边忙 / 撞车（429、「请求太多」「并发」「访问量过大」）：不是限额，悄悄等 2 秒重发一次；还不行再告诉我
      const busy = /429|too many requests|rate.?limit|请求数限制|请求过多|并发|访问量过大|繁忙|overload/i.test(e.message);
      if (busy && !first && !o.rt) { await sleepSg(2000, sg); if (CALL != A) return; return turn(said, { ...o, rt: 1 }); }
      A.st == 'dial' && await pickUp(); if (CALL != A) return;
      A.ph = 'fail'; A.why = busy ? '模型那边这会儿忙（请求太多），等几秒再说一遍' : '没接上：' + shortErr(e.message); hl && hl.t == '…' && (hl.t = '（语音）'); next(); toast((au && /audio|inline|mime|unsupport|modalit|HTTP 400/i.test(e.message) ? '这个模型可能听不了录音，可以把底部的「模型听」切成「浏览器识别」：' : '对方没听清：') + shortErr(e.message)); return; } // 失败就结束这一轮，不偷偷再生成一份
    endTurn();
    async function endTurn() { clearTimeout(guard); if (CALL != A || sg.aborted) return; if (A.st == 'dial') { await pickUp(); if (CALL != A || sg.aborted) return; }
      if (A.bye && (BYE.test(`${said || ''} ${A.lastSaid || ''}`) || A.log.filter(x => x.f == 'me').length >= 6)) { A.ph = 'idle'; draw(); return setTimeout(() => CALL == A && hang(), 900); } A.bye = 0; /* 我没说要走、才聊了几句就写 [挂断]：不当真 */
      A.ph = Q.length ? 'idle' : 'fail'; Q.length || (A.why = `模型回了空的内容${A.thk ? `（只思考了 ${A.thk} 字，没写正文）` : ''}，可以再说一遍`); next(); } // 说完了：轮到我（自动接话就直接开麦）
  }
  // 播一句：解码后排到同一个 AudioContext 的时间轴上（不每句新建播放器、不靠 setTimeout 接）；解不了码就退回 <audio>；没声音就按字数停一会儿
  async function playBlob(b, t, sg, on) { A.playN = (A.playN || 0) + 1; try { return await playOne(b, t, sg, on); } finally { A.playN--; } }
  async function playOne(b, t, sg, on) {
    if (!(b instanceof Blob)) return new Promise(r => { on?.(400 + t.length * 160, 0); const tm = setTimeout(r, 400 + t.length * 160); sg.addEventListener('abort', () => (clearTimeout(tm), r()), { once: true }); });
    const X = A.ctx; if (X) try { X.state != 'running' && await Promise.race([X.resume(), new Promise(r => setTimeout(r, 300))]);
      if (X.state == 'running') { const buf = await X.decodeAudioData(await b.arrayBuffer()); if (sg.aborted) return;
        const src = X.createBufferSource(); src.buffer = buf; src.connect(A.gain); const at = Math.max(A.next || 0, X.currentTime + .05); A.next = at + buf.duration; on?.(buf.duration * 1e3, (at - X.currentTime) * 1e3);
        return new Promise(r => { const tm = setTimeout(r, (at - X.currentTime + buf.duration) * 1e3 + 1500); src.onended = () => (clearTimeout(tm), r()); sg.addEventListener('abort', () => { try { src.stop(); } catch { } r(); }, { once: true }); src.start(at); }); } } catch { }
    // 退回：用开头解锁过的那个播放器换上这句的声音（不新建，新建的会被拦）
    return new Promise(r => { const a = A.au || new Audio(), u = URL.createObjectURL(b); A.au = a; a.src = u; a.volume = A.spk ? 1 : .85; const end = () => { URL.revokeObjectURL(u); r(); };
      a.onended = a.onerror = end; a.onplaying = () => on?.(isFinite(a.duration) && a.duration > 0 ? a.duration * 1e3 : 300 + t.length * 200, 0); sg.addEventListener('abort', () => (a.pause(), end()), { once: true });
      a.play().catch(e => { if (!A.blocked) { A.blocked = 1; toast('声音被浏览器拦住了，点一下屏幕再试'); } setTimeout(end, 400 + t.length * 160); }); });
  }
  return A;
}
export { wav } from './ear.js'; // 测试里用
// 拨号的嘟——嘟——声（WebAudio 现做，不用文件）；返回停止函数
function ringTone() {
  try { const X = new (globalThis.AudioContext || globalThis.webkitAudioContext)(), g = X.createGain(); g.gain.value = 0; g.connect(X.destination);
    const o = X.createOscillator(); o.frequency.value = 440; o.connect(g); o.start();
    let on = true; const beat = () => { if (!on) return; const t = X.currentTime; g.gain.setValueAtTime(0.06, t); g.gain.setValueAtTime(0, t + 1); setTimeout(beat, 3000); }; beat();
    return () => { on = false; try { o.stop(); X.close(); } catch { } };
  } catch { return () => { }; }
}
// 聊天里那条「通话」消息（照录屏：我打的是绿色气泡「已取消 ☎」/「通话时长 00:12 ☎」）
export const callBub = (m, i) => `<span class="clb" data-a="recall" data-x="${i}">${m.f == 'me' ? `${esc(m.c)}${m.kind == 'video' ? msk('p-video', 'clb-i') : msk('tel', 'clb-i')}` : `${m.kind == 'video' ? msk('p-video', 'clb-i') : msk('tel', 'clb-i')}${esc(m.c)}`}</span>`;
export const inCall = () => CALL;

// 小手机 · 磁铁召回（学 StarHub 记忆教程，简化成不调用模型、不花 API 的版本）
// 回复时只带最近 30 条聊天；更早的聊天里，和「现在说到的词」有关的几句被「吸」上来，当背景放进提示词。
// 像人一样：平时不会想起所有往事，但别人一提到某个词，相关的回忆自己就浮上来了。
// 规矩（照教程）：有字数预算（记忆是配菜不是主食，超了砍掉分低的）；没想起来就整块不出现（不留「暂无」占位）；越久远的分越低。
import { rn, say, meObj } from '../../core.js';
import { get } from './data.js';

// 常见但没信息量的双字词：不当磁铁（不然「我们」「今天」会把什么都吸上来）
const STOP = new Set('什么 我们 你们 他们 她们 今天 明天 昨天 怎么 这个 那个 这样 那样 就是 一下 没有 不是 可以 知道 现在 真的 还是 觉得 时候 已经 然后 因为 所以 但是 如果 一个 自己 东西 不要 没事 好的 哈哈 嗯嗯 一起 还有 只是 应该 可能 感觉 有点 一点 这么 那么 怎样 为什 么呢 了吗 的话 一样 不会 不能 出来 起来 过来 回来 这里 那里 哪里 是不 不了 了吧 吧吧 啊啊'.split(' '));
const txt = m => /sys|pat/.test(m.t) ? '' : String(say(m) || '');
// 抽磁铁：英文 / 数字词、假名 / 韩文连写、汉字按两个字一组切
export const keys = s => { const out = new Set(); s = String(s || '');
  for (const w of s.match(/[A-Za-z][A-Za-z0-9]{2,}|\d{3,}/g) || []) out.add(w.toLowerCase());
  for (const w of s.match(/[぀-ヿ]{2,}|[가-힯]{2,}/g) || []) out.add(w);
  for (const r of s.match(/[一-鿿]{2,}/g) || []) for (let i = 0; i < r.length - 1; i++) { const b = r.slice(i, i + 2); STOP.has(b) || out.add(b); }
  return out; };

// ch：这个聊天；n：最近多少条已经整段放进提示词；budget：最多放多少字
export function recall(ch, now = '', n = 30, budget = 600) {
  const old = ch.msgs.slice(0, Math.max(0, ch.msgs.length - n)); if (old.length < 3) return '';
  const recent = ch.msgs.slice(-n), me = meObj().nick;
  const trig = keys([now, ...recent.slice(-4).map(txt)].join(' ')); if (!trig.size) return '';
  const K = old.map(m => keys(txt(m))), df = new Map();
  K.forEach(s => s.forEach(k => trig.has(k) && df.set(k, (df.get(k) || 0) + 1)));
  const last = old.at(-1)?.ts || Date.now();
  const sc = old.map((m, i) => { let s = 0; K[i].forEach(k => df.has(k) && (s += 1 / Math.log2(1 + df.get(k)))); // 越少见的词越「有磁性」
    return [i, s * Math.pow(.5, Math.max(0, last - (m.ts || last)) / (60 * 864e5))]; }) // 两个月衰减一半
    .filter(([, s]) => s >= 1).sort((a, b) => b[1] - a[1]);
  const pick = new Set(); let used = 0;
  for (const [i] of sc.slice(0, 8)) { const L = [i - 1, i].filter(j => j >= 0 && !pick.has(j)), add = L.reduce((a, j) => a + txt(old[j]).length + 8, 0); // 带上前一句，知道是在接什么话
    if (used + add > budget) break; L.forEach(j => pick.add(j)); used += add; }
  if (!pick.size) return '';
  const who = m => m.f == 'me' ? me : rn(get(m.f)), day = ts => { const d = new Date(ts || 0); return `${d.getMonth() + 1}月${d.getDate()}日`; };
  return [...pick].sort((a, b) => a - b).map(j => `· ${day(old[j].ts)} ${who(old[j])}：${txt(old[j]).slice(0, 120)}`).join('\n');
}

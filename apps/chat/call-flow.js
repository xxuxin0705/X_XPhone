// 通话的稳定语句、轮末判断和中断记忆；不依赖界面或浏览器。
export const EMOTIONS = ['neutral', 'happy', 'sad', 'angry', 'surprised', 'fearful', 'disgusted'];
export const cleanSpeech = s => String(s || '').replace(/\[[^\]]*\]|<[^>]*>|[（(][^（）()]*[）)]|\*[^*]*\*/g, '').replace(/^[「“『"]|[」”』"]$/g, '').trim();
// 短停顿先认字，语义未完留更长时间；上限防止一句一直不交出。不额外调用一次模型判断。
export function endpointGap(text = '') {
  if (!text.trim()) return 900;
  if (/[，,、:：…]$|(?:因为|但是|然后|如果|就是|那个|えっと|あの|けど|から|and|but|because|so|um|uh)\s*$/i.test(text.trim())) return 1350;
  return /[。！？.!?]$/.test(text.trim()) ? 420 : 720;
}
export function speechParser(pub, { pairs = false, heard, wait } = {}) {
  let buf = '', tail = '', pending = null, emotion = 'neutral', finished = false, first = !!heard;
  const unit = s => { const t = cleanSpeech(s); t && pub({ t, tr: '', emotion }); };
  function scan(end = false) {
    let start = 0, stack = [];
    for (let i = 0; i < tail.length; i++) {
      const c = tail[i], opens = { '[': ']', '<': '>', '（': '）', '(': ')', '「': '」', '“': '”', '『': '』' };
      if (opens[c]) stack.push(opens[c]); else if (stack.at(-1) === c) stack.pop();
      if (stack.length) continue;
      if (/[。！？!?\n]/.test(c) || c === '.' && (end || i + 1 < tail.length) && (!/[0-9]/.test(tail[i - 1] || '') || !/[0-9]/.test(tail[i + 1] || '')) || /[，,]/.test(c) && i - start >= 18) {
        unit(tail.slice(start, i + 1)); start = i + 1;
      }
    }
    tail = tail.slice(start); if (end) { if (stack.length) throw Error('通话台词有未闭合的标记'); unit(tail); tail = ''; }
  }
  function line(l) {
    l = l.trim(); if (!l) return; if (l === 'WAIT' && wait) { wait(); return; }
    if (first) { first = false; const h = l.match(/^HEARD\s*[:：]\s*(.*)$/i); if (h) { heard(h[1]); return; } }
    const e = l.match(/^EMO\s*[:：]\s*(\w+)$/i); if (e) { if (pending) throw Error('缺少中文释义'); emotion = EMOTIONS.includes(e[1]) ? e[1] : 'neutral'; return; }
    if (!pairs) { tail += l + '\n'; scan(); return; }
    const m = l.match(/^(SAY|ZH)\s*[:：]\s*(.+)$/i); if (!m) throw Error('通话双语格式错误');
    if (m[1].toUpperCase() === 'SAY') { if (pending) throw Error('缺少中文释义'); pending = { t: cleanSpeech(m[2]), tr: '', emotion }; }
    else { if (!pending) throw Error('缺少外语台词'); pending.tr = cleanSpeech(m[2]); pending.t && pub(pending); pending = null; }
  }
  return {
    feed(d) {
      if (finished) throw Error('台词已经结束'); buf += d;
      // 无协议前缀的普通台词按标点尽早发布；协议行只按完整行处理。
      let i; while ((i = buf.indexOf('\n')) >= 0) { line(buf.slice(0, i)); buf = buf.slice(i + 1); }
      if (!pairs && !first && buf && !/^\s*(?:E(?:M(?:O)?)?\s*(?::|：|$)|W(?:A(?:I(?:T)?)?)?$)/i.test(buf)) { tail += buf; buf = ''; scan(); }
    },
    remainder() { return (pending?.t || '') + (/^\s*(?:EMO|WAIT)\b/.test(buf) ? '' : cleanSpeech(tail + buf)); },
    finish() { if (finished) return; finished = true; if (buf.trim()) line(buf); buf = ''; if (pending) throw Error('缺少中文释义'); scan(true); }
  };
}
export function remainingSpeech(units) { return units.map(u => u.t.slice(u.spoken || 0)).filter(Boolean).join(''); }
// 引用到提示词时明确区分：已说的在记录里，未说的不是已发生的对话。
export function callContext(ch, me, role, log, pending) {
  const recent = ch.msgs.filter(m => !/^(sys|pat)$/.test(m.t)).slice(-16);
  return `【最近的聊天】\n${recent.map(m => `${m.f === 'me' ? me : role}：${m.t === 'call' ? m.c + '\n' + (m.log || []).map(x => `${x.f === 'me' ? me : role}：${x.t}`).join('\n') : m.c || ''}`).join('\n')}\n【本次电话已经说过的】\n${log.slice(-40).map(x => `${x.f === 'me' ? me : role}：${x.t}`).join('\n')}${pending ? `\n【你被打断、尚未说完的内容】\n${pending}\n结合用户新说的话，自然接上仍然相关的意思；不要重复已经说过的句子，也不要无视用户硬接旧话。` : ''}`;
}

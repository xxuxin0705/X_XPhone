// 语音服务的 PCM 适配器。只映射已支持的字段；其它服务保留逐句音频回退。
const moods = { neutral: '平静自然', happy: '带笑意、轻快', sad: '低落、柔和', angry: '克制的不悦', surprised: '惊喜', fearful: '紧张', disgusted: '嫌弃' };
export function speechStyle(p, text, emotion) {
  if (!moods[emotion] || emotion === 'neutral') return { text, extra: {} };
  if (p.prov === 'openai' && /^gpt-4o-mini-tts/.test(p.model || '')) return { text, extra: { instructions: `像正在和亲近的人通电话，${moods[emotion]}。按句意自然改变重音、节奏和语调，保持原来的角色音色，不要播音腔。` } };
  if (p.prov === 'eleven' && p.model === 'eleven_v3') return { text: `${({ happy: '[excited]', sad: '[sad]', angry: '[angry]', surprised: '[surprised]', fearful: '[nervous]', disgusted: '[disgusted]' })[emotion]} ${text}`, extra: {} };
  return { text, extra: {} };
}
// 接收 raw PCM 时保留奇数字节。正常 HTTP EOF 是 raw 接口终态；SSE 必须另外收到成功结束事件。
export async function rawPCM(response, rate, signal, onPCM) {
  if (!response.ok) throw Error(`语音合成 HTTP ${response.status}`);
  if (!response.body) throw Error('语音流为空');
  const reader = response.body.getReader(), abort = () => { reader.cancel().catch(() => {}); }; signal?.addEventListener('abort', abort, { once: true }); let tail = new Uint8Array(), count = 0;
  try {
    for (;;) { signal?.throwIfAborted(); const { done, value } = await reader.read(); if (done) break;
      const data = new Uint8Array(tail.length + value.length); data.set(tail); data.set(value, tail.length); const n = data.length & ~1;
      if (n) { count += n; if (count > rate * 2 * 60) throw Error('单句语音超过一分钟'); await onPCM(data.slice(0, n), rate); }
      tail = data.slice(n);
    }
    signal?.throwIfAborted(); if (tail.length) throw Error('语音流采样不完整'); if (!count) throw Error('语音流为空');
  } finally { signal?.removeEventListener('abort', abort); await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
export async function streamSpeech(p, text, voice, signal, onPCM, request, emotion = 'neutral') {
  if (!['openai', 'eleven', 'mm', 'mmi'].includes(p.prov)) return false;
  const style = speechStyle(p, text, emotion); let url, body, headers;
  if (p.prov === 'openai') {
    const base = p.url.replace(/\/+$/, '').replace(/\/audio\/speech$/, ''); url = base + (/\/v\d[^/]*$/.test(base) ? '' : '/v1') + '/audio/speech';
    body = { model: p.model || 'tts-1', input: style.text, voice: voice || 'alloy', response_format: 'pcm', ...style.extra };
    headers = { Authorization: 'Bearer ' + p.key };
  } else if (p.prov === 'eleven') {
    url = p.url.replace(/\/+$/, '') + `/v1/text-to-speech/${encodeURIComponent(voice)}/stream?output_format=pcm_24000`;
    body = { text: style.text, model_id: p.model || 'eleven_multilingual_v2', ...(+p.speed && { voice_settings: { speed: +p.speed } }) }; headers = { 'xi-api-key': p.key };
  } else {
    url = p.url.replace(/\/v1(?:\/t2a_v2)?\/?$/, '').replace(/\/+$/, '') + '/v1/t2a_v2' + (p.gid ? '?GroupId=' + encodeURIComponent(p.gid) : '');
    body = { model: p.model || 'speech-2.6-hd', text, stream: true, output_format: 'hex', voice_setting: { voice_id: voice || 'female-shaonv', speed: +p.speed || 1, vol: 1, pitch: 0, ...(emotion !== 'neutral' && moods[emotion] && { emotion }) }, audio_setting: { format: 'pcm', sample_rate: 32000, channel: 1 }, ...(p.lang && { language_boost: p.lang }) }; headers = { Authorization: 'Bearer ' + p.key };
  }
  const r = await request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal });
  if (!r.ok) throw Error(`语音合成 HTTP ${r.status}`);
  if (p.prov !== 'mm' && p.prov !== 'mmi') { await rawPCM(r, 24000, signal, onPCM); return true; }
  const reader = r.body.getReader(), decoder = new TextDecoder(); let buf = '', ended = false, count = 0;
  async function event(block) {
    const data = block.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trimStart()).join('\n'); if (!data || data === '[DONE]') return;
    const j = JSON.parse(data); if (j.base_resp?.status_code) throw Error(j.base_resp.status_msg || '语音合成失败');
    // status=2 的 audio 是整句汇总，不能再排一次，否则会重复播放。
    if (j.data?.status === 2) { ended = true; return; }
    const h = j.data?.audio; if (h) { if (ended || !/^(?:[\da-f]{4})+$/i.test(h)) throw Error('语音流采样不完整'); const b = Uint8Array.from(h.match(/../g), x => parseInt(x, 16)); count += b.length; if (count > 32000 * 2 * 60) throw Error('单句语音超过一分钟'); await onPCM(b, 32000); }
  }
  try {
    for (;;) { signal?.throwIfAborted(); const { done, value } = await reader.read(); buf += decoder.decode(value, { stream: !done }).replace(/\r/g, ''); let i;
      while ((i = buf.indexOf('\n\n')) >= 0) { await event(buf.slice(0, i)); buf = buf.slice(i + 2); } if (done) break;
    }
    if (buf.trim()) await event(buf); signal?.throwIfAborted(); if (!ended || !count) throw Error('语音流没有正常结束'); return true;
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

// 一通电话共用音频时钟。每句先缓冲 .12 秒，之后沿同一时间轴排程；播放结束才确认。
export function pcmSentence(ctx, gain, signal, onStart, onProgress = () => {}, estimate = 1) {
  let rate = 0, queued = [], bytes = 0, total = 0, pending = 0, next = 0, started = false, ended = false, canceled = false, playedDuration = 0, timer;
  const nodes = new Set(); let resolve; const done = new Promise(a => { resolve = a; }); done.catch(() => {});
  const settle = () => { if (ended && !pending && !queued.length && !canceled) { clearInterval(timer); signal.removeEventListener('abort', cancel); onProgress(1); resolve(); } };
  function cancel() { if (canceled) return; canceled = true; clearInterval(timer); for (const n of nodes) { try { n.stop(); } catch {} } nodes.clear(); queued = []; signal.removeEventListener('abort', cancel); resolve(); }
  function flush() {
    if (canceled || !queued.length || !ended && (!started || next <= ctx.currentTime) && bytes < rate * 2 * .12) return;
    for (const data of queued) {
      const n = data.byteLength / 2, buf = ctx.createBuffer(1, n, rate), v = new DataView(data.buffer, data.byteOffset, data.byteLength), dst = buf.getChannelData(0);
      for (let i = 0; i < n; i++) dst[i] = v.getInt16(i * 2, true) / 32768;
      const node = ctx.createBufferSource(); node.buffer = buf; node.connect(gain); const at = Math.max(next, ctx.currentTime + .025); next = at + buf.duration;
      if (!started) { started = true; onStart(at); timer = setInterval(() => { if (!canceled) { const played = playedDuration + [...nodes].reduce((s, n) => s + Math.max(0, Math.min(n.duration, ctx.currentTime - n.at)), 0); onProgress(Math.min(.99, played / Math.max(.01, ended ? total / (rate * 2) : Math.max(estimate, total / (rate * 2))))); } }, 40); }
      node.at = at; node.duration = buf.duration; nodes.add(node); pending++; node.onended = () => { nodes.delete(node); playedDuration += buf.duration; pending--; settle(); }; node.start(at);
    }
    queued = []; bytes = 0;
  }
  signal.addEventListener('abort', cancel, { once: true }); if (signal.aborted) cancel();
  return {
    push(data, sr) { if (canceled) return; if (ended || data.length % 2 || ![16000, 24000, 32000, 44100, 48000].includes(sr) || rate && sr !== rate) throw Error('语音采样格式错误'); rate = sr; total += data.length; if (total > sr * 2 * 60) throw Error('单句语音太长'); queued.push(data); bytes += data.length; flush(); },
    finish() { if (canceled) return done; ended = true; if (!total) { cancel(); return Promise.reject(Error('语音流为空')); } flush(); settle(); return done; },
    done, cancel
  };
}

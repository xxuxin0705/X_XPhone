const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), http = require('http');
const root = path.resolve(__dirname, '..'), SAY = process.argv[2];
const MIME = { '.js': 'text/javascript', '.wasm': 'application/wasm', '.html': 'text/html' };
const srv = http.createServer((q, r) => { const u = q.url.split('?')[0]; if (u == '/') { r.writeHead(200, { 'content-type': 'text/html' }); return r.end('<!doctype html><body>asr</body>'); } if (u == '/say.f32') { r.writeHead(200); return r.end(fs.readFileSync(SAY)); } try { const b = fs.readFileSync(path.join(root, u)); r.writeHead(200, { 'content-type': MIME[path.extname(u)] || 'application/octet-stream', 'content-length': b.length }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(8830);
(async () => { const b = await chromium.launch(); const p = await b.newPage(); p.on('console', m => console.log('CON', m.text().slice(0, 200))); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:8830/');
  const r = await p.evaluate(async () => { const { localAsr } = await import('/apps/chat/local-asr.js'); const t0 = performance.now(); let pr = []; await localAsr.load(x => pr.push(x.pct)); const t1 = performance.now();
    const pcm = new Float32Array(await (await fetch('/say.f32')).arrayBuffer()); const parts = []; const s = localAsr.session(t => parts.push(t));
    for (let i = 0; i < pcm.length; i += 1600) { s.feed(pcm.subarray(i, i + 1600), 16000); await new Promise(r => setTimeout(r, 5)); }
    const fin = await s.end(); return { load: Math.round(t1 - t0), prog: pr.filter((x, i, a) => i == 0 || x != a[i - 1]).slice(-4), parts: parts.slice(-6), fin, n: parts.length }; });
  console.log(JSON.stringify(r, null, 1)); await b.close(); srv.close(); })();

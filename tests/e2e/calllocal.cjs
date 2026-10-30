// 真正的免费本地识别：打包模型、Worker 和真实录音；外网一律阻断。
const {chromium}=require('playwright'),fs=require('fs'),http=require('http'),path=require('path');
const root=path.resolve(__dirname,'../..'),srv=http.createServer((q,r)=>{try{const f=path.join(root,q.url==='/'?'tests/e2e/st.html':q.url.split('?')[0]);r.setHeader('content-type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.gz')?'application/gzip':f.endsWith('.wav')?'audio/wav':'text/html');r.end(fs.readFileSync(f))}catch{r.writeHead(404);r.end()}}).listen(8828,'127.0.0.1');
let passed=0,failed=0;const ok=(v,m)=>{v?passed++:failed++;console.log((v?'✓ ':'✗ ')+m)};
(async()=>{let b;try{
 b=await chromium.launch();const p=await b.newPage();await p.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:8828/')?r.continue():r.abort());
 const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:8828');await p.waitForFunction('window.booted');
 const result=await p.evaluate(async()=>{
  const m=await import('/apps/chat/local-speech.js');await m.prepareLocal('zh-CN');const ctx=new AudioContext(),audio=await ctx.decodeAudioData(await(await fetch('/tests/fixtures/local-speech.wav')).arrayBuffer()),data=audio.getChannelData(0),partials=[];
  let firstAt=null;const t=performance.now(),rec=m.localSession('zh-CN',s=>{if(s&&partials.at(-1)!==s){firstAt??=performance.now()-t;partials.push(s)}});
  for(let i=0;i<data.length;i+=2048){rec.feed(data.slice(i,i+2048),audio.sampleRate);await new Promise(r=>setTimeout(r,2048/audio.sampleRate*1000))}
  const before=partials.slice(),final=await rec.end();const loaded=[];
  for(const lang of ['ja-JP','en-US']){await m.prepareLocal(lang);loaded.push(m.localReady(lang))}
  m.releaseLocal();await ctx.close();return {partials,before,final,firstAt,loaded,unloaded:!m.localReady('en-US')};
 });
 console.log('REAL LOCAL ASR',JSON.stringify(result));
 ok(result.before.length>=2,'真实录音在结束前已经持续给出字幕，未调用云端识别');
 ok(/第一种|第二种/.test(result.final),'中文模型识别到录音中的实际词语');
 ok(result.partials.some(s=>s!==result.final),'临时结果与最终结果分开处理，允许回改');
 ok(result.loaded.every(Boolean)&&result.loaded.length===2,'日语和英语打包模型均能在浏览器中实际加载');
 ok(result.unloaded,'释放识别模型后 Worker 不再保持 ready');
 ok(errors.length===0,'没有浏览器运行异常：'+errors.join(';'));
} catch(e){ok(false,e.stack)}finally{await b?.close();srv.close();console.log(`${passed} passed, ${failed} failed`);process.exitCode=failed?1:0}})();

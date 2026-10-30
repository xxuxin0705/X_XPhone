import assert from 'node:assert/strict';
import { speechParser, endpointGap, remainingSpeech, callContext, callHistory } from '../../apps/chat/call-flow.js';
import { rawPCM, streamSpeech, speechStyle } from '../../speech-stream.js';
import { dialDirection } from '../../apps/chat/call-language.js';
import { pcmSentence } from '../../apps/chat/call-audio.js';
let pass=0, fail=0; const test=async(name,fn)=>{try{await fn();pass++;console.log('✓ '+name);}catch(e){fail++;console.error('✗ '+name+' '+e.stack);}};
await test('按任意块边界解析稳定中英文、情绪与释义',()=>{
  for (const size of [1,2,3,7,999]) {
    for (const [source,pairs,expected] of [
      ['EMO: happy\n你好。今天很开心！\nEMO: sad\n不过，我有一点想你。',false,[['你好。','','happy'],['今天很开心！','','happy'],['不过，我有一点想你。','','sad']]],
      ['EMO: happy\nSAY: Take your time.\nZH: 慢慢来。\nSAY: I am listening.\nZH: 我在听。',true,[['Take your time.','慢慢来。','happy'],['I am listening.','我在听。','happy']]],
      ['Value is 3.14. Fine!',false,[['Value is 3.14.','','neutral'],['Fine!','','neutral']]]
    ]) { const got=[],p=speechParser(u=>got.push([u.t,u.tr,u.emotion]),{pairs});for(let i=0;i<source.length;i+=size)p.feed(source.slice(i,i+size));p.finish();p.finish();assert.deepEqual(got,expected,`size ${size}`); }
  }
});
await test('未闭合标记不发布、不朗读控制标签',()=>{const got=[],p=speechParser(u=>got.push(u.t));p.feed('你好。<secret');assert.deepEqual(got,['你好。']);assert.throws(()=>p.finish(),/未闭合/);const pair=speechParser(()=>{}, {pairs:true});pair.feed('SAY: Hello.\n');assert.throws(()=>pair.finish(),/释义/);});
await test('WAIT 被任意网络分块时都只表示等待',()=>{let waited=0;const got=[],p=speechParser(u=>got.push(u),{wait:()=>waited++});for(const c of 'WAIT')p.feed(c);p.finish();assert.equal(waited,1);assert.equal(got.length,0);});
await test('不完整话语等待更久、中断记忆和已说记录分开',()=>{assert.ok(endpointGap('因为')>endpointGap('说完了。'));assert.ok(endpointGap('because')>endpointGap('Thank you!'));assert.equal(remainingSpeech([{t:'你好',spoken:2},{t:'明天去看海',spoken:2},{t:'还有礼物',spoken:0}]),'去看海还有礼物');assert.match(callContext({msgs:[]},'我','你',[{f:'me',t:'新问题'}],'礼物'),/尚未说完的内容/);});
const response=(parts)=>new Response(new ReadableStream({start(c){for(const p of parts)c.enqueue(Uint8Array.from(p));c.close();}}));
await test('最新问题只发送一次，旧回答保留 assistant 身份',()=>{const messages=callHistory([{f:'c',t:'喂？'},{f:'me',t:'你好'},{f:'c',t:'今こっち晴れててさ。'},{f:'me',t:'在说什么呢？'}],'在说什么呢？');assert.deepEqual(messages.map(x=>x.role),['user','assistant']);assert.equal(messages.at(-1).content,'今こっち晴れててさ。');assert.ok(!JSON.stringify(messages).includes('在说什么呢？'));});
await test('酒馆普通/流式/连接配置与自定义 API 都保留历史角色和最新问题',async()=>{
  const core=await import('../../core.js'), oldFetch=globalThis.fetch, oldST=globalThis.SillyTavern, oldChat=core.S.api.chat;
  const history=[{role:'user',content:'之前的问题'},{role:'assistant',content:'之前的回答'}];let captured;
  const c={generateRaw:async o=>(captured=o.prompt,'答复')};globalThis.SillyTavern={getContext:()=>c};
  const check=()=>{assert.deepEqual(captured.slice(-3),[...history,{role:'user',content:'现在的问题'}]);};
  try{
    core.S.api.chat={src:'tavern',list:[]};await core.llm('背景','现在的问题','通话',null,{history});check();
    Object.assign(c,{mainApi:'openai',chatCompletionSettings:{chat_completion_source:'custom',custom_url:'https://test/v1'},ChatCompletionService:{processRequest:async d=>(captured=d.messages,{content:'答复'})}});
    await core.llm('背景','现在的问题','通话',null,{history,stream:true});check();delete c.mainApi;
    c.extensionSettings={connectionManager:{profiles:[{id:'conn',api:'openai'}]}};c.ConnectionManagerRequestService={sendRequest:async(id,m)=>(captured=m,{content:'答复'})};core.S.api.chat.stp='conn';
    await core.llm('背景','现在的问题','通话',null,{history});check();
    core.S.api.chat={src:'custom',cur:'p',list:[{id:'p',url:'https://test/v1',key:'fake',model:'m'}]};globalThis.fetch=async(u,o)=>(captured=JSON.parse(o.body).messages,new Response(JSON.stringify({choices:[{message:{content:'答复'}}]}),{headers:{'content-type':'application/json'}}));
    await core.llm('背景','现在的问题','通话',null,{history,stream:false});check();
  }finally{core.S.api.chat=oldChat;globalThis.fetch=oldFetch;globalThis.SillyTavern=oldST;}
});
await test('语言圆盘方向和中心取消区域',()=>{assert.deepEqual([[0,-60],[60,0],[0,60],[-60,0],[2,3]].map(([x,y])=>dialDirection(x,y)),[0,1,2,3,-1]);});
await test('PCM 1/3/不规则字节边界重组、奇数尾和空流失败',async()=>{const got=[];await rawPCM(response([[1],[2,3,4],[5],[6,7,8]]),24000,new AbortController().signal,b=>got.push(...b));assert.deepEqual(got,[1,2,3,4,5,6,7,8]);await assert.rejects(rawPCM(response([[1,2,3]]),24000,null,()=>{}),/不完整/);await assert.rejects(rawPCM(response([]),24000,null,()=>{}),/为空/);});
await test('网络流尚未结束时 PCM 已经排入音频时钟',async()=>{const x=clock(),ac=new AbortController(),p=pcmSentence(x,{},ac.signal,()=>{});let controller;const r=new Response(new ReadableStream({start(c){controller=c}}));let received=false;const stream=rawPCM(r,24000,ac.signal,b=>{received=true;p.push(b,24000)});controller.enqueue(new Uint8Array(12000));await new Promise(r=>setImmediate(r));assert.ok(received&&x.nodes.length===1);ac.abort();await assert.rejects(stream);assert.ok(p.done);});
await test('MiniMax 分块 SSE UTF8、结束汇总不重播、缺结束拒绝',async()=>{let got=[];const content='data: '+JSON.stringify({data:{audio:'01020304',status:1}})+'\r\n\r\ndata: '+JSON.stringify({data:{audio:'01020304',status:2}})+'\r\n\r\n';const bytes=new TextEncoder().encode(content);await streamSpeech({prov:'mm',url:'https://test',key:'k'},'你好','v',new AbortController().signal,b=>got.push(...b),async()=>response([...bytes].map(x=>[x])));assert.deepEqual(got,[1,2,3,4]);await assert.rejects(streamSpeech({prov:'mm',url:'https://test'},'你好','v',new AbortController().signal,()=>{},async()=>response([Array.from(new TextEncoder().encode(content.split('data: ')[0]+'data: {"data":{"audio":"0102","status":1}}\n\n'))])),/正常结束/);});
function clock(){const nodes=[];return {currentTime:0,nodes,createBuffer(c,n,sr){return{duration:n/sr,getChannelData:()=>new Float32Array(n)}} ,createBufferSource(){const n={connect(){},start(at){this.at=at;},stop(){this.onended?.()}};nodes.push(n);return n;}};}
await test('audio_end 不能提前确认，短句不足缓冲也能播完',async()=>{const x=clock(),ac=new AbortController(),p=pcmSentence(x,{},ac.signal,()=>{});p.push(new Uint8Array(480),24000);assert.equal(x.nodes.length,0);let done=false;p.finish().then(()=>done=true);await Promise.resolve();assert.equal(x.nodes.length,1);assert.equal(done,false);x.nodes[0].onended();await p.done;assert.equal(done,true);});
await test('取消先置 canceled，stop 的结束回调不会假装播完',async()=>{const x=clock(),ac=new AbortController();let complete=0;const p=pcmSentence(x,{},ac.signal,()=>{},f=>{if(f===1)complete++});p.push(new Uint8Array(12000),24000);ac.abort();await p.done;assert.equal(complete,0);p.push(new Uint8Array(12000),24000);assert.equal(x.nodes.length,1);});
await test('空句必须报错，不能伪造已播放', async()=>{const ac=new AbortController(),p=pcmSentence(clock(),{},ac.signal,()=>{});await assert.rejects(p.finish(),/为空/);});
await test('错误采样率/奇数字节不能排入播放器',()=>{const ac=new AbortController(),p=pcmSentence(clock(),{},ac.signal,()=>{});assert.throws(()=>p.push(new Uint8Array(3),24000));assert.throws(()=>p.push(new Uint8Array(4),1));ac.abort();});
await test('语气只映射引擎支持的参数，普通模型不加入未知标签',()=>{assert.ok(speechStyle({prov:'openai',model:'gpt-4o-mini-tts'},'你好','happy').extra.instructions);assert.equal(speechStyle({prov:'fish',model:'s1'},'你好','happy').text,'你好');assert.equal(speechStyle({prov:'eleven',model:'eleven_multilingual_v2'},'你好','happy').text,'你好');});
console.log(`${pass} passed, ${fail} failed`);process.exitCode=fail?1:0;

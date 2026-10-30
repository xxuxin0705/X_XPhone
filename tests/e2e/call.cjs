// 新通话的端到端契约：自动切语言、剧情刷新、真实播放确认、插话续接与取消。
const { chromium } = require('playwright'), fs = require('fs'), path = require('path'), http = require('http');
const root = path.resolve(__dirname, '../..'), out = path.join(root, 'tests/out'); fs.mkdirSync(out, { recursive: true });
const srv = http.createServer((q, r) => { try { const f = path.join(root, q.url === '/' ? 'tests/e2e/st.html' : decodeURIComponent(q.url.split('?')[0])); r.setHeader('content-type', f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : f.endsWith('.png') ? 'image/png' : f.endsWith('.webp') ? 'image/webp' : 'text/html'); r.end(fs.readFileSync(f)); } catch { r.writeHead(404); r.end(); } }).listen(8827, '127.0.0.1');
let pass = 0, fail = 0; const ok = (x, m) => { x ? pass++ : fail++; console.log(`${x ? '✓' : '✗'} ${m}`); };
(async () => { let browser;
  try {
    browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => /127\.0\.0\.1/.test(r.request().url()) ? r.continue() : r.abort());
    const asr = [], speech = []; let transcript = '今天很开心。', pcmSeconds = .15;
    await ctx.route('**/audio/transcriptions', async r => { asr.push(r.request().postDataBuffer().toString()); await r.fulfill({ json: { text: transcript }, headers: { 'access-control-allow-origin': '*' } }); });
    await ctx.route('**/audio/speech', async r => { speech.push(r.request().postDataJSON()); await r.fulfill({ body: Buffer.alloc(Math.floor(24000 * pcmSeconds) * 2), contentType: 'application/octet-stream', headers: { 'access-control-allow-origin': '*' } }); });
    await ctx.addInitScript(() => {
      window.testTranscript = '说完了。'; window.localModels = [];
      window.XPhoneVosk = { Model: class {
        constructor(url) { this.ready=false; this.events={}; localModels.push(url); this.timer=setTimeout(()=>{this.ready=true;this.events.load?.({result:true})},5); }
        on(k,f){this.events[k]=f} terminate(){clearTimeout(this.timer);this.ready=false}
        get KaldiRecognizer(){return class{constructor(){this.events={};this.text=testTranscript;this.closed=false}on(k,f){this.events[k]=f}acceptWaveformFloat(){if(!this.closed)this.events.partialresult?.({result:{partial:this.text}})}retrieveFinalResult(){queueMicrotask(()=>{if(!this.closed)this.events.result?.({final:true,result:{text:this.text}})})}remove(){this.closed=true}}}
      } };
    });
    const p = await ctx.newPage(), errors = []; p.on('pageerror', e => errors.push(e.message)); await p.goto('http://127.0.0.1:8827'); await p.waitForFunction('window.booted'); await p.click('#stp-ball');
    await p.evaluate(async () => {
      window.core = await import('/core.js'); window.dt = await import('/apps/chat/data.js'); window.cl = await import('/apps/chat/call.js');
      core.S.lock.on = false; core.S.api.chat.src = 'tavern'; core.S.api.tts = { pv: 'openai', src: 'custom', v: 2, fb: false, cfg: { openai: { model: 'gpt-4o-mini-tts', key: 'test', url: 'https://tts.test/v1', voice: 'alloy' } } }; core.S.callAsr = { key: 'test', url: 'https://asr.test/v1' };
      window.ch = dt.add(dt.blank('p', { real: '角色', nick: '角色', fr: 1 })); ch.tv = { v: {} }; window.prompts = []; window.reply = 'EMO: happy\n好呀，跟我说说。';
      const c = SillyTavern.getContext(); c.generateRaw = async o => { prompts.push(o); return reply; }; c.chat.push({ name: '旁白', mes: '当前剧情：两人在海边。' });
      // 一条静音麦克风，测试音量样本通过同一个 frame 入口输入，不需要设备或付费服务。
      navigator.mediaDevices.getUserMedia = async () => { const x = new AudioContext(), d = x.createMediaStreamDestination(); window.micClock = x; return d.stream; };
      window.call = cl.startCall(ch);
    });
    await p.waitForFunction("call.st === 'talk' && call.ph === 'idle'");
    ok(await p.evaluate("call.inL === 'zh-CN' && !('earBack' in call)"), '默认免费本地中文，不使用云端识别密钥');
    const voice = async (text, lang='zh-CN') => { if(await p.evaluate('call.inL')!==lang){await p.click('[data-k=inl]');await p.click('.xcl-'+['zh-CN','ja-JP','en-US','keyboard'].indexOf(lang));await p.waitForFunction('!call.loading');} await p.waitForFunction('!call.loading && !!call.earObj.ms'); transcript = text; await p.evaluate(t=>testTranscript=t,text); const count = await p.evaluate('prompts.length'); await p.evaluate(() => { const ear = call.earObj, loud = new Float32Array(480).fill(.2), silent = new Float32Array(480); for (let i = 0; i < 40; i++) ear.frame(loud, 24000); for (let i = 0; i < 85; i++) ear.frame(silent, 24000); }); await p.waitForFunction(n => prompts.length > n && call.ph === 'idle', count); };
    for (const [lang,text] of [['zh-CN','今天很开心。'], ['ja-JP','今日は何をしていたの？'], ['en-US','Can you hear me?']]) await voice(text,lang);
    ok(await p.evaluate("['今天很开心。','今日は何をしていたの？','Can you hear me?'].every(t => call.log.some(x => x.f === 'me' && x.t === t))"), '中日英三轮识别原文上屏并记入通话');
    ok(asr.length === 0, '识别不调用云端接口，不使用已配置的旧 ASR 密钥');
    await p.evaluate("SillyTavern.getContext().chat.push({name:'旁白', mes:'剧情更新：现在两人到了医院。'}); reply='知道了，我在医院门口等你。'"); await voice('你知道我在哪吗？');
    ok(await p.evaluate("JSON.stringify(prompts.at(-1)).includes('现在两人到了医院')"), '电话中正文推进后，下一轮重新读取当前剧情');
    ok(await p.evaluate("JSON.stringify(prompts.at(-1)).includes('Can you hear me?')"), '当前电话前面说过的话进入后续上下文');
    ok(await p.evaluate("Array.isArray(prompts.at(-1).prompt) && prompts.at(-1).prompt.at(-1).role==='user' && prompts.at(-1).prompt.at(-1).content==='你知道我在哪吗？' && prompts.at(-1).prompt.some(x=>x.role==='assistant')"), '酒馆请求：历史回答为 assistant，最新问题独立放在最后');

    await p.evaluate("ch.tv = {v:{openai:'alloy'}}; reply='EMO: happy\\n真的太开心了。'"); await voice('我通过考试啦。');
    ok(speech.at(-1).response_format === 'pcm' && /笑意/.test(speech.at(-1).instructions || ''), '支持的引擎收到 PCM 和情绪指令，字幕没有控制标记');
    ok(await p.evaluate("!document.querySelector('.xc-tx').textContent.includes('EMO:')"), '情绪标签不会出现在字幕或朗读文本里');
    // 长语音中断：确认声音尚未结束，再送新话，不把未播完的全文算成已说。
    pcmSeconds = 3;
    await p.evaluate("reply='EMO: neutral\\n我本来想告诉你一个很重要的事情，明天我们一起去看海。\\n我还准备了一份礼物。'; document.querySelector('[data-k=kb]').click(); document.querySelector('.xc-entry input').value='你刚才想说什么'; document.querySelector('.xc-entry button').click()");
    await p.waitForFunction("call.ph === 'speak'"); await p.waitForTimeout(180);
    await p.evaluate("call.interrupt()");
    ok(await p.evaluate("call.pending.includes('礼物') && !call.log.filter(x=>x.f==='c').at(-1).t.includes('一起去看海')"), '插话停止播放，未说完的内容保留且未记成已经说过');
    pcmSeconds = .1;
    await p.evaluate("reply='先听你说，刚才那件事等一下再接着讲。'; document.querySelector('.xc-entry input').value='先等一下'; document.querySelector('.xc-entry button').click()");
    await p.waitForFunction("call.ph === 'idle'");
    ok(await p.evaluate("JSON.stringify(prompts.at(-1)).includes('尚未说完的内容') && JSON.stringify(prompts.at(-1)).includes('礼物')"), '下一轮同时带入插话和上一轮未说完的话');
    await p.evaluate("reply='WAIT'; ch.tv={v:{}}; document.querySelector('.xc-entry input').value='因为那个'; document.querySelector('.xc-entry button').click()"); await p.waitForFunction("call.ph === 'idle'");
    ok(await p.evaluate("!call.lines.some(x=>x.t==='WAIT')"), '模型认为话还没完时等待，不把等待协议念出来');
    // 真正的文字流：第一句播放时，模型尚未生成完下一句。
    await p.evaluate(() => {
      ch.tv = {v:{openai:'alloy'}}; const c = SillyTavern.getContext(); c.mainApi='openai'; c.chatCompletionSettings={chat_completion_source:'custom',custom_url:'https://relay.test/v1',openai_max_tokens:500}; c.getChatCompletionModel=()=> 'gemini-test'; window.generatedDone=false;
      c.ChatCompletionService={processRequest:async()=>async function*(){yield {text:'EMO: happy\n第一句已经出来了。\n'};await new Promise(r=>setTimeout(r,1300));generatedDone=true;yield {text:'EMO: happy\n第一句已经出来了。\n这是第二句。\n'}}};
      document.querySelector('.xc-entry input').value='边想边说';document.querySelector('.xc-entry button').click();
    });
    await p.waitForFunction("call.ph==='speak' && call.log.some(x=>x.f==='c' && /第一句/.test(x.t))");
    ok(await p.evaluate('!generatedDone'), '第一句已经发声时，模型仍在生成后面的句子');
    await p.waitForFunction("generatedDone && call.ph==='idle'");
    await p.evaluate("delete SillyTavern.getContext().ChatCompletionService;delete SillyTavern.getContext().mainApi;ch.tv={v:{}}");
    ok(await p.evaluate("ch.msgs.filter(x=>x.t==='call').length===1 && ch.msgs.at(-1).log.some(x=>/第二句/.test(x.t))"), '通话期间持续保存到同一条消息，切换剧情前已留下双方记录');
    // 拖圆盘只改变输入语言，角色语言整通固定。
    const dial=await p.locator('[data-k=inl]').boundingBox(); await p.mouse.move(dial.x+dial.width/2,dial.y+dial.height/2);await p.mouse.down();await p.mouse.move(dial.x+dial.width/2+65,dial.y+dial.height/2,{steps:6});await p.mouse.up();
    ok(await p.evaluate("call.inL==='ja-JP' && call.outL==='' && !document.querySelector('.xcl-dial')"), '向右拖选日语，不改变角色语言，松手圆盘关闭');
    await p.click('[data-k=inl]');await p.screenshot({path:path.join(out,'call-language.png')});await p.click('.xcl-0');
    ok(await p.evaluate("call.inL==='zh-CN' && core.S.callInputLang==='zh-CN'"), '点击圆盘也能选中文并保存');
    await voice('中文说完了。');
    ok(await p.evaluate("call.inL==='zh-CN' && localModels.some(u=>u.endsWith('zh.tar.gz'))"), '手动选择中文后使用中文本地模型');
    await p.click('[data-k=inl]');await p.click('.xcl-edit');await p.click('.sheet.in .mi[data-x="2"]');await p.click('.sheet.in .mi[data-x="keyboard"]');
    ok(await p.evaluate("core.S.callInputFavs[2]==='keyboard' && call.inL==='zh-CN'"), '常用语言位置可更换，不立即改变当前语言');
    await p.click('[data-k=inl]');ok(await p.locator('.xcl-2').textContent()==='键盘', '下次打开圆盘显示保存的常用语言');await p.keyboard.press('Escape');

    await p.screenshot({ path: path.join(out, 'call-rewrite.png') });
    ok(await p.evaluate("(()=>{const tx=document.querySelector('.xc-tx').getBoundingClientRect(), ctl=document.querySelector('.xc-entry').getBoundingClientRect();return tx.bottom<=ctl.top && tx.width>200})()"), '390px 宽屏：字幕与输入框不重叠');
    await p.evaluate("call.hang()");
    ok(await p.evaluate("ch.msgs.at(-1).t==='call' && ch.msgs.at(-1).log.some(x=>x.t==='今日は何をしていたの？') && !cl.inCall()"), '挂断保存双方通话内容，旧聊天消息继续保留');
    await p.evaluate(async()=>{ window.fav=await import('/apps/chat/fav.js');window.talk=await import('/apps/chat/talk.js');window.friend=dt.add(dt.blank('p',{real:'Kiki',fr:1}));core.APPS.chat.open();talk.openChat(ch.id);fav.addFav({f:ch.id,t:'text',c:'收藏的内容'},ch);fav.favPage({ch,done:m=>{ch.msgs.push({...m,f:'me',ts:Date.now()})}}); });
    ok(await p.evaluate("core.top().title==='发送收藏' && /收藏的内容/.test(document.querySelector('.fv-l').textContent)"), '发送收藏列表保持正常');
    await p.click('.fv-it');await p.waitForSelector('.xsd.in');await p.click('.xsd [data-k=y]');await p.waitForTimeout(300);
    ok(await p.evaluate("ch.msgs.at(-1).c==='收藏的内容' && ch.msgs.at(-1).f==='me'"), '收藏确认发送保持正常');
    await p.evaluate("fav.cardPick(ch,(c,note)=>{ch.msgs.push({t:'card',cid:c.id,c:c.real,f:'me',ts:Date.now()})})");await p.waitForTimeout(250);await p.click('.cp-r');await p.waitForSelector('.xsd.in');await p.click('.xsd [data-k=y]');await p.waitForTimeout(300);
    ok(await p.evaluate("ch.msgs.at(-1).cid===friend.id && /Kiki/.test(core.say(ch.msgs.at(-1)))"), '个人名片选择与正文上下文保持正常');
    // 权限申请迟到：先挂断，再返回流，所有轨道必须立刻释放。
    await p.evaluate("window.stopped=0; navigator.mediaDevices.getUserMedia=()=>new Promise(r=>window.resolveMic=r); window.late=cl.startCall(ch)"); await p.waitForFunction('window.resolveMic');await p.evaluate("late.hang();resolveMic({getTracks:()=>[{stop(){stopped++}}]})");await p.waitForTimeout(100);
    ok(await p.evaluate('stopped === 1 && !cl.inCall()'), '挂断后迟到的麦克风权限回调会释放轨道');
    // 跨剧情聊天不能继续请求或把旧通话写到新聊天。
    await p.evaluate("core.S.callAsr.key=''; window.next=cl.startCall(ch); SillyTavern.getContext().chatId='chatB'; SillyTavern.getContext().chatMetadata={}"); await p.waitForTimeout(650);
    ok(await p.evaluate("!cl.inCall() && !core.D().chats.length"), '切换酒馆聊天立即结束旧电话，新聊天没有旧通话');
    await p.evaluate("window.keyboardMic=0;core.S.callInputLang='keyboard';navigator.mediaDevices.getUserMedia=async()=>{keyboardMic++;throw Error('must not open')};window.keyCh=dt.add(dt.blank('p',{real:'键盘测试',fr:1}));window.keyCall=cl.startCall(keyCh)");await p.waitForTimeout(650);
    ok(await p.evaluate("!document.querySelector('.xc-entry').hidden && keyboardMic===0 && /键盘输入/.test(document.querySelector('.xc-ph').textContent)"), '保存的键盘模式下次通话直接可用，不偷偷打开麦克风');await p.evaluate('keyCall.hang()');
    ok(errors.length === 0, '无浏览器运行异常：' + errors.join('; '));
  } catch (e) { ok(false, e.stack); }
  finally { await browser?.close(); srv.close(); console.log(`${pass} passed, ${fail} failed`); process.exitCode = fail ? 1 : 0; }
})();

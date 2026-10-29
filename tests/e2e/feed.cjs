const {chromium}=require('playwright'),assert=require('assert/strict'),fs=require('fs'),path=require('path'),http=require('http');
const root=path.resolve(__dirname,'../..');const srv=http.createServer((q,r)=>{try{const f=path.join(root,q.url==='/'?'tests/e2e/st.html':q.url.split('?')[0]);r.setHeader('content-type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html');r.end(fs.readFileSync(f));}catch{r.writeHead(404);r.end();}}).listen(8816);
(async()=>{let b;try{b=await chromium.launch();const p=await b.newPage({viewport:{width:400,height:860},deviceScaleFactor:1});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://localhost:8816');await p.waitForFunction('window.booted');await p.click('#stp-ball');await p.evaluate(async()=>{window.c=await import('/core.js');window.f=await import('/apps/chat/feed.js');const d=await import('/apps/chat/data.js');window.norm=await import('/apps/chat/feed-generation.js');c.S.lock.on=false;c.S.api.chat.src='tavern';window.a=d.add(d.blank('p',{real:'小夏',fr:1}));window.z=d.add(d.blank('p',{real:'小林',fr:1}));c.D().posts=[];c.home();c.page({title:'朋友圈',live:1,cls:'chatapp st-wx tb-feed',right:()=>f.feedRight(),after:f.mountFeed,body:()=>f.feed(),acts:f.FA});window.calls=0;SillyTavern.getContext().generateRaw=async(o)=>{calls++;window.lastP=JSON.stringify(o);return JSON.stringify({moments:[{name:'小夏',text:'午后的风刚刚好。',images:['[图片]（窗边咖啡）（coffee, sunlight）','[图片]（海边）（ocean, sunset）'],location:'海边',time:'2小时前',likeList:['小林','陌生人'],commentList:[{name:'小林',text:'下次一起！'},{name:c.nm(c.meObj()),text:'不该替用户说话'}]},{name:'小林',text:'不应入选'},{name:'陌生人',text:'不应新建联系人'}]});};});
await p.evaluate(()=>f.FA.fgen());await p.waitForTimeout(350);await p.click('.gdlg [data-a=gdp]');await p.click('.gdlg [data-a=gdo]');await p.click('.gdlg [data-a=gdg]');await p.waitForFunction(()=>c.D().posts.length===1);
assert.deepEqual(await p.evaluate(()=>[c.D().posts[0].images.length,c.D().posts[0].cm.length,c.D().posts[0].likes.length,calls]),[2,1,1,1]);
// 配图描述拆成 中文（显示） + 英文 tags（NAI / SD / ComfyUI 用）；看过朋友圈后新动态的红点标记清掉
assert.deepEqual(await p.evaluate(()=>{const i=c.D().posts[0].images[0];return [i.description,i.prompt,c.D().posts[0].u||0];}),['窗边咖啡','coffee, sunlight',0]);
assert.deepEqual(await p.evaluate(()=>[c.imgDesc('[图片-小夏]（合照）（2girls, selfie）'),c.imgDesc('a cat'),c.imgDesc('海边')]),[{zh:'合照',en:'2girls, selfie'},{zh:'',en:'a cat'},{zh:'海边',en:''}]);
assert.equal(await p.locator('.mo-photo small').first().textContent(),'窗边咖啡');
await p.waitForTimeout(400);
await p.evaluate(()=>{c.ui.tasks.innerHTML='';});
assert.equal(await p.locator('.feed-header-btn svg').count(),2);
assert.equal(await p.locator('.feed-header-btn svg').first().getAttribute('viewBox'),'0 0 576 512');
assert.equal(await p.locator('.feed-header-btn svg').first().evaluate(e=>getComputedStyle(e).width),'18px');
assert.equal(await p.locator('.mo-images .mo-photo').count(),2);assert.equal(await p.locator('.mo-location').textContent(),'海边');
assert.equal(await p.locator('.mo-images').evaluate(e=>getComputedStyle(e).maxWidth),'180px');
await p.click('.mo-ab');assert.equal(await p.locator('.wxp b').count(),2);await p.click('.mo-ab');assert.equal(await p.locator('.wxp').count(),0);
await p.evaluate(()=>{const e=document.querySelector('.feed');e.style.minHeight='1600px';const area=c.top().el.querySelector('.pg-b');area.scrollTop=100;area.dispatchEvent(new Event('scroll'));});assert(!await p.locator('.pg-h').evaluate(e=>e.classList.contains('feed-header-solid')));
await p.evaluate(()=>{const area=c.top().el.querySelector('.pg-b');area.scrollTop=400;area.dispatchEvent(new Event('scroll'));});assert(await p.locator('.pg-h').evaluate(e=>e.classList.contains('feed-header-solid')&&getComputedStyle(e).backgroundColor=='rgb(237, 237, 237)'));
await p.evaluate(()=>{c.top().re();});
assert.equal(await p.evaluate(()=>norm.normalizeMoments({moments:[{name:c.nm(c.meObj()),text:'用户'}]},c.D().chats,{},c.nm(c.meObj())).length),0);
assert(await p.evaluate(()=>Math.abs(+c.now()-c.D().posts[0].ts-7200000)<10000));
await p.evaluate(()=>f.FA.like(c.D().posts[0].id));assert.equal(await p.evaluate(()=>c.D().posts[0].likes.length),2);
// 评论框：表情面板插 [微笑]、⌫ 删整个表情；发出去的评论里显示成表情图
await p.evaluate(()=>{c.top().el.querySelector('.pg-b').scrollTop=0;f.FA.cmt(c.D().posts[0].id);});await p.waitForTimeout(300);
await p.click('.wxcb [data-k=emo]');assert(await p.locator('.wxcb-e img').count()>50);await p.click('.wxcb-e img >> nth=0');assert.equal(await p.inputValue('.wxcb input'),'[微笑]');
await p.click('.wxcb-del');assert.equal(await p.inputValue('.wxcb input'),'');await p.click('.wxcb-e img >> nth=0');await p.click('.wxcb-s');await p.waitForTimeout(300);
assert.equal(await p.evaluate(()=>c.D().posts[0].cm.at(-1).c),'[微笑]');assert(await p.locator('.f-c .f-emo').count()>=1);await p.evaluate(()=>{c.ui.tasks.innerHTML='';});
// 评论按各自的语言、回复不 @ 对方：提示词里写明；旧数据开头的 @某某 显示时去掉
await p.waitForTimeout(300);assert(await p.evaluate(()=>/每个人只用自己的语言说话|都用简体中文/.test(lastP)&&/不要写「@名字」/.test(lastP)));
await p.evaluate(()=>{c.D().posts[0].cm.push({f:'小林',c:'@小夏 喂喂',to:'小夏'});c.top().re();});assert.equal(await p.evaluate(()=>[...document.querySelectorAll('.f-c')].at(-1).textContent),'小林 回复 小夏：喂喂');
await p.evaluate(()=>{c.D().posts[0].cm.pop();c.top().re();c.ui.tasks.innerHTML='';});
// 没图的配图：点开是编辑描述（中文 + 英文）；有图：点开看大图，单击收起
await p.click('.mo-photo >> nth=0');await p.waitForTimeout(300);assert.deepEqual(await p.evaluate(()=>[...document.querySelectorAll('.sheet textarea')].map(t=>t.value)),['窗边咖啡','coffee, sunlight']);await p.mouse.click(200,60);await p.waitForTimeout(400);assert.equal(await p.locator('.sheet').count(),0);
await p.evaluate(()=>{c.D().posts[0].images[0].url='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>';c.top().re();});await p.click('.mo-photo >> nth=0');await p.waitForTimeout(100);assert.equal(await p.locator('.imv').count(),1);
await p.click('.imv');await p.waitForTimeout(600);assert.equal(await p.locator('.imv').count(),0);
await p.evaluate(()=>{c.D().me.fbg='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>';c.top().re();});assert.equal(await p.locator('.wxm').evaluate(el=>getComputedStyle(el).borderRadius),'12px');
for(const [style,key] of [['wx','wx'],['qq','qq'],['line','tw']]){await p.evaluate(({style})=>{c.S.style=style;c.top().re();},{style});await p.waitForTimeout(150);assert.equal(await p.locator('.mo-photo').count(),2);fs.mkdirSync(path.join(root,'tests/out'),{recursive:true});await p.screenshot({path:path.join(root,'tests/out/feed-'+key+'.png')});}
await p.evaluate(()=>{c.S.style='wx';c.top().re();f.FA.fgen();});await p.waitForTimeout(350);await p.screenshot({path:path.join(root,'tests/out/feed-generator.png')});
// 角色的个人相册：封面顶到状态栏（和我的朋友圈一样），有图的动态显示配图拼图（2 张左右排）
await p.evaluate(()=>{c.home();f.openFeed(c.D().posts[0].a);});await p.waitForTimeout(500);
assert.deepEqual(await p.evaluate(()=>[getComputedStyle(c.top().el).paddingTop,document.querySelectorAll('.al-p.im .al-g.n2>*').length]),['0px',2]);
assert.deepEqual(errors,[]);console.log('20 passed, 0 failed');}finally{await b?.close();srv.close();}})().catch(e=>{console.error(e);process.exitCode=1});

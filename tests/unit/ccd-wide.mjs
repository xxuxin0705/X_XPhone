import assert from 'node:assert/strict';
import { wideHtml, wideBody, WIDE_SILVER, wideSettings, mountWideVideos } from '../../apps/theme/ccd-wide.js';
const colors = [WIDE_SILVER,'#c7b7e8','#edb8cf'];
const bodies = colors.map(body=>wideBody({body}));
assert.equal(new Set(bodies).size,3);
for(const [i,c] of ['#c9cdcb','#c7b7e8','#edb8cf'].entries()) assert(bodies[i].includes(c));
for(const body of bodies) {
 assert.match(body,/viewBox="0 0 900 460"/);assert.match(body,/fill-rule="evenodd"/);
 const ids=[...body.matchAll(/id="([^"]+)"/g)].map(x=>x[1]);
 for(const ref of body.matchAll(/url\(#([^)]*)\)/g)) assert(ids.includes(ref[1]),'每个机壳只引用自身渐变');
}
const ids=bodies.flatMap(s=>[...s.matchAll(/id="([^"]+)"/g)].map(x=>x[1]));assert.equal(new Set(ids).size,ids.length);
assert.match(wideBody({style:'custom',body:'#b8f3df'}),/#b8f3df/);
assert(wideBody({}).includes(WIDE_SILVER));
assert(wideBody({body:'#b8f3df'}).includes('#b8f3df'));
assert.equal(wideSettings({style:'pink',body:WIDE_SILVER}).body,'#edb8cf');
assert.equal(wideSettings({style:'custom',body:'#b8f3df'}).body,'#b8f3df');
const migrated = wideSettings({style:'lavender',body:WIDE_SILVER,img:'photo.jpg',video:'clip.mp4',bg:'glass',sticker:'sticker.png',sx:80,sy:20,ss:18});
assert.deepEqual(migrated,{body:'#c7b7e8',img:'photo.jpg',video:'clip.mp4',bg:'glass'});
const photo=wideHtml({img:'photo.jpg',style:'silver',zoom:196,px:0,py:100,sticker:'sticker.png',sx:80,sy:10,ss:20});
assert.match(photo,/translate\(-50%,50%\) scale\(1.96\)/);assert.doesNotMatch(photo,/cw-sticker|sticker.png/);
assert.match(wideHtml({img:'x" onerror="evil',style:'silver'}),/x&#34; onerror=&#34;evil/);
assert.doesNotMatch(wideHtml({style:'silver'}),/data-wide-src/);
const video=wideHtml({type:'video',video:'/clip.mp4',img:'cover.jpg'});
assert.match(video,/<video .*muted loop autoplay playsinline/);assert.match(video,/poster="cover.jpg"/);
assert.match(wideHtml({type:'video',video:'',img:'cover.jpg'}),/<img src="cover.jpg"/);
assert.match(wideHtml({bg:'solid',bgC:'#ffffff',bgA:50}),/rgba\(255,255,255,0.5\)/);
for (const bg of ['none','glass','solid','grad']) {
  const html=wideHtml({bg,bgC:'#abcdef',bgC2:'#fedcba',bgA:40});
  if(bg==='none') assert.match(html,/class="ccd-bg" style=""/);
  if(bg==='glass') assert.match(html,/backdrop-filter:blur/);
  if(bg==='solid') assert.match(html,/rgba\(171,205,239,0.4\)/);
  if(bg==='grad') assert.match(html,/background:linear-gradient/);
}
// 同一节点不会重复载入，切换/关闭后释放本地视频地址。
let plays=0;const released=[],old=URL.revokeObjectURL;URL.revokeObjectURL=u=>released.push(u);
try {
 const v={isConnected:true,dataset:{wideSrc:'blob:wide-video'},play(){plays++;return Promise.resolve()},setAttribute(){}};
 const root={querySelectorAll:()=>[v]};mountWideVideos(root);await new Promise(r=>setImmediate(r));
 assert.equal(v.src,'blob:wide-video');assert.equal(plays,1);mountWideVideos(root);assert.equal(plays,1);
 v.isConnected=false;mountWideVideos({querySelectorAll:()=>[]});assert.deepEqual(released,['blob:wide-video']);
 const gone={isConnected:true,dataset:{wideSrc:'blob:gone'},play(){throw Error('removed video must not play')}};
 mountWideVideos({querySelectorAll:()=>[gone]});gone.isConnected=false;await new Promise(r=>setImmediate(r));assert(released.includes('blob:gone'));
} finally {URL.revokeObjectURL=old;}
console.log('Wide CCD: silver default, custom colors, migration, shared backgrounds, media, positions, escaping and video cleanup checked.');
console.log('1 passed, 0 failed');

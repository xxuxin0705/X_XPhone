import assert from 'node:assert/strict';
import { recolorPixels } from '../../apps/theme/ccd.js';
// 原机壳的平面、高光、阴影、暗框、中性金属和透明像素，避免测试依赖浏览器 Canvas。
const src = new Uint8ClampedArray([
  255,207,232,255, 255,247,250,255, 236,144,182,255,
  49,10,23,255, 60,60,60,255, 255,100,180,0, 252,197,227,120, 255,207,232,255, 255,207,232,255,
]);
const before = new Uint8ClampedArray(src), rgb = (a,i) => [...a.slice(i*4,i*4+3)];
const light = c => (Math.max(...c)+Math.min(...c))/2;
for (const color of ['#b8f3df','#c9f2fa','#f6d4e3','#ddd4f4','#f7e5b5','#3366cc','#ffffff','#222222']) {
  const out = recolorPixels(src,color), target = color.slice(1).match(/../g).map(h=>parseInt(h,16));
  assert(rgb(out,0).every((c,k)=>Math.abs(c-target[k])<3), `${color}: 机壳平面接近实际选色`);
  if(color !== '#ffffff') assert(light(rgb(out,1)) >= light(rgb(out,0)), `${color}: 保留高光`);
  assert(light(rgb(out,2)) < light(rgb(out,0)), `${color}: 保留阴影`);
  assert.deepEqual(rgb(out,3),rgb(src,3), '深色屏幕边框不染色');
  assert.deepEqual(rgb(out,4),rgb(src,4), '中性金属不染色');
  assert.deepEqual(rgb(out,5),rgb(src,5), '透明像素不染色');
  for(let i=3;i<src.length;i+=4) assert.equal(out[i],src[i], '透明度原样保留');
  if(color!=='#ffffff') assert(rgb(out,0).some(c=>c<245), '浅色机壳不会整体过曝成白色');
}
assert.deepEqual(src,before,'反复试色不修改原图');
console.log('CCD tint: pastel swatches, highlights/shadows, neutral details, transparency and source immutability checked.');
console.log('1 passed, 0 failed');

// 心屿 · 按配方装配球里的 3D 小世界（three.js）
// 单位：球半径 = 1，岛面在 y ≈ -.12。地形是细分的圆盘（顶点色 + 程序化材质按坡度混草 / 岩 / 雪），建筑和道具来自 kits.js，树和草来自 flora.js
// 所有零件按材质合并（parts.js），一座岛通常只有一二十个网格；建筑和树的影子烘进一张 AO 贴图压在地面上
// 导出 buildWorld(THREE, recipe, opts) → { group, update(t, dt), setWeather(scene), setPixel, fog, night, dispose() }
import { rng } from './gen.js';
import * as M from './mats.js';
import * as PT from './parts.js';
import * as F from './flora.js';
import { KITS, K, setThree as setKitsThree } from './kits.js';
const TAU = Math.PI * 2, KS = 1.3; // 套件整体放大一点，细节看得清

/* ---------- 心情天气 ---------- */
export const WEATHER = {
    sun: { top: '#3f8fe0', hor: '#cfe5f7', sun: [2.2, '#fff4dc', [1, 1.5, .6]], hemi: [.7, '#bfe3ff', '#8a7a60'], fog: 0, night: false, cloud: .35 },
    sunset: { top: '#4d4a9a', hor: '#ffb27a', sun: [1.9, '#ffb070', [1.5, .45, .5]], hemi: [.6, '#ffc9a0', '#6a5a60'], fog: 0, night: false, cloud: .45 },
    rain: { top: '#5b6a80', hor: '#aab5c2', sun: [.6, '#dfe6ee', [.6, 1.4, .8]], hemi: [.6, '#c7d0da', '#5a6068'], fog: .25, night: false, rain: 1, cloud: .9, wet: 1 },
    storm: { top: '#171d2b', hor: '#434c5e', sun: [.4, '#c9d2e0', [.4, 1.2, 1]], hemi: [.45, '#8c98ac', '#3a4048'], fog: .35, night: true, rain: 2, lightning: true, cloud: 1, wet: 1, wind: 1 },
    aurora: { top: '#030818', hor: '#163050', sun: [.35, '#9fb8ff', [-.8, 1.2, .6]], hemi: [.4, '#6f9bd6', '#243040'], fog: 0, night: true, aurora: true, stars: true, moon: true, cloud: .1 },
    night: { top: '#060a20', hor: '#263468', sun: [.4, '#aab8ff', [-.8, 1.3, .7]], hemi: [.4, '#7f94d6', '#242c44'], fog: 0, night: true, stars: true, moon: true, cloud: .25 },
    fog: { top: '#a6b0ba', hor: '#e6eaee', sun: [.7, '#f2f2f2', [.5, 1.2, 1]], hemi: [.7, '#dfe4e8', '#7a8088'], fog: .7, night: false, cloud: .6 },
    fireworks: { top: '#090b28', hor: '#2a2d5e', sun: [.35, '#aab0ff', [-.6, 1.2, .8]], hemi: [.45, '#8d93e8', '#2c2c48'], fog: 0, night: true, stars: true, fireworks: true, cloud: .15 },
};

let T;
const col = c => new T.Color(c);
/** 材质名 → 材质：'wood:x:#8b6a4b' 'paint:#d9534f:1' 'lamp:#ffd36a:1.5:1' 'tile:#4a4d58:70' 'rock:#9a978f' … */
function matFor(key, cache, ao) {
    if (cache.has(key)) return cache.get(key);
    const [kind, a, b, c] = key.split(':'); let m;
    switch (kind) {
        case 'ground': m = M.SURF.ground({}, ao); break;
        case 'sandG': m = M.SURF.sand({}, ao); break;
        case 'snowG': m = M.SURF.snow({}, ao); break;
        case 'rock': m = M.SURF.rock(.5, { color: a, vertexColors: false }); break;
        case 'rockV': m = M.SURF.rock(.7); break;
        case 'sand': m = M.SURF.sand({ color: a, vertexColors: false }); break;
        case 'wood': m = M.SURF.wood(a, b, +c || 0); break;
        case 'lacquer': m = M.SURF.lacquer(a); break;
        case 'plaster': m = M.SURF.plaster(a); break;
        case 'concrete': m = M.SURF.concrete(a); break;
        case 'asphalt': m = M.SURF.asphalt(); break;
        case 'tile': m = M.SURF.tile(a, +b || 70); break;
        case 'gold': m = M.SURF.gold(a); break;
        case 'metal': m = M.SURF.metal(a); break;
        case 'paint': m = M.SURF.paint(a, +b); break;
        case 'glass': m = M.SURF.glass(); break;
        case 'lamp': m = M.SURF.lamp(a, +b || 1, +c || 0); break;
        case 'beam': m = new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, uniforms: { o: { value: 0 } }, vertexShader: 'varying float v;void main(){v=uv.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: 'uniform float o;varying float v;void main(){gl_FragColor=vec4(1.,.9,.6,(1.-v)*.35*o);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}' }); break;
        default: m = M.SURF.paint('#ff00ff', 0);
    }
    cache.set(key, m); return m;
}

/* ---------- 噪声（CPU，做山丘和岩壁） ---------- */
const noise2 = seed => { const r = rng(seed), g = Array.from({ length: 64 }, () => r() * TAU); const grad = (ix, iz) => g[((ix * 7 + iz * 13) & 63)]; const dot = (ix, iz, x, z) => { const a = grad(ix, iz); return (x - ix) * Math.cos(a) + (z - iz) * Math.sin(a); }; const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
    return (x, z) => { const x0 = Math.floor(x), z0 = Math.floor(z), u = fade(x - x0), v = fade(z - z0); const lerp = (a, b, t) => a + (b - a) * t; return lerp(lerp(dot(x0, z0, x, z), dot(x0 + 1, z0, x, z), u), lerp(dot(x0, z0 + 1, x, z), dot(x0 + 1, z0 + 1, x, z), u), v); }; };

/* ---------- 地形 ---------- */
function diskGeo(R, rings, segs, h, colorAt) {
    const pos = [], colr = [], idx = [];
    for (let i = 0; i <= rings; i++) { const rr = R * (i / rings) ** .9; for (let j = 0; j < (i ? segs : 1); j++) { const a = j / segs * TAU, x = Math.cos(a) * rr, z = Math.sin(a) * rr; pos.push(x, h(x, z), z); const c = colorAt(x, z, rr / R); colr.push(c.r, c.g, c.b); } }
    const at = (i, j) => i ? 1 + (i - 1) * segs + (j % segs) : 0;
    for (let i = 1; i <= rings; i++) for (let j = 0; j < segs; j++) { const a = at(i, j), b = at(i, j + 1), c = at(i - 1, j), d = at(i - 1, j + 1); i == 1 ? idx.push(a, c, b) : idx.push(a, c, b, b, c, d); }
    const g = new T.BufferGeometry(); g.setIndex(idx); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(colr, 3)); g.computeVertexNormals(); return g;
}
/** 岛身：从边沿往下收成一个尖（浮岛）或一小截崖壁（高原 / 海岛），岩壁带分层起伏 */
function bodyGeo(R, top, depth, segs, n, c1, c2) {
    const pos = [], colr = [], idx = [], rings = depth > .3 ? 10 : 4, C1 = col(c1), C2 = col(c2);
    for (let i = 0; i <= rings; i++) { const t = i / rings, rr = R * (1 - t) ** (depth > .3 ? .65 : .15), y = top - depth * (t ** .9); for (let j = 0; j < segs; j++) { const a = j / segs * TAU, w = i && i < rings ? 1 + n(Math.cos(a) * 3 + i * .7, Math.sin(a) * 3) * .3 + n(Math.cos(a) * 9, Math.sin(a) * 9 + i) * .1 : 1; pos.push(Math.cos(a) * rr * w, y + (i && i < rings ? n(a * 2, i) * .01 : 0), Math.sin(a) * rr * w); const c = C1.clone().lerp(C2, t); colr.push(c.r, c.g, c.b); } }
    for (let i = 0; i < rings; i++) for (let j = 0; j < segs; j++) { const a = i * segs + j, b = i * segs + (j + 1) % segs, c = a + segs, d = b + segs; idx.push(a, b, c, b, d, c); }
    const g = new T.BufferGeometry(); g.setIndex(idx); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(colr, 3)); g.computeVertexNormals(); return g;
}
function terrain(rc, n, mats, ao) {
    const { terrain: tt, R, pal } = rc, sea = tt === 'sea' || tt === 'atoll', TOP = -.12, g = new T.Group(), desert = rc.climate === 'desert';
    const hill = tt === 'plateau' ? .014 : tt === 'floating' ? .035 : .022;
    const h = (x, z) => { const d = Math.hypot(x, z) / R; const base = n(x * 4 + 9, z * 4) * hill + n(x * 9, z * 9 + 3) * hill * .4 + n(x * 20, z * 20) * hill * .12; const edge = tt === 'plateau' ? Math.max(0, d - .8) * .08 : 0; const lake = tt === 'lake' ? -Math.max(0, .4 - d) * .25 : 0; return base * (1 - d * d * .5) + edge + lake; };
    const G = col(pal.ground), GD = col(pal.groundDark), S = col(pal.sand), CL = col(pal.cliffDark), SN = col('#eef2f8');
    const groundCol = (x, z, d) => { const v = n(x * 12, z * 12) * .5, w = n(x * 5 + 3, z * 5) * .5; if (rc.snowy) return d > .93 ? CL : SN; if (desert) return S.clone().lerp(col('#c9a26a'), Math.max(0, v)); if (sea) return d > .72 ? S : G.clone().lerp(GD, Math.max(0, v + .2)); if (tt === 'lake' && Math.hypot(x, z) / R < .42) return S; return (d > .95 ? CL : G.clone().lerp(GD, Math.max(0, v * .8 + w * .4))); };
    const islands = tt === 'twin' ? [[-.36, .1, R], [.36, -.12, R * .8]] : [[0, 0, R]];
    const gm = desert ? 'sandG' : rc.snowy ? 'snowG' : 'ground';
    for (const [ox, oz, r] of islands) {
        const top = new T.Mesh(diskGeo(r, 26, 72, (x, z) => h(x, z), groundCol), matFor(gm, mats, ao)); top.position.set(ox, TOP, oz); top.receiveShadow = true; top.castShadow = false; g.add(top);
        const depth = tt === 'floating' || tt === 'twin' ? .5 + r * .3 : sea ? .1 : .16;
        const body = new T.Mesh(bodyGeo(r * .995, TOP - .003, depth, 72, n, pal.cliff, tt === 'floating' || tt === 'twin' ? '#2f2622' : pal.cliffDark), matFor('rockV', mats)); body.position.set(ox, 0, oz); body.castShadow = body.receiveShadow = true; g.add(body);
        if (tt === 'floating' || tt === 'twin') for (let i = 0; i < 4; i++) { const s = new T.Mesh(new T.SphereGeometry(.05 + i * .01, 7, 5), matFor('rock:' + pal.cliffDark, mats)); s.scale.set(1.3, .8, 1); s.position.set(ox + n(i * 3, 7) * .6 * r, TOP - .25 - i * .12, oz + n(i * 5, 2) * .6 * r); s.userData.float = { y: s.position.y, ph: i }; g.add(s); }
    }
    g.userData = { h, TOP, islands };
    return g;
}
/** 烘焙 AO：建筑和树脚下的阴影画到 canvas 上 */
function bakeAO(rc) {
    const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, S, S);
    const R = rc.R * 1.02, px = (v) => (v / R * .5 + .5) * S;
    const blob = (cx, cz, rad, a) => { const g = x.createRadialGradient(px(cx), px(cz), 0, px(cx), px(cz), rad / R * .5 * S); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(.6, `rgba(0,0,0,${a * .35})`); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, S, S); };
    const FOOT = { temple: .34, street: .36, school: .32, hospital: .28, shrine: .26, pagoda: .18, castle: .22, cafe: .2, izakaya: .18, station: .28, ferris: .2, lighthouse: .12, windmill: .12, tower: .11, observatory: .12, cabin: .16, house: .15, tent: .1, pyramid: .2, pond: .14, hotspring: .1, crater: .18 };
    for (const it of rc.items) { const f = FOOT[it.type]; if (f) blob(it.x, it.z, f * it.s, .75); else if (/^(broad|maple|sakura|pine|palm|cypress|bamboo|mushroom|bush)$/.test(it.type)) blob(it.x, it.z, .09 * it.s, .45); else if (it.type === 'rock') blob(it.x, it.z, .05 * it.s, .4); }
    const t = new T.CanvasTexture(c); t.colorSpace = T.NoColorSpace; t.flipY = false; return { tex: t, R };
}

/* ---------- 天空 ---------- */
function sky(rc) {
    const sea = rc.terrain === 'sea' || rc.terrain === 'atoll';
    const u = { top: { value: col('#4da3f0') }, hor: { value: col('#cfe9ff') }, bot: { value: col(sea ? rc.pal.waterDeep : '#3a3f55') }, wl: { value: sea ? -.15 : -3 }, sun: { value: new T.Vector3(1, 1, 0) }, sunc: { value: col('#fff4dc') }, sunk: { value: 1 }, cloud: { value: .4 }, t: M.U.uTime, stars: { value: 0 }, night: { value: 0 } };
    const m = new T.ShaderMaterial({ uniforms: u, side: T.BackSide, vertexShader: 'varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader: `${M.NOISE_GLSL}uniform vec3 top,hor,bot,sun,sunc;uniform float wl,sunk,cloud,t,stars,night;varying vec3 p;
        void main(){vec3 n=normalize(p);vec3 L=normalize(sun);
          vec3 c=mix(hor,top,pow(smoothstep(-.05,.6,n.y),.7));
          if(n.y<wl)c=bot;else if(n.y<wl+.08)c=mix(bot,hor,smoothstep(wl,wl+.08,n.y));
          float s=max(0.,dot(n,L));c+=sunc*(pow(s,600.)*3.+pow(s,24.)*.6+pow(s,4.)*.18)*sunk;
          // 星星
          vec3 cell=floor(n*90.);float st=pow(n_h13(cell),220.)*stars*smoothstep(0.,.15,n.y);st*=.5+.5*sin(t*2.+n_h13(cell+1.)*20.);c+=vec3(st*2.5);
          // 云层：按方向投到一个高度平面上取噪声
          if(n.y>.02){vec2 q=n.xz/(n.y+.12);float d=n_fbm(vec3(q*1.6+vec2(t*.012,0.),2.),4)*.5+.5;float cv=smoothstep(1.-cloud*.95,1.02-cloud*.55,d);
            vec3 lit=mix(hor,vec3(1.),.6)*(1.-night*.75);vec3 shade=mix(top,hor,.4)*(1.-night*.6);float sl=.5+.5*dot(normalize(vec3(q.x,1.,q.y)),L);
            vec3 cc=mix(shade,lit,sl)*(.75+.35*d);cc+=sunc*pow(s,8.)*.3*sunk;c=mix(c,cc,cv*smoothstep(.02,.18,n.y)*.95);}
          gl_FragColor=vec4(c,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>}` });
    const o = new T.Mesh(new T.SphereGeometry(.985, 40, 24), m); o.renderOrder = -10; o.userData.u = u; return o;
}
function aurora() {
    const g = new T.Group(); for (let b = 0; b < 3; b++) { const geo = new T.PlaneGeometry(1.5, .22, 40, 1); const m = new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, uniforms: { t: { value: 0 }, o: { value: 0 }, c: { value: col(['#78ebbe', '#a0c8eb', '#c8aae1'][b]) }, k: { value: b } }, vertexShader: 'uniform float t,k;varying vec2 vu;void main(){vu=uv;vec3 p=position;p.y+=sin(p.x*5.+t*.8+k)*.05;p.z+=cos(p.x*3.+t*.5+k)*.03;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}', fragmentShader: 'uniform vec3 c;uniform float o,t;varying vec2 vu;void main(){float a=sin(vu.y*3.14159)*(.5+.5*sin(vu.x*20.+t*2.))*smoothstep(0.,.15,vu.x)*smoothstep(1.,.85,vu.x);gl_FragColor=vec4(c,a*.45*o);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}' }); const p = new T.Mesh(geo, m); p.position.set(0, .5 + b * .08, -.55); p.rotation.x = .3; p.userData.u = m.uniforms; g.add(p); } return g;
}
let glowTex, petalTex, dotTex;
const canvasTex = (draw, size = 64) => { const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; };
const textures = () => {
    glowTex ||= canvasTex((x, s) => { const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, s, s); });
    dotTex ||= canvasTex((x, s) => { const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.7, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, s, s); }, 32);
    petalTex ||= canvasTex((x, s) => { x.translate(s / 2, s / 2); x.rotate(.6); x.fillStyle = '#fff'; x.beginPath(); x.ellipse(0, 0, s * .42, s * .22, 0, 0, TAU); x.fill(); }, 32);
};
const glow = (c, size, x, y, z, a = .9) => { const s = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: c, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: a })); s.scale.set(size, size, 1); s.position.set(x, y, z); return s; };
function particles(kind, count) {
    const pos = new Float32Array(count * 3), ph = new Float32Array(count), sp = new Float32Array(count), r = Math.random;
    for (let i = 0; i < count; i++) { pos.set([(r() * 2 - 1), 0, (r() * 2 - 1)], i * 3); ph[i] = r() * 2.4; sp[i] = .5 + r(); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('ph', new T.BufferAttribute(ph, 1)); g.setAttribute('sp', new T.BufferAttribute(sp, 1));
    const cfg = { rain: { c: '#dfeaff', sz: 1.6, v: 1.6, sway: 0, tex: dotTex, a: .55 }, snow: { c: '#ffffff', sz: 3.2, v: .22, sway: .08, tex: dotTex, a: .9 }, petal: { c: '#f8c1d2', sz: 4.5, v: .25, sway: .14, tex: petalTex, a: .95 }, leaf: { c: '#e8743b', sz: 4.2, v: .3, sway: .12, tex: petalTex, a: .95 }, ash: { c: '#c8c0b8', sz: 2.4, v: -.12, sway: .05, tex: dotTex, a: .6 }, spore: { c: '#d8b4ff', sz: 2.6, v: -.06, sway: .1, tex: dotTex, a: .8 }, firefly: { c: '#d9ff6a', sz: 3.5, v: -.03, sway: .2, tex: glowTex, a: 1 } }[kind];
    const m = new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: kind === 'firefly' ? T.AdditiveBlending : T.NormalBlending, uniforms: { t: { value: 0 }, o: { value: 1 }, c: { value: col(cfg.c) }, sz: { value: cfg.sz }, v: { value: cfg.v }, sway: { value: cfg.sway }, tex: { value: cfg.tex }, px: { value: 2 }, lo: { value: kind === 'firefly' ? -.3 : -1.2 } },
        vertexShader: `attribute float ph,sp;uniform float t,v,sway,sz,px,lo;varying float a;void main(){float y=1.2-mod(t*v*sp+ph,2.4);if(v<0.)y=lo+mod(t*(-v)*sp+ph,1.6);float x=position.x+sin(t*1.3+ph*7.)*sway;float z=position.z+cos(t*1.1+ph*5.)*sway;vec3 p=vec3(x,y,z);float d=length(p);a=step(d,.97)*(.5+.5*sin(t*3.+ph*9.));if(v>0.)a=step(d,.97);gl_PointSize=sz*px*(.7+.3*sp);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
        fragmentShader: `uniform sampler2D tex;uniform vec3 c;uniform float o;varying float a;void main(){vec4 s=texture2D(tex,gl_PointCoord);gl_FragColor=vec4(c,s.a*a*o*${cfg.a.toFixed(2)});\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}` });
    const p = new T.Points(g, m); p.frustumCulled = false; p.userData.u = m.uniforms; return p;
}

/**
 * @param {object} THREE three.js 模块
 * @param {object} rc gen.js 的配方
 * @param {{quality:string, reduced:boolean}} opts
 */
export function buildWorld(THREE, rc, { quality = 'high', reduced = false, renderer = null } = {}) {
    T = THREE; M.setThree(T); PT.setThree(T); F.setThree(T); setKitsThree(T); textures(); const hi = quality === 'high'; M.setLow(!hi);
    const group = new T.Group(), n = noise2(rc.seed), r = rng(rc.seed + 1), sea = rc.terrain === 'sea' || rc.terrain === 'atoll', mats = new Map();
    const ao = bakeAO(rc), land = terrain(rc, n, mats, ao); group.add(land); const { h, TOP, islands } = land.userData;
    const hAt = (x, z) => { let best = null; for (const [ox, oz, rr] of islands) { const d = Math.hypot(x - ox, z - oz); if (d < rr && (!best || d < best.d)) best = { d, ox, oz, r: rr }; } return best ? TOP + h(x - best.ox, z - best.oz) : TOP; };
    const onLand = (x, z) => islands.some(([ox, oz, rr]) => Math.hypot(x - ox, z - oz) < rr * .97);
    const anim = [], movers = []; // 每帧要动的东西
    const acc = new PT.Acc(), lv = new F.Leaves();
    /* 水 */
    const waters = [];
    const water = (radius, y, o) => { const w = new T.Mesh(new T.CircleGeometry(radius, 64).rotateX(-Math.PI / 2), M.waterMat({ c1: o.shallow ? '#7fd6e8' : rc.pal.water, c2: o.shallow ? '#4fb8d4' : rc.pal.waterDeep, radius, ring: o.ring || 0, amp: o.shallow ? .004 : .012 })); w.position.y = y; w.renderOrder = 2; waters.push(w); return w; };
    if (sea) { group.add(water(.975, -.15, { ring: rc.R + .03 })); if (rc.terrain === 'atoll') { const ring = new T.Mesh(new T.RingGeometry(rc.R + .12, rc.R + .3, 64).rotateX(-Math.PI / 2), matFor('sand:' + rc.pal.sand, mats)); ring.position.y = -.145; ring.receiveShadow = true; group.add(ring); group.add(water(rc.R + .12, -.142, { shallow: true })); } }
    if (rc.terrain === 'lake') group.add(water(rc.R * .4, TOP - .02, { shallow: true }));
    /* 哪些地方不长草：建筑、池塘、小路 */
    const bare = []; const FOOT = { temple: .17, street: .26, school: .19, hospital: .16, shrine: .13, pagoda: .1, castle: .12, cafe: .11, izakaya: .1, station: .16, ferris: .1, lighthouse: .09, windmill: .07, tower: .06, observatory: .07, cabin: .1, house: .09, tent: .07, pyramid: .11, pond: .12, hotspring: .09, crater: .14, bonfire: .05 };
    for (const it of rc.items) if (FOOT[it.type]) bare.push([it.x, it.z, FOOT[it.type] * it.s]);
    const grassOk = (x, z) => onLand(x, z) && !(rc.terrain === 'lake' && Math.hypot(x, z) < rc.R * .44) && !(sea && Math.hypot(x, z) > rc.R * .72) && !bare.some(([bx, bz, br]) => Math.hypot(x - bx, z - bz) < br);
    /* 小路（踏脚石）、小溪、灯笼串 */
    if (rc.extras.includes('path') && !sea) { const a0 = r() * TAU; for (let i = 0; i < 11; i++) { const d = .15 + i * .075, a = a0 + Math.sin(i * .9) * .25, x = Math.cos(a) * d * rc.R, z = Math.sin(a) * d * rc.R; if (!onLand(x, z)) continue; bare.push([x, z, .03]); acc.put('sph', 'rock:' + (rc.snowy ? '#aab4c0' : '#c9b99a'), [x, hAt(x, z) - .006, z], [.022 * (1 + r() * .3), .008, .017], [0, a, 0], null, 8); } }
    if (rc.extras.includes('river') && !sea) { const a0 = r() * TAU; for (let i = 0; i < 12; i++) { const d = .05 + i * .085, a = a0 + Math.sin(i * .7) * .3, x = Math.cos(a) * d * rc.R, z = Math.sin(a) * d * rc.R; if (!onLand(x, z)) continue; bare.push([x, z, .035]); acc.put('cyl', 'paint:#5fc3dd:1', [x, hAt(x, z) + .002, z], [.034, .004, .024], [0, a, 0], null, 10); for (let k = 0; k < 2; k++) acc.put('sph', 'rock:#8a8580', [x + (r() - .5) * .05, hAt(x, z), z + (r() - .5) * .05], [.008, .005, .007], [0, r() * 3, 0], null, 5); } }
    if (rc.extras.includes('lanterns') && !sea) { const kk = K(acc, k => matFor(k, mats)), a0 = r() * TAU; for (let i = 0; i < 6; i++) { const a = a0 + i * .35, d = rc.R * .82, x = Math.cos(a) * d, z = Math.sin(a) * d; if (!onLand(x, z)) continue; const y = hAt(x, z); kk.cyl('wood:y:#4a3626', x, y + .05, z, .003, .1, 5); kk.paperLamp(x, y + .085, z, i % 2 ? '#ff7a5c' : '#ffd27a', .008); } }
    /* 零件：树、灌木、建筑 */
    for (const it of rc.items) {
        const p = new T.Vector3(it.x, hAt(it.x, it.z), it.z), tr = /^(broad|maple|sakura|pine|palm|cypress|bamboo)$/.test(it.type);
        if (tr) { F.tree(acc, lv, rng(it.k), it.type, { p, h: (it.type === 'palm' ? .3 : it.type === 'pine' || it.type === 'cypress' ? .32 : it.type === 'bamboo' ? .3 : .26) * it.s, col: rc.pal.foliage }); continue; }
        if (it.type === 'bush') { F.bush(lv, rng(it.k), p, rc.pal.foliage, rc.climate === 'sakura' ? 'blossom' : 'broad', .045 * it.s); continue; }
        if (it.type === 'cactus') { F.cactus(acc, rng(it.k), p, .12 * it.s); continue; }
        if (it.type === 'mushroom') { F.mushroom(acc, rng(it.k), p, .1 * it.s, ['#e84c5a', '#f4a259', '#9b6bd6'][it.k % 3], rc.glow); continue; }
        const kit = KITS[it.type]; if (!kit) continue;
        const ks = it.s * KS, base = PT.mat4(it.x, p.y, it.z, ks, ks, ks, 0, it.rot, 0), n0 = acc.extra.length;
        kit(K(acc, k => matFor(k, mats), base), rc, rng(it.k));
        for (let i = n0; i < acc.extra.length; i++) { const mv = acc.extra[i], wrap = new T.Group(); wrap.applyMatrix4(base); const at = mv.userData.at || [0, mv.userData.y || 0, 0]; mv.position.set(...at); wrap.add(mv); group.add(wrap); movers.push(mv); }
        acc.extra.length = n0;
        // 池塘 / 温泉的水面
        if (it.type === 'pond' || it.type === 'hotspring') { const w = water(it.type === 'pond' ? .11 * it.s : .07 * it.s, p.y + .004, { shallow: true }); w.position.x = it.x; w.position.z = it.z; group.add(w); if (it.type === 'hotspring') { const st = glow('#ffffff', .18, it.x, p.y + .06, it.z, .35); st.userData.steam = { y: p.y + .06 }; group.add(st); anim.push(st); } }
    }
    if (rc.extras.includes('bridge') && rc.terrain === 'twin') { const base = PT.mat4(0, TOP + .01, 0, 1, 1, 1, 0, Math.atan2(-.22, .72), 0); KITS.bridge(K(acc, k => matFor(k, mats), base), rc, r); }
    /* 草、野花 */
    if (!rc.snowy && rc.climate !== 'desert' && !rc.lava) { const gr = F.grass(r, hi ? 2600 : 900, hAt, rc.R, grassOk, rc.pal.grass[0], rc.pal.grass[1]); group.add(gr); }
    if (rc.extras.includes('flowers') && !sea && !rc.snowy) F.flowers(lv, r, rc.climate === 'lavender' ? 260 : 90, hAt, rc.R, grassOk, rc.climate === 'lavender' ? ['#9b7fd6', '#8a6fc9', '#b39ae6'] : ['#ffe27a', '#f6a3b4', '#ffffff', '#b9a3e8', '#ff8a65']);
    /* 合并 */
    const solid = acc.build(Object.fromEntries(mats), k => matFor(k, mats)); group.add(solid); const leaves = lv.build(); group.add(leaves);
    const halos = (acc.glows || []).map(g => { const sp = glow(g.c, g.size, g.x, g.y, g.z, g.a); sp.userData.always = g.c === '#ffa040'; group.add(sp); return sp; });
    /* 动物、船 */
    const mover = (type, data) => { const a = new PT.Acc(); KITS[type](K(a, k => matFor(k, mats)), rc, r); const g = a.build({}, k => matFor(k, mats)); Object.assign(g.userData, data); group.add(g); movers.push(g); return g; };
    if (rc.animals.includes('whale') && (sea || rc.terrain === 'lake')) { const a = new PT.Acc(), kk = K(a, k => matFor(k, mats)); const b = 'paint:#4a7fc4:0'; kk.sph(b, 0, 0, 0, .05, 10, [1.9, .8, 1]); kk.put('cone', b, [-.1, .005, 0], [.02, .05, .02], [0, 0, Math.PI / 2 + .3], null, 6); kk.box(b, -.13, .01, 0, .04, .008, .06); kk.sph('paint:#ffffff:0', .03, .012, .03, .006, 5); kk.sph('paint:#dff2ff:0', 0, .035, 0, .02, 6, [.4, 1.2, .4]); const g = a.build({}, k => matFor(k, mats)); g.userData.orbit = { r: sea ? .62 : rc.R * .2, y: sea ? -.15 : TOP - .02, v: .25, a: 0, bob: 1 }; group.add(g); movers.push(g); }
    if (rc.animals.includes('birds')) for (let i = 0; i < 3; i++) { const a = new PT.Acc(), kk = K(a, k => matFor(k, mats)); for (const s of [-1, 1]) kk.put('box', 'paint:#3b3a40:0', [s * .01, 0, 0], [.02, .002, .006], [0, 0, s * .5]); const g = a.build({}, k => matFor(k, mats)); g.userData.fly = { a: i * 2.1, r: .5 + i * .08, y: .35 + i * .06, v: .5 + i * .1 }; group.add(g); movers.push(g); }
    if (rc.extras.includes('boat') && (sea || rc.terrain === 'lake')) mover('boat', { orbit: { r: sea ? .55 : rc.R * .25, y: sea ? -.15 : TOP - .02, v: .12, a: 2 } });
    /* 天空和天气 */
    const skyM = sky(rc), au = aurora(); group.add(skyM, au);
    const moon = glow('#fff6cf', .22, -.5, .62, -.5, 1); moon.material.blending = T.NormalBlending; group.add(moon);
    const sunGlow = glow('#fff1b0', .9, .55, .6, -.5, .45); group.add(sunGlow);
    const parts = {}; const addP = (k, c) => { parts[k] = particles(k, reduced ? c / 3 | 0 : c); parts[k].visible = false; group.add(parts[k]); };
    addP('rain', 220); addP('snow', 160); if (rc.fall === 'petal') addP('petal', 90); if (rc.fall === 'leaf') addP('leaf', 90); if (rc.fall === 'ash') addP('ash', 80); if (rc.fall === 'spore') addP('spore', 70); if (rc.extras.includes('fireflies')) addP('firefly', 40);
    /* 灯光 */
    const hemi = new T.HemisphereLight('#bfe3ff', '#8a7a60', .9), sun = new T.DirectionalLight('#fff4dc', 2), amb = new T.AmbientLight('#ffffff', .12);
    sun.position.set(1, 1.6, .6); sun.castShadow = true; sun.shadow.mapSize.set(hi ? 2048 : 1024, hi ? 2048 : 1024); Object.assign(sun.shadow.camera, { left: -1, right: 1, top: 1, bottom: -1, near: .1, far: 5 }); sun.shadow.bias = -.0006; sun.shadow.normalBias = .006; sun.shadow.radius = 2;
    const lampLight = new T.PointLight('#ffd36a', 0, 1.2, 2); const mk = rc.items.find(i => i.type === rc.mark); lampLight.position.set(mk?.x || 0, TOP + .25, mk?.z || 0);
    group.add(hemi, sun, sun.target, amb, lampLight);
    /* 烟花 / 闪电 */
    const fw = []; const fwGeo = new T.BufferGeometry(); fwGeo.setAttribute('position', new T.BufferAttribute(new Float32Array(600 * 3), 3)); fwGeo.setAttribute('color', new T.BufferAttribute(new Float32Array(600 * 3), 3)); const fwP = new T.Points(fwGeo, new T.PointsMaterial({ size: .012, vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false, map: dotTex })); fwP.frustumCulled = false; fwP.visible = false; group.add(fwP);
    const bolt = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3()]), new T.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0 })); group.add(bolt);

    let W = WEATHER.sunset, flash = 0, nextBolt = 2;
    const U = M.U, wv = new T.Vector3(), wt = new T.Vector3();
    // 环境光照：按天气从天空颜色烤一张小环境图给岛上的 PBR 材质（不用球外那个亮房间，否则夜里也亮得像白天）
    const envScene = new T.Scene(), envU = { top: { value: col('#4da3f0') }, hor: { value: col('#cfe9ff') }, bot: { value: col('#3a3f55') }, sun: { value: new T.Vector3(1, 1, 0) }, sunc: { value: col('#fff4dc') }, sunk: { value: 1 } };
    envScene.add(new T.Mesh(new T.SphereGeometry(5, 16, 8), new T.ShaderMaterial({ side: T.BackSide, uniforms: envU, vertexShader: 'varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: 'uniform vec3 top,hor,bot,sun,sunc;uniform float sunk;varying vec3 p;void main(){vec3 n=normalize(p);vec3 c=n.y<0.?mix(hor,bot,smoothstep(0.,-.4,n.y)):mix(hor,top,smoothstep(0.,.6,n.y));float s=max(0.,dot(n,normalize(sun)));c+=sunc*(pow(s,40.)*2.+pow(s,4.)*.3)*sunk;gl_FragColor=vec4(c,1.);}' })));
    let envTex = null; const pm = renderer ? new T.PMREMGenerator(renderer) : null;
    const allMats = () => { const out = [...mats.values()]; group.traverse(o => { if (o.userData.leaves || o.isInstancedMesh) out.push(o.material); }); return out; };
    const bakeEnv = () => { if (!pm) return; const old = envTex; envU.top.value.set(W.top); envU.hor.value.set(W.hor); envU.bot.value.set(W.hemi[2]); envU.sun.value.set(...W.sun[2]); envU.sunc.value.set(W.sun[1]); envU.sunk.value = W.night ? 0 : W.sun[0] * .4; envTex = pm.fromScene(envScene, .04).texture; for (const m of allMats()) if ('envMap' in m) { m.envMap = envTex; m.envMapIntensity = W.night ? .45 : W.fog ? .7 : 1; m.needsUpdate = m.envMap !== envTex; } old?.dispose(); };
    function setWeather(scene) {
        W = WEATHER[scene] || WEATHER.sunset; const u = skyM.userData.u;
        u.top.value.set(W.top); u.hor.value.set(W.hor); u.sun.value.set(...W.sun[2]); u.sunc.value.set(W.sun[1]); u.sunk.value = W.night ? 0 : scene === 'fog' ? .3 : 1; u.cloud.value = W.cloud ?? .4; u.stars.value = W.stars ? 1 : 0; u.night.value = W.night ? 1 : 0;
        sun.color.set(W.sun[1]); sun.intensity = W.sun[0]; sun.position.set(...W.sun[2]).multiplyScalar(2); hemi.intensity = W.hemi[0]; hemi.color.set(W.hemi[1]); hemi.groundColor.set(W.hemi[2]); amb.intensity = W.night ? .06 : .12;
        U.uSunCol.value.set(W.sun[1]).multiplyScalar(Math.min(1.2, W.sun[0] * .6)); U.uWet.value = W.wet ? 1 : 0; U.uWind.value = W.wind ? 1 : W.rain ? .5 : .2; U.uSnow.value = rc.snowy ? 1 : 0;
        au.children.forEach(a => a.userData.u.o.value = W.aurora ? 1 : 0); moon.visible = !!W.moon; sunGlow.visible = !W.night && scene !== 'fog' && scene !== 'rain'; sunGlow.position.set(...W.sun[2]).normalize().multiplyScalar(.82); sunGlow.material.color.set(scene === 'sunset' ? '#ffb070' : '#fff1b0'); sunGlow.scale.setScalar(scene === 'sunset' ? 1.2 : .9);
        const lit = W.night || scene === 'rain' || scene === 'fog'; U.uLit.value = lit ? 1 : 0; lampLight.intensity = lit ? .8 : 0; halos.forEach(h => h.visible = lit || h.userData.always);
        for (const k in parts) parts[k].visible = false; if (W.rain) parts.rain.visible = true; if (rc.snowy) parts.snow.visible = true; if (rc.fall && parts[rc.fall] && !W.rain) parts[rc.fall].visible = true; if (parts.firefly) parts.firefly.visible = !!W.night && !W.rain;
        if (parts.rain) parts.rain.userData.u.v.value = W.rain === 2 ? 2.6 : 1.6;
        waters.forEach(w => { w.material.uniforms.sky.value.set(W.hor).lerp(col(W.top), .5); w.material.uniforms.night.value = W.night ? 1 : 0; });
        group.userData.fogDensity = W.fog; fwP.visible = !!W.fireworks; group.userData.night = !!W.night; bakeEnv();
    }
    let px = 2; const setPixel = v => { px = v; for (const k in parts) parts[k].userData.u.px.value = v; };
    function update(t, dt) {
        U.uTime.value = t;
        // 太阳在世界坐标里的方向（整座岛会跟着球转）
        sun.getWorldPosition(wv); sun.target.getWorldPosition(wt); U.uSunDir.value.copy(wv.sub(wt).normalize());
        for (const o of movers) {
            const d = o.userData;
            if (d.spin) { o.rotation[d.spin] = t * d.v; }
            if (d.swing) o.rotation.x = Math.sin(t * 1.6) * .35;
            if (d.flame) { o.scale.set(1 + Math.sin(t * 11) * .15, 1 + Math.sin(t * 13) * .25, 1 + Math.cos(t * 9) * .15); }
            if (d.beam) { o.rotation.y = t * 1.2; o.children.forEach(c => c.material.uniforms && (c.material.uniforms.o.value = (W.night || W.fog || W.rain) ? 1 : 0)); }
            if (d.drive && !d.park) { const dr = d.drive, dir = Math.abs(dr.ry) > 1 ? -1 : 1; o.position.set(dr.x + dir * ((t * dr.v) % dr.len - dr.len / 2), 0, dr.z); o.rotation.y = dr.ry; } else if (d.drive) { o.position.set(d.drive.x, 0, d.drive.z); o.rotation.y = d.drive.ry; }
            if (d.orbit) { const ob = d.orbit; ob.a += dt * ob.v; o.position.set(Math.cos(ob.a) * ob.r, ob.y + (ob.bob ? Math.max(0, Math.sin(t * .8)) * .03 : 0), Math.sin(ob.a) * ob.r); o.rotation.y = -ob.a + Math.PI; }
            if (d.fly) { const f = d.fly; f.a += dt * f.v; o.position.set(Math.cos(f.a) * f.r, f.y + Math.sin(t * 2 + f.a) * .02, Math.sin(f.a) * f.r); o.rotation.y = -f.a; o.rotation.z = Math.sin(t * 9) * .4; }
        }
        for (const o of anim) { if (o.userData.steam) o.position.y = o.userData.steam.y + (t * .05 % .08); }
        land.children.forEach(c => { if (c.userData.float) c.position.y = c.userData.float.y + Math.sin(t * .7 + c.userData.float.ph) * .02; });
        au.children.forEach(a => a.userData.u.t.value = t); for (const k in parts) parts[k].userData.u.t.value = t;
        if (W.fireworks) { if (fw.length < 540 && Math.random() < .04) { const a = Math.random() * TAU, o = [Math.cos(a) * .45, .35 + Math.random() * .3, Math.sin(a) * .35], c = col(`hsl(${Math.random() * 360 | 0},90%,70%)`); for (let i = 0; i < 30; i++) { const th = Math.random() * TAU, ph = Math.acos(2 * Math.random() - 1), v = .25 + Math.random() * .15; fw.push({ p: [...o], v: [Math.sin(ph) * Math.cos(th) * v, Math.cos(ph) * v, Math.sin(ph) * Math.sin(th) * v], l: 1.2, c }); } }
            const pa = fwGeo.attributes.position.array, ca = fwGeo.attributes.color.array; let k = 0; for (let i = fw.length - 1; i >= 0; i--) { const f = fw[i]; f.l -= dt; if (f.l <= 0) { fw.splice(i, 1); continue; } f.v[1] -= dt * .25; f.p[0] += f.v[0] * dt; f.p[1] += f.v[1] * dt; f.p[2] += f.v[2] * dt; pa.set(f.p, k * 3); ca.set([f.c.r * f.l, f.c.g * f.l, f.c.b * f.l], k * 3); k++; } fwGeo.setDrawRange(0, k); fwGeo.attributes.position.needsUpdate = true; fwGeo.attributes.color.needsUpdate = true; }
        if (W.lightning) { nextBolt -= dt; if (nextBolt <= 0) { nextBolt = 2 + Math.random() * 4; flash = 1; const pts = [new T.Vector3((Math.random() - .5) * .8, .9, -.3)]; for (let i = 1; i < 6; i++) pts.push(new T.Vector3(pts[i - 1].x + (Math.random() - .5) * .15, .9 - i * .17, -.3)); bolt.geometry.setFromPoints(pts); } if (flash > 0) { flash -= dt * 5; bolt.material.opacity = Math.max(0, flash); hemi.intensity = W.hemi[0] + Math.max(0, flash) * 1.2; } }
        else if (bolt.material.opacity) { bolt.material.opacity = 0; }
    }
    setWeather('sunset');
    const stats = () => ({ tris: acc.tris, leaves: lv.count, meshes: solid.children.length + leaves.children.length, mats: mats.size });
    return { group, update, setWeather, setPixel, stats, get fog() { return W.fog; }, get night() { return !!W.night; }, dispose: () => { group.traverse(o => { o.geometry?.dispose?.(); if (o.material && !o.userData.mk) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose?.()); }); mats.forEach(m => m.dispose()); ao.tex.dispose(); envTex?.dispose(); pm?.dispose(); } };
}

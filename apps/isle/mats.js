// 心屿 · 材质：不用一张贴图，表面细节（草、土、岩石的斑点和苔藓、木纹、瓦楞、鎏金的氧化…）都是噪声在着色器里算出来的
// 做法：往 three.js 自带的 PBR 材质里注入 GLSL，光照、阴影、环境反射都还是 three.js 的
// 为了打开快：所有实体表面共用「一个」着色器程序（SOLID），用 uniform uSurf 选是草还是木头还是瓦——
//   手机上最慢的是编译着色器，每个程序都要带上 three.js 整套光照代码，30 个程序要编译好几秒，1 个只要零点几秒
// 材质实例按名字全局缓存、不随岛销毁，换岛 / 重开都不用重新编译
let T;
export const setThree = three => { T = three; U.uSunDir.value ||= new T.Vector3(1, 1.6, .6).normalize(); U.uSunCol.value ||= new T.Color('#fff4dc'); };

/* ---------- GLSL 噪声库（n_ 前缀，避免和 three 的 chunk 撞名）：值噪声，编译和运行都比 simplex 便宜 ---------- */
const NOISE = /* glsl */`
#ifndef N_LIB
#define N_LIB
float n_h13(vec3 p){p=fract(p*.1031);p+=dot(p,p.zyx+31.32);return fract((p.x+p.y)*p.z);}
float n_v3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(mix(n_h13(i),n_h13(i+vec3(1,0,0)),f.x),mix(n_h13(i+vec3(0,1,0)),n_h13(i+vec3(1,1,0)),f.x),f.y),
            mix(mix(n_h13(i+vec3(0,0,1)),n_h13(i+vec3(1,0,1)),f.x),mix(n_h13(i+vec3(0,1,1)),n_h13(i+vec3(1,1,1)),f.x),f.y),f.z);}
float n_s3(vec3 p){return n_v3(p)*2.-1.;}
#ifdef N_LOW
#define N_OCT 2
#else
#define N_OCT 4
#endif
float n_fbm(vec3 p,int o){float s=0.,a=.5;for(int i=0;i<N_OCT;i++){if(i>=o)break;s+=a*n_s3(p);p=p*2.03+vec3(17.1,9.7,3.3);a*=.5;}return s;}
float n_ridge(vec3 p,int o){float s=0.,a=.5;for(int i=0;i<N_OCT;i++){if(i>=o)break;s+=a*(1.-abs(n_s3(p)));p=p*2.1+vec3(5.3,1.7,9.1);a*=.5;}return s;}
#endif
`;
export const NOISE_GLSL = NOISE;
// 用屏幕空间导数把一个高度场变成法线扰动（不用切线）——只能在片元着色器里用
const FRAG_UTIL = /* glsl */`
vec3 n_bump(vec3 p,vec3 n,float h,float k){vec3 dx=dFdx(p),dy=dFdy(p);float hx=dFdx(h),hy=dFdy(h);vec3 r1=cross(dy,n),r2=cross(n,dx);float det=dot(dx,r1);vec3 g=sign(det)*(hx*r1+hy*r2);return normalize(abs(det)*n-k*g);}
`;
const HEAD = /* glsl */`
varying vec3 vLPos;varying vec3 vLNrm;varying vec3 vIns;
uniform float uTime;uniform float uWind;uniform vec3 uSunDir;uniform vec3 uSunCol;uniform float uSnow;uniform float uWet;uniform float uLit;
float g_h=0.,g_m=0.,g_r=-1.,g_bump=0.;vec3 g_e=vec3(0.);
${NOISE}`;
export let LOW = false; export const setLow = v => { if (LOW !== !!v) { LOW = !!v; clearCache(); } }; // 画质变了：缓存的材质带着旧的 define，清掉重建
// 所有材质共用的 uniform（build.js 每帧更新）
export const U = { uTime: { value: 0 }, uWind: { value: .2 }, uSunDir: { value: null }, uSunCol: { value: null }, uSnow: { value: 0 }, uWet: { value: 0 }, uLit: { value: 0 } };
const hashStr = s => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h.toString(36); };

/**
 * 往材质里注入 GLSL。钩子（都是 GLSL 语句串）：
 *  vert 在 <begin_vertex> 之后改 transformed；color 改 diffuseColor；rough / metal / normal / emis / light 同名阶段
 *  片元里随时可用：vLPos / vLNrm（物体空间位置、法线）、vIns（实例位置）、噪声库、uTime 等
 * uniforms 是这个材质自己的（同一个程序的不同材质可以不一样）
 */
export function patch(m, o = {}) {
    const key = 'isle_' + (LOW ? 'L' : 'H') + hashStr([o.vert, o.color, o.rough, o.metal, o.normal, o.emis, o.light, Object.keys(o.uniforms || {}).join(','), JSON.stringify(o.defines || {})].join('|'));
    m.defines = Object.assign(m.defines || {}, o.defines || {}, LOW ? { N_LOW: '' } : {});
    m.userData.u = o.uniforms || {};
    m.onBeforeCompile = sh => {
        Object.assign(sh.uniforms, U, m.userData.u);
        const decl = Object.entries(m.userData.u).map(([k, v]) => `uniform ${v.value?.isTexture ? 'sampler2D' : v.value?.isVector4 ? 'vec4' : v.value?.isColor || v.value?.isVector3 ? 'vec3' : 'float'} ${k};`).join('');
        sh.vertexShader = sh.vertexShader
            .replace('#include <common>', `#include <common>\n${HEAD}\n${decl}`)
            .replace('#include <begin_vertex>', `#include <begin_vertex>\nvIns=vec3(0.);\n#ifdef USE_INSTANCING\nvIns=instanceMatrix[3].xyz;\n#endif\n${o.vert || ''}\nvLPos=transformed;vLNrm=objectNormal;`);
        let f = sh.fragmentShader.replace('#include <common>', `#include <common>\n${HEAD}\n${decl}\n${FRAG_UTIL}`);
        if (o.color) f = f.replace('#include <color_fragment>', `#include <color_fragment>\n{${o.color}}`);
        if (o.rough) f = f.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n{${o.rough}}`);
        if (o.metal) f = f.replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\n{${o.metal}}`);
        if (o.normal) f = f.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n{${o.normal}}`);
        if (o.emis) f = f.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n{${o.emis}}`);
        if (o.light) f = f.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>\n{${o.light}}`);
        sh.fragmentShader = f;
    };
    m.customProgramCacheKey = () => key;
    return m;
}

/* ---------- 万能实体材质：uSurf 选表面，uP 是这种表面的参数 ---------- */
export const SURF_ID = { ground: 0, sandG: 1, snowG: 2, rock: 3, sand: 4, wood: 5, lacquer: 6, plaster: 7, concrete: 8, asphalt: 9, tile: 10, gold: 11, metal: 12, paint: 13, glass: 14, lamp: 15 };
const SOLID = {
    color: /* glsl */`
      vec3 P=vLPos;vec3 N=normalize(vLNrm);vec3 c=diffuseColor.rgb;float s=uSurf;
      if(s<2.5){ // 0 草地 1 沙地 2 雪地（顶点色给大块颜色），带烘焙 AO
        float ao=texture2D(uAO,P.xz/uR*.5+.5).r;c*=.3+.7*ao;
        if(s<.5){float big=n_fbm(P*3.,3),fine=n_s3(P*90.),blade=n_v3(P*vec3(260.,40.,260.));
          c*=(.86+.2*big+.1*fine);c=mix(c,c*vec3(.75,.68,.55),smoothstep(.15,.6,n_fbm(P*7.+3.,2))*.45);c*=.9+.2*blade;
          float steep=1.-smoothstep(.55,.9,N.y);float rk=n_ridge(P*14.,2);c=mix(c,vec3(.33,.31,.28)*(.8+.3*rk),steep*.9);
          c*=1.-uWet*.35;g_h=fine*.3+blade*.15+big*.4+steep*rk*.8;g_r=mix(.95,.55,uWet);g_bump=.012;}
        else if(s<1.5){float g=n_s3(P*160.),rip=sin(P.x*60.+n_s3(P*8.)*6.)*.5+.5,big=n_fbm(P*4.,2);c*=(.9+.12*big)*(.96+.08*g)*(.95+.08*rip);g_h=g*.2+rip*.25+big*.3;g_bump=.006;}
        else{float big=n_fbm(P*5.,3),sp=pow(n_v3(P*200.),8.);c*=mix(vec3(.82,.88,1.),vec3(1.),smoothstep(-.3,.4,big));c+=sp*.25;g_h=big*.6;g_r=.6+.3*n_s3(P*40.);g_bump=.01;}
        float snow=uSnow*(1.-step(1.5,s))*smoothstep(.35,.7,N.y+n_s3(P*20.)*.2);c=mix(c,vec3(.93,.95,1.),snow);
      } else if(s<3.5){ // 岩石：分层、斑点、地衣、朝上长苔藓（uP.x 苔藓量）
        float strata=n_ridge(P*vec3(6.,22.,6.),3),sp=n_s3(P*80.);c*=(.72+.4*strata);c=mix(c,c*.35,smoothstep(.55,.85,sp)*.6);
        float lich=smoothstep(.62,.8,n_fbm(P*5.+3.3,2)*.5+.5);c=mix(c,vec3(.45,.45,.3),lich*.4);
        float up=smoothstep(.2,.85,N.y),mn=n_fbm(P*4.+9.1,3)*.5+.5;g_m=clamp(smoothstep(.62-.35*up*uP.x,.82,mn+up*.15)*uP.x,0.,1.);
        c=mix(c,mix(vec3(.05,.08,.015),vec3(.13,.17,.04),n_v3(P*18.)),g_m);c=mix(c,vec3(.93,.95,1.),uSnow*smoothstep(.45,.8,N.y+n_s3(P*25.)*.15));
        g_h=strata*.7+sp*.1+g_m*.5;g_r=mix(.8,.97,g_m);g_bump=.02;
      } else if(s<4.5){float g=n_s3(P*160.),big=n_fbm(P*4.,2);c*=(.9+.12*big)*(.96+.08*g);g_h=g*.2+big*.3;g_bump=.006;}
      else if(s<5.5){ // 木头：uP.xyz 是年轮拉伸方向
        float g=n_fbm(P*uP.xyz,3);float rings=sin(g*14.)*.5+.5;rings=mix(rings,.5,clamp(fwidth(g*14.)*.6,0.,1.));float big=n_fbm(P*3.,2);
        c*=.72+.38*rings*(.7+.3*big)+.12*big;g_h=rings*.5+g*.3;g_r=clamp(roughness+(g_h-.4)*.2,.1,1.);g_bump=.004;
      } else if(s<6.5){ // 朱漆：褪色、磨损露木、底部污渍
        float big=n_fbm(P*2.,2),grain=n_s3(P*vec3(40.,4.,40.))*.5;c*=(.88+.16*big+.05*grain);c=mix(c,c*vec3(1.15,1.4,1.45),smoothstep(.3,.8,n_fbm(P*5.,2)*.5+.5)*.2);
        float wear=smoothstep(.65,.82,n_fbm(P*9.,2)*.5+.5);c=mix(c,vec3(.1,.05,.03),wear*.5);c*=1.-smoothstep(.12,0.,P.y)*.25;g_h=grain*.3+wear*.4;g_r=clamp(roughness*(.85+.3*g_h),.15,1.);g_bump=.003;
      } else if(s<7.5){float n=n_fbm(P*3.,2),streak=n_fbm(P*vec3(12.,1.,12.),2);c*=(.92+.08*n)*(1.-smoothstep(.1,.7,streak)*.18);g_h=n_s3(P*50.)*.5+n*.5;g_bump=.002;}
      else if(s<8.5){float n=n_v3(P*120.),big=n_fbm(P*4.,2),streak=n_fbm(P*vec3(10.,1.5,10.),2);c*=(.9+.12*big)*(.94+.1*n)*(1.-smoothstep(.1,.6,streak)*.15);g_h=n*.3+big*.4;g_bump=.002;}
      else if(s<9.5){float n=n_v3(P*180.),big=n_fbm(P*5.,2);c*=(.85+.3*big)*(.9+.2*n);c*=1.-uWet*.4;g_h=n*.4;g_r=mix(.92,.35,uWet);g_bump=.002;}
      else if(s<10.5){ // 瓦顶：一垄一垄，沟里积灰长苔（uP.x 每单位几垄）
        float row=sin(P.x*uP.x)*.5+.5;float st=fract(P.y*uP.x*.6+n_s3(P*4.)*.3);float edge=smoothstep(0.,.08,st)*smoothstep(.2,.12,st);
        float n=n_fbm(P*3.,2),lich=smoothstep(.6,.85,n_fbm(P*8.+11.,2)*.5+.5);c*=(.8+.3*n)*(.75+.35*row);c=mix(c,vec3(.17,.16,.11),lich*.35);c=mix(c,c*.6,edge*.6);
        c=mix(c,vec3(.93,.95,1.),uSnow*smoothstep(.3,.7,N.y));g_h=row*.6-edge*.5+lich*.3;g_r=clamp(roughness+g_h*.2,.2,1.);g_bump=.012;
      } else if(s<11.5){float n=n_fbm(P*10.,2),t=smoothstep(.2,.75,n_fbm(P*3.+7.,2)*.5+.5);c*=(.92+.12*n);c=mix(c,c*vec3(.55,.42,.25),t*.35);g_h=n*.5;g_r=clamp(roughness+g_h*.15,.05,1.);g_bump=.001;}
      else if(s<12.5){float n=n_v3(P*60.),rust=smoothstep(.6,.85,n_fbm(P*6.,2)*.5+.5);c*=.9+.15*n;c=mix(c,vec3(.35,.18,.1),rust*.5);g_h=n*.3+rust*.4;g_m=rust;g_r=mix(roughness,.9,rust);g_bump=.002;}
      else if(s<13.5){float n=n_v3(vLPos*200.);c*=.96+.06*n;g_h=n;g_bump=.0005;}
      else if(s<14.5){ // 窗玻璃：白天反光，夜里暖光；每扇窗亮不亮按位置哈希错开
        float k=n_h13(floor(P*40.)+vIns*7.);g_e=vec3(1.,.77,.42)*uLit*step(.25,k)*(.6+.6*k)*1.4;
      } else { // 发光体：uP.x 亮度，uP.y 白天也亮
        g_e=c*uP.x*max(uP.y,uLit);
      }
      diffuseColor.rgb=c;`,
    rough: `if(g_r>=0.)roughnessFactor=g_r;`,
    metal: `if(uSurf>11.5&&uSurf<12.5)metalnessFactor=mix(metalnessFactor,.2,g_m);`,
    normal: `if(g_bump>0.)normal=n_bump(-vViewPosition,normal,g_h,g_bump);`,
    emis: `totalEmissiveRadiance+=g_e;`,
};
let whiteTex;
const white = () => { if (!whiteTex) { whiteTex = new T.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); whiteTex.needsUpdate = true; } return whiteTex; };
const cache = new Map();
/**
 * 拿一个实体材质（全局缓存）。key 形如 'wood:x:#8b6a4b'、'paint:#d9534f:1'、'lamp:#ffd36a:1.5:1'、'tile:#4a4d58:70'、'rock:#9a978f'、'ground'
 * 地面三种（ground / sandG / snowG）的 AO 贴图每座岛不一样，用 setAO 换
 */
export function solid(key) {
    let m = cache.get(key); if (m) return m;
    const [kind, a, b, c] = key.split(':'), id = SURF_ID[kind] ?? 13;
    const p = { color: '#ffffff', roughness: .85, metalness: 0, vertexColors: true }, P = new T.Vector4(0, 0, 0, 0);
    switch (kind) {
        case 'ground': case 'sandG': case 'snowG': p.roughness = kind === 'snowG' ? .75 : .95; break;
        case 'rock': p.color = a || '#ffffff'; p.roughness = .9; P.x = a ? .5 : .7; break;
        case 'sand': p.color = a; p.roughness = .95; break;
        case 'wood': p.color = b; p.roughness = +c ? .4 : .8; P.set(...(a === 'x' ? [2, 60, 60] : a === 'z' ? [60, 60, 2] : [60, 2, 60]), 0); break;
        case 'lacquer': p.color = a; p.roughness = .45; break;
        case 'plaster': p.color = a; p.roughness = .93; break;
        case 'concrete': p.color = a; p.roughness = .9; break;
        case 'asphalt': p.color = '#3a3b3e'; p.roughness = .92; break;
        case 'tile': p.color = a; p.roughness = .55; p.metalness = .08; P.x = +b || 70; break;
        case 'gold': p.color = a; p.roughness = .3; p.metalness = 1; break;
        case 'metal': p.color = a; p.roughness = .45; p.metalness = .9; break;
        case 'paint': p.color = a; p.roughness = +b ? .28 : .7; break;
        case 'glass': p.color = '#8fb6cc'; p.roughness = .12; p.metalness = .1; break;
        case 'lamp': p.color = a; p.roughness = .6; P.set(+b || 1, +c || 0, 0, 0); break;
    }
    m = patch(new T.MeshStandardMaterial(p), { ...SOLID, uniforms: { uSurf: { value: id }, uP: { value: P }, uAO: { value: white() }, uR: { value: 1 } } });
    m.userData.key = key; cache.set(key, m); return m;
}
export const setAO = ao => { for (const k of ['ground', 'sandG', 'snowG']) { const m = solid(k); m.userData.u.uAO.value = ao.tex; m.userData.u.uR.value = ao.R; } };

/** 树叶片（实例化平面）：alpha 裁剪、背光透光、随风摆。按叶形 + 颜色缓存（共用一个程序） */
export function leaf(map, color) {
    const k = 'leaf|' + map.uuid + '|' + color; let m = cache.get(k); if (m) return m;
    m = patch(new T.MeshStandardMaterial({ map, alphaTest: .5, side: T.DoubleSide, roughness: .8, color }), {
        vert: `float ph=dot(vIns,vec3(12.9,7.3,5.1));float sw=uWind*(.6+.4*sin(uTime*1.7+ph));float gust=.6+.4*sin(uTime*.7+vIns.x*3.);transformed.x+=(sin(uTime*(2.3+uWind*4.)+ph+transformed.y*3.)*.012+uWind*gust*.03)*sw*(1.+uWind*2.);transformed.z+=cos(uTime*(1.9+uWind*3.)+ph)*.01*sw*(1.+uWind*2.);`,
        color: `float v=n_h13(vIns*31.);diffuseColor.rgb*=.85+.3*v;diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.93,.95,1.),uSnow*smoothstep(.2,.8,vLNrm.y)*.6);`,
        light: `vec3 sd=normalize((viewMatrix*vec4(uSunDir,0.)).xyz);float tr=max(0.,dot(-normal,sd))*max(0.,dot(normalize(vViewPosition),sd)*.5+.5);reflectedLight.directDiffuse+=diffuseColor.rgb*uSunCol*tr*.35;`,
    }); cache.set(k, m); return m;
}
/** 草叶（实例化的小三角）：根部深顶部浅，随风。颜色是 uniform，所有草共用一个程序 */
export function grass(c1, c2) {
    const k = 'grass|' + c1 + '|' + c2; let m = cache.get(k); if (m) return m;
    m = patch(new T.MeshStandardMaterial({ color: '#ffffff', side: T.DoubleSide, roughness: .9 }), {
        uniforms: { uC1: { value: new T.Color(c1) }, uC2: { value: new T.Color(c2) } },
        vert: `float ph=dot(vIns,vec3(9.1,3.3,7.7));float sw=uWind*(.5+.5*sin(uTime*2.+ph));transformed.x+=transformed.y*transformed.y*(sin(uTime*(2.6+uWind*5.)+ph)*.9+uWind*1.6)*sw;transformed.z+=transformed.y*transformed.y*cos(uTime*2.2+ph)*.6*sw;`,
        color: `float v=n_h13(vIns*17.);float h=clamp(vLPos.y*60.,0.,1.);diffuseColor.rgb=mix(uC1,uC2,h)*(.8+.4*v);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.93,.95,1.),uSnow*.85);`,
        light: `vec3 sd=normalize((viewMatrix*vec4(uSunDir,0.)).xyz);reflectedLight.directDiffuse+=diffuseColor.rgb*uSunCol*max(0.,dot(-normal,sd))*.25;`,
    }); cache.set(k, m); return m;
}
/** 所有缓存的材质（换环境贴图时用） */
export const allCached = () => [...cache.values()];
export const clearCache = () => { cache.forEach(m => m.dispose()); cache.clear(); };

/** 水面（独立着色器，所有水共用一个程序）：法线扰动、菲涅尔映天空、太阳高光、岸边泡沫 */
export function waterMat(opts) {
    const u = { t: U.uTime, c1: { value: new T.Color(opts.c1) }, c2: { value: new T.Color(opts.c2) }, sky: { value: new T.Color('#9ec9ff') }, sun: U.uSunDir, sunc: U.uSunCol, ring: { value: opts.ring || 0 }, rad: { value: opts.radius }, amp: { value: opts.amp ?? .012 }, night: { value: 0 } };
    return new T.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false,
        vertexShader: `${NOISE}uniform float t,amp;varying vec3 vP;varying vec3 vW;void main(){vP=position;float s=n_s3(vec3(position.xz*9.,t*.5))*.6+n_s3(vec3(position.xz*22.+3.,t*.9))*.4;vec3 q=position;q.y+=s*amp;vec4 w=modelMatrix*vec4(q,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
        fragmentShader: `${NOISE}uniform mat4 modelMatrix;uniform vec3 c1,c2,sky,sun,sunc;uniform float ring,rad,t,night;varying vec3 vP;varying vec3 vW;
            void main(){float d=length(vP.xz)/rad;
              float h=n_s3(vec3(vP.xz*40.,t*.8))*.5+n_s3(vec3(vP.xz*95.+7.,t*1.3))*.25;
              vec3 n=normalize(vec3(-dFdx(h)*18.,1.,-dFdy(h)*18.));n=normalize((modelMatrix*vec4(n,0.)).xyz);
              vec3 V=normalize(cameraPosition-vW);float fr=pow(1.-max(0.,dot(n,V)),3.);
              vec3 c=mix(c1,c2,smoothstep(.15,1.,d));c=mix(c,sky,fr*.6);
              vec3 L=normalize(sun);vec3 H=normalize(L+V);c+=sunc*pow(max(0.,dot(n,H)),180.)*(1.-night)*1.2;
              c+=sunc*pow(max(0.,dot(n,H)),16.)*.08;
              if(ring>0.){float f=abs(length(vP.xz)-ring);float foam=smoothstep(.07,0.,f+n_s3(vec3(vP.xz*30.,t*.6))*.02)*.6;c=mix(c,vec3(1.),foam*(.6+.4*n_v3(vec3(vP.xz*60.,t))));}
              float a=1.-smoothstep(.975,1.,d);gl_FragColor=vec4(c,a*(.9+fr*.1));
              #include <tonemapping_fragment>
              #include <colorspace_fragment>}` });
}

/* ---------- 叶片贴图（canvas 画的，带 alpha） ---------- */
const texCache = new Map();
export function leafTex(kind) {
    if (texCache.has(kind)) return texCache.get(kind);
    const s = 64, c = document.createElement('canvas'); c.width = c.height = s; const x = c.getContext('2d'); x.clearRect(0, 0, s, s); x.fillStyle = '#fff';
    const leafShape = (cx, cy, w, h, rot) => { x.save(); x.translate(cx, cy); x.rotate(rot); x.beginPath(); x.moveTo(0, -h); x.bezierCurveTo(w, -h * .5, w, h * .5, 0, h); x.bezierCurveTo(-w, h * .5, -w, -h * .5, 0, -h); x.fill(); x.restore(); };
    if (kind === 'broad') { leafShape(32, 30, 14, 26, 0); leafShape(16, 40, 9, 16, -.9); leafShape(48, 40, 9, 16, .9); leafShape(32, 50, 8, 12, 0); }
    else if (kind === 'maple') { for (let i = 0; i < 5; i++) { const a = (i - 2) * .55; x.save(); x.translate(32, 44); x.rotate(a); x.beginPath(); x.moveTo(0, 0); x.lineTo(-6, -14); x.lineTo(0, -30); x.lineTo(6, -14); x.closePath(); x.fill(); x.restore(); } }
    else if (kind === 'needle') { for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2; x.save(); x.translate(32, 32); x.rotate(a); x.fillRect(0, -1, 28 + (i % 3) * 3, 2); x.restore(); } }
    else if (kind === 'blossom') { for (let i = 0; i < 7; i++) { const a = i * 2.39, r = i ? 12 + (i % 3) * 5 : 0; const cx = 32 + Math.cos(a) * r, cy = 32 + Math.sin(a) * r; for (let p = 0; p < 5; p++) { x.save(); x.translate(cx, cy); x.rotate(p / 5 * Math.PI * 2); x.beginPath(); x.ellipse(0, -5, 3.2, 5, 0, 0, Math.PI * 2); x.fill(); x.restore(); } } }
    else if (kind === 'frond') { x.save(); x.translate(32, 60); for (let i = 0; i < 18; i++) { const t = i / 18, y = -t * 56; x.fillRect(-1, y, 2, 4); x.save(); x.translate(0, y); x.rotate(-.9 - t * .3); x.fillRect(0, -1.2, 14 * (1 - t * .5), 2.4); x.restore(); x.save(); x.translate(0, y); x.rotate(.9 + t * .3); x.fillRect(-14 * (1 - t * .5), -1.2, 14 * (1 - t * .5), 2.4); x.restore(); } x.restore(); }
    else if (kind === 'bamboo') { leafShape(32, 32, 4, 26, .3); leafShape(22, 40, 3.5, 20, -.5); leafShape(42, 42, 3.5, 20, .9); }
    else if (kind === 'round') { x.beginPath(); x.arc(32, 32, 26, 0, Math.PI * 2); x.fill(); }
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 2; texCache.set(kind, t); return t;
}

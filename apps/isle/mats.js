// 心屿 · 材质：不用一张贴图，所有表面细节（草、土、岩石的斑点和苔藓、木纹、瓦楞、鎏金的氧化…）都是噪声在着色器里算出来的
// 做法：往 three.js 自带的 PBR 材质（MeshStandard / MeshPhysical）里注入几段 GLSL（颜色、粗糙度、法线凹凸、自发光），
// 这样光照、阴影、环境反射都还是 three.js 的，只是表面「长」出细节。噪声用物体空间坐标，所以球怎么转花纹都跟着走
let T;
export const setThree = three => { T = three; U.uSunDir.value ||= new T.Vector3(1, 1.6, .6).normalize(); U.uSunCol.value ||= new T.Color('#fff4dc'); };

/* ---------- GLSL 噪声库（n_ 前缀，避免和 three 的 chunk 撞名） ---------- */
const NOISE = /* glsl */`
#ifndef N_LIB
#define N_LIB
float n_h13(vec3 p){p=fract(p*.1031);p+=dot(p,p.zyx+31.32);return fract((p.x+p.y)*p.z);}
vec3 n_h33(vec3 p){p=fract(p*vec3(.1031,.1030,.0973));p+=dot(p,p.yxz+33.33);return fract((p.xxy+p.yxx)*p.zyx);}
float n_v3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(mix(n_h13(i),n_h13(i+vec3(1,0,0)),f.x),mix(n_h13(i+vec3(0,1,0)),n_h13(i+vec3(1,1,0)),f.x),f.y),
            mix(mix(n_h13(i+vec3(0,0,1)),n_h13(i+vec3(1,0,1)),f.x),mix(n_h13(i+vec3(0,1,1)),n_h13(i+vec3(1,1,1)),f.x),f.y),f.z);}
vec4 n_p4(vec4 x){return mod(((x*34.)+1.)*x,289.);}
vec4 n_tis(vec4 r){return 1.79284291400159-.85373472095314*r;}
float n_s3(vec3 v){const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);
 vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
 vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;i=mod(i,289.);
 vec4 p=n_p4(n_p4(n_p4(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
 float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
 vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
 vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
 vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
 vec4 nr=n_tis(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));p0*=nr.x;p1*=nr.y;p2*=nr.z;p3*=nr.w;
 vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}
// 低画质：fbm 用便宜的 value noise，最多两层
#ifdef N_LOW
#define N_BASE(p) (n_v3(p)*2.-1.)
#define N_OCT 2
#else
#define N_BASE(p) n_s3(p)
#define N_OCT 6
#endif
float n_fbm(vec3 p,int o){float s=0.,a=.5;for(int i=0;i<N_OCT;i++){if(i>=o)break;s+=a*N_BASE(p);p=p*2.03+vec3(17.1,9.7,3.3);a*=.5;}return s;}
float n_ridge(vec3 p,int o){float s=0.,a=.5;for(int i=0;i<N_OCT;i++){if(i>=o)break;s+=a*(1.-abs(N_BASE(p)));p=p*2.1+vec3(5.3,1.7,9.1);a*=.5;}return s;}
vec2 n_worley(vec3 p){vec3 i=floor(p),f=fract(p);float d1=8.,d2=8.;for(int z=-1;z<=1;z++)for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec3 g=vec3(float(x),float(y),float(z));vec3 r=g+n_h33(i+g)-f;float d=dot(r,r);if(d<d1){d2=d1;d1=d;}else if(d<d2)d2=d;}return sqrt(vec2(d1,d2));}
#endif
`;
// 用屏幕空间导数把一个高度场变成法线扰动（不用切线）——只能在片元着色器里用
const FRAG_UTIL = /* glsl */`
vec3 n_bump(vec3 p,vec3 n,float h,float k){vec3 dx=dFdx(p),dy=dFdy(p);float hx=dFdx(h),hy=dFdy(h);vec3 r1=cross(dy,n),r2=cross(n,dx);float det=dot(dx,r1);vec3 g=sign(det)*(hx*r1+hy*r2);return normalize(abs(det)*n-k*g);}
`;
export const NOISE_GLSL = NOISE;
const HEAD = /* glsl */`
varying vec3 vLPos;varying vec3 vLNrm;varying vec3 vIns;
uniform float uTime;uniform float uWind;uniform vec3 uSunDir;uniform vec3 uSunCol;uniform float uSnow;uniform float uWet;uniform float uLit;
float g_h=0.,g_m=0.;
#ifdef ISLE_AO
uniform sampler2D uAO;uniform float uR;
#endif
${NOISE}`;
// 所有材质共用的 uniform（build.js 每帧更新）
export let LOW = false; export const setLow = v => { LOW = !!v; };
export const U = { uTime: { value: 0 }, uWind: { value: .2 }, uSunDir: { value: null }, uSunCol: { value: null }, uSnow: { value: 0 }, uWet: { value: 0 }, uLit: { value: 0 } };
const hashStr = s => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h.toString(36); };

/**
 * 往材质里注入 GLSL。钩子（都是 GLSL 语句串）：
 *  vert       在 <begin_vertex> 之后，可改 transformed（物体空间）——树叶摆动用
 *  color      在 <color_fragment> 之后，改 diffuseColor.rgb（线性）
 *  rough      改 roughnessFactor；metal 改 metalnessFactor
 *  normal     在 <normal_fragment_maps> 之后，改 normal（视空间）
 *  emis       改 totalEmissiveRadiance
 *  light      在 <lights_fragment_end> 之后，可往 reflectedLight 加东西（树叶透光）
 *  片元里随时可用：vLPos / vLNrm（物体空间位置、法线）、vIns（实例位置）、噪声库、uTime 等
 */
export function patch(m, o = {}) {
    const key = 'isle_' + (LOW ? 'L' : 'H') + hashStr([o.vert, o.color, o.rough, o.metal, o.normal, o.emis, o.light, JSON.stringify(o.defines || {})].join('|'));
    m.defines = Object.assign(m.defines || {}, o.defines || {}, LOW ? { N_LOW: '' } : {});
    m.onBeforeCompile = sh => {
        Object.assign(sh.uniforms, U, o.uniforms || {});
        sh.vertexShader = sh.vertexShader
            .replace('#include <common>', `#include <common>\n${HEAD}`)
            .replace('#include <begin_vertex>', `#include <begin_vertex>\nvIns=vec3(0.);\n#ifdef USE_INSTANCING\nvIns=instanceMatrix[3].xyz;\n#endif\n${o.vert || ''}\nvLPos=transformed;vLNrm=objectNormal;`);
        let f = sh.fragmentShader.replace('#include <common>', `#include <common>\n${HEAD}\n${FRAG_UTIL}`);
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
const std = (p, o) => patch(new T.MeshStandardMaterial({ roughness: .85, metalness: 0, ...p }), o);
const phys = (p, o) => patch(new T.MeshPhysicalMaterial({ roughness: .5, metalness: 0, ...p }), o);
const BUMP = (k, h = 'g_h') => `normal=n_bump(-vViewPosition,normal,${h},${k});`;

/* ---------- 各种表面 ---------- */
// 地面的烘焙 AO（build.js 把建筑和树的影子画在一张 canvas 上）
const AO = `\n#ifdef ISLE_AO\nfloat ao=texture2D(uAO,vLPos.xz/uR*.5+.5).r;diffuseColor.rgb*=.3+.7*ao;\n#endif\n`;
const aoOpts = ao => ao ? { uniforms: { uAO: { value: ao.tex }, uR: { value: ao.R } }, defines: { ISLE_AO: '' } } : {};
export const SURF = {
    /** 草地：顶点色给大块颜色，这里加草的细碎纹理、泥土斑、坡面露岩、雪盖 */
    ground: (p = {}, ao) => std({ color: '#ffffff', vertexColors: true, roughness: .95, ...p }, {
        ...aoOpts(ao),
        color: `${AO}vec3 P=vLPos;vec3 N=normalize(vLNrm);
            float big=n_fbm(P*3.,3),fine=n_s3(P*90.),blade=n_s3(P*vec3(260.,40.,260.))*.5+.5;
            vec3 c=diffuseColor.rgb*(.86+.2*big+.1*fine);
            c=mix(c,c*vec3(.75,.68,.55),smoothstep(.15,.6,n_fbm(P*7.+3.,3))*.45); // 泥土斑
            c*=.9+.2*blade;
            float steep=1.-smoothstep(.55,.9,N.y);vec3 rock=vec3(.33,.31,.28)*(.8+.3*n_ridge(P*14.,3));c=mix(c,rock,steep*.9);
            float snow=uSnow*smoothstep(.35,.7,N.y+n_s3(P*20.)*.2);c=mix(c,vec3(.93,.95,1.)*(.9+.1*n_s3(P*120.)),snow);
            c*=1.-uWet*.35;diffuseColor.rgb=c;g_h=fine*.3+blade*.15+big*.4+steep*n_ridge(P*14.,3)*.8;`,
        rough: `roughnessFactor=mix(.95,.55,uWet);`,
        normal: BUMP('.012'),
    }),
    /** 岩石 / 崖壁：分层的脊状噪声、斑点、地衣、朝上的面长苔藓 */
    rock: (moss = .6, p = {}) => std({ color: '#ffffff', vertexColors: true, roughness: .9, ...p }, {
        color: `vec3 P=vLPos;vec3 N=normalize(vLNrm);
            float strata=n_ridge(P*vec3(6.,22.,6.),4),sp=n_s3(P*80.),sp2=n_s3(P*130.+5.);
            vec3 c=diffuseColor.rgb*(.72+.4*strata);
            c=mix(c,c*.35,smoothstep(.55,.85,sp)*.7);c=mix(c,c*1.5,smoothstep(.6,.9,sp2)*.5);
            float lich=smoothstep(.62,.8,n_fbm(P*5.+3.3,3)*.5+.5);c=mix(c,vec3(.45,.45,.3),lich*.4);
            float up=smoothstep(.2,.85,N.y);float mn=n_fbm(P*4.+9.1,4)*.5+.5;float moss=clamp(smoothstep(.62-.35*up*${moss.toFixed(2)},.82,mn+up*.15)*${moss.toFixed(2)},0.,1.);
            c=mix(c,mix(vec3(.05,.08,.015),vec3(.13,.17,.04),n_s3(P*18.)*.5+.5),moss);
            float snow=uSnow*smoothstep(.45,.8,N.y+n_s3(P*25.)*.15);c=mix(c,vec3(.93,.95,1.),snow);
            diffuseColor.rgb=c;g_h=strata*.7+sp*.1+moss*.5;g_m=moss;`,
        rough: `roughnessFactor=mix(.8,.97,g_m);`,
        normal: BUMP('.02'),
    }),
    /** 沙：细颗粒 + 风纹 */
    sand: (p = {}, ao) => std({ color: '#ffffff', vertexColors: true, roughness: .95, ...p }, {
        ...aoOpts(ao),
        color: `${AO}vec3 P=vLPos;float g=n_s3(P*160.),rip=sin(P.x*60.+n_s3(P*8.)*6.)*.5+.5,big=n_fbm(P*4.,3);
            diffuseColor.rgb*=(.9+.12*big)*(.96+.08*g)*(.95+.08*rip);g_h=g*.2+rip*.25+big*.3;`,
        normal: BUMP('.006'),
    }),
    /** 雪：柔软的起伏、晶体闪点、凹处偏蓝 */
    snow: (p = {}, ao) => std({ color: '#ffffff', vertexColors: true, roughness: .75, ...p }, {
        ...aoOpts(ao),
        color: `${AO}vec3 P=vLPos;float big=n_fbm(P*5.,3),sp=pow(n_s3(P*200.)*.5+.5,8.);
            diffuseColor.rgb*=mix(vec3(.82,.88,1.),vec3(1.),smoothstep(-.3,.4,big));diffuseColor.rgb+=sp*.25;g_h=big*.6;`,
        rough: `roughnessFactor=.6+.3*n_s3(vLPos*40.);`,
        normal: BUMP('.01'),
    }),
    /** 木头：年轮沿 axis 方向拉长 */
    wood: (axis = 'y', base = '#8b6a4b', gloss = 0) => (gloss ? phys : std)({ color: base, roughness: gloss ? .35 : .8, clearcoat: gloss ? .5 : 0, clearcoatRoughness: .25 }, {
        color: `vec3 P=vLPos;vec3 sc=${axis === 'x' ? 'vec3(2.,60.,60.)' : axis === 'z' ? 'vec3(60.,60.,2.)' : 'vec3(60.,2.,60.)'};
            float g=n_fbm(P*sc,3);float rings=sin(g*14.)*.5+.5;rings=mix(rings,.5,clamp(fwidth(g*14.)*.6,0.,1.));float big=n_fbm(P*3.,2);
            diffuseColor.rgb*=.72+.38*rings*(.7+.3*big)+.12*big;g_h=rings*.5+g*.3;`,
        rough: `roughnessFactor=clamp(roughnessFactor+(g_h-.4)*.2,.1,1.);`,
        normal: BUMP('.004'),
    }),
    /** 朱漆（鸟居、柱子）：褪色、磨损露木、底部污渍 */
    lacquer: (base = '#c2432d') => phys({ color: base, roughness: .45, clearcoat: .3, clearcoatRoughness: .4 }, {
        color: `vec3 P=vLPos;float big=n_fbm(P*2.,3),grain=n_s3(P*vec3(40.,4.,40.))*.5+n_s3(P*90.)*.25;
            vec3 c=diffuseColor.rgb*(.88+.16*big+.05*grain);c=mix(c,c*vec3(1.15,1.4,1.45),smoothstep(.3,.8,n_fbm(P*5.,2)*.5+.5)*.2);
            float wear=smoothstep(.65,.82,n_fbm(P*9.,3)*.5+.5);c=mix(c,vec3(.1,.05,.03),wear*.5);c*=1.-smoothstep(.12,0.,P.y)*.25;
            diffuseColor.rgb=c;g_h=grain*.3+wear*.4;`,
        rough: `roughnessFactor=clamp(roughnessFactor*(.85+.3*g_h),.15,1.);`,
        normal: BUMP('.003'),
    }),
    /** 灰泥 / 石灰墙：雨痕、污渍 */
    plaster: (base = '#e8e0d0') => std({ color: base, roughness: .93 }, {
        color: `vec3 P=vLPos;float n=n_fbm(P*3.,3),streak=n_fbm(P*vec3(12.,1.,12.),3);
            diffuseColor.rgb*=(.92+.08*n)*(1.-smoothstep(.1,.7,streak)*.18);g_h=n_s3(P*50.)*.5+n*.5;`,
        normal: BUMP('.002'),
    }),
    /** 混凝土 / 水泥：细麻点、水渍 */
    concrete: (base = '#b9b6ae') => std({ color: base, roughness: .9 }, {
        color: `vec3 P=vLPos;float n=n_s3(P*120.)*.5+.5,big=n_fbm(P*4.,3),streak=n_fbm(P*vec3(10.,1.5,10.),2);
            diffuseColor.rgb*=(.9+.12*big)*(.94+.1*n)*(1.-smoothstep(.1,.6,streak)*.15);g_h=n*.3+big*.4;`,
        normal: BUMP('.002'),
    }),
    /** 沥青：颗粒、车辙的暗带 */
    asphalt: () => std({ color: '#3a3b3e', roughness: .92 }, {
        color: `vec3 P=vLPos;float n=n_s3(P*180.)*.5+.5,big=n_fbm(P*5.,3);diffuseColor.rgb*=(.85+.3*big)*(.9+.2*n);diffuseColor.rgb*=1.-uWet*.4;g_h=n*.4;`,
        rough: `roughnessFactor=mix(.92,.35,uWet);`,
        normal: BUMP('.002'),
    }),
    /** 瓦顶：一垄一垄沿屋面方向，沟里积灰长苔 */
    tile: (base = '#4a4d58', rows = 70) => std({ color: base, roughness: .55, metalness: .08 }, {
        color: `vec3 P=vLPos;vec3 N=normalize(vLNrm);float along=P.x*${rows.toFixed(1)};float row=sin(along)*.5+.5;float step_=fract(P.y*${(rows * .6).toFixed(1)}+n_s3(P*4.)*.3);float edge=smoothstep(.0,.08,step_)*smoothstep(.2,.12,step_);
            float n=n_fbm(P*3.,3),lich=smoothstep(.6,.85,n_fbm(P*8.+11.,3)*.5+.5);
            vec3 c=diffuseColor.rgb*(.8+.3*n)*(.75+.35*row);c=mix(c,vec3(.17,.16,.11),lich*.35);c=mix(c,c*.6,edge*.6);
            float snow=uSnow*smoothstep(.3,.7,N.y);c=mix(c,vec3(.93,.95,1.),snow);diffuseColor.rgb=c;g_h=row*.6-edge*.5+lich*.3;`,
        rough: `roughnessFactor=clamp(roughnessFactor+g_h*.2,.2,1.);`,
        normal: BUMP('.012'),
    }),
    /** 金 / 铜：氧化斑 */
    gold: (base = '#ffb347') => std({ color: base, roughness: .3, metalness: 1 }, {
        color: `vec3 P=vLPos;float n=n_fbm(P*10.,3),t=smoothstep(.2,.75,n_fbm(P*3.+7.,3)*.5+.5);diffuseColor.rgb*=(.92+.12*n);diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.55,.42,.25),t*.35);g_h=n*.5;`,
        rough: `roughnessFactor=clamp(roughnessFactor+g_h*.15,.05,1.);`,
        normal: BUMP('.001'),
    }),
    metal: (base = '#8d939c') => std({ color: base, roughness: .45, metalness: .9 }, {
        color: `vec3 P=vLPos;float n=n_s3(P*60.)*.5+.5,rust=smoothstep(.6,.85,n_fbm(P*6.,3)*.5+.5);diffuseColor.rgb*=.9+.15*n;diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.35,.18,.1),rust*.5);g_h=n*.3+rust*.4;g_m=rust;`,
        rough: `roughnessFactor=mix(roughnessFactor,.9,g_m);`, metal: `metalnessFactor=mix(metalnessFactor,.2,g_m);`,
        normal: BUMP('.002'),
    }),
    /** 油漆（车身、招牌、座椅）：干净一点，只有轻微的桔皮纹 */
    paint: (base = '#d9534f', gloss = 1) => phys({ color: base, roughness: gloss ? .3 : .7, clearcoat: gloss ? .8 : 0, clearcoatRoughness: .15 }, {
        color: `float n=n_s3(vLPos*200.)*.5+.5;diffuseColor.rgb*=.96+.06*n;g_h=n;`, normal: BUMP('.0005'),
    }),
    /** 窗玻璃：白天反光，夜里暖光（uLit）；每扇窗亮度用实例位置哈希错开 */
    glass: () => phys({ color: '#8fb6cc', roughness: .12, metalness: .1, emissive: '#ffc46b', emissiveIntensity: 0 }, {
        emis: `float k=n_h13(floor(vLPos*40.)+vIns*7.);float on=uLit*step(.25,k)*(.6+.6*k);totalEmissiveRadiance=vec3(1.,.77,.42)*on*1.4;`,
    }),
    /** 发光体（灯罩、灯笼纸、火焰）：颜色 × 强度，夜里 uLit 调亮 */
    lamp: (c = '#ffd36a', k = 1.2, always = 0) => patch(new T.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0, roughness: .6 }), { uniforms: {}, emis: `totalEmissiveRadiance=diffuseColor.rgb*${k.toFixed(2)}*max(${always.toFixed(2)},uLit);` }),
    /** 树叶片（实例化平面）：alpha 裁剪、背光透光、随风摆 */
    leaf: (map, extra = {}) => std({ map, alphaTest: .5, side: T.DoubleSide, roughness: .8, color: '#ffffff', ...extra }, {
        vert: `float ph=dot(vIns,vec3(12.9,7.3,5.1));float sw=uWind*(.6+.4*sin(uTime*1.7+ph));transformed.x+=sin(uTime*2.3+ph+transformed.y*3.)*.012*sw;transformed.z+=cos(uTime*1.9+ph)*.01*sw;`,
        color: `float v=n_h13(vIns*31.);diffuseColor.rgb*=.85+.3*v;`,
        light: `vec3 sd=normalize((viewMatrix*vec4(uSunDir,0.)).xyz);float tr=max(0.,dot(-normal,sd))*max(0.,dot(normalize(vViewPosition),sd)*.5+.5);reflectedLight.directDiffuse+=diffuseColor.rgb*uSunCol*tr*.35;`,
    }),
    /** 草叶（实例化的小三角）：根部深顶部浅，随风 */
    grass: (c1, c2) => std({ color: '#ffffff', side: T.DoubleSide, roughness: .9 }, {
        vert: `float ph=dot(vIns,vec3(9.1,3.3,7.7));float sw=uWind*(.5+.5*sin(uTime*2.+ph));transformed.x+=transformed.y*transformed.y*sin(uTime*2.6+ph)*.9*sw;transformed.z+=transformed.y*transformed.y*cos(uTime*2.2+ph)*.6*sw;`,
        color: `float v=n_h13(vIns*17.);float h=clamp(vLPos.y*60.,0.,1.);diffuseColor.rgb=mix(${glsl(c1)},${glsl(c2)},h)*(.8+.4*v);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.93,.95,1.),uSnow*.85);`,
        light: `vec3 sd=normalize((viewMatrix*vec4(uSunDir,0.)).xyz);reflectedLight.directDiffuse+=diffuseColor.rgb*uSunCol*max(0.,dot(-normal,sd))*.25;`,
    }),
    /** 云：噪声蚀刻的柔软边缘（billboard 平面） */
    cloud: () => patch(new T.MeshStandardMaterial({ color: '#ffffff', transparent: true, depthWrite: false, roughness: 1, side: T.DoubleSide }), {
        color: `vec2 uv=vUv*2.-1.;float d=length(uv);float n=n_fbm(vec3(vUv*4.+vIns.xy*3.,uTime*.03),4)*.5+.5;float a=smoothstep(1.,.3,d)*smoothstep(.25,.7,n+(1.-d)*.3);diffuseColor.a*=a;diffuseColor.rgb*=.85+.3*n;`,
        defines: { USE_UV: '' },
    }),
};
const glsl = hex => { const c = new T.Color(hex); return `vec3(${c.r.toFixed(3)},${c.g.toFixed(3)},${c.b.toFixed(3)})`; };

/** 水面（独立着色器）：法线扰动、菲涅尔映天空、太阳高光、岸边泡沫 */
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
              if(ring>0.){float f=abs(length(vP.xz)-ring);float foam=smoothstep(.07,0.,f+n_s3(vec3(vP.xz*30.,t*.6))*.02)*.6;c=mix(c,vec3(1.),foam*(.6+.4*n_s3(vec3(vP.xz*60.,t))));}
              float a=1.-smoothstep(.975,1.,d);gl_FragColor=vec4(c,a*(.9+fr*.1));
              #include <tonemapping_fragment>
              #include <colorspace_fragment>}` });
}

/* ---------- 叶片贴图（canvas 画的，带 alpha） ---------- */
const texCache = new Map();
export function leafTex(kind) {
    if (texCache.has(kind)) return texCache.get(kind);
    const s = 64, c = document.createElement('canvas'); c.width = c.height = s; const x = c.getContext('2d'); x.clearRect(0, 0, s, s); x.fillStyle = '#fff'; x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 1.2;
    const leaf = (cx, cy, w, h, rot) => { x.save(); x.translate(cx, cy); x.rotate(rot); x.beginPath(); x.moveTo(0, -h); x.bezierCurveTo(w, -h * .5, w, h * .5, 0, h); x.bezierCurveTo(-w, h * .5, -w, -h * .5, 0, -h); x.fill(); x.restore(); };
    if (kind === 'broad') { leaf(32, 30, 14, 26, 0); leaf(16, 40, 9, 16, -.9); leaf(48, 40, 9, 16, .9); leaf(32, 50, 8, 12, 0); }
    else if (kind === 'maple') { for (let i = 0; i < 5; i++) { const a = (i - 2) * .55; x.save(); x.translate(32, 44); x.rotate(a); x.beginPath(); x.moveTo(0, 0); x.lineTo(-6, -14); x.lineTo(0, -30); x.lineTo(6, -14); x.closePath(); x.fill(); x.restore(); } }
    else if (kind === 'needle') { for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2; x.save(); x.translate(32, 32); x.rotate(a); x.fillRect(0, -1, 28 + (i % 3) * 3, 2); x.restore(); } }
    else if (kind === 'blossom') { for (let i = 0; i < 7; i++) { const a = i * 2.39, r = i ? 12 + (i % 3) * 5 : 0; const cx = 32 + Math.cos(a) * r, cy = 32 + Math.sin(a) * r; for (let p = 0; p < 5; p++) { x.save(); x.translate(cx, cy); x.rotate(p / 5 * Math.PI * 2); x.beginPath(); x.ellipse(0, -5, 3.2, 5, 0, 0, Math.PI * 2); x.fill(); x.restore(); } } }
    else if (kind === 'frond') { x.save(); x.translate(32, 60); for (let i = 0; i < 18; i++) { const t = i / 18, y = -t * 56; x.fillRect(-1, y, 2, 4); x.save(); x.translate(0, y); x.rotate(-.9 - t * .3); x.fillRect(0, -1.2, 14 * (1 - t * .5), 2.4); x.restore(); x.save(); x.translate(0, y); x.rotate(.9 + t * .3); x.fillRect(-14 * (1 - t * .5), -1.2, 14 * (1 - t * .5), 2.4); x.restore(); } x.restore(); }
    else if (kind === 'bamboo') { leaf(32, 32, 4, 26, .3); leaf(22, 40, 3.5, 20, -.5); leaf(42, 42, 3.5, 20, .9); }
    else if (kind === 'round') { x.beginPath(); x.arc(32, 32, 26, 0, Math.PI * 2); x.fill(); }
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 2; texCache.set(kind, t); return t;
}
export const disposeTex = () => { texCache.forEach(t => t.dispose()); texCache.clear(); };

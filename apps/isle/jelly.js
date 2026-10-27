// 心屿 · 果冻球（three.js）：玻璃球是一团真的软体（soft.js），抓哪拉哪、戳哪凹哪、拍一下砸到地上压扁再弹；双指捏合 / 滚轮缩放；画质自动降档
// 岛跟着软体的整体位置、旋转和一半的拉伸走，所以球被拉扁、拧歪时里面的岛也跟着晃；天空贴在会变形的玻璃内壁上
// 为了「点一下就出来」：渲染器、场景、玻璃球和编译好的着色器都是常驻的（ENG），每次打开只是把这块画布挪进新页面；
//   打开手机后会趁空闲提前预热（warm），第一次点进来也不用等编译。岛在后台拼好后「啵」地弹进球里
import { buildWorld, WEATHER } from './build.js';
import { softBall, skinWeights, skin } from './soft.js';

let THREE_P;
const loadThree = () => (THREE_P ||= import(new URL('../../assets/three/three.module.min.js', import.meta.url).href));
const FOV = 30, TAN = Math.tan(FOV / 2 * Math.PI / 180);
const wkeyOf = rc => `${rc?.seed}|${rc?.climate}|${rc?.mark}`;
const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));

/* ---------- 常驻引擎 ---------- */
let ENG = null, ENG_P = null;
async function engine() {
    if (ENG && !ENG.lost) return ENG;
    if (ENG_P) return ENG_P;
    return (ENG_P = (async () => {
        const T = await loadThree();
        const canvas = document.createElement('canvas');
        const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
        renderer.setClearColor(0x000000, 0); renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08; renderer.outputColorSpace = T.SRGBColorSpace;
        if ('transmissionResolutionScale' in renderer) renderer.transmissionResolutionScale = .6;
        const scene = new T.Scene(), cam = new T.PerspectiveCamera(FOV, 1, .05, 30);
        // 环境反射：柔和的渐变房间（反射调得很淡：变形时不会像一层塑料膜）
        const pm = new T.PMREMGenerator(renderer), envScene = new T.Scene();
        envScene.add(new T.Mesh(new T.SphereGeometry(5, 16, 8), new T.MeshBasicMaterial({ side: T.BackSide, color: '#e4ecf2' })));
        const strip = new T.Mesh(new T.PlaneGeometry(3, 1.2), new T.MeshBasicMaterial({ color: '#ffffff' })); strip.position.set(-1.5, 3, -1); strip.lookAt(0, 0, 0); envScene.add(strip);
        const envTex = pm.fromScene(envScene, .08).texture; scene.environment = envTex; pm.dispose(); envScene.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
        const key = new T.DirectionalLight('#ffffff', .6); key.position.set(-2, 3, 2); scene.add(key);
        const root = new T.Group(), worldG = new T.Group(); worldG.matrixAutoUpdate = false; root.add(worldG); scene.add(root);
        // 地上的影子
        const shCv = document.createElement('canvas'); shCv.width = shCv.height = 128; { const x = shCv.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(40,60,55,.45)'); g.addColorStop(.5, 'rgba(40,60,55,.18)'); g.addColorStop(1, 'rgba(40,60,55,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }
        const shadow = new T.Mesh(new T.PlaneGeometry(2.6, 2.6), new T.MeshBasicMaterial({ map: new T.CanvasTexture(shCv), transparent: true, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = -1.03; shadow.scale.set(1, .55, 1); scene.add(shadow);
        // 玻璃球：顶点跟着软体的表面粒子走；天空用同一套顶点、往里缩一点
        const geo = new T.SphereGeometry(1, 56, 36), base = geo.attributes.position.array.slice();
        geo.boundingSphere = new T.Sphere(new T.Vector3(), 4); // 顶点一直在动：给个够大的包围球，射线和裁剪都不用每帧重算
        const skyGeo = new T.BufferGeometry(); skyGeo.setIndex(geo.index); skyGeo.setAttribute('position', new T.BufferAttribute(base.slice(), 3)); skyGeo.setAttribute('dir', new T.BufferAttribute(base.slice(), 3)); skyGeo.boundingSphere = geo.boundingSphere;
        const glass = { high: null, low: null };
        // 果冻感：低反射、无清漆；折射只留一点点（太强会变成放大镜，把岛底下的土放大得满球都是）
        glass.high = new T.MeshPhysicalMaterial({ color: '#ffffff', transmission: 1, thickness: .06, roughness: .03, ior: 1.12, attenuationColor: new T.Color('#e8f7ff'), attenuationDistance: 10, envMapIntensity: .09, specularIntensity: .35, transparent: true, depthWrite: false });
        glass.low = new T.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { c: { value: new T.Color('#d6f0ff') } }, vertexShader: 'varying vec3 n,v;void main(){n=normalize(normalMatrix*normal);vec4 p=modelViewMatrix*vec4(position,1.);v=-p.xyz;gl_Position=projectionMatrix*p;}', fragmentShader: 'uniform vec3 c;varying vec3 n,v;void main(){float f=pow(1.-max(0.,dot(normalize(n),normalize(v))),3.);vec3 l=normalize(vec3(-.5,.8,.6));float s=pow(max(0.,dot(reflect(-l,normalize(n)),normalize(v))),80.);gl_FragColor=vec4(c+s,.04+f*.3+s*.35);}' });
        const globe = new T.Mesh(geo, glass.high); globe.renderOrder = 5; root.add(globe);
        const rim = new T.Mesh(geo, new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, uniforms: {}, vertexShader: 'varying vec3 n,v;void main(){n=normalize(normalMatrix*normal);vec4 p=modelViewMatrix*vec4(position,1.);v=-p.xyz;gl_Position=projectionMatrix*p;}', fragmentShader: 'varying vec3 n,v;void main(){float f=pow(1.-max(0.,dot(normalize(n),normalize(v))),5.);gl_FragColor=vec4(.85,.95,1.,f*.1);}' })); rim.renderOrder = 6; root.add(rim);
        const sky = new T.Mesh(skyGeo, new T.MeshBasicMaterial()); sky.renderOrder = -10; sky.frustumCulled = false; root.add(sky);
        const S = softBall(), sw = skinWeights(base, S);
        const E = { T, canvas, renderer, scene, cam, root, worldG, shadow, geo, skyGeo, base, globe, sky, glass, S, sw, world: null, wkey: '', quality: 'high', lost: false, warmed: false };
        canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); E.lost = true; if (ENG === E) { ENG = null; ENG_P = null; } }); // 切后台被系统回收了：下次打开重建
        ENG = E; return E;
    })().finally(() => { ENG_P = null; }));
}
export const _eng = () => ENG; // 测试用
const setGlass = (E, q) => { E.quality = q; E.globe.material = q === 'high' ? E.glass.high : E.glass.low; };
/** 换一座岛：旧的先从场景里拿下来，但等新的画出第一帧后再拆——否则天空、水面这些着色器会在没人用的那一刻被释放，新岛又得重编 */
function putWorld(E, rc, reduced, weather) {
    const old = E.world; E.world = buildWorld(E.T, rc, { quality: E.quality, reduced, renderer: E.renderer, weather }); E.world.rc = rc; E.wkey = wkeyOf(rc);
    E.worldG.add(E.world.group); E.world.setPixel(E.renderer.getPixelRatio()); E.sky.material = E.world.skyMat;
    if (old) { E.worldG.remove(old.group); (E.trash ||= []).push(old); }
    return E.world;
}
/** 新岛已经画过一帧：拆掉换下来的旧岛 */
const emptyTrash = E => { if (!E.trash?.length) return; for (const w of E.trash) w.dispose(); E.trash.length = 0; };
// 只编译新岛这一组（隐藏的物体 three.js 会跳过，所以不能对整个场景编）；不支持并行编译的机器上就同步编
const compile = async E => { try { const g = E.world?.group; if (!g) return; if (E.renderer.compileAsync) await E.renderer.compileAsync(g, E.cam, E.scene); else E.renderer.compile(g, E.cam, E.scene); } catch (e) { console.warn('[心屿] 编译', e); } };

/**
 * 预热：建好渲染器、拼一座岛、把着色器都编译好（用 KHR_parallel_shader_compile 不卡页面）。打开手机后空闲时调一次
 * @param {object} rc 随便一个配方
 */
export async function warm(rc, quality = 'high') {
    const E = await engine(); if (E.warmed) return; E.warmed = true;
    setGlass(E, quality === 'low' ? 'low' : 'high');
    if (E.active) return; // 心屿已经开着了：它自己会拼岛、编译，别去动画布尺寸和相机
    if (!E.world) putWorld(E, rc, false, 'sunset');
    E.renderer.setSize(64, 64, false); E.cam.aspect = 1; E.cam.updateProjectionMatrix(); E.cam.position.set(0, .9, 4.4); E.cam.lookAt(0, 0, 0);
    await compile(E); await nextFrame(); if (E.active) return;
    E.renderer.render(E.scene, E.cam); emptyTrash(E); // 真画一帧：透射（玻璃）那一趟也编好
}

/**
 * @param {HTMLCanvasElement} cv 页面里的占位画布（会被常驻画布替换掉）
 * @param {() => {scene:string, recipe:object}} getState
 * @param {{quality?:'high'|'low', onQuality?:(q:string)=>void}} opts
 */
export async function jelly(cv, getState, opts = {}) {
    const E = await engine(); if (!cv.isConnected) return { stop() { } };
    const { T, renderer, scene, cam, worldG, shadow, geo, skyGeo, S, sw } = E, posA = geo.attributes.position, skyPos = skyGeo.attributes.position;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let quality = opts.quality === 'low' ? 'low' : 'high';
    if (E.quality !== quality) { setGlass(E, quality); E.world && putWorld(E, getState().recipe, reduced, getState().scene); }
    // 把常驻画布换进页面（沿用占位画布的 class / 无障碍名字）
    E.active = (E.active || 0) + 1; const el = E.canvas; el.className = cv.className; el.setAttribute('aria-label', cv.getAttribute('aria-label') || ''); el.setAttribute('role', 'img'); cv.replaceWith(el);
    S.reset(); S.walls = null;

    /* ---------- 相机：按画布比例算距离，让整个球（加一点弹跳余量）正好放下、居中 ---------- */
    let def = 4.4, zf = 1, zfT = 1; const Z = { min: .72, max: 1.35 };
    const dist = () => def * zf;
    const placeCam = () => { const d = dist(); cam.position.set(0, d * .2, d * .98); cam.lookAt(0, -.02, 0); };

    /* ---------- 状态 ---------- */
    let idleAt = 0, press = null, scene_ = '', building = false, pop = 1, air = false, calm = 0, landed = false;
    let W = 1, H = 1;
    const size = () => { const r = el.getBoundingClientRect(); if (!r.width) return; W = r.width; H = r.height; renderer.setPixelRatio(Math.min(devicePixelRatio || 1, quality === 'high' ? 2 : 1.5)); renderer.setSize(W, H, false); cam.aspect = W / H; cam.updateProjectionMatrix(); def = Math.max(1.15 / TAN, 1.1 / (TAN * cam.aspect)); placeCam(); E.world?.setPixel(renderer.getPixelRatio()); };
    size(); const ro = typeof ResizeObserver == 'function' ? new ResizeObserver(size) : null; ro?.observe(el);
    const room = () => { const hh = TAN * dist(), hw = hh * cam.aspect; return { x: Math.max(1.05, hw * .98), top: Math.max(1.2, hh * 1.05) }; };
    const zoomTo = v => { zfT = Math.max(Z.min, Math.min(Z.max, v)); };

    const applyWeather = (s, built) => { built || E.world.setWeather(s); scene_ = s; const w = WEATHER[s] || WEATHER.sunset; const f = E.world.fog, d = def; scene.fog = f ? new T.Fog(new T.Color(w.hor), d - 1, d - 1 + 2.4 / f) : null; };
    /** 同步换岛（测试 / 画质切换用） */
    const rebuildNow = () => { const st = getState(); putWorld(E, st.recipe, reduced, st.scene); applyWeather(st.scene, true); };
    /** 异步换岛：先显示空玻璃球，下一帧拼岛、编译，好了再弹进来 */
    const rebuild = async () => {
        if (building) return; building = true; const st = getState(), k = wkeyOf(st.recipe);
        worldG.visible = false; await nextFrame(); if (stopped) return;
        if (k !== wkeyOf(getState().recipe)) { building = false; return; } // 等的时候又换了：下一帧重来
        putWorld(E, st.recipe, reduced, getState().scene); applyWeather(getState().scene, true);
        await compile(E); if (stopped) return;
        worldG.visible = true; pop = 0; S.kick(0, 1.6, 0); building = false;
    };

    /* ---------- 物理：软体 → 玻璃顶点、天空、岛的姿态 ---------- */
    const m4 = new T.Matrix4(), UP = [0, 1, 0];
    const sync = () => {
        skin(posA.array, S, sw); posA.needsUpdate = true; geo.computeVertexNormals();
        const c = S.c, sp = skyPos.array, pa = posA.array; for (let i = 0; i < pa.length; i += 3) { sp[i] = c[0] + (pa[i] - c[0]) * .975; sp[i + 1] = c[1] + (pa[i + 1] - c[1]) * .975; sp[i + 2] = c[2] + (pa[i + 2] - c[2]) * .975; } skyPos.needsUpdate = true;
        // 岛：旋转 R × 一半的拉伸（体积不变）；R、A 都是列主序
        const R = S.R(), A = S.A, Rm = (r, c_) => R[c_ * 3 + r], Am = (r, c_) => A[c_ * 3 + r];
        const B = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) { let v = 0; for (let k = 0; k < 3; k++) v += Rm(k, a) * Am(k, b); B[a][b] = (a === b ? .5 : 0) + v * .5; } // ½(I + RᵀA)
        const det = B[0][0] * (B[1][1] * B[2][2] - B[1][2] * B[2][1]) - B[0][1] * (B[1][0] * B[2][2] - B[1][2] * B[2][0]) + B[0][2] * (B[1][0] * B[2][1] - B[1][1] * B[2][0]), s = (.55 + .45 * (1 - (1 - pop) ** 3) + Math.sin(pop * Math.PI) * .05) / Math.cbrt(Math.max(.2, det));
        const M = [0, 1, 2].map(a => [0, 1, 2].map(b => { let v = 0; for (let j = 0; j < 3; j++) v += Rm(a, j) * B[j][b]; return v * s; })); // R·B
        m4.set(M[0][0], M[0][1], M[0][2], c[0], M[1][0], M[1][1], M[1][2], c[1], M[2][0], M[2][1], M[2][2], c[2], 0, 0, 0, 1); worldG.matrix.copy(m4); worldG.matrixWorldNeedsUpdate = true;
        const lift = Math.max(0, c[1]); shadow.position.x = c[0]; shadow.position.z = c[2]; shadow.scale.set(1 - Math.min(.5, lift * .3), .55 * (1 - Math.min(.5, lift * .3)), 1); shadow.material.opacity = 1 / (1 + lift * 1.5);
    };
    const step = dt => {
        const k = Math.min(2, dt * 60), rm = room();
        // 抓着：戳（不动）就往里按；拖就跟着手指
        if (press?.g) { if (press.mode === 'poke') { press.depth = Math.min(.24, press.depth + dt * .9); const d = press.rayDir; press.g.target = [press.hit[0] + d[0] * press.depth, press.hit[1] + d[1] * press.depth, press.hit[2] + d[2] * press.depth]; } else if (press.drag) press.g.target = press.drag; }
        if (air) { S.walls = { x: rm.x, top: rm.top }; if (S.ke < .02 && S.c[1] < .15) { if ((calm += dt) > .5) { air = false; S.gravity = 0; S.tether = 0; S.walls = null; idleAt = performance.now(); } } else calm = 0; }
        else S.tether = Math.min(1, S.tether + dt * 2); // 落地后慢慢把绳子拴回去
        if (air && S.c[1] < .02) landed = true;
        S.damp = air ? (landed ? 4 : 1.5) : press ? 2 : 10; // 拖着时灵活；摇一摇第一次落地后就收住，只再小弹一下；一松手回弹一两下就停
        S.step(Math.min(dt, 1 / 30));
        // 放着不动：像不倒翁一样慢慢立回来，再慢慢自转
        if (!press && !air && performance.now() - idleAt > 1500) {
            const R = S.R(), u = [R[3], R[4], R[5]], ax = [u[1] * UP[2] - u[2] * UP[1], u[2] * UP[0] - u[0] * UP[2], u[0] * UP[1] - u[1] * UP[0]], s = Math.hypot(...ax), a = Math.atan2(s, u[1]);
            if (a > .002) { const axn = s < 1e-4 ? [1, 0, 0] : ax.map(v => v / s); S.rotate(...axn, Math.min(a, (.02 + a * .05) * k)); }
            if (!reduced) S.rotate(0, 1, 0, .0022 * k);
        }
        if (pop < 1) pop = Math.min(1, pop + .06 * k);
        if (Math.abs(zfT - zf) > 1e-4) { zf += (zfT - zf) * Math.min(1, .18 * k); placeCam(); }
        sync();
    };

    /* ---------- 手势 ---------- */
    const ray = new T.Raycaster(), ndc = new T.Vector2(), plane = new T.Plane(), tv = new T.Vector3(), camDir = new T.Vector3();
    const setRay = e => { const r = el.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height * 2 - 1)); ray.setFromCamera(ndc, cam); };
    const hit = e => { setRay(e); const h = ray.intersectObject(E.globe, false)[0]; return h ? h.point.toArray() : null; };
    const L = []; const listen = (t, ev, f, o) => { t.addEventListener(ev, f, o); L.push(() => t.removeEventListener(ev, f, o)); };
    // 捏合缩放：记住所有按着的手指；第二根手指按下时，原来的戳 / 拖立刻结束，改成缩放
    const fingers = new Map(); let pinch = null;
    const endPress = () => { if (!press) return; S.release(); press = null; idleAt = performance.now(); };
    const fdist = () => { const [a, b] = [...fingers.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
    listen(el, 'pointerdown', e => {
        if (e.isPrimary) { fingers.clear(); pinch = null; } // 第一根手指：清掉之前没收到抬起的「幽灵手指」，否则单指会被当成双指缩放
        fingers.set(e.pointerId, { x: e.clientX, y: e.clientY }); try { el.setPointerCapture(e.pointerId); } catch { } e.preventDefault(); idleAt = performance.now();
        if (fingers.size === 2) { endPress(); pinch = { d0: fdist(), z0: zfT }; return; }
        if (fingers.size > 2 || press) return;
        const p = hit(e); if (!p) return;
        const g = S.grabAt(p, .6); if (!g) return; // 抓的范围大一点，拉出来更圆润
        cam.getWorldDirection(camDir); plane.setFromNormalAndCoplanarPoint(camDir, tv.fromArray(p));
        press = { id: e.pointerId, x0: e.clientX, y0: e.clientY, mode: 'poke', hit: p, rayDir: ray.ray.direction.toArray(), depth: 0, g, drag: null };
    });
    listen(el, 'pointermove', e => {
        if (fingers.has(e.pointerId)) fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pinch && fingers.size >= 2) { const d = fdist(); if (d > 10) zoomTo(pinch.z0 * pinch.d0 / d); idleAt = performance.now(); return; }
        if (!press || press.id !== e.pointerId) return;
        if (press.mode === 'poke' && Math.hypot(e.clientX - press.x0, e.clientY - press.y0) > 7) press.mode = 'drag';
        if (press.mode === 'drag') { setRay(e); if (ray.ray.intersectPlane(plane, tv)) { const c = S.c, dx = tv.x - c[0], dy = tv.y - c[1], dz = tv.z - c[2], l = Math.hypot(dx, dy, dz) || 1, m = Math.min(1, 2.3 / l); press.drag = [c[0] + dx * m, c[1] + dy * m, c[2] + dz * m]; } } /* 拉得太远就停在 2.3 倍半径，不至于扯坏 */
        idleAt = performance.now();
    });
    const up = e => {
        if (e?.pointerId != null) fingers.delete(e.pointerId); if (fingers.size < 2) pinch = null;
        if (!press || (e?.pointerId != null && e.pointerId !== press.id)) return;
        endPress();
    };
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(el, ev, up);
    listen(el, 'wheel', e => { e.preventDefault(); zoomTo(zfT * (1 + Math.sign(e.deltaY) * .12)); idleAt = performance.now(); }, { passive: false });

    /** 拍一下：像拍篮球——解开拴绳、打开重力，往随机方向弹出去，砸到地上压扁再弹 */
    const bounce = () => {
        if (reduced) { S.kick(0, 1.2, 0); return; }
        endPress(); air = true; landed = false; calm = 0; S.tether = 0; S.gravity = -14; const rm = room(); S.walls = { x: rm.x, top: rm.top };
        S.kick((Math.random() < .5 ? -1 : 1) * (1.4 + Math.random() * 1.4), 5.5 + Math.random() * 1.5, 0, [(Math.random() - .5) * 6, (Math.random() - .5) * 6, (Math.random() - .5) * 5]); idleAt = performance.now();
    };
    const hop = () => { if (!reduced) S.kick(0, 2.4, 0); };

    /* ---------- 渲染循环 + 画质自动降档 ---------- */
    let raf = 0, stopped = false, last = performance.now(), t0 = last, frames = 0, slow = 0, checked = quality === 'low', nframes = 0;
    const setQuality = qv => { if (qv === quality) return; quality = qv; setGlass(E, qv); size(); rebuildNow(); opts.onQuality?.(qv); };
    // 进来时：岛已经是这一座（预热过 / 刚才看过）就直接显示，否则先显示空球、马上拼
    if (E.world && E.wkey === wkeyOf(getState().recipe)) { worldG.visible = true; applyWeather(getState().scene); E.sky.material = E.world.skyMat; } else rebuild();
    sync();
    const frame = now => {
        if (stopped) return; raf = requestAnimationFrame(frame);
        if (!W || !H) { size(); return; }
        const dt = Math.min(.05, (now - last) / 1000); last = now; const t = reduced ? 0 : (now - t0) / 1000;
        const st = getState();
        if (wkeyOf(st.recipe) !== E.wkey && !building) rebuild();
        if (E.world && !building && st.scene !== scene_) applyWeather(st.scene);
        step(dt);
        E.world?.update(t, dt);
        renderer.render(scene, cam); nframes++; if (!building) emptyTrash(E);
        // 前 4 秒看帧率：撑不住就换轻量玻璃、小阴影
        if (!checked && !building) { frames++; if (dt > 1 / 32 && frames > 20) slow++; if (now - t0 > 4000) { checked = true; if (slow > frames * .4) setQuality('low'); } }
    };
    raf = requestAnimationFrame(frame);
    const vis = () => { if (document.hidden) { cancelAnimationFrame(raf); } else { last = performance.now(); raf = requestAnimationFrame(frame); } }; listen(document, 'visibilitychange', vis);

    return {
        // 停下：只解绑手势、停循环；渲染器、着色器、这座岛都留着，下次打开直接用
        stop: () => { if (stopped) return; stopped = true; building = false; E.active = Math.max(0, (E.active || 1) - 1); cancelAnimationFrame(raf); ro?.disconnect(); L.forEach(f => f()); S.release(); worldG.visible = true; },
        bounce, hop, size, setQuality, zoomTo: v => zoomTo(v / def),
        get quality() { return quality; }, get zoom() { return dist(); }, get frames() { return nframes; },
        /** 测试用：不等真实时间，直接把物理往前算 s 秒（慢机器上帧率不够也能测）；岛没拼好就当场拼 */
        advance(s) { if (wkeyOf(getState().recipe) !== E.wkey || !E.world) { building = false; rebuildNow(); worldG.visible = true; pop = 1; } if (getState().scene !== scene_) applyWeather(getState().scene); idleAt -= s * 1000; for (let i = 0; i < s * 60; i++) step(1 / 60); },
        /** 测试用：朝向、身体位置、按下去多深、缩放 */
        get state() { const R = S.R(); return { up: [R[3], R[4], R[5]], right: [R[0], R[1], R[2]], body: { air, x: S.c[0], y: S.c[1] }, poke: S.grabDepth(), dev: S.dev(), vol: S.volRatio(), quality, zoom: dist(), ready: !!E.world && worldG.visible && !building, stats: E.world?.stats?.() }; }
    };
}

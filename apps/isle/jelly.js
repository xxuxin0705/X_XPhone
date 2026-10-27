// 心屿 · 果冻球（three.js）：玻璃球体 + 软体变形 + 手势（戳、拖着转、翻面、双指捏合 / 滚轮缩放）+ 拍一下乱弹 + 画质自动降档
// three.js 只在打开心屿时按需加载（assets/three，MIT）。球里的世界由 build.js 拼，配方由 gen.js 生成
import { buildWorld, WEATHER } from './build.js';

let THREE_P;
const loadThree = () => (THREE_P ||= import(new URL('../../assets/three/three.module.min.js', import.meta.url).href));
const TAU = Math.PI * 2;

/**
 * @param {HTMLCanvasElement} cv
 * @param {() => {scene:string, recipe:object}} getState
 * @param {{quality?:'high'|'low', onQuality?:(q:string)=>void}} opts
 */
export async function jelly(cv, getState, opts = {}) {
    const T = await loadThree();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let quality = opts.quality === 'low' ? 'low' : 'high';
    const renderer = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setClearColor(0x000000, 0); renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08; renderer.outputColorSpace = T.SRGBColorSpace;
    if ('transmissionResolutionScale' in renderer) renderer.transmissionResolutionScale = .6;
    const scene = new T.Scene(), cam = new T.PerspectiveCamera(30, 1, .05, 30);
    // 相机：绕着球看，dist 是离球心的距离（缩放改它），角度固定略俯视
    const ZOOM = { min: 2.3, max: 5.4, def: 4.05 }; let dist = ZOOM.def, distT = dist; const DIST = ZOOM.def;
    const placeCam = () => { cam.position.set(0, dist * .21, dist * .975); cam.lookAt(0, -.1 - (ZOOM.def - dist) * .06, 0); }; placeCam();
    // 环境反射：一个简单的渐变房间，给玻璃做倒影
    const pm = new T.PMREMGenerator(renderer); const envScene = new T.Scene(); const es = new T.Mesh(new T.SphereGeometry(5, 16, 8), new T.MeshBasicMaterial({ side: T.BackSide, color: '#dfe9f3' })); envScene.add(es);
    const strip = new T.Mesh(new T.PlaneGeometry(3, .6), new T.MeshBasicMaterial({ color: '#ffffff' })); strip.position.set(-1.5, 3, -1); strip.lookAt(0, 0, 0); envScene.add(strip);
    const strip2 = new T.Mesh(new T.PlaneGeometry(1.5, 1.5), new T.MeshBasicMaterial({ color: '#fff4e0' })); strip2.position.set(2.5, 1.5, 2); strip2.lookAt(0, 0, 0); envScene.add(strip2);
    const envTex = pm.fromScene(envScene, .04).texture; scene.environment = envTex; pm.dispose();
    const key = new T.DirectionalLight('#ffffff', .6); key.position.set(-2, 3, 2); scene.add(key);

    const root = new T.Group(), worldG = new T.Group(); root.add(worldG); scene.add(root);
    // 地上的影子
    const shCv = document.createElement('canvas'); shCv.width = shCv.height = 128; { const x = shCv.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(40,60,55,.45)'); g.addColorStop(.5, 'rgba(40,60,55,.18)'); g.addColorStop(1, 'rgba(40,60,55,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }
    const shadow = new T.Mesh(new T.PlaneGeometry(2.6, 2.6), new T.MeshBasicMaterial({ map: new T.CanvasTexture(shCv), transparent: true, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = -1.06; shadow.scale.set(1, .55, 1); scene.add(shadow);

    /* ---------- 玻璃球（软体） ---------- */
    const geo = new T.SphereGeometry(1, 64, 40), base = geo.attributes.position.array.slice(), posA = geo.attributes.position;
    const glassHigh = () => new T.MeshPhysicalMaterial({ color: '#ffffff', transmission: 1, thickness: .2, roughness: .01, ior: 1.25, attenuationColor: new T.Color('#e4f6ff'), attenuationDistance: 8, clearcoat: .5, clearcoatRoughness: .04, envMapIntensity: .16, specularIntensity: .55, transparent: true, depthWrite: false });
    const glassLow = () => new T.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { c: { value: new T.Color('#cfefff') } }, vertexShader: 'varying vec3 n,v;void main(){n=normalize(normalMatrix*normal);vec4 p=modelViewMatrix*vec4(position,1.);v=-p.xyz;gl_Position=projectionMatrix*p;}', fragmentShader: 'uniform vec3 c;varying vec3 n,v;void main(){float f=pow(1.-max(0.,dot(normalize(n),normalize(v))),3.);vec3 l=normalize(vec3(-.5,.8,.6));float s=pow(max(0.,dot(reflect(-l,normalize(n)),normalize(v))),60.);gl_FragColor=vec4(c+s,.08+f*.55+s*.6);}' });
    const globe = new T.Mesh(geo, quality === 'high' ? glassHigh() : glassLow()); globe.renderOrder = 5; root.add(globe);
    const rim = new T.Mesh(geo, new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.FrontSide, uniforms: {}, vertexShader: 'varying vec3 n,v;void main(){n=normalize(normalMatrix*normal);vec4 p=modelViewMatrix*vec4(position,1.);v=-p.xyz;gl_Position=projectionMatrix*p;}', fragmentShader: 'varying vec3 n,v;void main(){float f=pow(1.-max(0.,dot(normalize(n),normalize(v))),4.);gl_FragColor=vec4(.8,.95,1.,f*.22);}' })); rim.renderOrder = 6; root.add(rim); // 和球体共用会变形的几何

    // 软体：几处凹坑（方向 + 深度弹簧）+ 整体压扁
    const dents = []; const sq = { x: 1, y: 1, vx: 0, vy: 0 };
    const tmpV = new T.Vector3();
    const dent = (dir, amp, w = .9, hold = false) => { const d = { dir: dir.clone().normalize(), a: 0, v: amp, t: 0, w, hold, life: 1 }; dents.push(d); return d; };
    let deformed = false;
    const deform = () => {
        let any = false;
        for (let i = dents.length - 1; i >= 0; i--) { const d = dents[i]; d.v += (d.t - d.a) * .16; d.v *= d.hold ? .72 : .86; d.a += d.v; if (!d.hold && Math.abs(d.a) < .002 && Math.abs(d.v) < .002) { dents.splice(i, 1); continue; } any = true; }
        if (!any && !deformed) return;
        for (let i = 0; i < posA.count; i++) {
            const x = base[i * 3], y = base[i * 3 + 1], z = base[i * 3 + 2]; let r = 1;
            for (const d of dents) { const c = x * d.dir.x + y * d.dir.y + z * d.dir.z, ang = Math.acos(Math.max(-1, Math.min(1, c))); r += d.a * Math.exp(-(ang * ang) / (d.w * d.w * .5)); }
            posA.setXYZ(i, x * r, y * r, z * r);
        }
        posA.needsUpdate = true; geo.computeVertexNormals(); deformed = any;
    };

    /* ---------- 状态 ---------- */
    let q = new T.Quaternion(), spin = new T.Vector3(), idleAt = 0, press = null, world = null, wkey = '', scene_ = '';
    const body = { x: 0, y: 0, vx: 0, vy: 0, air: false };
    let W = 1, H = 1, pxU = 100; // 画布尺寸、一个单位多少像素
    const size = () => { const r = cv.getBoundingClientRect(); if (!r.width) return; W = r.width; H = r.height; renderer.setPixelRatio(Math.min(devicePixelRatio || 1, quality === 'high' ? 2 : 1.5)); renderer.setSize(W, H, false); cam.aspect = W / H; cam.updateProjectionMatrix(); pxU = (H / 2) / (Math.tan(cam.fov / 2 * Math.PI / 180) * dist); world?.setPixel(renderer.getPixelRatio()); };
    size(); const ro = typeof ResizeObserver == 'function' ? new ResizeObserver(size) : null; ro?.observe(cv);
    const room = () => { const hh = Math.tan(cam.fov / 2 * Math.PI / 180) * dist, hw = hh * cam.aspect; return { side: Math.max(.05, hw - 1.06), ceil: Math.max(.1, hh * 1.1 - 1.06) }; };
    const zoomTo = v => { distT = Math.max(ZOOM.min, Math.min(ZOOM.max, v)); };

    const rebuild = () => { const st = getState(); if (world) { worldG.remove(world.group); world.dispose(); } world = buildWorld(T, st.recipe, { quality, reduced, renderer }); worldG.add(world.group); world.setPixel(renderer.getPixelRatio()); scene_ = ''; };
    const applyWeather = s => { world.setWeather(s); scene_ = s; const w = WEATHER[s] || WEATHER.sunset; const f = world.fog; scene.fog = f ? new T.Fog(new T.Color(w.hor), DIST - 1, DIST - 1 + 2.4 / f) : null; };

    /* ---------- 物理 ---------- */
    const UP = new T.Vector3(0, 1, 0), tq = new T.Quaternion(), ax = new T.Vector3();
    const step = dt => {
        const k = Math.min(2, dt * 60); // 按 60fps 的步长缩放
        // 身体：乱弹 / 跟着手指 / 回原位
        const rm = room();
        if (body.air) {
            body.vy -= .006 * k; body.x += body.vx * k; body.y += body.vy * k;
            if (body.y <= 0) { const v = Math.max(0, -body.vy); body.y = 0; body.vy = v * .68; body.vx *= .85; dent(new T.Vector3(0, -1, 0), -Math.min(.3, v * 2.2), 1.2); sq.vy -= Math.min(.22, v * 1.3); sq.vx += Math.min(.18, v); spin.z -= body.vx * .5; if (v < .02 && Math.abs(body.vx) < .008) { body.vy = 0; body.air = false; } }
            if (body.y > rm.ceil) { body.y = rm.ceil; body.vy = -Math.abs(body.vy) * .6; dent(new T.Vector3(0, 1, 0), -.18, 1.2); }
            if (Math.abs(body.x) > rm.side) { const sd = Math.sign(body.x); body.x = sd * rm.side; const v = Math.abs(body.vx); body.vx = -sd * v * .75; dent(new T.Vector3(sd, 0, 0), -Math.min(.28, v * 3), 1.2); sq.vx -= Math.min(.2, v * 2); spin.x += (Math.random() - .5) * .06; }
        } else if (press?.mode === 'drag') { body.vx += (press.dx * .1 - body.x) * .2; body.vy += (-press.dy * .1 - body.y) * .2; body.vx *= .6; body.vy *= .6; body.x += body.vx; body.y += body.vy; }
        else { body.vx += -body.x * .1; body.vy += -body.y * .1; body.vx *= .8; body.vy *= .8; body.x += body.vx; body.y += body.vy; }
        // 整体压扁
        const sp = body.air ? Math.min(.1, Math.hypot(body.vx, body.vy) * .6) : 0;
        sq.vx += ((1 - sp * .35) - sq.x) * .12 * k; sq.vy += ((1 + sp * .5) - sq.y) * .12 * k; sq.vx *= .84; sq.vy *= .84; sq.x += sq.vx; sq.y += sq.vy;
        // 转动：拖 → 惯性 → 回正 → 慢慢自转
        if (spin.lengthSq() > 1e-8) { const a = spin.length() * k; tq.setFromAxisAngle(ax.copy(spin).normalize(), a); q.premultiply(tq); spin.multiplyScalar(Math.pow(body.air ? .985 : .95, k)); }
        if (!press && !body.air && performance.now() - idleAt > 1500) {
            const u = tmpV.set(0, 1, 0).applyQuaternion(q); ax.crossVectors(u, UP); const s = ax.length(), c = u.dot(UP), a = Math.atan2(s, c);
            if (a > .002) { if (s < 1e-4) ax.set(1, 0, 0); else ax.divideScalar(s); tq.setFromAxisAngle(ax, Math.min(a, (.02 + a * .05) * k)); q.premultiply(tq); }
            if (!reduced) { tq.setFromAxisAngle(UP, .0022 * k); q.multiply(tq); }
        }
        worldG.quaternion.copy(q);
        if (Math.abs(distT - dist) > 1e-4) { dist += (distT - dist) * Math.min(1, .18 * k); placeCam(); pxU = (H / 2) / (Math.tan(cam.fov / 2 * Math.PI / 180) * dist); }
        root.position.set(body.x, body.y, 0); root.scale.set(sq.x, sq.y, sq.x);
        const lift = Math.max(0, body.y); shadow.position.x = body.x; shadow.scale.set(1 - Math.min(.5, lift * .3), .55 * (1 - Math.min(.5, lift * .3)), 1); shadow.material.opacity = 1 / (1 + lift * 1.5);
        deform();
    };

    /* ---------- 手势 ---------- */
    const ray = new T.Raycaster(), ndc = new T.Vector2(), sphere = new T.Sphere(new T.Vector3(), 1), hitP = new T.Vector3();
    const hit = e => { const r = cv.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height * 2 - 1)); ray.setFromCamera(ndc, cam); sphere.center.copy(root.position); sphere.radius = 1.04 * Math.max(sq.x, sq.y); return ray.ray.intersectSphere(sphere, hitP) ? hitP.clone().sub(root.position).normalize() : null; };
    const L = []; const listen = (t, ev, f, o) => { t.addEventListener(ev, f, o); L.push(() => t.removeEventListener(ev, f, o)); };
    // 捏合缩放：记住所有按着的手指；第二根手指按下时，原来的戳 / 拖立刻结束，改成缩放
    const fingers = new Map(); let pinch = null;
    const endPress = () => { if (!press) return; if (press.mode === 'drag') { press.pull.hold = false; press.pull.t = 0; } else { press.poke.hold = false; press.poke.t = 0; } press = null; };
    const fdist = () => { const [a, b] = [...fingers.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
    listen(cv, 'pointerdown', e => {
        fingers.set(e.pointerId, { x: e.clientX, y: e.clientY }); cv.setPointerCapture?.(e.pointerId); e.preventDefault(); idleAt = performance.now();
        if (fingers.size === 2) { endPress(); pinch = { d0: fdist(), z0: distT }; return; }
        if (fingers.size > 2 || press) return;
        const dir = hit(e); if (!dir) return;
        press = { id: e.pointerId, x0: e.clientX, y0: e.clientY, lx: e.clientX, ly: e.clientY, at: performance.now(), mode: 'poke', wx: 0, wy: 0, dx: 0, dy: 0, dir, poke: dent(dir, 0, .8, true), pull: null };
        press.poke.t = -.1;
    });
    listen(cv, 'pointermove', e => {
        if (fingers.has(e.pointerId)) fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pinch && fingers.size >= 2) { const d = fdist(); if (d > 10) zoomTo(pinch.z0 * pinch.d0 / d); idleAt = performance.now(); return; }
        if (!press || press.id !== e.pointerId) return;
        const now = performance.now(), dt = Math.max(8, now - press.at), ddx = e.clientX - press.lx, ddy = e.clientY - press.ly;
        if (press.mode === 'poke') { press.poke.t = Math.max(-.3, press.poke.t - .006 * dt); if (Math.hypot(e.clientX - press.x0, e.clientY - press.y0) > 7) { press.mode = 'drag'; press.poke.hold = false; press.poke.t = 0; press.pull = dent(new T.Vector3(1, 0, 0), 0, 1.1, true); } }
        if (press.mode === 'drag') {
            const ry = ddx / pxU * 1.1, rx = ddy / pxU * 1.1; tq.setFromAxisAngle(UP, ry); q.premultiply(tq); tq.setFromAxisAngle(new T.Vector3(1, 0, 0), rx); q.premultiply(tq);
            press.wx = rx * 16 / dt; press.wy = ry * 16 / dt;
            press.dx = (e.clientX - press.x0) / pxU; press.dy = (e.clientY - press.y0) / pxU;
            const m = Math.min(.6, Math.hypot(press.dx, press.dy)); press.pull.dir.set(press.dx, -press.dy, .2).normalize(); press.pull.t = m * .35;
        }
        press.lx = e.clientX; press.ly = e.clientY; press.at = now; idleAt = now;
    });
    const up = e => {
        if (e?.pointerId != null) fingers.delete(e.pointerId); if (fingers.size < 2) pinch = null;
        if (!press || (e?.pointerId != null && e.pointerId !== press.id)) return;
        if (press.mode === 'drag') { if (performance.now() - press.at < 80) { spin.x += press.wx; spin.y += press.wy; } press.pull.hold = false; press.pull.t = 0; press.pull.v -= .08; }
        else { press.poke.hold = false; press.poke.t = 0; press.poke.v += .09; sq.vx += .03; sq.vy -= .03; }
        press = null; idleAt = performance.now();
    };
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(cv, ev, up);
    listen(cv, 'wheel', e => { e.preventDefault(); zoomTo(distT * (1 + Math.sign(e.deltaY) * .12)); idleAt = performance.now(); }, { passive: false });

    /** 拍一下：像拍篮球，往随机方向弹出去，边弹边翻滚 */
    const bounce = () => {
        if (reduced) { dent(new T.Vector3(Math.random() - .5, Math.random() - .5, 1), .15); return; }
        body.air = true; body.vy = .1 + Math.random() * .05; body.vx = (Math.random() < .5 ? -1 : 1) * (.035 + Math.random() * .045);
        spin.set((Math.random() - .5) * .14, (Math.random() - .5) * .18, (Math.random() - .5) * .1);
        dent(new T.Vector3(0, -1, .3), -.25, 1.2); sq.vy -= .14; idleAt = performance.now();
    };
    const hop = () => { if (reduced) return; body.air = true; body.vy = .065; body.vx = 0; dent(new T.Vector3(0, -1, 0), .08, 1.4); };

    /* ---------- 渲染循环 + 画质自动降档 ---------- */
    let raf = 0, stopped = false, last = performance.now(), t0 = last, frames = 0, slow = 0, checked = quality === 'low', nframes = 0;
    const setQuality = qv => { if (qv === quality) return; quality = qv; globe.material.dispose(); globe.material = qv === 'high' ? glassHigh() : glassLow(); size(); rebuild(); applyWeather(getState().scene); opts.onQuality?.(qv); };
    const frame = now => {
        if (stopped) return; raf = requestAnimationFrame(frame);
        if (!W || !H) { size(); return; }
        const dt = Math.min(.05, (now - last) / 1000); last = now; const t = reduced ? 0 : (now - t0) / 1000;
        const st = getState(), k = `${st.recipe?.seed}|${st.recipe?.climate}|${st.recipe?.mark}`;
        if (k !== wkey) { wkey = k; rebuild(); }
        if (st.scene !== scene_) applyWeather(st.scene);
        if (!reduced || press || body.air) step(dt);
        world.update(t, dt);
        renderer.render(scene, cam); nframes++;
        // 前 4 秒看帧率：撑不住就换轻量玻璃、小阴影
        if (!checked) { frames++; if (dt > 1 / 32 && frames > 20) slow++; if (now - t0 > 4000) { checked = true; if (slow > frames * .4) setQuality('low'); } }
    };
    raf = requestAnimationFrame(frame);
    const vis = () => { if (document.hidden) { cancelAnimationFrame(raf); } else { last = performance.now(); raf = requestAnimationFrame(frame); } }; listen(document, 'visibilitychange', vis);

    return {
        stop: () => { stopped = true; cancelAnimationFrame(raf); ro?.disconnect(); L.forEach(f => f()); world?.dispose(); geo.dispose(); globe.material.dispose(); envTex.dispose(); renderer.dispose(); renderer.forceContextLoss?.(); }, // 反复开关不会攒下一堆 WebGL 上下文
        bounce, hop, size, setQuality, zoomTo,
        get quality() { return quality; }, get zoom() { return dist; }, get frames() { return nframes; },
        /** 测试用：不等真实时间，直接把物理往前算 s 秒（慢机器上帧率不够也能测） */
        advance(s) { const st = getState(), k = `${st.recipe?.seed}|${st.recipe?.climate}|${st.recipe?.mark}`; if (k !== wkey) { wkey = k; rebuild(); } if (st.scene !== scene_) applyWeather(st.scene); idleAt -= s * 1000; for (let i = 0; i < s * 60; i++) step(1 / 60); },
        /** 测试用：当前朝向、身体、凹坑 */
        get state() { const m = new T.Matrix4().makeRotationFromQuaternion(q).elements; return { up: [m[4], m[5], m[6]], right: [m[0], m[1], m[2]], body: { ...body }, dents: dents.map(d => ({ a: d.a, hold: d.hold })), quality, zoom: dist, zoomT: distT, stats: world?.stats?.() }; }
    };
}

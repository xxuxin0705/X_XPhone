// 心屿 · 果冻球：软体外形、戳哪凹哪、拖着转（能把岛翻过来）、拍一下四处乱弹
// 球里的世界由 world.js 画；这里只管球本身的物理和手势。
import { makeWorld, mul, Rx, Ry, Rz, Raxis, ortho } from './world.js';

const TAU = Math.PI * 2, TILT = .44; // 静止时略微俯视
const UP0 = [0, Math.cos(TILT), Math.sin(TILT)];

/**
 * @param {HTMLCanvasElement} cv
 * @param {() => {scene:string, sea:number, biome:string, seed:number}} getState
 */
export function globe(cv, getState) {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const x = cv.getContext('2d');
    let W = 0, H = 0, R = 0, CX = 0, CY = 0, raf = 0, stopped = false, t0 = performance.now();
    const size = () => { const r = cv.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2); cv.width = r.width * d; cv.height = r.height * d; x.setTransform(d, 0, 0, d, 0, 0); W = r.width; H = r.height; R = Math.min(W * .34, H * .36); CX = W / 2; CY = H - R * 1.16; };
    size(); const ro = typeof ResizeObserver == 'function' ? new ResizeObserver(size) : null; ro?.observe(cv);

    // 朝向：世界 → 屏幕；转动角速度（绕屏幕的 x / y / z 轴）
    let M = Rx(TILT), spin = [0, 0, 0], idleAt = 0;
    // 软体外形：一圈 48 个点，每个点一根径向弹簧，相邻点互相拉着
    const N = 48, off = new Float32Array(N), vel = new Float32Array(N), ang = i => i / N * TAU, wrap = i => (i % N + N) % N;
    const dent = (a, amt, w = 1.2) => { for (let i = 0; i < N; i++) { let d = Math.abs(ang(i) - a); d = Math.min(d, TAU - d); vel[i] += amt * Math.exp(-(d * d) / (w * w * .18)); } };
    const sq = { x: 1, y: 1, vx: 0, vy: 0 };
    // 身体：平时在原位，拍一下会飞起来、撞墙撞地乱弹
    const body = { x: 0, y: 0, vx: 0, vy: 0, air: false };
    // 按住：poke = 戳（原地凹进去），drag = 拖（转球 + 拉扯）
    let press = null; const dim = { u: 0, v: 0, d: 0, vd: 0, on: false };

    let world = null, wkey = '';
    const blob = (cx, cy, rx, ry) => { const P = []; for (let i = 0; i < N; i++) { const a = ang(i), k = 1 + off[i]; P.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); }
        x.beginPath(); const m = (i, j) => [(P[i][0] + P[j][0]) / 2, (P[i][1] + P[j][1]) / 2]; const s0 = m(N - 1, 0); x.moveTo(s0[0], s0[1]);
        for (let i = 0; i < N; i++) { const e = m(i, wrap(i + 1)); x.quadraticCurveTo(P[i][0], P[i][1], e[0], e[1]); } x.closePath(); };

    const room = () => ({ side: Math.max(.05, (W / 2 - R * 1.04) / R), ceil: Math.max(.1, (CY - R * 1.04) / R) });
    const step = () => {
        // 外形弹簧
        if (press?.mode === 'drag') { const m = Math.min(.18, press.pull * .5), a = press.pa; for (let i = 0; i < N; i++) { let d = Math.abs(ang(i) - a); d = Math.min(d, TAU - d); vel[i] += (m * Math.exp(-(d * d) / .3) - m * .1 - off[i]) * .2; } }
        if (press?.mode === 'poke') { const near = Math.min(1, Math.hypot(dim.u, dim.v)); const a = Math.atan2(dim.v, dim.u), m = -dim.d * near * near * .9; for (let i = 0; i < N; i++) { let d = Math.abs(ang(i) - a); d = Math.min(d, TAU - d); vel[i] += (m * Math.exp(-(d * d) / .35) - off[i]) * .25; } }
        for (let i = 0; i < N; i++) vel[i] += -off[i] * .12 + (off[wrap(i - 1)] + off[wrap(i + 1)] - 2 * off[i]) * .3;
        for (let i = 0; i < N; i++) { vel[i] *= .86; off[i] = Math.max(-.4, Math.min(.5, off[i] + vel[i])); }
        // 凹坑：按住时越来越深，松手弹回来还会鼓一下
        dim.vd += ((dim.on ? .32 : 0) - dim.d) * (dim.on ? .08 : .16); dim.vd *= dim.on ? .7 : .78; dim.d += dim.vd;
        // 身体
        const rm = room();
        if (body.air) {
            body.vy += .006; body.x += body.vx; body.y += body.vy;
            if (body.y >= 0) { const v = body.vy; body.y = 0; body.vy = -v * .7; body.vx *= .85; dent(Math.PI / 2, -Math.min(.35, v * 2.2), 1.6); dent(0, Math.min(.12, v), 1); dent(Math.PI, Math.min(.12, v), 1); sq.vy -= Math.min(.22, v * 1.2); sq.vx += Math.min(.18, v); spin[2] -= body.vx * .6; if (Math.abs(body.vy) < .02 && Math.abs(body.vx) < .01) { body.vy = 0; body.air = false; } }
            if (body.y < -rm.ceil) { body.y = -rm.ceil; body.vy = Math.abs(body.vy) * .6; dent(-Math.PI / 2, -.2, 1.4); }
            if (Math.abs(body.x) > rm.side) { const sd = Math.sign(body.x); body.x = sd * rm.side; const v = Math.abs(body.vx); body.vx = -sd * v * .75; dent(sd > 0 ? 0 : Math.PI, -Math.min(.3, v * 3), 1.4); sq.vx -= Math.min(.2, v * 2); spin[0] += (Math.random() - .5) * .06; }
        } else if (press?.mode === 'drag') { body.vx += (press.dx * .12 - body.x) * .2; body.vy += (press.dy * .12 - body.y) * .2; body.vx *= .6; body.vy *= .6; body.x += body.vx; body.y += body.vy; }
        else { body.vx += -body.x * .1; body.vy += -body.y * .1; body.vx *= .8; body.vy *= .8; body.x += body.vx; body.y += body.vy; }
        // 整体压扁：飞得快时顺着速度拉长
        const sp = body.air ? Math.min(.1, Math.hypot(body.vx, body.vy) * .6) : 0, ty = 1 + sp * .5, tx = 1 - sp * .35;
        sq.vx += (tx - sq.x) * .12; sq.vy += (ty - sq.y) * .12; sq.vx *= .84; sq.vy *= .84; sq.x += sq.vx; sq.y += sq.vy;
        // 转动：手指拖 / 惯性 / 乱弹时翻滚；没人碰的时候慢慢自转，并像不倒翁一样回正
        if (Math.abs(spin[0]) + Math.abs(spin[1]) + Math.abs(spin[2]) > 1e-5) { M = mul(Rz(spin[2]), mul(Rx(spin[0]), mul(Ry(spin[1]), M))); spin = spin.map(v => v * (body.air ? .985 : .95)); }
        if (!press && !body.air && performance.now() - idleAt > 1600) {
            const u = [M[1], M[4], M[7]], ax = [u[1] * UP0[2] - u[2] * UP0[1], u[2] * UP0[0] - u[0] * UP0[2], u[0] * UP0[1] - u[1] * UP0[0]], s = Math.hypot(...ax), c = u[0] * UP0[0] + u[1] * UP0[1] + u[2] * UP0[2], a = Math.atan2(s, c);
            if (a > .002) M = s < 1e-4 ? mul(Raxis(1, 0, 0, .05), M) : mul(Raxis(ax[0] / s, ax[1] / s, ax[2] / s, Math.min(a, .02 + a * .05)), M);
            if (!reduced) M = mul(M, Ry(.0025));
        }
        M = ortho(M);
    };

    const draw = () => {
        if (stopped) return;
        if (R < 4) { size(); raf = requestAnimationFrame(draw); return; } // 还没排版出尺寸
        const st = getState(), key = `${st.biome}|${st.seed}`;
        if (key !== wkey) { wkey = key; world = makeWorld(st.biome, st.seed); }
        if (!reduced || press || body.air) step();
        const t = reduced ? 0 : (performance.now() - t0) / 1000, cx = CX + body.x * R, cy = CY + body.y * R, rx = R * sq.x, ry = R * sq.y;
        x.clearRect(0, 0, W, H);
        // 地上的影子：飞得越高越小越淡
        const fy = CY + R * 1.02, lift = Math.max(0, -body.y), sr = R * (.85 - Math.min(.5, lift * .3));
        let g = x.createRadialGradient(cx, fy, 0, cx, fy, sr); g.addColorStop(0, `rgba(48,76,66,${.22 / (1 + lift * 1.5)})`); g.addColorStop(1, 'rgba(48,76,66,0)');
        x.save(); x.translate(cx, fy); x.scale(1, .16); x.translate(-cx, -fy); x.fillStyle = g; x.fillRect(cx - sr, fy - sr, sr * 2, sr * 2); x.restore();
        // 球里的世界
        x.save(); blob(cx, cy, rx, ry); x.clip();
        world(x, { cx, cy, kx: rx, ky: ry, M, t, scene: st.scene, sea: st.sea });
        // 戳出来的凹坑：中间暗、边上一圈亮；弹回来时变成一个小鼓包的高光
        if (Math.abs(dim.d) > .01) { const px = cx + dim.u * rx, py = cy + dim.v * ry, r = R * (.22 + Math.abs(dim.d) * .5);
            g = x.createRadialGradient(px, py, 0, px, py, r);
            if (dim.d > 0) { g.addColorStop(0, `rgba(20,40,60,${dim.d * .9})`); g.addColorStop(.6, `rgba(20,40,60,${dim.d * .3})`); g.addColorStop(.85, `rgba(255,255,255,${dim.d * .9})`); g.addColorStop(1, 'rgba(255,255,255,0)'); }
            else { g.addColorStop(0, `rgba(255,255,255,${-dim.d * 1.4})`); g.addColorStop(1, 'rgba(255,255,255,0)'); }
            x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, TAU); x.fill(); }
        // 玻璃：边缘一圈淡淡的折射色
        g = x.createRadialGradient(cx - rx * .25, cy - ry * .3, R * .2, cx, cy, R * 1.05); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.78, 'rgba(225,240,250,.06)'); g.addColorStop(1, 'rgba(190,215,235,.5)');
        x.fillStyle = g; x.fillRect(cx - R * 2, cy - R * 2, R * 4, R * 4);
        x.restore();
        x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = 1; blob(cx, cy, rx, ry); x.stroke();
        // 高光固定在左上（光从那边来）
        x.save(); x.translate(cx, cy); x.scale(rx, ry); x.lineCap = 'round';
        x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = .02; x.beginPath(); x.arc(0, 0, .9, Math.PI * 1.1, Math.PI * 1.45); x.stroke();
        x.strokeStyle = 'rgba(255,255,255,.3)'; x.lineWidth = .012; x.beginPath(); x.arc(0, 0, .88, -.2, .7); x.stroke();
        x.fillStyle = 'rgba(255,255,255,.5)'; x.beginPath(); x.ellipse(-.48, -.55, .12, .06, -.7, 0, TAU); x.fill();
        x.restore();
        raf = requestAnimationFrame(draw);
    };

    /* ---------- 手势 ---------- */
    const local = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left - (CX + body.x * R)) / (R * sq.x), (e.clientY - r.top - (CY + body.y * R)) / (R * sq.y)]; };
    const L = []; const listen = (t, ev, f, o) => { t.addEventListener(ev, f, o); L.push(() => t.removeEventListener(ev, f, o)); };
    listen(cv, 'pointerdown', e => {
        if (press || e.isPrimary === false) return;
        const [u, v] = local(e); if (Math.hypot(u, v) > 1.08) return;
        press = { id: e.pointerId, x0: e.clientX, y0: e.clientY, lx: e.clientX, ly: e.clientY, at: performance.now(), mode: 'poke', wx: 0, wy: 0, pull: 0, pa: 0, dx: 0, dy: 0 };
        Object.assign(dim, { u, v, on: true }); idleAt = performance.now();
        cv.setPointerCapture?.(e.pointerId); e.preventDefault();
    });
    listen(cv, 'pointermove', e => {
        if (!press || press.id !== e.pointerId) return;
        const ddx = e.clientX - press.lx, ddy = e.clientY - press.ly, now = performance.now(), dt = Math.max(8, now - press.at);
        if (press.mode === 'poke' && Math.hypot(e.clientX - press.x0, e.clientY - press.y0) > 7) { press.mode = 'drag'; dim.on = false; }
        if (press.mode === 'drag') {
            const ay = ddx / R, ax = ddy / R; M = mul(Rx(ax), mul(Ry(ay), M));
            press.wx = ax * 16 / dt; press.wy = ay * 16 / dt;
            const dx = (e.clientX - press.x0) / R, dy = (e.clientY - press.y0) / R; press.dx = dx; press.dy = dy; press.pull = Math.min(.5, Math.hypot(dx, dy)); press.pa = Math.atan2(dy, dx);
        }
        press.lx = e.clientX; press.ly = e.clientY; press.at = now; idleAt = now;
    });
    const up = e => {
        if (!press || (e?.pointerId != null && e.pointerId !== press.id)) return;
        if (press.mode === 'drag') { spin[0] += press.wx; spin[1] += press.wy; if (performance.now() - press.at > 80) spin = [0, 0, 0]; }
        else { const near = Math.min(1, Math.hypot(dim.u, dim.v)); dent(Math.atan2(dim.v, dim.u), .14 * near, 1); sq.vx += .03; sq.vy -= .03; }
        dim.on = false; press = null; idleAt = performance.now();
    };
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(cv, ev, up);

    /** 拍一下：像拍篮球，往随机方向弹出去，边弹边翻滚 */
    const bounce = () => {
        if (reduced) { dent(Math.random() * TAU, .2); return; }
        body.air = true; body.vy = -(.11 + Math.random() * .05); body.vx = (Math.random() < .5 ? -1 : 1) * (.04 + Math.random() * .05);
        spin = [(Math.random() - .5) * .16, (Math.random() - .5) * .2, (Math.random() - .5) * .1];
        dent(Math.random() * TAU, -.3, 1.3); sq.vy -= .15; idleAt = performance.now();
    };
    /** 读到新心情：轻轻跳一下 */
    const hop = () => { if (reduced) return; body.air = true; body.vy = -.07; body.vx = 0; dent(Math.PI / 2, .1, 1.6); };

    draw();
    return {
        stop: () => { stopped = true; cancelAnimationFrame(raf); ro?.disconnect(); L.forEach(f => f()); },
        bounce, hop, size,
        /** 测试用：当前朝向和状态 */
        get state() { return { M: [...M], body: { ...body }, dim: { ...dim }, off: [...off] }; }
    };
}

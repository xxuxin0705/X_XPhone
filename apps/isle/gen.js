// 心屿 · 风景配方：每次随机拼一座岛（时代 × 气候 × 地形 × 地标套件 × 植物 × 动物 × 配色），不限定几种
// 纯逻辑，不碰 DOM 和 three.js，可以在 Node 里直接测
// AI 导演：剧情里的风景词（「古寺 求签 枫叶」「深夜便利店 路灯 雨」）映射成配方里的选项；没有 AI 时按角色卡的时代偏向（eraOf）
const TAU = Math.PI * 2;
export const rng = seed => { let s = (seed >>> 0) || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };
export const hash = str => [...String(str)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];
const weighted = (r, obj) => { const ks = Object.keys(obj), tot = ks.reduce((a, k) => a + obj[k], 0); let x = r() * tot; for (const k of ks) { x -= obj[k]; if (x <= 0) return k; } return ks[ks.length - 1]; };

/* ---------- 气候：决定地面颜色、植物、能出现的地标 ---------- */
export const CLIMATES = {
    tropical: { name: '热带海岛', ground: [95, .45, .55], cliff: [30, .3, .4], trees: ['palm'], marks: ['lighthouse', 'cabin', 'tent', 'cafe'], animals: ['whale', 'birds'], fall: '' },
    temperate: { name: '青草坡', ground: [105, .5, .5], cliff: [28, .28, .38], trees: ['broad', 'pine'], marks: ['windmill', 'cabin', 'tower', 'castle', 'tent', 'cafe', 'temple', 'school', 'house'], animals: ['sheep', 'birds', 'fox'], fall: '' },
    snow: { name: '雪原', ground: [210, .25, .93], cliff: [215, .15, .55], trees: ['pine'], marks: ['cabin', 'castle', 'observatory', 'tent', 'lighthouse', 'temple', 'izakaya'], animals: ['fox', 'birds'], fall: 'snow', snowy: true },
    autumn: { name: '枫林', ground: [38, .5, .5], cliff: [24, .3, .35], trees: ['maple', 'broad'], marks: ['cabin', 'shrine', 'temple', 'tent', 'tower', 'cafe', 'izakaya', 'pagoda'], animals: ['fox', 'birds'], fall: 'leaf' },
    sakura: { name: '樱花林', ground: [100, .45, .55], cliff: [25, .3, .38], trees: ['sakura'], marks: ['shrine', 'temple', 'pagoda', 'cafe', 'school', 'station'], animals: ['birds'], fall: 'petal' },
    desert: { name: '沙漠绿洲', ground: [40, .55, .72], cliff: [32, .45, .5], trees: ['cactus', 'palm'], marks: ['pyramid', 'tent', 'tower'], animals: ['birds'], fall: '', oasis: true },
    city: { name: '小城', ground: [115, .18, .5], cliff: [215, .08, .4], trees: ['broad'], marks: ['street', 'ferris', 'tower', 'cafe', 'station', 'school', 'hospital', 'izakaya'], animals: ['birds'], fall: '', urban: true },
    lavender: { name: '薰衣草田', ground: [270, .35, .6], cliff: [28, .28, .38], trees: ['broad', 'cypress'], marks: ['windmill', 'cabin', 'cafe', 'tower', 'house'], animals: ['sheep', 'birds'], fall: 'petal' },
    bamboo: { name: '竹林', ground: [95, .4, .45], cliff: [30, .25, .32], trees: ['bamboo'], marks: ['shrine', 'pagoda', 'temple', 'cabin', 'izakaya'], animals: ['birds', 'fox'], fall: 'leaf' },
    mushroom: { name: '蘑菇森林', ground: [140, .4, .4], cliff: [280, .2, .3], trees: ['mushroom', 'broad'], marks: ['cabin', 'tent', 'tower'], animals: ['fox', 'birds'], fall: 'spore', glow: true },
    volcano: { name: '火山岛', ground: [15, .3, .28], cliff: [10, .35, .2], trees: ['pine', 'palm'], marks: ['observatory', 'tent', 'lighthouse'], animals: ['birds'], fall: 'ash', lava: true },
    moor: { name: '雾中荒原', ground: [80, .2, .45], cliff: [200, .1, .35], trees: ['pine', 'cypress'], marks: ['castle', 'tower', 'lighthouse', 'shrine'], animals: ['sheep', 'birds'], fall: '' },
};
export const TERRAINS = { floating: '浮岛', sea: '海中孤岛', plateau: '高原', twin: '双子岛', lake: '湖心', atoll: '环礁' };
export const MARKS = { temple: '古寺', shrine: '神社', pagoda: '宝塔', street: '街角', school: '学校', hospital: '医院', cafe: '咖啡馆', izakaya: '小酒馆', station: '小车站', lighthouse: '灯塔', windmill: '风车', castle: '小城堡', tower: '钟楼', observatory: '天文台', tent: '营地', cabin: '木屋', house: '小院', pyramid: '金字塔', ferris: '摩天轮' };
/** 地标属于哪个时代（随机时按角色卡的时代偏向） */
export const ERA = { modern: ['street', 'school', 'hospital', 'cafe', 'station', 'ferris', 'observatory', 'lighthouse', 'izakaya'], ancient: ['temple', 'shrine', 'pagoda', 'castle', 'tower', 'windmill', 'pyramid', 'izakaya'], nature: ['cabin', 'tent', 'house', 'lighthouse', 'windmill'] };
export const TREES = { palm: '椰子树', broad: '阔叶树', pine: '松树', maple: '枫树', sakura: '樱花树', cactus: '仙人掌', cypress: '柏树', bamboo: '竹子', mushroom: '大蘑菇' };
export const ANIMALS = { whale: '鲸鱼', sheep: '羊群', birds: '飞鸟', fox: '小狐狸' };
export const EXTRAS = { lanterns: '灯笼', fireflies: '萤火虫', hotspring: '温泉', bridge: '小桥', path: '小路', river: '小溪', flowers: '野花', boat: '小船', bonfire: '篝火', bench: '长椅', lamp: '路灯', swing: '秋千', pond: '池塘' };
// 哪种地形配哪种气候更合理
const TERRAIN_W = {
    tropical: { sea: 5, atoll: 3, floating: 2, twin: 2 }, temperate: { floating: 4, plateau: 2, lake: 2, twin: 1 }, snow: { floating: 3, plateau: 3, lake: 2 },
    autumn: { floating: 3, lake: 3, plateau: 1 }, sakura: { floating: 3, lake: 3, plateau: 1 }, desert: { plateau: 4, floating: 2 }, city: { floating: 3, sea: 2, plateau: 2 },
    lavender: { floating: 3, plateau: 3 }, bamboo: { floating: 3, plateau: 2, lake: 2 }, mushroom: { floating: 4, lake: 1 }, volcano: { sea: 4, floating: 2 }, moor: { plateau: 3, floating: 2, lake: 2, sea: 1 },
};
// 大套件占地大，岛也要大一点；放在中间
const BIG = { temple: .36, street: .4, school: .34, hospital: .3, shrine: .3, pagoda: .2, castle: .25, cafe: .22, izakaya: .2, station: .32, ferris: .22, lighthouse: .14, windmill: .14 };

/* ---------- 配色：以气候的色相为中心轻微抖动，所以同气候的岛也不一样 ---------- */
const hsl = (h, s, l) => { h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l)); const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)); return '#' + [f(0), f(8), f(4)].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join(''); };
const jitter = (r, [h, s, l], dh = 8, ds = .06, dl = .05) => [h + (r() - .5) * 2 * dh, s + (r() - .5) * 2 * ds, l + (r() - .5) * 2 * dl];
function palette(r, C, climate) {
    const g = jitter(r, C.ground), c = jitter(r, C.cliff, 6);
    const FOL = { autumn: [[22, .8, .5], [35, .85, .52], [8, .75, .45]], sakura: [[340, .8, .82], [345, .75, .76], [335, .7, .88]], lavender: [[100, .4, .42], [110, .35, .36], [95, .45, .48]], snow: [[150, .35, .22], [140, .3, .28], [160, .4, .18]], desert: [[95, .45, .4], [85, .4, .45], [100, .5, .34]], city: [[105, .45, .38], [115, .4, .44], [95, .45, .32]], volcano: [[130, .35, .25], [120, .3, .3], [140, .4, .2]], moor: [[120, .22, .32], [110, .2, .38], [130, .25, .26]], mushroom: [[150, .45, .32], [140, .4, .4], [165, .5, .26]], bamboo: [[95, .5, .4], [85, .45, .48], [105, .55, .34]], tropical: [[110, .5, .38], [100, .45, .46], [120, .55, .32]] };
    const fol = (FOL[climate] || [[g[0] + (r() - .5) * 20, Math.min(.85, g[1] + .15), g[2] - .18], [g[0] + 12, Math.min(.8, g[1] + .1), g[2] - .1], [g[0] - 10, g[1], g[2] - .25]]).map(f => jitter(r, f, 6, .05, .04));
    return {
        ground: hsl(...g), groundDark: hsl(g[0], g[1], g[2] - .12), cliff: hsl(...c), cliffDark: hsl(c[0], c[1], c[2] - .15),
        sand: hsl(42 + (r() - .5) * 10, .45, .78), water: hsl(195 + (r() - .5) * 20, .6, .5), waterDeep: hsl(205, .6, .3),
        foliage: fol.map(f => hsl(...f)), grass: [hsl(fol[2][0], fol[2][1], fol[2][2] - .08), hsl(fol[1][0], fol[1][1], fol[1][2] + .08)],
        accent: hsl(pick(r, [0, 12, 350, 28, 200, 320]), .7, .5), wood: hsl(25, .35, .35), roof: hsl(pick(r, [8, 350, 20, 200, 160, 220]), .45, .4), wall: hsl(40, .35, .9),
    };
}

/* ---------- 把东西摆到岛上 ---------- */
function place(r, R) {
    const items = [], taken = [];
    const free = (x, z, rad) => !taken.some(t => Math.hypot(t.x - x, t.z - z) < t.r + rad);
    const put = (type, rad, { minR = .1, maxR = .9, s = 1, tries = 24, fixed, rot } = {}) => {
        for (let i = 0; i < tries; i++) {
            const a = r() * TAU, d = fixed ? fixed.d : (minR + Math.sqrt(r()) * (maxR - minR)), x = fixed ? fixed.x : Math.cos(a) * d * R, z = fixed ? fixed.z : Math.sin(a) * d * R;
            if (!free(x, z, rad)) continue;
            taken.push({ x, z, r: rad }); items.push({ type, x, z, s: s * (.92 + r() * .16), rot: rot ?? r() * TAU, k: r() * 1e6 | 0 }); return items[items.length - 1];
        }
        return null;
    };
    return { items, put, taken };
}

/**
 * 生成一座岛的配方
 * @param {number} seed
 * @param {{era?:string, climate?:string, terrain?:string, mark?:string, extras?:string[], animals?:string[]}} want AI 导演给的要求（可缺）
 */
export function makeRecipe(seed, want = {}) {
    const r = rng(seed);
    const era = ERA[want.era] ? want.era : '';
    let climate = CLIMATES[want.climate] ? want.climate : '';
    // 指定了地标但没指定气候：挑一个有这个地标的气候
    if (!climate && MARKS[want.mark]) { const cs = Object.keys(CLIMATES).filter(c => CLIMATES[c].marks.includes(want.mark)); climate = cs.length ? pick(r, cs) : ''; }
    if (!climate) { const w = { tropical: 3, temperate: 4, snow: 3, autumn: 3, sakura: 3, desert: 2, city: 3, lavender: 2, bamboo: 2, mushroom: 2, volcano: 1.5, moor: 1.5 }; if (era === 'modern') { w.city = 10; w.sakura = 4; w.temperate = 4; w.mushroom = .3; w.desert = .5; w.volcano = .3; w.moor = .5; } if (era === 'ancient') { w.city = .3; w.autumn = 5; w.bamboo = 5; w.sakura = 4; w.mushroom = .3; } climate = weighted(r, w); }
    const C = CLIMATES[climate];
    const terrain = TERRAINS[want.terrain] ? want.terrain : weighted(r, TERRAIN_W[climate]);
    let mark = MARKS[want.mark] ? want.mark : '';
    if (!mark) { let ms = C.marks; if (era) { const es = ms.filter(m => ERA[era].includes(m)); if (es.length) ms = es; } mark = pick(r, ms); }
    const pal = palette(r, C, climate);
    const sea = terrain === 'sea' || terrain === 'atoll', big = BIG[mark] || 0, R = sea ? .34 + big * .5 : terrain === 'twin' ? .42 : .66 + big * .4; // 岛的半径（球半径 = 1）
    const { items, put } = place(r, R);
    put(mark, big || .17, { minR: 0, maxR: big ? .05 : .2, s: 1, rot: big ? (r() - .5) * .6 : undefined });
    // 树：按气候，数量随地形；大套件旁边少放点
    const nTree = sea ? 2 + (r() * 2 | 0) : (big > .25 ? 4 : 6) + (r() * 4 | 0), tree = C.trees;
    for (let i = 0; i < nTree; i++) put(pick(r, tree), .08, { minR: .35, maxR: .96, s: .8 + r() * .5 });
    for (let i = 0; i < (sea ? 1 : 3 + (r() * 3 | 0)); i++) put('bush', .05, { minR: .3, maxR: .95, s: .7 + r() * .6 });
    // 建筑 / 小东西
    const extras = new Set(want.extras?.filter(k => EXTRAS[k]) || []);
    if (!sea && !big && r() < .6) put('house', .13, { minR: .4, maxR: .85 });
    if (mark === 'street') { put('lamp', .05, { minR: .5, maxR: .9 }); }
    if (r() < .5 || extras.has('lamp')) put('lamp', .05, { minR: .3, maxR: .8 });
    if (r() < .45 || extras.has('bench')) put('bench', .07, { minR: .3, maxR: .8 });
    if (extras.has('bonfire') || (!C.urban && mark !== 'temple' && r() < .3)) put('bonfire', .09, { minR: .35, maxR: .8 });
    if (extras.has('swing') || r() < .2) put('swing', .09, { minR: .4, maxR: .85 });
    if (C.oasis || extras.has('pond') || (!sea && r() < .2)) put('pond', .18, { minR: .45, maxR: .7, s: 1 });
    if (extras.has('hotspring') || (C.snowy && r() < .35)) put('hotspring', .15, { minR: .4, maxR: .75 });
    if (extras.has('lanterns') || ((climate === 'sakura' || climate === 'bamboo') && r() < .5)) extras.add('lanterns');
    if (extras.has('fireflies') || (C.glow) || ((climate === 'temperate' || climate === 'bamboo' || climate === 'autumn') && r() < .4)) extras.add('fireflies');
    if (!sea && (extras.has('path') || r() < .6)) extras.add('path');
    if (!sea && (extras.has('river') || r() < .25)) extras.add('river');
    if (!sea && !C.urban && (extras.has('flowers') || r() < .55)) extras.add('flowers');
    if (sea || terrain === 'lake' || extras.has('boat')) extras.add('boat');
    for (let i = 0; i < 3 + (r() * 4 | 0); i++) put('rock', .05, { minR: .45, maxR: .97, s: .6 + r() * .8 });
    // 动物
    const animals = new Set(want.animals?.filter(k => ANIMALS[k]) || []);
    if (!animals.size) { if (sea || terrain === 'lake' || r() < .25) animals.add('whale'); if (r() < .5) animals.add(pick(r, C.animals)); }
    if (animals.has('sheep')) for (let i = 0; i < 3 + (r() * 3 | 0); i++) put('sheep', .05, { minR: .4, maxR: .9, s: .9 });
    if (animals.has('fox')) put('fox', .06, { minR: .4, maxR: .85 });
    if (C.lava) put('crater', .25, { minR: 0, maxR: .1, s: 1, tries: 1 });
    return { seed, era: era || (ERA.modern.includes(mark) && !ERA.ancient.includes(mark) ? 'modern' : ERA.ancient.includes(mark) ? 'ancient' : 'nature'), climate, terrain, mark, pal, R, items, extras: [...extras], animals: [...animals], tree: tree[0], fall: C.fall, snowy: !!C.snowy, urban: !!C.urban || mark === 'street', glow: !!C.glow, lava: !!C.lava };
}

/** 风景名：「樱花林 · 古寺」 */
export const recipeName = rc => rc ? `${CLIMATES[rc.climate]?.name || ''} · ${MARKS[rc.mark] || ''}` : '';

/* ---------- AI 导演：剧情里的风景词 → 配方要求 ---------- */
const KW = {
    era: [[/现代|都市|手机|地铁|公司|写字楼|便利店|公寓|霓虹|高楼|汽车|网吧|学校|医院|咖啡|酒吧|车站|商场|天台/, 'modern'], [/古|寺|庙|神社|宫|殿|宝塔|佛塔|城堡|江湖|朝|王府|客栈|驿站|书院|求签|香火|鸟居|庭院|长安|京都/, 'ancient']],
    climate: [[/雪|冰|冬|严寒|滑雪/, 'snow'], [/樱|花见|花瓣/, 'sakura'], [/沙漠|绿洲|骆驼|金字塔|沙丘/, 'desert'], [/城市|都市|街|高楼|地铁|霓虹|天台|商场|写字楼|公寓|便利店|红绿灯|马路|医院|学校|校园/, 'city'], [/枫|秋|红叶|落叶/, 'autumn'], [/竹/, 'bamboo'], [/薰衣草|紫色花田|花田/, 'lavender'], [/蘑菇|菌|精灵|童话/, 'mushroom'], [/火山|熔岩|岩浆/, 'volcano'], [/雾|荒原|沼泽|阴/, 'moor'], [/海|沙滩|椰|浪|潮|海岛|渔/, 'tropical'], [/草原|草坡|牧场|田野|乡/, 'temperate'], [/森林|树林|林|山/, 'temperate']],
    terrain: [[/环礁|珊瑚/, 'atoll'], [/海|孤岛|岛/, 'sea'], [/湖|池|水边/, 'lake'], [/高原|山顶|崖|悬崖/, 'plateau'], [/双|两座|并排/, 'twin'], [/浮|空中|飘/, 'floating']],
    mark: [[/求签|寺|庙|佛|香火|禅|钟声/, 'temple'], [/神社|鸟居|绘马|巫女|参拜/, 'shrine'], [/学校|教室|校园|操场|课|自习/, 'school'], [/医院|病房|急诊|病床|输液/, 'hospital'], [/居酒屋|酒馆|酒吧|小酒|烧烤|夜宵|拉面/, 'izakaya'], [/咖啡|茶馆|餐厅|甜品|书店|面包/, 'cafe'], [/车站|站台|火车|列车|地铁|月台/, 'station'], [/灯塔/, 'lighthouse'], [/钟楼|塔楼|高塔/, 'tower'], [/金字塔/, 'pyramid'], [/宝塔|佛塔|古塔|(?<![灯钟高字])塔/, 'pagoda'], [/街|马路|便利店|公寓|红绿灯|写字楼|霓虹|天台|巷|路口|商场|公交/, 'street'], [/风车/, 'windmill'], [/摩天轮|游乐/, 'ferris'], [/城堡|宫|王府|殿/, 'castle'], [/天文|望远镜|观星/, 'observatory'], [/帐篷|露营|营地/, 'tent'], [/木屋|小屋|小木|木楼/, 'cabin'], [/小院|庭院|家|房子|老宅/, 'house']],
    extras: [[/灯笼|提灯/, 'lanterns'], [/萤火|萤/, 'fireflies'], [/温泉/, 'hotspring'], [/桥/, 'bridge'], [/小路|石板路|路灯/, 'path'], [/溪|河|流水/, 'river'], [/花/, 'flowers'], [/船|舟/, 'boat'], [/篝火|营火|火堆|炉火|壁炉/, 'bonfire'], [/长椅|椅/, 'bench'], [/路灯/, 'lamp'], [/秋千/, 'swing'], [/池塘|荷/, 'pond']],
    animals: [[/鲸/, 'whale'], [/羊/, 'sheep'], [/鸟|雁|鸥/, 'birds'], [/狐|猫|狗|小动物/, 'fox']],
};
/**
 * 把一段风景描述（AI 写的几个词）翻成配方要求；认不出的词忽略，整段没认出来就返回 {}（照常随机）
 * @param {string} text
 */
export function hintOf(text) {
    const t = String(text || '').trim(); if (!t) return {};
    const out = { extras: [], animals: [] };
    for (const [re, k] of KW.era) if (re.test(t)) { out.era = k; break; }
    for (const [re, k] of KW.mark) if (re.test(t)) { out.mark = k; break; }
    for (const [re, k] of KW.climate) if (re.test(t)) { out.climate = k; break; }
    if (out.climate && out.mark && !CLIMATES[out.climate].marks.includes(out.mark)) delete out.climate; // 地标优先：「雪 便利店」→ 有便利店的气候里挑
    for (const [re, k] of KW.terrain) if (re.test(t)) { out.terrain = k; break; }
    for (const [re, k] of KW.extras) if (re.test(t)) out.extras.push(k);
    for (const [re, k] of KW.animals) if (re.test(t)) out.animals.push(k);
    return out;
}
/** 没有 AI 时看角色卡 / 开场白是现代还是古风：数关键词，多的那边赢；都不明显返回 '' */
export function eraOf(text) {
    const t = String(text || ''); if (!t) return '';
    const n = re => (t.match(re) || []).length;
    const m = n(/手机|微信|电话|地铁|公司|上班|办公室|写字楼|便利店|公寓|汽车|开车|电脑|网络|学校|大学|高中|教室|医院|咖啡|酒吧|电梯|出租车|外卖|直播|游戏|快递/g);
    const a = n(/陛下|殿下|王爷|公子|姑娘|丫鬟|侍卫|江湖|门派|修仙|灵力|剑|轿|马车|客栈|朝廷|皇|宫|府|书生|仙|妖|法术|魔法|骑士|精灵|龙|王国|城堡/g);
    return m >= 3 && m > a * 1.5 ? 'modern' : a >= 3 && a > m * 1.5 ? 'ancient' : '';
}

// =============================================================
//  小手机 Mini Phone —— SillyTavern 第三方扩展
//  应用：聊天 / 设置
//  模式：线上模式（只有正文影响手机） / 正文联动（勾选的对话会注入正文）
// =============================================================

const MODULE = 'mini_phone';
const INJECT_KEY = 'mini_phone_inject';

// 正文里角色发手机消息的格式：[手机消息|发送人|内容]  [手机图片|发送人|画面描述]
const PHONE_TAG_RE = /\[手机(消息|图片)\s*[|｜]\s*([^|｜\]]+?)\s*[|｜]\s*([^\]]+?)\s*\]/g;

const defaultSettings = {
    enabled: true,
    mode: 'online',            // 'online' 线上模式 | 'linked' 正文联动
    autoReply: true,           // 发送后自动让对方回复
    storyPrompt: true,         // 向正文注入「手机消息格式」说明
    autoScanEvery: 0,          // 每 N 条正文自动识别联系人，0 = 关闭
    contextMessages: 10,       // 手机聊天时带入的正文条数
    injectCount: 10,           // 联动模式每个对话注入最近 N 条
    injectDepth: 1,            // 注入深度
    chatApi: { source: 'st', url: '', key: '', model: '', temperature: 0.9 },
    imageApi: { enabled: false, url: '', key: '', model: 'dall-e-3', size: '1024x1024', stylePrompt: '' },
    ttsApi: { enabled: false, url: '', key: '', model: 'tts-1', voice: 'alloy', autoPlay: false },
    fabPos: null,
    phonePos: null,
};

const state = {
    open: false,
    view: 'home',
    contactId: null,
    typing: {},
    scanning: false,
    storyCounter: 0,
    drafts: {},
    audioCache: new Map(),
    models: [],
};

// ---------------- 工具 ----------------
const ctx = () => SillyTavern.getContext();
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const trunc = (s, n) => (s && s.length > n ? s.slice(0, n) + '…' : s || '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (n) => String(n).padStart(2, '0');
const fmtTime = (t) => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const joinUrl = (base, path) => String(base || '').trim().replace(/\/+$/, '') + path;
const authHeaders = (key) => ({ 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) });
const stripThink = (t) => String(t || '').replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '').trim();
const sub = (s) => { const c = ctx(); return typeof c.substituteParams === 'function' ? c.substituteParams(s) : s; };
const getPath = (o, p) => p.split('.').reduce((x, k) => x?.[k], o);
const setPath = (o, p, v) => { const ks = p.split('.'); const last = ks.pop(); ks.reduce((x, k) => (x[k] ??= {}), o)[last] = v; };
const hashStr = (s) => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0; return (h >>> 0).toString(36); };
const toast = (type, msg) => window.toastr?.[type]?.(msg, '小手机');

const PALETTE = ['#4F6D8F', '#7A5C8E', '#3F7F6E', '#9A6B3F', '#8E4F5E', '#5B6B3A', '#3D6E8C', '#86663C'];
const colorFor = (name) => PALETTE[parseInt(hashStr(name || '?'), 36) % PALETTE.length];

// ---------------- 设置 & 数据 ----------------
function getSettings() {
    const es = ctx().extensionSettings;
    if (!es[MODULE]) es[MODULE] = structuredClone(defaultSettings);
    const s = es[MODULE];
    for (const k of Object.keys(defaultSettings)) {
        const dv = defaultSettings[k];
        if (s[k] === undefined) s[k] = structuredClone(dv);
        else if (dv && typeof dv === 'object' && !Array.isArray(dv)) {
            for (const kk of Object.keys(dv)) if (s[k][kk] === undefined) s[k][kk] = dv[kk];
        }
    }
    return s;
}
const saveSettings = () => ctx().saveSettingsDebounced();

function hasChat() {
    const c = ctx();
    return !!(c.chatId ?? c.getCurrentChatId?.());
}

// 联系人与聊天记录按「酒馆聊天」保存在 chat metadata 中，切换聊天自动切换
function getData() {
    const md = ctx().chatMetadata;
    if (!md) return { contacts: [], processed: [] };
    if (!md[MODULE]) md[MODULE] = { contacts: [], processed: [] };
    return md[MODULE];
}

function saveData() {
    const c = ctx();
    if (hasChat()) (c.saveMetadataDebounced || c.saveMetadata)?.call(c);
    updateInjection();
    updateBadges();
}

const contactById = (id) => getData().contacts.find((x) => x.id === id);
const curContact = () => contactById(state.contactId);
const lastTime = (ct) => ct.messages.at(-1)?.time || 0;
const totalUnread = () => getData().contacts.reduce((n, c) => n + (c.unread || 0), 0);

function ensureContact(name, extra = {}) {
    const d = getData();
    name = String(name).trim();
    let ct = d.contacts.find((x) => x.name === name);
    if (!ct) {
        ct = { id: uid(), name, avatar: '', avatarImg: '', intro: '', inject: false, voice: '', unread: 0, messages: [], ...extra };
        d.contacts.push(ct);
    }
    return ct;
}

function addMessage(ct, msg) {
    const m = { id: uid(), time: Date.now(), type: 'text', source: 'phone', ...msg };
    ct.messages.push(m);
    const viewing = state.open && state.view === 'conversation' && state.contactId === ct.id;
    if (m.from === 'them' && !viewing) {
        ct.unread = (ct.unread || 0) + 1;
        notify(ct, m);
    }
    return m;
}

function ensureMainCharacter() {
    const c = ctx();
    if (!hasChat() || c.groupId || c.characterId === undefined) return;
    const ch = c.characters?.[c.characterId];
    if (!ch || getData().contacts.some((x) => x.name === ch.name)) return;
    ensureContact(ch.name, {
        isMain: true,
        avatarImg: ch.avatar ? `/thumbnail?type=avatar&file=${encodeURIComponent(ch.avatar)}` : '',
        intro: '',
    });
    saveData();
}

// ---------------- 上下文收集 ----------------
function cleanStory(t) {
    return String(t || '').replace(PHONE_TAG_RE, (_, type, from, content) =>
        type === '图片' ? `（${from}发来一张手机图片：${content}）` : `（${from}发来手机消息：${content}）`);
}

function getRecentStory(n) {
    const c = ctx();
    return (c.chat || [])
        .filter((m) => !m.is_system && m.mes)
        .slice(-n)
        .map((m) => `${m.name}: ${trunc(cleanStory(m.mes), 600)}`)
        .join('\n');
}

function getMainCharInfo() {
    const c = ctx();
    const ch = c.characters?.[c.characterId];
    if (!ch) return { name: c.name2 || '', desc: '' };
    return { name: ch.name, desc: trunc(sub([ch.description, ch.personality, ch.scenario].filter(Boolean).join('\n')), 2500) };
}

function getPersona() {
    try { return trunc(sub(ctx().powerUserSettings?.persona_description || ''), 800); } catch { return ''; }
}

async function getWorldInfoText() {
    const c = ctx();
    if (typeof c.loadWorldInfo !== 'function') return '';
    const names = new Set();
    const ch = c.characters?.[c.characterId];
    if (ch?.data?.extensions?.world) names.add(ch.data.extensions.world);
    if (c.chatMetadata?.world_info) names.add(c.chatMetadata.world_info);
    const out = [];
    for (const n of names) {
        try {
            const d = await c.loadWorldInfo(n);
            for (const e of Object.values(d?.entries || {})) {
                if (e.disable || !e.content) continue;
                out.push(`【${e.comment || (e.key || []).join(',')}】${e.content}`);
            }
        } catch { /* 忽略 */ }
    }
    return trunc(sub(out.join('\n')), 4000);
}

// ---------------- API 调用 ----------------
async function stGenerate(system, prompt) {
    const c = ctx();
    if (typeof c.generateRaw !== 'function') throw new Error('当前酒馆版本不支持 generateRaw，请在设置里改用自定义 API');
    // 新版酒馆 generateRaw 接收对象参数，旧版是位置参数
    if (c.generateRaw.length === 0) return await c.generateRaw({ systemPrompt: system, prompt });
    return await c.generateRaw(prompt, null, false, false, system);
}

async function callChatAPI(system, user) {
    const s = getSettings().chatApi;
    if (s.source === 'st') return stGenerate(system, user);
    if (!s.url || !s.model) throw new Error('请先在 设置 → 聊天 API 中填写地址和模型');
    const r = await fetch(joinUrl(s.url, '/chat/completions'), {
        method: 'POST',
        headers: authHeaders(s.key),
        body: JSON.stringify({
            model: s.model,
            temperature: Number(s.temperature) || 0.9,
            messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        }),
    });
    if (!r.ok) throw new Error(`聊天 API 返回 ${r.status}：${trunc(await r.text(), 200)}`);
    const j = await r.json();
    return j.choices?.[0]?.message?.content ?? '';
}

async function fetchModels() {
    const s = getSettings().chatApi;
    const r = await fetch(joinUrl(s.url, '/models'), { headers: authHeaders(s.key) });
    if (!r.ok) throw new Error(`获取模型失败 ${r.status}`);
    const j = await r.json();
    return (j.data || j.models || []).map((m) => m.id || m.name).filter(Boolean);
}

async function generateImage(prompt) {
    const s = getSettings().imageApi;
    if (!s.enabled || !s.url) throw new Error('生图 API 未启用');
    const r = await fetch(joinUrl(s.url, '/images/generations'), {
        method: 'POST',
        headers: authHeaders(s.key),
        body: JSON.stringify({ model: s.model, prompt: [s.stylePrompt, prompt].filter(Boolean).join(', '), n: 1, size: s.size }),
    });
    if (!r.ok) throw new Error(`生图 API 返回 ${r.status}：${trunc(await r.text(), 200)}`);
    const j = await r.json();
    const d = j.data?.[0];
    if (d?.url) return d.url;
    if (d?.b64_json) return 'data:image/png;base64,' + d.b64_json;
    throw new Error('无法识别生图返回格式');
}

async function genImageForMessage(ct, m) {
    try { m.src = await generateImage(m.text); delete m.error; }
    catch (e) { m.error = String(e.message || e); }
    finally { m.pending = false; refresh(ct); saveData(); }
}

let currentAudio = null;
let ttsQueue = Promise.resolve();

async function playTTS(m, ct) {
    const s = getSettings().ttsApi;
    try {
        let url = state.audioCache.get(m.id);
        if (!url) {
            const r = await fetch(joinUrl(s.url, '/audio/speech'), {
                method: 'POST',
                headers: authHeaders(s.key),
                body: JSON.stringify({ model: s.model, input: m.text, voice: ct?.voice || s.voice }),
            });
            if (!r.ok) throw new Error(`TTS 返回 ${r.status}：${trunc(await r.text(), 200)}`);
            url = URL.createObjectURL(await r.blob());
            state.audioCache.set(m.id, url);
        }
        currentAudio?.pause();
        currentAudio = new Audio(url);
        await new Promise((res) => { currentAudio.onended = res; currentAudio.onerror = res; currentAudio.play().catch(res); });
    } catch (e) { toast('error', String(e.message || e)); }
}
const queueTTS = (m, ct) => { ttsQueue = ttsQueue.then(() => playTTS(m, ct)); };

// ---------------- 手机聊天：让对方回复 ----------------
function parseReply(raw, name) {
    const prefix = new RegExp(`^${escRe(name)}\\s*[:：]\\s*`);
    const out = [];
    for (let line of stripThink(raw).split(/\n+/)) {
        line = line.trim().replace(prefix, '').replace(/^["“”「」]+|["“”「」]+$/g, '').trim();
        if (!line) continue;
        const im = line.match(/^\[(?:图片|照片|手机图片)\s*[:：|｜]\s*(.+?)\]$/);
        out.push(im ? { image: im[1] } : { text: line });
    }
    return out.slice(0, 8);
}

async function requestReply(ct) {
    if (state.typing[ct.id]) return;
    state.typing[ct.id] = true;
    refresh(ct);
    try {
        const s = getSettings();
        const c = ctx();
        const user = c.name1 || '我';
        const main = getMainCharInfo();
        const intro = ct.isMain || ct.name === main.name ? main.desc : ct.intro;
        const wi = await getWorldInfoText();
        const persona = getPersona();
        const history = ct.messages.slice(-30)
            .map((m) => `${m.from === 'me' ? user : ct.name}: ${m.type === 'image' ? `[图片:${m.text}]` : m.text}`)
            .join('\n');

        const system = [
            `你正在扮演「${ct.name}」，正在用手机聊天软件和「${user}」聊天。`,
            `【${ct.name}的设定】\n${intro || '（暂无，请根据剧情与世界观合理推断）'}`,
            persona && `【${user}的设定】\n${persona}`,
            main.name && main.name !== ct.name && main.desc && `【故事主角色 ${main.name}】\n${main.desc}`,
            wi && `【世界书】\n${wi}`,
            `【最近的正文剧情】\n${getRecentStory(s.contextMessages) || '（暂无）'}`,
            `【规则】
- 只以「${ct.name}」的身份发消息，像真实的手机聊天：口语化、简短，可以连发多条，每条单独一行。
- 不写动作、旁白、心理描写，不加引号，不加名字前缀。
- 想发照片时单独一行写：[图片:画面描述]
- 一次发 1~4 条。`,
        ].filter(Boolean).join('\n\n');

        const prompt = `【手机聊天记录】\n${history || '（还没有聊过）'}\n\n请直接输出「${ct.name}」接下来要发的消息：`;
        const lines = parseReply(await callChatAPI(system, prompt), ct.name);
        if (!lines.length) throw new Error('AI 没有返回内容');

        for (const [i, l] of lines.entries()) {
            if (i > 0) await sleep(clamp((l.text || '').length * 60, 500, 1600));
            if (l.image) {
                const m = addMessage(ct, { from: 'them', type: 'image', text: l.image, pending: s.imageApi.enabled });
                if (s.imageApi.enabled) genImageForMessage(ct, m);
            } else {
                const m = addMessage(ct, { from: 'them', text: l.text });
                if (s.ttsApi.enabled && s.ttsApi.autoPlay) queueTTS(m, ct);
            }
            refresh(ct);
            saveData();
        }
    } catch (e) {
        console.error('[小手机]', e);
        toast('error', String(e.message || e));
    } finally {
        state.typing[ct.id] = false;
        refresh(ct);
    }
}

// ---------------- AI 识别联系人 ----------------
async function scanContacts(silent = false) {
    if (state.scanning || !hasChat()) return;
    state.scanning = true;
    render();
    try {
        const c = ctx();
        const user = c.name1 || '用户';
        const main = getMainCharInfo();
        const wi = await getWorldInfoText();
        const existing = getData().contacts.map((x) => x.name);
        const system = `你是信息提取助手。根据角色设定、世界书和最近剧情，找出「${user}」手机通讯录里应该有的联系人（认识${user}、合理会互留联系方式的人物）。只输出 JSON 数组，不要任何其他文字。格式：[{"name":"名字","avatar":"一个emoji","intro":"身份、与${user}的关系、说话风格，一两句话"}]。不要包含${user}本人，最多 8 个。`;
        const prompt = `【主角色】${main.name}\n${main.desc}\n\n【世界书】\n${wi || '无'}\n\n【最近剧情】\n${getRecentStory(20) || '无'}\n\n【已有联系人】${existing.join('、') || '无'}\n\n输出 JSON：`;
        const raw = stripThink(await callChatAPI(system, prompt));
        const arr = JSON.parse((raw.match(/\[[\s\S]*\]/) || [])[0] || '[]');
        let n = 0;
        for (const it of arr) {
            const name = String(it?.name || '').trim();
            if (!name || name === user) continue;
            const ex = getData().contacts.find((x) => x.name === name);
            if (ex) { if (!ex.intro && it.intro) ex.intro = it.intro; continue; }
            ensureContact(name, { avatar: it.avatar || '', intro: it.intro || '' });
            n++;
        }
        saveData();
        if (!silent || n) toast('success', n ? `新增 ${n} 位联系人` : '没有发现新的联系人');
    } catch (e) {
        console.error('[小手机]', e);
        if (!silent) toast('error', '识别联系人失败：' + (e.message || e));
    } finally {
        state.scanning = false;
        render();
    }
}

// ---------------- 正文 → 手机 ----------------
function onMessageReceived(mesId) {
    const s = getSettings();
    if (!s.enabled || !hasChat()) return;
    const c = ctx();
    const msg = c.chat?.[mesId];
    if (!msg || msg.is_user || msg.is_system) return;

    const d = getData();
    let added = 0;
    for (const [full, type, from, content] of String(msg.mes || '').matchAll(PHONE_TAG_RE)) {
        const key = `${mesId}|${hashStr(full)}`;
        if (d.processed.includes(key)) continue;
        d.processed.push(key);
        const ct = ensureContact(from);
        if (type === '图片') {
            const m = addMessage(ct, { from: 'them', type: 'image', text: content.trim(), source: 'story', pending: s.imageApi.enabled });
            if (s.imageApi.enabled) genImageForMessage(ct, m);
        } else {
            const m = addMessage(ct, { from: 'them', text: content.trim(), source: 'story' });
            if (s.ttsApi.enabled && s.ttsApi.autoPlay && state.open) queueTTS(m, ct);
        }
        added++;
    }
    if (d.processed.length > 500) d.processed = d.processed.slice(-500);
    if (added) { saveData(); render(); }

    if (s.autoScanEvery > 0 && ++state.storyCounter >= s.autoScanEvery) {
        state.storyCounter = 0;
        scanContacts(true);
    }
}

// ---------------- 手机 → 正文（提示词注入） ----------------
function updateInjection() {
    const c = ctx();
    if (typeof c.setExtensionPrompt !== 'function') return;
    const s = getSettings();
    if (!s.enabled || !hasChat()) { c.setExtensionPrompt(INJECT_KEY, '', 1, 0); return; }

    const user = c.name1 || '用户';
    const parts = [];
    if (s.storyPrompt) {
        parts.push(`[小手机系统]
${user}有一部手机。剧情中如果有角色用手机给${user}发消息，请在正文中使用以下格式（可以多条）：
[手机消息|发送人名字|消息内容]
发图片：[手机图片|发送人名字|图片画面描述]
只在剧情合理时使用。`);
    }
    if (s.mode === 'linked') {
        const logs = getData().contacts
            .filter((x) => x.inject && x.messages.length)
            .map((x) => {
                const lines = x.messages.slice(-s.injectCount)
                    .map((m) => `${m.from === 'me' ? user : x.name}: ${m.type === 'image' ? `[图片:${m.text}]` : m.text}`)
                    .join('\n');
                return `与「${x.name}」的手机聊天：\n${lines}`;
            });
        if (logs.length) {
            parts.push(`[${user}的手机聊天记录 —— 以下聊天已真实发生，聊天双方都知道内容，可在剧情中自然体现]\n${logs.join('\n\n')}`);
        }
    }
    // position 1 = 聊天中（IN_CHAT），role 0 = system
    c.setExtensionPrompt(INJECT_KEY, parts.join('\n\n'), 1, Number(s.injectDepth) || 1, false, 0);
}

// ---------------- 通知 ----------------
function notify(ct, m) {
    const text = m.type === 'image' ? '[图片]' : m.text;
    const fab = document.getElementById('mp-fab');
    fab?.classList.remove('mp-ring');
    void fab?.offsetWidth;
    fab?.classList.add('mp-ring');
    if (state.open) {
        const el = document.querySelector('#mp-phone .mp-banner');
        if (!el) return;
        el.innerHTML = `${avatarHTML(ct, 30)}<div><b>${esc(ct.name)}</b><span>${esc(trunc(text, 40))}</span></div>`;
        el.dataset.id = ct.id;
        el.classList.add('show');
        clearTimeout(notify.t);
        notify.t = setTimeout(() => el.classList.remove('show'), 3000);
    } else {
        window.toastr?.info(esc(trunc(text, 60)), `📱 ${esc(ct.name)}`);
    }
}

function updateBadges() {
    const n = hasChat() ? totalUnread() : 0;
    const b = document.querySelector('#mp-fab .mp-badge');
    if (b) { b.textContent = n > 99 ? '99+' : n; b.style.display = n ? '' : 'none'; }
}

// ---------------- 视图 ----------------
function avatarHTML(ct, size = 40) {
    const txt = ct.avatar || [...(ct.name || '?')][0];
    return `<div class="mp-avatar" style="width:${size}px;height:${size}px;background:${colorFor(ct.name)};font-size:${Math.round(size * 0.44)}px">${esc(txt)}${ct.avatarImg ? `<img src="${esc(ct.avatarImg)}" alt="" onerror="this.remove()">` : ''}</div>`;
}

function header(title, { back = null, right = '' } = {}) {
    return `<div class="mp-header">
        ${back ? `<button class="mp-hbtn mp-back" data-action="go" data-view="${back}" aria-label="返回">‹</button>` : '<span class="mp-hbtn"></span>'}
        <div class="mp-htitle">${title}</div>
        <div class="mp-hright">${right || '<span class="mp-hbtn"></span>'}</div>
    </div>`;
}

function viewHome() {
    const d = new Date();
    const unread = hasChat() ? totalUnread() : 0;
    const s = getSettings();
    return `<div class="mp-home">
        <div class="mp-home-clock">${fmtTime(d)}</div>
        <div class="mp-home-date">${d.getMonth() + 1}月${d.getDate()}日 星期${'日一二三四五六'[d.getDay()]}</div>
        <div class="mp-apps">
            <button class="mp-app" data-action="go" data-view="chatList">
                <span class="mp-app-icon mp-ic-chat">💬${unread ? `<span class="mp-badge">${unread}</span>` : ''}</span>
                <span>聊天</span>
            </button>
            <button class="mp-app" data-action="go" data-view="settings">
                <span class="mp-app-icon mp-ic-set">⚙️</span>
                <span>设置</span>
            </button>
        </div>
        <div class="mp-home-mode">${s.mode === 'linked' ? '🔗 正文联动' : '🌐 线上模式'}</div>
    </div>`;
}

function viewChatList() {
    if (!hasChat()) return header('聊天', { back: 'home' }) + `<div class="mp-empty">先在酒馆里打开一个聊天，<br>小手机的联系人跟随聊天保存。</div>`;
    const cs = [...getData().contacts].sort((a, b) => lastTime(b) - lastTime(a));
    const right = `<button class="mp-hbtn" data-action="scan" title="根据剧情和世界书识别联系人">${state.scanning ? '<span class="mp-spin">⟳</span>' : '✨'}</button>
                   <button class="mp-hbtn" data-action="go" data-view="addContact" title="添加联系人">＋</button>`;
    const list = cs.length
        ? cs.map((ct) => {
            const last = ct.messages.at(-1);
            const preview = state.typing[ct.id] ? '正在输入…' : last ? (last.from === 'me' ? '我：' : '') + (last.type === 'image' ? '[图片]' : last.text) : ct.intro || '还没有消息';
            const linked = getSettings().mode === 'linked' && ct.inject;
            return `<button class="mp-contact" data-action="open-chat" data-id="${ct.id}">
                ${avatarHTML(ct, 44)}
                <span class="mp-contact-main">
                    <span class="mp-contact-top"><b>${esc(ct.name)}${linked ? ' <i class="mp-link-dot" title="同步到正文">🔗</i>' : ''}</b><small>${last ? fmtTime(last.time) : ''}</small></span>
                    <span class="mp-contact-bottom"><span>${esc(trunc(preview, 28))}</span>${ct.unread ? `<span class="mp-badge">${ct.unread}</span>` : ''}</span>
                </span>
            </button>`;
        }).join('')
        : `<div class="mp-empty">还没有联系人。<br>点 ✨ 让 AI 从剧情和世界书里找，<br>或点 ＋ 手动添加。</div>`;
    return header('聊天', { back: 'home', right }) + `<div class="mp-content mp-list">${list}</div>`;
}

function msgHTML(m, ct, prev) {
    const s = getSettings();
    const mine = m.from === 'me';
    const gap = !prev || m.time - prev.time > 5 * 60 * 1000;
    let body;
    if (m.type === 'image') {
        body = m.src
            ? `<img class="mp-img" src="${esc(m.src)}" data-action="img-open" alt="${esc(m.text)}">`
            : `<div class="mp-img-ph">🖼️ ${esc(m.text)}${m.pending ? '<small>正在生成图片…</small>' : ''}${m.error ? `<small class="mp-err">${esc(m.error)}</small><button class="mp-mini" data-action="retry-img" data-mid="${m.id}">重试</button>` : ''}</div>`;
    } else {
        body = esc(m.text).replace(/\n/g, '<br>');
    }
    const tools = [
        !mine && m.type === 'text' && s.ttsApi.enabled ? `<button class="mp-tool" data-action="tts" data-mid="${m.id}" title="朗读">🔊</button>` : '',
        `<button class="mp-tool" data-action="del-msg" data-mid="${m.id}" title="删除">✕</button>`,
    ].join('');
    return `${gap ? `<div class="mp-timesep">${fmtTime(m.time)}</div>` : ''}
    <div class="mp-msg ${mine ? 'mine' : 'theirs'}">
        ${mine ? '' : avatarHTML(ct, 32)}
        <div class="mp-bubble-wrap">
            <div class="mp-bubble ${m.type === 'image' ? 'is-img' : ''}">${body}</div>
            <div class="mp-msg-meta">${m.source === 'story' ? '<span class="mp-tag">来自正文</span>' : ''}${tools}</div>
        </div>
    </div>`;
}

function viewConversation() {
    const ct = curContact();
    if (!ct) { state.view = 'chatList'; return viewChatList(); }
    const s = getSettings();
    const status = state.typing[ct.id] ? '对方正在输入…'
        : s.mode === 'linked' ? (ct.inject ? '🔗 同步到正文' : '不同步到正文') : '线上模式 · 正文不知道这里的聊天';
    const title = `<div class="mp-ctitle">${esc(ct.name)}</div><div class="mp-csub">${status}</div>`;
    const right = `<button class="mp-hbtn" data-action="go" data-view="contactInfo" title="联系人资料">⋯</button>`;
    const msgs = ct.messages.map((m, i) => msgHTML(m, ct, ct.messages[i - 1])).join('')
        + (state.typing[ct.id] ? `<div class="mp-msg theirs">${avatarHTML(ct, 32)}<div class="mp-bubble mp-typing"><i></i><i></i><i></i></div></div>` : '');
    return header(title, { back: 'chatList', right })
        + `<div class="mp-content mp-msgs">${msgs || `<div class="mp-empty">和 ${esc(ct.name)} 打个招呼吧</div>`}</div>
        <div class="mp-inputbar">
            ${s.imageApi.enabled ? '<button class="mp-ibtn" data-action="send-photo" title="把输入的描述生成图片发出去">📷</button>' : ''}
            <textarea class="mp-input" rows="1" placeholder="发消息…">${esc(state.drafts[ct.id] || '')}</textarea>
            <button class="mp-ibtn" data-action="ask-reply" title="让对方回复">✨</button>
            <button class="mp-send" data-action="send">发送</button>
        </div>`;
}

function viewContactForm(ct) {
    const s = getSettings();
    const isNew = !ct;
    ct = ct || { name: '', avatar: '', intro: '', voice: '', inject: false };
    return header(isNew ? '添加联系人' : '联系人资料', { back: isNew ? 'chatList' : 'conversation' })
        + `<div class="mp-content mp-form">
            ${isNew ? '' : `<div class="mp-profile">${avatarHTML(ct, 72)}<b>${esc(ct.name)}</b></div>`}
            <div class="mp-group">
                <label class="mp-field"><span>名字</span><input id="mp-f-name" value="${esc(ct.name)}" placeholder="例如：林老师"></label>
                <label class="mp-field"><span>头像</span><input id="mp-f-avatar" value="${esc(ct.avatar)}" placeholder="一个 emoji 或一个字"></label>
                <label class="mp-field mp-field-col"><span>人设</span><textarea id="mp-f-intro" rows="4" placeholder="身份、和你的关系、说话风格">${esc(ct.intro)}</textarea></label>
                ${ct.isMain ? '<p class="mp-hint">这是主角色，人设留空时自动使用角色卡。</p>' : ''}
                ${s.ttsApi.enabled ? `<label class="mp-field"><span>音色</span><input id="mp-f-voice" value="${esc(ct.voice)}" placeholder="留空用默认：${esc(s.ttsApi.voice)}"></label>` : ''}
            </div>
            ${isNew ? '' : `<div class="mp-group">
                <label class="mp-row"><span>同步到正文</span><input type="checkbox" id="mp-f-inject" ${ct.inject ? 'checked' : ''}><i class="mp-switch"></i></label>
                <p class="mp-hint">${s.mode === 'linked'
                    ? '打开后，这个对话最近的聊天会注入正文，角色会知道你们聊了什么。'
                    : '当前是线上模式，不会同步。到 设置 里切换为「正文联动」后生效。'}</p>
            </div>`}
            <button class="mp-btn primary" data-action="${isNew ? 'add-contact' : 'save-contact'}">${isNew ? '添加联系人' : '保存'}</button>
            ${isNew ? '' : `<button class="mp-btn" data-action="clear-contact">清空聊天记录</button>
            <button class="mp-btn danger" data-action="delete-contact">删除联系人</button>`}
        </div>`;
}

function viewSettings() {
    const s = getSettings();
    const v = (p) => esc(getPath(s, p) ?? '');
    const text = (p, label, ph = '', type = 'text', extra = '') =>
        `<label class="mp-field"><span>${label}</span><input type="${type}" data-path="${p}" value="${v(p)}" placeholder="${esc(ph)}" ${extra}></label>`;
    const check = (p, label) =>
        `<label class="mp-row"><span>${label}</span><input type="checkbox" data-path="${p}" ${getPath(s, p) ? 'checked' : ''}><i class="mp-switch"></i></label>`;
    const modeCard = (val, title, desc) =>
        `<label class="mp-mode ${s.mode === val ? 'on' : ''}"><input type="radio" name="mp-mode" data-path="mode" value="${val}" ${s.mode === val ? 'checked' : ''}><b>${title}</b><small>${desc}</small></label>`;

    return header('设置', { back: 'home' }) + `<div class="mp-content mp-form">
        <h4>模式</h4>
        <div class="mp-modes">
            ${modeCard('online', '🌐 线上模式', '只有正文影响手机。角色在正文里发的消息会出现在手机上，但你在手机里回了什么，正文里的角色不知道。')}
            ${modeCard('linked', '🔗 正文联动', '正文的消息同样会进手机。另外，在联系人资料里打开「同步到正文」的对话，会注入正文，角色知道你们聊了什么。')}
        </div>

        <h4>聊天 API</h4>
        <div class="mp-group">
            <label class="mp-field"><span>来源</span>
                <select data-path="chatApi.source">
                    <option value="st" ${s.chatApi.source === 'st' ? 'selected' : ''}>使用酒馆当前 API</option>
                    <option value="custom" ${s.chatApi.source === 'custom' ? 'selected' : ''}>自定义（OpenAI 兼容）</option>
                </select>
            </label>
            ${s.chatApi.source === 'custom' ? `
                ${text('chatApi.url', '地址', 'https://api.openai.com/v1')}
                ${text('chatApi.key', '密钥', 'sk-…', 'password')}
                ${text('chatApi.model', '模型', '例如 gpt-4o-mini', 'text', 'list="mp-model-list"')}
                <datalist id="mp-model-list">${state.models.map((m) => `<option value="${esc(m)}">`).join('')}</datalist>
                ${text('chatApi.temperature', '温度', '0.9', 'number', 'step="0.1" min="0" max="2"')}
                <div class="mp-btnrow"><button class="mp-mini" data-action="fetch-models">获取模型列表</button><button class="mp-mini" data-action="test-chat">测试连接</button></div>
            ` : '<p class="mp-hint">手机聊天会走酒馆当前连接的模型和预设之外的单独请求。</p>'}
        </div>

        <h4>生图 API</h4>
        <div class="mp-group">
            ${check('imageApi.enabled', '启用生图')}
            ${s.imageApi.enabled ? `
                ${text('imageApi.url', '地址', 'https://api.openai.com/v1')}
                ${text('imageApi.key', '密钥', 'sk-…', 'password')}
                ${text('imageApi.model', '模型', 'dall-e-3')}
                ${text('imageApi.size', '尺寸', '1024x1024')}
                ${text('imageApi.stylePrompt', '风格词', '例如：anime style, soft light')}
                <div class="mp-btnrow"><button class="mp-mini" data-action="test-image">测试生图</button></div>
            ` : '<p class="mp-hint">关闭时，照片会显示为文字描述卡片。</p>'}
        </div>

        <h4>TTS 语音</h4>
        <div class="mp-group">
            ${check('ttsApi.enabled', '启用语音')}
            ${s.ttsApi.enabled ? `
                ${text('ttsApi.url', '地址', 'https://api.openai.com/v1')}
                ${text('ttsApi.key', '密钥', 'sk-…', 'password')}
                ${text('ttsApi.model', '模型', 'tts-1')}
                ${text('ttsApi.voice', '默认音色', 'alloy')}
                ${check('ttsApi.autoPlay', '收到消息自动朗读')}
                <div class="mp-btnrow"><button class="mp-mini" data-action="test-tts">试听</button></div>
            ` : ''}
        </div>

        <h4>聊天与注入</h4>
        <div class="mp-group">
            ${check('autoReply', '发送后自动回复')}
            ${check('storyPrompt', '告诉正文 AI 怎么发手机消息')}
            ${text('autoScanEvery', '自动识别联系人', '0 = 关闭', 'number', 'min="0" step="1"')}
            <p class="mp-hint">每收到这么多条正文，AI 自动从剧情和世界书里补充联系人。填 0 关闭。</p>
            ${text('contextMessages', '带入正文条数', '10', 'number', 'min="0" step="1"')}
            ${text('injectCount', '每个对话注入条数', '10', 'number', 'min="1" step="1"')}
            ${text('injectDepth', '注入深度', '1', 'number', 'min="0" step="1"')}
        </div>
        <p class="mp-hint">正文里角色发手机消息的格式：<br><code>[手机消息|发送人|内容]</code><br><code>[手机图片|发送人|画面描述]</code></p>
    </div>`;
}

function render() {
    const body = document.querySelector('#mp-phone .mp-body');
    if (!body || !state.open) { updateBadges(); return; }
    const oldContent = body.querySelector('.mp-content');
    const keepScroll = oldContent && body.dataset.view === state.view && state.view !== 'conversation' ? oldContent.scrollTop : null;

    let html;
    switch (state.view) {
        case 'chatList': html = viewChatList(); break;
        case 'conversation': html = viewConversation(); break;
        case 'contactInfo': html = curContact() ? viewContactForm(curContact()) : viewChatList(); break;
        case 'addContact': html = viewContactForm(null); break;
        case 'settings': html = viewSettings(); break;
        default: html = viewHome();
    }
    body.innerHTML = html;
    body.dataset.view = state.view;
    document.querySelector('#mp-phone .mp-screen').classList.toggle('on-home', state.view === 'home');

    const content = body.querySelector('.mp-content');
    if (state.view === 'conversation' && content) content.scrollTop = content.scrollHeight;
    else if (keepScroll !== null && content) content.scrollTop = keepScroll;

    const input = body.querySelector('.mp-input');
    if (input) autoGrow(input);
    updateBadges();
}

// 只在相关界面可见时重绘
function refresh(ct) {
    if (!state.open) { updateBadges(); return; }
    if (state.view === 'chatList' || state.view === 'home' || (state.view === 'conversation' && state.contactId === ct?.id)) render();
    else updateBadges();
}

function autoGrow(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 96) + 'px';
}

// ---------------- 交互 ----------------
const actions = {
    go(a) {
        state.view = a.dataset.view;
        if (state.view === 'conversation') { const ct = curContact(); if (ct) { ct.unread = 0; saveData(); } }
        render();
    },
    home() { state.view = 'home'; render(); },
    close() { togglePhone(false); },
    'open-chat'(a) {
        state.contactId = a.dataset.id;
        const ct = curContact();
        if (ct) ct.unread = 0;
        state.view = 'conversation';
        saveData();
        render();
    },
    banner(a) {
        if (!a.dataset.id) return;
        a.classList.remove('show');
        actions['open-chat'](a);
    },
    send() {
        const ct = curContact();
        const input = document.querySelector('#mp-phone .mp-input');
        const text = input?.value.trim();
        if (!ct) return;
        if (!text) { requestReply(ct); return; }
        addMessage(ct, { from: 'me', text });
        state.drafts[ct.id] = '';
        render();
        saveData();
        if (getSettings().autoReply) requestReply(ct);
    },
    'ask-reply'() { const ct = curContact(); if (ct) requestReply(ct); },
    'send-photo'() {
        const ct = curContact();
        const input = document.querySelector('#mp-phone .mp-input');
        const text = input?.value.trim();
        if (!ct) return;
        if (!text) { toast('info', '先在输入框里写下照片的画面描述'); return; }
        const m = addMessage(ct, { from: 'me', type: 'image', text, pending: true });
        state.drafts[ct.id] = '';
        render();
        saveData();
        genImageForMessage(ct, m);
    },
    'retry-img'(a) {
        const ct = curContact();
        const m = ct?.messages.find((x) => x.id === a.dataset.mid);
        if (!m) return;
        m.pending = true; delete m.error;
        render();
        genImageForMessage(ct, m);
    },
    'img-open'(a) { window.open(a.getAttribute('src'), '_blank'); },
    tts(a) {
        const ct = curContact();
        const m = ct?.messages.find((x) => x.id === a.dataset.mid);
        if (m) playTTS(m, ct);
    },
    'del-msg'(a) {
        const ct = curContact();
        if (!ct) return;
        ct.messages = ct.messages.filter((x) => x.id !== a.dataset.mid);
        saveData();
        render();
    },
    scan() { scanContacts(false); },
    'add-contact'() {
        if (!hasChat()) return toast('warning', '先打开一个聊天');
        const name = document.getElementById('mp-f-name').value.trim();
        if (!name) return toast('warning', '名字不能为空');
        if (getData().contacts.some((x) => x.name === name)) return toast('warning', '已经有同名联系人');
        const ct = ensureContact(name, {
            avatar: document.getElementById('mp-f-avatar').value.trim(),
            intro: document.getElementById('mp-f-intro').value.trim(),
            voice: document.getElementById('mp-f-voice')?.value.trim() || '',
        });
        saveData();
        state.contactId = ct.id;
        state.view = 'conversation';
        render();
    },
    'save-contact'() {
        const ct = curContact();
        if (!ct) return;
        const name = document.getElementById('mp-f-name').value.trim();
        if (!name) return toast('warning', '名字不能为空');
        if (name !== ct.name && getData().contacts.some((x) => x.name === name)) return toast('warning', '已经有同名联系人');
        ct.name = name;
        ct.avatar = document.getElementById('mp-f-avatar').value.trim();
        ct.intro = document.getElementById('mp-f-intro').value.trim();
        const voice = document.getElementById('mp-f-voice');
        if (voice) ct.voice = voice.value.trim();
        ct.inject = document.getElementById('mp-f-inject').checked;
        saveData();
        toast('success', '已保存');
        state.view = 'conversation';
        render();
    },
    'clear-contact'() {
        const ct = curContact();
        if (!ct || !confirm(`清空和「${ct.name}」的所有聊天记录？`)) return;
        ct.messages = [];
        ct.unread = 0;
        saveData();
        toast('success', '已清空');
    },
    'delete-contact'() {
        const ct = curContact();
        if (!ct || !confirm(`删除联系人「${ct.name}」和全部聊天记录？`)) return;
        const d = getData();
        d.contacts = d.contacts.filter((x) => x.id !== ct.id);
        saveData();
        state.contactId = null;
        state.view = 'chatList';
        render();
    },
    async 'fetch-models'() {
        try { state.models = await fetchModels(); toast('success', `获取到 ${state.models.length} 个模型`); render(); }
        catch (e) { toast('error', String(e.message || e)); }
    },
    async 'test-chat'() {
        try { const r = await callChatAPI('你是测试助手。', '只回复两个字：成功'); toast('success', `连接正常：${trunc(stripThink(r), 30)}`); }
        catch (e) { toast('error', String(e.message || e)); }
    },
    async 'test-image'() {
        toast('info', '正在生成测试图片…');
        try { const src = await generateImage('a cute cat sitting by the window'); window.open(src, '_blank'); toast('success', '生图正常'); }
        catch (e) { toast('error', String(e.message || e)); }
    },
    'test-tts'() { playTTS({ id: 'test-' + Date.now(), text: '你好，这是一条测试语音。' }, null); },
};

function bindPhoneEvents(phone) {
    phone.addEventListener('click', (e) => {
        const a = e.target.closest('[data-action]');
        if (a && phone.contains(a)) { e.preventDefault(); actions[a.dataset.action]?.(a, e); }
    });

    phone.addEventListener('input', (e) => {
        if (e.target.classList.contains('mp-input')) {
            if (state.contactId) state.drafts[state.contactId] = e.target.value;
            autoGrow(e.target);
        }
    });

    phone.addEventListener('keydown', (e) => {
        if (e.target.classList.contains('mp-input') && e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
            e.preventDefault();
            actions.send();
        }
        e.stopPropagation(); // 避免触发酒馆的快捷键
    });

    phone.addEventListener('change', (e) => {
        const el = e.target;
        const p = el.dataset.path;
        if (!p) return;
        if (el.type === 'radio' && !el.checked) return;
        let val = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value;
        setPath(getSettings(), p, val);
        saveSettings();
        updateInjection();
        if (el.type === 'radio' || el.type === 'checkbox' || el.tagName === 'SELECT') render();
    });
}

// ---------------- 拖动 ----------------
function makeDraggable(el, handle, onEnd) {
    let sx, sy, ox, oy, moved = false, dragging = false;
    handle.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || e.target.closest('button,input,textarea,select')) return;
        if (el.id === 'mp-phone' && window.innerWidth <= 600) return;
        dragging = true; moved = false;
        sx = e.clientX; sy = e.clientY;
        const r = el.getBoundingClientRect();
        ox = r.left; oy = r.top;
        handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const dx = e.clientX - sx, dy = e.clientY - sy;
        if (!moved && Math.abs(dx) + Math.abs(dy) < 5) return;
        moved = true;
        placeAt(el, ox + dx, oy + dy);
    });
    const end = () => { if (!dragging) return; dragging = false; onEnd?.(moved); };
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
}

function placeAt(el, x, y) {
    x = clamp(x, 0, window.innerWidth - el.offsetWidth);
    y = clamp(y, 0, window.innerHeight - el.offsetHeight);
    Object.assign(el.style, { left: x + 'px', top: y + 'px', right: 'auto', bottom: 'auto' });
    return { x, y };
}

function restorePos(el, pos) {
    if (pos) placeAt(el, pos.x, pos.y);
}

// ---------------- 构建界面 ----------------
function togglePhone(force) {
    const phone = document.getElementById('mp-phone');
    state.open = force ?? !state.open;
    phone.classList.toggle('mp-hidden', !state.open);
    if (state.open) {
        restorePos(phone, getSettings().phonePos);
        render();
    }
}

function buildUI() {
    document.getElementById('mp-fab')?.remove();
    document.getElementById('mp-phone')?.remove();

    const fab = document.createElement('div');
    fab.id = 'mp-fab';
    fab.title = '小手机';
    fab.innerHTML = '<span class="mp-fab-icon">📱</span><span class="mp-badge" style="display:none"></span>';
    document.body.appendChild(fab);

    const phone = document.createElement('div');
    phone.id = 'mp-phone';
    phone.className = 'mp-hidden';
    phone.innerHTML = `<div class="mp-screen">
        <div class="mp-statusbar">
            <span class="mp-sb-time">${fmtTime(Date.now())}</span>
            <span class="mp-notch"></span>
            <span class="mp-sb-right">●●● 5G <button class="mp-close" data-action="close" title="收起">✕</button></span>
        </div>
        <div class="mp-banner" data-action="banner"></div>
        <div class="mp-body"></div>
        <div class="mp-homebar" data-action="home" title="回到主屏"></div>
    </div>`;
    document.body.appendChild(phone);

    bindPhoneEvents(phone);

    restorePos(fab, getSettings().fabPos);
    makeDraggable(fab, fab, (moved) => {
        if (moved) {
            const r = fab.getBoundingClientRect();
            getSettings().fabPos = { x: r.left, y: r.top };
            saveSettings();
        } else togglePhone();
    });
    makeDraggable(phone, phone.querySelector('.mp-statusbar'), (moved) => {
        if (!moved) return;
        const r = phone.getBoundingClientRect();
        getSettings().phonePos = { x: r.left, y: r.top };
        saveSettings();
    });

    setInterval(() => {
        const t = phone.querySelector('.mp-sb-time');
        if (t) t.textContent = fmtTime(Date.now());
        if (state.open && state.view === 'home') render();
    }, 30000);

    window.addEventListener('resize', () => {
        const s = getSettings();
        restorePos(fab, s.fabPos);
        if (state.open) restorePos(phone, s.phonePos);
    });

    applyEnabled();
}

function applyEnabled() {
    const on = getSettings().enabled;
    document.getElementById('mp-fab')?.classList.toggle('mp-off', !on);
    if (!on) togglePhone(false);
    updateInjection();
}

// 扩展面板里的小开关
function buildExtensionPanel() {
    const html = `<div class="mp-ext-settings">
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>📱 小手机</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <label class="checkbox_label"><input type="checkbox" id="mp-enabled"> <span>启用小手机</span></label>
                <div class="flex-container">
                    <div class="menu_button" id="mp-open-btn">打开小手机</div>
                    <div class="menu_button" id="mp-reset-pos">重置位置</div>
                </div>
                <small>API、模式等设置在小手机的「设置」应用里。</small>
            </div>
        </div>
    </div>`;
    const host = document.getElementById('extensions_settings2') || document.getElementById('extensions_settings');
    if (!host) return;
    host.insertAdjacentHTML('beforeend', html);
    const cb = document.getElementById('mp-enabled');
    cb.checked = getSettings().enabled;
    cb.addEventListener('change', () => { getSettings().enabled = cb.checked; saveSettings(); applyEnabled(); });
    document.getElementById('mp-open-btn').addEventListener('click', () => { if (getSettings().enabled) togglePhone(true); });
    document.getElementById('mp-reset-pos').addEventListener('click', () => {
        const s = getSettings();
        s.fabPos = null; s.phonePos = null;
        saveSettings();
        for (const id of ['mp-fab', 'mp-phone']) {
            const el = document.getElementById(id);
            if (el) Object.assign(el.style, { left: '', top: '', right: '', bottom: '' });
        }
    });
}

// ---------------- 启动 ----------------
function onChatChanged() {
    state.contactId = null;
    state.typing = {};
    state.storyCounter = 0;
    if (['conversation', 'contactInfo', 'addContact'].includes(state.view)) state.view = 'chatList';
    ensureMainCharacter();
    updateInjection();
    render();
}

jQuery(async () => {
    getSettings();
    buildUI();
    buildExtensionPanel();

    const { eventSource, event_types } = ctx();
    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
    eventSource.on(event_types.MESSAGE_RECEIVED, onMessageReceived);
    if (event_types.MESSAGE_EDITED) eventSource.on(event_types.MESSAGE_EDITED, onMessageReceived);

    onChatChanged();
    console.log('[小手机] 已加载');
});

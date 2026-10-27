// ========================================
// 🎵 音乐 App · 小手机入口
// ----------------------------------------
// 界面和播放器（music-view / music-data / music-api / music.css）是从 phonetest 里你做的那版搬来的，
// 这里负责把它接到小手机上：
//  · 存储：global_* 键 → S.mz（全局，跨聊天）；music_* 键 → D().mz（跟着当前酒馆聊天）
//  · 图层壳：音乐界面自己管「首页 → 歌单 → 播放页」几层，这里给它一个能叠图层的屏幕
//  · 音乐卡：角色每次回复末尾带 <音乐卡>…</音乐卡>，本地解析成首页那张卡片 + 推荐的两首歌，然后从正文里去掉
//  · 聊天联动：分享 / 一起听走 music-share.js；聊天里接受角色的邀请走 G.mz*
// ========================================
import { S, D, C, G, ui, $, save, saveD, on, emit, page, reg, top, back, toast, meObj, avOf, putMedia, syncInject, INJ } from '../../core.js';
import { MusicData } from './music-data.js';
import { MusicView } from './music-view.js';
import { bridge } from './music-share.js';

/* ---------- 存储 ---------- */
const chatBox = () => (D().mz ||= {});
const globalBox = () => (S.mz ||= {});
const storage = {
    get(key, fallback = null) {
        const box = /^music_/.test(key) ? chatBox() : globalBox();
        return Object.prototype.hasOwnProperty.call(box, key) ? box[key] : fallback;
    },
    set(key, value) {
        if (/^music_/.test(key)) { chatBox()[key] = value; saveD(); }
        else { globalBox()[key] = value; save(); }
    }
};

/* ---------- 旧版音乐 App 的数据搬过来（只搬一次） ---------- */
export function migrate() {
    const old = S.music;
    const g = globalBox();
    if (!old || g._migrated) return;
    const song = s => ({ id: String(s.id || ''), name: s.name || '', artist: s.artist || '未知歌手', album: '', pic: s.pic || '', duration: Number(s.dur || 0) || 0 });
    const put = (k, v) => { if (v != null && !(k in g)) g[k] = JSON.stringify(v); };
    put('global_music_liked', (old.liked || []).map(song));
    put('global_music_history', (old.hist || []).map(song));
    put('global_music_search_history', old.sh || []);
    put('global_music_playlists', (old.lists || []).map(l => ({ id: l.id, name: l.n, songs: (l.songs || []).map(song), createdAt: Date.now() })));
    put('global_music_notes', (old.notes || []).filter(n => n.song?.name).map(n => ({
        id: n.id, song: song(n.song), lines: (n.lines || []).map(t => ({ txt: String(t), tr: '', t: 0 })),
        note: n.text || '', position: 0, createdAt: n.ts || Date.now()
    })));
    if (old.listenSec) put('global_music_listen_seconds', old.listenSec);
    else if (old.sec) put('global_music_listen_seconds', old.sec);
    const src = {};
    if (old.src?.search) src.vkeys = old.src.search;
    if (old.src?.meting) src.meting = old.src.meting;
    if (Object.keys(src).length) put('global_music_sources', src);
    g._migrated = 1;
    save();
}

/* ---------- 图层壳：按 id 叠图层，当前一层在最上，上一层垫在下面，其它隐藏，出栈的删掉 ---------- */
class Shell {
    constructor() { this.host = null; this.order = []; }
    get screen() { return this.host?.el?.querySelector('.mz-screen') || null; }
    setContent(html, id) {
        const screen = this.screen;
        if (!screen) return;
        const at = this.order.indexOf(id);
        if (at >= 0) this.order.splice(at + 1); else this.order.push(id);
        let layer = screen.querySelector(`:scope > [data-view-id="${id}"]`);
        if (!layer) {
            layer = document.createElement('div');
            layer.setAttribute('data-view-id', id);
            screen.appendChild(layer);
        }
        if (layer.getAttribute('data-raw-html') !== html) {
            layer.innerHTML = html;
            layer.setAttribute('data-raw-html', html);
        }
        screen.querySelectorAll(':scope > [data-view-id]').forEach(v => {
            const vid = v.getAttribute('data-view-id');
            const i = this.order.indexOf(vid);
            if (i < 0) { v.remove(); return; }
            v.className = vid === id ? 'phone-view-layer phone-view-current' : i === this.order.length - 2 ? 'phone-view-layer phone-view-prev' : 'phone-view-layer';
        });
    }
    showNotification(_title, text) { toast(text); }
}

/* ---------- 音乐卡（正文末尾）：提示词 + 解析 ---------- */
export const CARD_PROMPT = `<音乐卡格式>
每次回复的最后附一个 <音乐卡>…</音乐卡>，写主角（不是{{user}}）此刻的音乐状态，一行一项，竖线分隔，不加多余说明：
角色|显示名|@英文账号
时间|剧情里的日期|时间
没说出口|此刻憋在心里没说出口的一句话
心声|第一人称、此刻真实的想法
评论|名字|@账号|评论（写三行：三个不同的人对这条心声的吐槽、调侃或接话，口吻轻松好笑）
推荐|歌名|歌手（写两行：两首真实存在、贴合此刻心情的歌；歌名不加书名号、引号；不要照抄之前推荐过的）
喜欢|喜欢的东西|喜欢的东西|喜欢的东西（主角最近喜欢的三样：人、物或事）
整条回复只有一个 <音乐卡>，放在最末尾，不要放进代码块。
</音乐卡格式>`;
const CARD_RE = /<音乐卡>([\s\S]*?)<\/音乐卡>/g;
export function parseCard(text) {
    const blocks = [...String(text || '').matchAll(CARD_RE)];
    if (!blocks.length) return null;
    const card = { char: [], meta: [], stats: [], thought: [], replies: [], media: [], likes: [] };
    const field = { 角色: 'char', 时间: 'meta', 没说出口: 'stats', 心声: 'thought', 评论: 'replies', 推荐: 'media', 喜欢: 'likes' };
    for (const raw of blocks.at(-1)[1].split('\n')) {
        const parts = raw.trim().replace(/^[-*•\d.、\s]+/, '').replace(/｜/g, '|').split(/\s*\|\s*/);
        const k = field[parts[0]];
        if (!k || parts.length < 2) continue;
        const v = parts.slice(1).map(x => x.trim());
        if (k === 'replies') card.replies.push(v[0] || '', v[1] || '', v.slice(2).join('|'));
        else if (k === 'media') card.media.push(v[0].replace(/^[《「“"']+|[》」”"']+$/g, ''), v[1] || '');
        else if (k === 'stats' || k === 'thought') card[k] = [v.join('|')];
        else card[k] = v.filter(Boolean);
    }
    card.media = card.media.slice(0, 4);
    return card;
}

/* ---------- 控制器 ---------- */
class MusicApp {
    constructor() {
        this.storage = storage;
        this.phoneShell = new Shell();
        this.musicData = new MusicData(storage);
        this.view = new MusicView(this);
        this.musicData.onStateChange = () => this._scheduleUpdate();
        this.musicData.onTimeUpdate = (t, d) => this.view.onTime(t, d);
        this.musicData.onToast = (msg) => this.view.toast(msg);
        this.musicData.onPlaybackStopped = (reason) => this.endListening(reason);
        this.host = null;
    }

    _scheduleUpdate() {
        if (this._queued) return;
        this._queued = true;
        requestAnimationFrame(() => {
            this._queued = false;
            this.view.updateDisplay();
            this.paintIsland();
        });
    }

    /** 打开音乐 App；after 用来直接跳到播放页 / 一起听 */
    open(after) {
        if (this.host && top() === this.host) { after?.(); return; }
        this.phoneShell.order = [];
        this.host = page({
            cls: 'mzhost', noBack: 1, title: '', body: () => '<div class="mz-screen"></div>',
            onBack: () => this.view.back(),
            onClose: () => { this.leave(); this.host = null; }
        });
        this.phoneShell.host = this.host;
        this.view.render();
        after?.();
    }

    /** 音乐界面退到最底层再返回：关掉这个 App（歌照常放） */
    exit() {
        if (this.host && top() === this.host) back(true);
    }

    /** 离开 App：收起弹层，停掉计时，不打断音乐和一起听 */
    leave() {
        this.view._closeOverlay?.();
        this.view._hideThought?.();
        this.view._stopListenTimer?.();
        clearTimeout(this.view._joinTimer);
        this.view.stack = ['music'];
    }

    hostUser() {
        const me = meObj();
        return { name: me.nick || '我', avatar: avOf(me) };
    }

    /** 上传封面：居中裁成正方形，存进酒馆图片文件夹 */
    async uploadSquare(file, size = 600) {
        const url = URL.createObjectURL(file);
        try {
            const im = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('图片读不出来')); i.src = url; });
            const s = Math.min(im.width, im.height), c = Object.assign(document.createElement('canvas'), { width: size, height: size });
            c.getContext('2d').drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, size, size);
            return await putMedia(c.toDataURL('image/webp', .86), 'cover');
        } finally { URL.revokeObjectURL(url); }
    }

    cardEnabled() { return globalBox().card !== false; }
    setCardEnabled(on) { globalBox().card = !!on; save(); syncInject(); }
    getCardPrompt() { return globalBox().cardPrompt || CARD_PROMPT; }
    /** 空字符串 = 恢复默认；返回现在用的提示词 */
    setCardPrompt(text) {
        const t = String(text || '').trim();
        globalBox().cardPrompt = t && t !== CARD_PROMPT ? t : '';
        save(); syncInject();
        return this.getCardPrompt();
    }

    /** 歌停了（清空 / 换聊天）：一起听也一起结束 */
    endListening(reason = '') {
        const s = bridge.activeSession();
        if (s) bridge.endMusicListening(s.chatId, { reason });
        this.view?._paintListen?.();
    }

    /** 正文里的音乐卡：卡片 + 推荐的歌 */
    takeCard(card) {
        if (!card) return;
        this.musicData.setCardData(card);
        for (let j = 0; j + 1 < card.media.length; j += 2) {
            const name = card.media[j].trim(), artist = card.media[j + 1].trim();
            if (name) this.musicData.addSong(name, artist || '未知歌手');
        }
        this._scheduleUpdate();
    }

    onChatChanged() {
        this.musicData.clearCache();
        this.musicData.syncVolume();
        this.view.destroyFloatingWidget();
        if (storage.get('music_show_floating', false)) this.view.renderFloatingWidget();
        this._scheduleUpdate();
    }

    /** 灵动岛：放歌时显示封面 + 跳动的音柱，点一下打开播放页 */
    paintIsland() {
        const isl = $('.isl', ui.root);
        if (!isl) return;
        const d = this.musicData, s = d.getCurrentSong(), live = !!s && (d.isPlaying || d.isLoading);
        isl.classList.toggle('mu', live);
        isl.dataset.a = live ? 'mfull' : '';
        const want = live ? `${s.pic ? `<img src="${String(s.pic).replace(/"/g, '&quot;')}" alt="" referrerpolicy="no-referrer">` : ''}<i class="eq ${d.isPlaying ? 'on' : ''}"><b></b><b></b><b></b></i>` : '';
        if (isl._mz !== want) { isl._mz = want; isl.innerHTML = want; }
    }
}

/**
 * 等 initS() 读出真正的设置之后再建（index.js 的 init 里调用）。
 * 不能在 import 时就建：那时 S 还是默认值，旧数据迁移、播放队列和音量都会读空。
 */
export let musicApp = null;
export function initMusic() {
    if (musicApp) return musicApp;
    migrate();
    musicApp = new MusicApp();
    if (storage.get('music_show_floating', false)) musicApp.view.renderFloatingWidget();
    return musicApp;
}
const app = () => musicApp || initMusic();

/* ---------- 接到小手机 ---------- */
INJ.push(c => globalBox().card !== false ? (globalBox().cardPrompt || CARD_PROMPT).replace(/\{\{user\}\}/g, c?.name1 || '用户') : '');

/** 收到 AI 回复：取出音乐卡，再把它从正文里去掉（只认正常生成的新回复） */
export function cardSync(id) {
    const c = C(), m = c.chat?.[id];
    if (!m || m.is_user || !/<音乐卡>/.test(String(m.mes))) return false;
    app().takeCard(parseCard(m.mes));
    const cut = t => String(t).replace(CARD_RE, '').replace(/\n{3,}/g, '\n\n').trim();
    m.mes = cut(m.mes);
    if (Array.isArray(m.swipes) && m.swipes[m.swipe_id ?? 0] != null) m.swipes[m.swipe_id ?? 0] = cut(m.swipes[m.swipe_id ?? 0]);
    setTimeout(() => { c.updateMessageBlock?.(id, m); c.saveChat?.(); });
    return true;
}

try {
    const c = C(), E = c.eventTypes || c.event_types;
    c.eventSource?.on(E.MESSAGE_RECEIVED, id => cardSync(id));
    c.eventSource?.on(E.CHAT_CHANGED, () => musicApp?.onChatChanged()); // 还没初始化就不用管，初始化时会读当前聊天
} catch (_e) { /* 没有酒馆环境（测试）就算了 */ }

// 聊天那边要用的：接受角色的一起听邀请、点分享卡片放歌、打开一起听页面
Object.assign(G, {
    mfull: () => app().open(() => musicApp.view.openPlayer()),
    mzPlay: (name, artist, meta) => app().musicData.playSongByName(name, artist, meta),
    mzSnapshot: () => app().musicData.getListeningSnapshot(),
    mzListen: () => app().open(() => musicApp.view.openListen()),
    mzPlayer: () => app().open(() => musicApp.view.openPlayer())
});

reg({
    id: 'music', name: '音乐',
    icon: '<svg viewBox="0 0 24 24" fill="#fff"><circle cx="12" cy="12" r="9" opacity=".25"/><path d="M10 16.5V8l6-1.5V15"/><circle cx="8.3" cy="16.6" r="1.9"/><circle cx="14.3" cy="15.1" r="1.9"/></svg>',
    open: () => app().open()
});

// ========================================
// 🎵 音乐APP - 音源
// ----------------------------------------
// vkeys 搜索 + Meting 取链 / 歌词 / 歌单，最后试备用音源脚本；三个地址都能在设置里改
// 请求走小手机的 getJ / getT：直连被跨域拦了会改用 TauriTavern 原生请求或酒馆 /proxy/
// ========================================
import { getJ, getT } from '../../core.js';

export const SOURCE_DEFAULTS = {
    vkeys: 'https://api.vkeys.cn/v2/music/netease',
    meting: 'https://api.qijieya.cn/meting/',
    external: 'https://drive.baibai.cv/f/ZKEBuW/Music.js'
};
const EXTERNAL_SOURCE_ID = 'mz-external-music-source';

// 网易云官方榜单（ID 长期稳定）
export const MUSIC_TOPLISTS = [
    { id: '19723756', name: '飙升榜', tint: '#4fb3a9' },
    { id: '3779629', name: '新歌榜', tint: '#6c8fd8' },
    { id: '3778678', name: '热歌榜', tint: '#e0605e' },
    { id: '2884035', name: '原创榜', tint: '#c07ad6' }
];

// 语种 / 风格关键词扩展：直接搜“日语”只会搜到歌名带“日语”的歌，
// 这里把它展开成一批代表歌手，保证搜出来的确实是日语歌。
const KEYWORD_EXPANSIONS = [
    {
        match: /^(日语|日文|日系|日本|j-?pop|日语歌|日文歌)$/i,
        label: '日语', cat: '日语',
        seeds: ['米津玄師', 'YOASOBI', 'ヨルシカ', 'Aimer', 'RADWIMPS', 'Official髭男dism', 'King Gnu', 'あいみょん', '藤井風', '宇多田ヒカル', 'Mrs. GREEN APPLE', 'back number', 'LiSA', 'Ado', '優里', '中島美嘉']
    },
    {
        match: /^(韩语|韩文|韩国|k-?pop|韩语歌)$/i,
        label: '韩语', cat: '韩语',
        seeds: ['IU', 'BTS', 'BLACKPINK', 'NewJeans', 'NCT 127', 'TWICE', 'BIGBANG', 'aespa', 'IVE', 'SEVENTEEN', 'EXO', 'Red Velvet', '太妍', 'LE SSERAFIM']
    },
    {
        match: /^(英语|英文|欧美|英文歌|英语歌)$/i,
        label: '英语', cat: '欧美',
        seeds: ['Taylor Swift', 'Ed Sheeran', 'Billie Eilish', 'Bruno Mars', 'Adele', 'The Weeknd', 'Ariana Grande', 'Lana Del Rey', 'Justin Bieber', 'Coldplay', 'Rihanna', 'Keri Hilson', 'Dua Lipa', 'Maroon 5']
    },
    {
        match: /^(粤语|广东话|粤语歌)$/i,
        label: '粤语', cat: '粤语',
        seeds: ['陈奕迅 粤语', '张学友', 'Beyond', '王菲 粤语', '张国荣', '梅艳芳', '容祖儿', '杨千嬅', '谢安琪', '古巨基', '林子祥', '邓紫棋 粤语']
    },
    {
        match: /^(二次元|动漫|acg|动画|番剧)$/i,
        label: '二次元', cat: 'ACG',
        seeds: ['LiSA', 'Aimer', 'ClariS', 'supercell', 'EGOIST', 'ReoNa', '澤野弘之', 'fripSide', 'YOASOBI', 'Eve']
    },
    {
        match: /^(古风|国风)$/i,
        label: '古风', cat: '古风',
        seeds: ['银临', '河图', '双笙', '音频怪物', '等什么君', '司夏', '小魂', '古风']
    },
    {
        match: /^(说唱|rap|嘻哈|hiphop|hip-hop)$/i,
        label: '说唱', cat: '说唱',
        seeds: ['GAI', '法老', '马思唯', '艾热', 'Higher Brothers', 'Kendrick Lamar', 'Drake', 'Eminem', '说唱']
    }
];

export const MUSIC_HOT_KEYWORDS = ['日语', '韩语', '英语', '粤语', '二次元', '古风', '说唱', '小甜歌', '治愈', '伤感', 'NCT', '周杰伦'];

const cleanText = (value = '') => String(value || '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const parseDurationText = (value) => {
    if (value === undefined || value === null || value === '') return 0;
    if (typeof value === 'number') return value > 10000 ? Math.round(value / 1000) : Math.round(value);
    const text = String(value);
    const mmss = text.match(/(\d+):(\d{1,2})/);
    if (mmss) return Number(mmss[1]) * 60 + Number(mmss[2]);
    const zh = text.match(/(?:(\d+)\s*分)?\s*(?:(\d+)\s*秒)?/);
    if (zh && (zh[1] || zh[2])) return Number(zh[1] || 0) * 60 + Number(zh[2] || 0);
    const num = Number(text);
    return Number.isFinite(num) ? (num > 10000 ? Math.round(num / 1000) : Math.round(num)) : 0;
};

const toHttps = (url = '') => String(url || '').replace(/^http:\/\//i, 'https://');

export function parseLrc(text = '') {
    const lines = [];
    const timeRegex = /\[(\d+):(\d+)(\.\d+)?\]/g;
    String(text || '').split(/\r?\n/).forEach(rawLine => {
        const line = rawLine.trim();
        if (!line) return;
        const matches = [...line.matchAll(timeRegex)];
        if (matches.length === 0) return;
        const lyricText = line.replace(timeRegex, '').trim();
        if (!lyricText) return;
        matches.forEach(match => {
            const fraction = match[3] ? parseFloat(`0${match[3]}`) : 0;
            lines.push({ t: Number(match[1]) * 60 + Number(match[2]) + fraction, txt: lyricText });
        });
    });
    return lines.sort((a, b) => a.t - b.t);
}

function mergeLyrics(mainText, transText) {
    const main = parseLrc(mainText);
    if (main.length === 0) return [];
    const trans = transText ? parseLrc(transText) : [];
    return main.map(line => {
        const hit = trans.find(item => Math.abs(item.t - line.t) < 0.6);
        return { t: line.t, txt: line.txt, tr: hit && hit.txt !== line.txt ? hit.txt : '' };
    });
}

export class MusicApi {
    /**
     * @param {() => {vkeys?: string, meting?: string, external?: string}} getSources 设置里填的地址（空着就用默认）
     */
    constructor(getSources) {
        this.getSources = typeof getSources === 'function' ? getSources : () => ({});
        this._lyricCache = new Map();
        this._externalPromise = null;
    }

    // ================= 基础 =================

    _src(key) {
        return String(this.getSources()?.[key] || '').trim() || SOURCE_DEFAULTS[key];
    }

    get VKEYS() { return this._src('vkeys'); }
    get METING() { return this._src('meting'); }

    _q(base, params) {
        return base + (base.includes('?') ? '&' : '?') + new URLSearchParams(params);
    }

    async _fetch(url, { timeout = 9000, as = 'json' } = {}) {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), timeout) : null;
        try {
            return as === 'text' ? await getT(url, controller?.signal) : await getJ(url, controller?.signal);
        } finally {
            if (timer) clearTimeout(timer);
        }
    }

    // ================= 归一化 =================

    normalizeVkeysSong(raw = {}) {
        return {
            id: raw.id ? String(raw.id) : '',
            name: cleanText(raw.song || raw.name || raw.title || ''),
            artist: cleanText(raw.singer || raw.artist || raw.author || '') || '未知歌手',
            album: cleanText(raw.album || ''),
            pic: toHttps(raw.cover || raw.pic || raw.picUrl || ''),
            duration: parseDurationText(raw.interval || raw.duration || raw.time || 0),
            fee: 0
        };
    }

    normalizeMetingSong(raw = {}) {
        const idMatch = String(raw.url || raw.lrc || raw.pic || '').match(/[?&]id=(\d+)/);
        return {
            id: raw.id ? String(raw.id) : (idMatch ? idMatch[1] : ''),
            name: cleanText(raw.name || raw.title || ''),
            artist: cleanText(raw.artist || raw.author || '') || '未知歌手',
            album: '',
            pic: toHttps(raw.pic || raw.cover || ''),
            duration: 0,
            fee: 0
        };
    }

    // ================= 搜索 =================

    getExpansion(keyword = '') {
        const key = cleanText(keyword);
        return KEYWORD_EXPANSIONS.find(item => item.match.test(key)) || null;
    }

    async _vkeysSearch(word, page = 1, num = 20) {
        const json = await this._fetch(this._q(this.VKEYS, { word, page, num }));
        const items = Array.isArray(json?.data) ? json.data : [];
        return items.map(item => this.normalizeVkeysSong(item)).filter(song => song.name);
    }

    async _searchOne(word, page, limit) {
        const songs = await this._vkeysSearch(word, page, Math.min(20, limit));
        return { songs, hasMore: songs.length >= Math.min(20, limit) };
    }

    /**
     * 搜索歌曲
     * 语种/风格词会展开成多位代表歌手并交错合并结果
     */
    async searchSongs(keyword, page = 1) {
        const word = cleanText(keyword);
        if (!word) return { songs: [], hasMore: false, expansion: null };
        const expansion = this.getExpansion(word);

        if (!expansion) {
            const result = await this._searchOne(word, page, 30);
            return { ...result, expansion: null };
        }

        // 展开搜索：每页取 4 位歌手，每人 8 首
        const perPage = 4;
        const seeds = expansion.seeds.slice((page - 1) * perPage, page * perPage);
        if (seeds.length === 0) return { songs: [], hasMore: false, expansion };
        const groups = await Promise.all(seeds.map(seed =>
            this._searchOne(seed, 1, 8).then(r => r.songs.slice(0, 8)).catch(() => [])
        ));
        const merged = [];
        const maxLen = Math.max(0, ...groups.map(g => g.length));
        for (let i = 0; i < maxLen; i++) {
            groups.forEach(group => { if (group[i]) merged.push(group[i]); });
        }
        return {
            songs: merged,
            hasMore: page * perPage < expansion.seeds.length,
            expansion
        };
    }

    // ================= 歌单 =================

    async getPlaylistTracks(playlistId) {
        const id = String(playlistId || '').trim();
        if (!id) return { info: null, songs: [] };

        const json = await this._fetch(this._q(this.METING, { server: 'netease', type: 'playlist', id }), { timeout: 15000 });
        const list = Array.isArray(json) ? json : [];
        const songs = list.map(item => this.normalizeMetingSong(item)).filter(s => s.name);
        return { info: null, songs };
    }

    /** 从分享链接 / 文本里提取歌单 ID */
    static parsePlaylistId(text = '') {
        const value = String(text || '').trim();
        const match = value.match(/playlist[^0-9]*?(?:id=)?(\d{5,})/i) || value.match(/[?&]id=(\d{5,})/) || value.match(/^(\d{5,})$/);
        return match ? match[1] : '';
    }

    // ================= 播放链接 =================

    /**
     * 依次产出可尝试的播放链接
     * @returns {AsyncGenerator<{url: string, source: string, trial?: boolean}>}
     */
    async *urlCandidates(song) {
        if (!song) return;
        if (song.localUrl) {
            yield { url: song.localUrl, source: 'local' };
            return;
        }

        let id = String(song.id || '').trim();
        if (!id) {
            const found = await this.resolveSongId(song.name, song.artist).catch(() => null);
            if (found?.id) {
                id = found.id;
                song.id = found.id;
                if (!song.pic && found.pic) song.pic = found.pic;
                if (!song.duration && found.duration) song.duration = found.duration;
            }
        }

        if (id) {
            try {
                const json = await this._fetch(this._q(this.METING, { server: 'netease', type: 'song', id }));
                const url = Array.isArray(json) ? json[0]?.url : '';
                if (url && !String(url).includes('music.163.com/404')) {
                    if (!song.pic && json[0]?.pic) song.pic = toHttps(json[0].pic);
                    yield { url: toHttps(url), source: 'meting' };
                }
            } catch (_e) { /* 下一个 */ }

            try {
                const json = await this._fetch(this._q(this.VKEYS, { id }));
                if (json?.data?.url) yield { url: toHttps(json.data.url), source: 'vkeys' };
            } catch (_e) { /* 下一个 */ }

            yield { url: `https://music.163.com/song/media/outer/url?id=${encodeURIComponent(id)}.mp3`, source: 'outer' };
        }

        const external = await this._fetchExternalSong(song.name, song.artist).catch(() => null);
        if (external?.url) {
            if (!song.pic && external.pic) song.pic = external.pic;
            if (external.lrc?.length && !this._lyricCache.has(this._lyricKey(song))) {
                this._lyricCache.set(this._lyricKey(song), external.lrc);
            }
            yield { url: external.url, source: 'external' };
        }
    }

    async resolveSongId(name, artist) {
        const word = cleanText(`${name || ''} ${artist || ''}`);
        if (!word) return null;
        const { songs } = await this._searchOne(word, 1, 10);
        if (!songs.length) return null;
        const targetName = cleanText(name).toLowerCase();
        return songs.find(s => s.name.toLowerCase() === targetName) || songs[0];
    }

    // ================= 歌词 =================

    _lyricKey(song) {
        return song?.id ? `id:${song.id}` : `n:${cleanText(song?.name)}|${cleanText(song?.artist)}`;
    }

    async getLyrics(song) {
        if (!song) return [];
        const key = this._lyricKey(song);
        if (this._lyricCache.has(key)) return this._lyricCache.get(key);

        let lyrics = [];
        const id = String(song.id || '').trim();
        if (!lyrics.length && id) {
            try {
                const main = await this._fetch(this._q(this.METING, { server: 'netease', type: 'lrc', id }), { as: 'text' });
                if (main && !main.includes('暂无歌词')) {
                    const trans = await this._fetch(this._q(this.METING, { server: 'netease', type: 'tlrc', id }), { as: 'text' }).catch(() => '');
                    lyrics = mergeLyrics(main, trans);
                }
            } catch (_e) { /* 无歌词 */ }
        }
        this._lyricCache.set(key, lyrics);
        return lyrics;
    }

    // ================= 备用音源（百百音源脚本） =================

    async _ensureExternalSource() {
        if (typeof window === 'undefined' || typeof document === 'undefined') return null;
        const existing = window.Music || globalThis.Music;
        if (typeof existing?.SearchMusic === 'function') return existing;
        if (this._externalPromise) return this._externalPromise;

        this._externalPromise = new Promise(resolve => {
            let settled = false;
            const finish = (api = null) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                resolve(api);
            };
            const timer = setTimeout(() => finish(null), 10000);
            const onReady = () => {
                const api = window.Music || globalThis.Music;
                finish(typeof api?.SearchMusic === 'function' ? api : null);
            };
            const existingNode = document.getElementById(EXTERNAL_SOURCE_ID);
            if (existingNode) {
                existingNode.addEventListener('load', onReady, { once: true });
                existingNode.addEventListener('error', () => finish(null), { once: true });
                setTimeout(onReady, 50);
                return;
            }
            const node = document.createElement('script');
            node.id = EXTERNAL_SOURCE_ID;
            node.src = this._src('external');
            node.async = true;
            node.onload = onReady;
            node.onerror = () => finish(null);
            document.head.appendChild(node);
        }).finally(() => {
            this._externalPromise = null;
        });
        return this._externalPromise;
    }

    async _fetchExternalSong(name, artist) {
        const safeName = cleanText(name);
        if (!safeName) return null;
        const api = await this._ensureExternalSource();
        if (typeof api?.SearchMusic !== 'function') return null;

        const queries = [cleanText(`${safeName} ${artist || ''}`), safeName]
            .filter((value, index, arr) => value && arr.indexOf(value) === index);
        for (const query of queries) {
            let raw = null;
            try {
                raw = await Promise.resolve(api.SearchMusic(query));
            } catch (_e) {
                continue;
            }
            const source = Array.isArray(raw) ? raw[0] : raw;
            if (!source || typeof source !== 'object') continue;
            const url = toHttps(source.Url || source.url || source.URL || source.data?.Url || source.data?.url || '');
            if (!url) continue;
            const lyricText = String(source.Lyric || source.lyric || source.Lrc || source.lrc || '').trim();
            return {
                url,
                pic: toHttps(source.Pic || source.pic || source.Cover || source.cover || ''),
                lrc: lyricText ? parseLrc(lyricText).map(line => ({ ...line, tr: '' })) : []
            };
        }
        return null;
    }
}

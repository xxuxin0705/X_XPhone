// ========================================
// 🎵 音乐APP - 聊天联动（分享到私聊 / 群聊、一起听）
// ----------------------------------------
// 接的是小手机自己的「聊天」：消息写进 D().chats，一起听的会话存在 D().mzListen（跟着当前酒馆聊天走）
// 消息类型：song（分享歌曲 / 歌词摘录）、listen（我发起的一起听）、minv（角色邀请我一起听）
// 导出的名字和音乐界面原来用的一样，界面那边不用改调用
// ========================================
import { D, saveD, emit, now, meObj, avOf, nm } from '../../core.js';
import { get } from '../chat/data.js';

const sessions = () => {
    const d = D();
    if (!d.mzListen || typeof d.mzListen !== 'object') d.mzListen = {};
    return d.mzListen;
};
const songLabel = (song) => `《${song.name || song.songName || '未知歌曲'}》${(song.artist) ? ` - ${song.artist}` : ''}`;
const songOf = (s = {}) => ({
    id: String(s.id || s.songId || ''),
    name: String(s.name || s.songName || '').trim(),
    artist: String(s.artist || '').trim(),
    album: String(s.album || '').trim(),
    pic: String(s.pic || s.cover || '').trim()
});

/** 头像：只认能直接显示的地址 */
export function normalizeAvatarPath(value) {
    const raw = String(value || '').trim();
    return /^(?:data:image|https?:\/\/|\/|blob:)/i.test(raw) ? raw : '';
}

/** 一个「像微信数据」的小外壳：音乐界面只用到这几样 */
class ChatBridge {
    get data() { return { musicListening: sessions() }; }

    getUserInfo() {
        const me = meObj();
        return { name: me.nick || '我', avatar: avOf(me) };
    }

    getContactAutoAvatar(key) {
        const c = get(key) || D().chats.find(x => [x.real, x.nick, x.remark, x.name].includes(key));
        return c ? avOf(c) : '';
    }

    getChat(id) { return get(id) || null; }

    getMusicListening(chatId) {
        const s = sessions()[chatId];
        return s && s.active !== false && get(chatId) ? s : null;
    }

    /** 最近一个还在进行的一起听 */
    activeSession() {
        let best = null;
        Object.values(sessions()).forEach(s => {
            if (!s || s.active === false || !get(s.chatId)) return;
            if (!best || Number(s.startedAt) > Number(best.startedAt)) best = s;
        });
        return best;
    }

    startMusicListening(chatId, contact = {}, snapshot = {}) {
        const ch = get(chatId);
        if (!ch) return null;
        // 同一时间只有一个一起听：开新的就把旧的结束掉（同一个聊天里之前那张卡片也显示已结束）
        Object.keys(sessions()).forEach(id => { if (sessions()[id]?.active !== false) this.endMusicListening(id, { reason: 'switch' }); });
        const user = this.getUserInfo();
        const session = {
            active: true,
            chatId,
            isGroup: ch.type === 'g',
            contactId: ch.type === 'g' ? '' : ch.id,
            contactName: contact.name || nm(ch),
            contactAvatar: normalizeAvatarPath(contact.avatar) || avOf(ch),
            userName: user.name,
            userAvatar: user.avatar,
            startedAt: Date.now(),
            sourceMessageId: String(snapshot.sourceMessageId || ''),
            songName: String(snapshot.songName || '').trim(),
            artist: String(snapshot.artist || '').trim(),
            cover: String(snapshot.cover || '').trim()
        };
        sessions()[chatId] = session;
        saveD();
        emit('chat');
        return session;
    }

    /** 结束一起听：会话标记结束，聊天里对应的卡片显示「共听已结束」 */
    endMusicListening(chatId, { reason = '' } = {}) {
        const s = sessions()[chatId];
        if (!s || s.active === false) return false;
        s.active = false;
        s.endedAt = Date.now();
        s.endReason = reason;
        const ch = get(chatId);
        (ch?.msgs || []).forEach(m => {
            if (m.t === 'listen' && m.st !== 'ended') m.st = 'ended';
            if (m.t === 'minv' && m.st === 'accepted') m.st = 'ended';
        });
        saveD();
        emit('chat');
        return true;
    }

    /** 我发一条消息（音乐 App 发出去的都是「我」发的，不会触发对方自动回复） */
    addMessage(chatId, msg) {
        const ch = get(chatId);
        if (!ch) return null;
        const x = { f: 'me', t: 'text', c: '', ts: +now(), ...msg };
        ch.msgs.push(x);
        saveD();
        emit('chat');
        return x;
    }

    saveData() { saveD(); }
}

export const bridge = new ChatBridge();

export async function getWechatData() {
    return bridge;
}

/**
 * 分享对象列表：好友按最近聊天排在前面，群聊单独一栏
 * @returns {{ singles: Array, groups: Array, userAvatar: string }}
 */
export async function listShareTargets() {
    const last = c => c.msgs?.at(-1)?.ts || 0;
    const chats = [...D().chats].sort((a, b) => last(b) - last(a));
    const singles = chats.filter(c => c.type === 'p' && c.fr !== 0).map(c => ({
        kind: 'single', chatId: c.id, contact: { id: c.id, name: nm(c), avatar: avOf(c) }, name: nm(c), avatar: avOf(c)
    }));
    const groups = chats.filter(c => c.type === 'g').map(c => ({
        kind: 'group', chatId: c.id, contact: null, name: c.name || '群聊', avatar: avOf(c), memberCount: (c.members || []).length + 1
    }));
    return { singles, groups, userAvatar: bridge.getUserInfo().avatar };
}

/**
 * 分享歌曲卡片
 * @param {object} target listShareTargets 返回的条目
 * @param {object} song
 * @param {{excerpt?: Array<{txt:string,tr?:string}>, note?: string, text?: string}} extra
 */
export async function shareSongToWechat(_storage, target, song, extra = {}) {
    const ch = get(target?.chatId);
    if (!ch) throw new Error('找不到这个聊天');
    const text = String(extra.text || '').trim();
    if (text) bridge.addMessage(ch.id, { t: 'text', c: text });
    const ex = (extra.excerpt || []).map(line => ({ txt: String(line.txt || '').trim(), tr: String(line.tr || '').trim() }))
        .filter(line => line.txt).slice(0, 8);
    const s = songOf(song);
    bridge.addMessage(ch.id, { t: 'song', c: `[分享音乐] ${songLabel(s)}`, song: s, ex, note: String(extra.note || '').trim() });
    return ch;
}

/** 发起一起听（私聊、群聊都可以）：发一张一起听卡片 */
export async function inviteListenInWechat(_storage, target, snapshot) {
    if (!snapshot) throw new Error('当前没有正在播放的歌曲');
    const ch = get(target?.chatId);
    if (!ch) throw new Error('找不到这个聊天');
    const sourceMessageId = `mzl_${Date.now().toString(36)}`;
    bridge.startMusicListening(ch.id, { name: target.name, avatar: target.avatar }, { ...snapshot, sourceMessageId });
    const s = songOf(snapshot);
    bridge.addMessage(ch.id, { t: 'listen', id: sourceMessageId, c: `[一起听歌] ${songLabel(s)}`, song: s, st: '' });
    return ch;
}

/** 在音乐 App 里直接邀请（不往聊天里发卡片），聊天那边也知道你们在一起听 */
export async function inviteListenInApp(_storage, target, snapshot) {
    if (!snapshot) throw new Error('当前没有正在播放的歌曲');
    const ch = get(target?.chatId);
    if (!ch) throw new Error('找不到这个好友');
    const session = bridge.startMusicListening(ch.id, { name: target.name, avatar: target.avatar }, { ...snapshot, sourceMessageId: '' });
    if (session) { session.via = 'app'; saveD(); }
    return ch;
}

/** 只发一句话（一起听卡片后面的附言） */
export async function sendTextToChat(_storage, target, text) {
    const ch = get(target?.chatId);
    if (ch && String(text || '').trim()) bridge.addMessage(ch.id, { t: 'text', c: String(text).trim() });
}

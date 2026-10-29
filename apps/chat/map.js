// 小手机 · 地图选点：地区、状态里的位置都用这个
// 地图用开源的 Leaflet（BSD-2，第一次打开时从公共 CDN 加载）；底图在国内用高德瓦片（国内快、中文地名），国外用 OpenStreetMap；
// 搜地点 / 把坐标换成地名用 OpenStreetMap 的 Nominatim（免费、不要密钥，不走你的 API）。加载不了地图时退回成「搜索 + 手动填写」。
import { esc, page, back, toast, $ } from '../../core.js';

const VER = '1.9.4';
const CDN = [`https://cdn.jsdelivr.net/npm/leaflet@${VER}/dist/`, `https://unpkg.com/leaflet@${VER}/dist/`];
export const mapHook = { geo: null }; // 测试用：换成假的搜索 / 反查
let lib = null;
const load = (tag, a) => new Promise((res, rej) => { const e = Object.assign(document.createElement(tag), a); e.onload = res; e.onerror = () => { e.remove(); rej(); }; document.head.append(e); });
const leaflet = () => lib ||= (async () => {
  if (globalThis.L?.map) return globalThis.L;
  for (const b of CDN) { try { await Promise.all([load('link', { rel: 'stylesheet', href: b + 'leaflet.css' }), load('script', { src: b + 'leaflet.js' })]); if (globalThis.L?.map) return globalThis.L; } catch { } }
  lib = null; throw Error('地图加载失败（网络不通）');
})();

const NOM = 'https://nominatim.openstreetmap.org/';
const ask = async (path, sg) => { const r = await fetch(NOM + path + '&format=jsonv2&accept-language=zh-CN', { signal: sg }); if (!r.ok) throw Error('地点服务暂时不可用'); return r.json(); };
// 地名：国内「省 市」，国外「国家 城市」（照微信资料里「地区：安徽 合肥」的写法）
const short = s => String(s || '').replace(/(省|市|自治区|特别行政区|壮族|回族|维吾尔)$/g, '');
export const placeName = a => { if (!a) return ''; const city = a.city || a.town || a.county || a.village || a.state_district || '', st = a.state || a.province || '';
  return (a.country_code == 'cn' ? [short(st), short(city)] : [a.country, city || st]).filter((x, i, L) => x && L.indexOf(x) == i).join(' '); };
export const geo = {
  search: async (q, sg) => mapHook.geo ? mapHook.geo.search(q) : (await ask(`search?q=${encodeURIComponent(q)}&limit=8&addressdetails=1`, sg)).map(x => ({ lat: +x.lat, lng: +x.lon, name: x.name || x.display_name.split(',')[0], full: x.display_name, area: placeName(x.address) })),
  rev: async (lat, lng, sg) => { if (mapHook.geo) return mapHook.geo.rev(lat, lng); const x = await ask(`reverse?lat=${lat}&lon=${lng}&zoom=12&addressdetails=1`, sg); return { area: placeName(x.address), full: x.display_name || '' }; },
};
const inCN = (lat, lng) => lat > 18 && lat < 54 && lng > 73 && lng < 135;
const TILE = { cn: ['https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', { subdomains: '1234', maxZoom: 18 }], os: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }] };

// 打开选点页：o = { title, lat, lng, area }；返回 { area, lat, lng } 或 null（取消）
export const mapPick = (o = {}) => new Promise(done => {
  let E = null, res = null, M = null, layer = null, lk = '', tm = 0, ac = null, cur = { lat: +o.lat || 0, lng: +o.lng || 0, area: o.area || '' };
  const show = () => { const b = $('.mp-cur', E); b && (b.querySelector('b').textContent = cur.area || '在地图上拖动选一个地方'); };
  const tiles = (lat, lng) => { const k = inCN(lat, lng) ? 'cn' : 'os'; if (k == lk || !M) return; lk = k; layer?.remove(); layer = globalThis.L.tileLayer(...TILE[k]).addTo(M); };
  const at = async (lat, lng) => { cur = { ...cur, lat, lng }; ac?.abort(); ac = new AbortController(); try { const r = await geo.rev(lat, lng, ac.signal); cur.area = r.area || cur.area; } catch { } show(); };
  const go = (lat, lng, z = 11) => { cur = { ...cur, lat, lng }; M ? (tiles(lat, lng), M.setView([lat, lng], z)) : 0; };
  const list = L => { const u = $('.mp-res', E); u.innerHTML = L.length ? L.map((x, i) => `<div class="mp-it" data-a="mpgo" data-x="${i}"><b>${esc(x.name)}</b><small>${esc(x.full)}</small></div>`).join('') : '<p class="mp-no">没有找到这个地方</p>'; u.hidden = false; u._L = L; };
  let A; page({ title: o.title || '地区', cls: 'mppg', noBack: 0,
    right: () => '<b class="txt mp-ok" data-a="mpok">确定</b>',
    body: () => `<div class="mp-s"><input class="mp-q" placeholder="搜索地点，如：横滨、合肥、Tokyo" enterkeyhint="search"><b data-a="mpq">搜索</b></div><div class="mp-res" hidden></div>
<div class="mp-map"><div class="mp-m"></div><i class="mp-pin"></i><p class="mp-tip">正在加载地图…</p></div>
<div class="mp-cur"><small>当前选择</small><b></b><span data-a="mphand">手动填写</span></div>`,
    after: async el => {
      E = el; show(); const q = $('.mp-q', el); q.onkeydown = e => e.key == 'Enter' && A.mpq();
      try {
        const L = await leaflet(); if (!el.isConnected) return; $('.mp-tip', el).remove();
        M = L.map($('.mp-m', el), { zoomControl: false, attributionControl: false }).setView(cur.lat || cur.lng ? [cur.lat, cur.lng] : [35, 105], cur.lat || cur.lng ? 11 : 3);
        tiles(M.getCenter().lat, M.getCenter().lng);
        M.on('moveend', () => { const c = M.getCenter(); tiles(c.lat, c.lng); clearTimeout(tm); tm = setTimeout(() => at(+c.lat.toFixed(5), +c.lng.toFixed(5)), 350); }); // 拖地图：中间的针下面是哪就是哪
        setTimeout(() => M?.invalidateSize(), 360);
      } catch (e) { const t = $('.mp-tip', el); t && (t.textContent = '地图加载不了（网络不通），可以搜索地点或手动填写'); }
    },
    acts: A = {
      mpq: async () => { const v = $('.mp-q', E).value.trim(); if (!v) return; try { list(await geo.search(v)); } catch { toast('搜索暂时不可用，可以手动填写'); } },
      mpgo: i => { const x = $('.mp-res', E)._L?.[+i]; if (!x) return; $('.mp-res', E).hidden = true; cur = { lat: x.lat, lng: x.lng, area: x.area || x.name }; show(); go(x.lat, x.lng, 12); },
      mphand: () => hand(),
      mpok: () => { if (!cur.area) return toast('先选一个地方'); res = { ...cur }; back(); },
    },
    onClose: () => { M?.remove(); M = null; done(res); },
  });
  // 手动填写：就地换成输入框（不弹浏览器自带的对话框）
  const hand = () => { const b = $('.mp-cur b', E); b.innerHTML = `<input class="mp-hi" value="${esc(cur.area)}" placeholder="如：日本 横滨">`; const i = $('.mp-hi', b); i.focus(); i.onkeydown = e => e.key == 'Enter' && i.blur(); i.onblur = () => { cur.area = i.value.trim(); show(); }; };
});

/* XFeed v2 — 共享内核：配置 / Telegram / 状态 / 反馈事件 / 图标 / 工具。
   交互逻辑与 v1（app/app.js）一致；视觉由 ?theme=a|b|c|d|hybrid 选择。 */
(() => {
'use strict';
const qs = new URLSearchParams(location.search);
function resolveFeedbackEndpoint() {
  // 优先级：?endpoint= → window.XFEED_CONFIG → <meta name="xfeed-feedback">
  // 不做同站默认：here.now 等纯静态站没有 /api/feedback，避免无意义 404。
  const fromQs = qs.get('endpoint');
  if (fromQs) return fromQs;
  const cfg = window.XFEED_CONFIG || {};
  if (cfg.FEEDBACK_ENDPOINT) return cfg.FEEDBACK_ENDPOINT;
  const meta = document.querySelector('meta[name="xfeed-feedback"]');
  if (meta && meta.content) return meta.content.trim();
  return null;
}
const CONFIG = Object.assign({
  FEEDBACK_ENDPOINT: null,
  FEEDBACK_TOKEN: null,
  DATA_BASE: 'data/',
  CHARS_PER_MIN: 400,
  SECONDS_PER_CARD: 3,
}, window.XFEED_CONFIG || {});
if (!CONFIG.FEEDBACK_ENDPOINT) CONFIG.FEEDBACK_ENDPOINT = resolveFeedbackEndpoint();
if (!CONFIG.FEEDBACK_TOKEN && qs.get('ftoken')) CONFIG.FEEDBACK_TOKEN = qs.get('ftoken');

// 视觉方向：a 编辑部 / b 暗色工具 / c 竖屏信息流 / d|hybrid = B 视觉 + A 单卡（无 UP NEXT）。兼容 v1 ?theme=dark|light
let THEME = (qs.get('theme') || 'd').toLowerCase();
let MODE = qs.get('mode');
if (THEME === 'hybrid') THEME = 'd';
if (THEME === 'dark' || THEME === 'light') { MODE = THEME; THEME = 'a'; }
if (!['a', 'b', 'c', 'd'].includes(THEME)) THEME = 'd';
document.documentElement.dataset.theme = THEME;

// ---------- Telegram ----------
const tg = window.Telegram && window.Telegram.WebApp;
const inTg = !!(tg && tg.initData);
const tgAtLeast = v => inTg && tg.isVersionAtLeast && tg.isVersionAtLeast(v);
const haptic = {
  impact: s => { if (tgAtLeast('6.1')) tg.HapticFeedback.impactOccurred(s); else if (navigator.vibrate && !inTg) try { navigator.vibrate(s === 'heavy' ? 20 : 8); } catch (e) {} },
  notify: s => { if (tgAtLeast('6.1')) tg.HapticFeedback.notificationOccurred(s); },
  select: () => { if (tgAtLeast('6.1')) tg.HapticFeedback.selectionChanged(); },
};
// 原生可强制浅/深（WKWebView 常不刷新 prefers-color-scheme）
let FORCED_SCHEME = null; // 'dark' | 'light' | null
function isDark() {
  if (FORCED_SCHEME) return FORCED_SCHEME === 'dark';
  if (MODE) return MODE === 'dark';
  if (inTg) return tg.colorScheme === 'dark';
  return matchMedia('(prefers-color-scheme: dark)').matches;
}
function applyTheme() {
  const root = document.documentElement;
  // C 永远是暗色（全屏影像流）；A/B/D 跟随系统 / 原生强制 / Telegram
  const dark = THEME === 'c' ? true : isDark();
  root.classList.toggle('dark', dark);
  root.classList.toggle('light', !dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
  if (inTg && tg.themeParams && qs.get('tgaccent') && tg.themeParams.button_color) root.style.setProperty('--accent', tg.themeParams.button_color);
  requestAnimationFrame(() => {
    const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
    if (tgAtLeast('6.1') && /^#[0-9a-f]{6}$/i.test(bg)) { try { tg.setHeaderColor(bg); tg.setBackgroundColor(bg); } catch (e) {} }
    if (tgAtLeast('7.10') && /^#[0-9a-f]{6}$/i.test(bg)) { try { tg.setBottomBarColor(bg); } catch (e) {} }
    const m = document.querySelector('meta[name=theme-color]'); if (m && bg) m.content = bg;
  });
}
/** 供 iOS traitCollection 注入：立刻切浅/深，不重启 WebView */
function setColorScheme(scheme) {
  if (scheme !== 'dark' && scheme !== 'light') return;
  FORCED_SCHEME = scheme;
  applyTheme();
}
if (tg) {
  try { tg.ready(); if (inTg) tg.expand(); } catch (e) {}
  if (tgAtLeast('7.7')) tg.disableVerticalSwipes();
  if (inTg) tg.onEvent('themeChanged', applyTheme);
}
applyTheme();
try {
  const mq = matchMedia('(prefers-color-scheme: dark)');
  const onMq = () => { if (!FORCED_SCHEME) applyTheme(); };
  if (mq.addEventListener) mq.addEventListener('change', onMq);
  else if (mq.addListener) mq.addListener(onMq);
} catch (e) {}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') applyTheme(); });

// ---------- 工具 ----------
const $ = s => document.querySelector(s);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
const WEEK_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const dObj = d => new Date(d + 'T00:00:00');
const fmtDate = d => { const t = dObj(d); return `${t.getMonth() + 1}月${t.getDate()}日 周${WEEK[t.getDay()]}`; };
const pad2 = n => String(n).padStart(2, '0');
let toastT;
function toast(msg) { const t = $('#toast'); if (!t) return; t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1400); }
function openLink(url) {
  if (!url) return;
  // 进外链前先清 drag / sheet / pointer，避免回前台假死（尤其开 X App）
  try {
    if (window.XFeed && typeof window.XFeed.prepareForExternal === 'function') window.XFeed.prepareForExternal();
    else if (window.XFeed && typeof window.XFeed.resumeFromExternal === 'function') window.XFeed.resumeFromExternal();
  } catch (e) {}
  if (inTg) {
    tg.openLink(url, { try_instant_view: !/x\.com|twitter\.com/.test(url) });
    return;
  }
  // X 帖：附带 twitter:// 给原生（WKWebView 拦截后优先开 X App）；https 作兜底
  const m = String(url).match(/(?:x|twitter)\.com\/(?:#!\/)?([^/?#]+)\/status(?:es)?\/(\d+)/i);
  if (m) {
    window.__xfeedXOpen = { https: url, deep: 'twitter://status?id=' + m[2], id: m[2], user: m[1] };
  } else {
    window.__xfeedXOpen = null;
  }
  window.open(url, '_blank', 'noopener');
}


// ---------- 图标（Lucide，ISC License，内联 path） ----------
const P = {
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  bookmark: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>',
  thumbsDown: '<path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"/>',
  arrowUpRight: '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
  arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  arrowLeft: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  arrowUp: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/>',
  rotate: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  chevronUp: '<path d="m18 15-6-6-6 6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  send: '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  message: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
  triangle: '<path d="m18 15-6-6-6 6"/>',
  list: '<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
};
const icon = (n, cls = '', sw = 1.75) => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;
const metricIcon = c => !c.metric_raw ? '' : c.metric_raw.label === '评论' ? 'message' : c.metric_raw.label === '票' ? 'triangle' : 'eye';

// ---------- 状态 ----------
const S = { data: null, deck: [], pos: 0, history: [], decisions: {} };
const EV_KEY = 'xfeed:events:v1', SENT_KEY = 'xfeed:sent:v1';
const LIKED_KEY = 'xfeed:liked:v1';          // 感兴趣永久库（跨天）
const CACHE_META_KEY = 'xfeed:cache:meta:v1'; // 日缓存元数据
const CACHE_DAY_PREFIX = 'xfeed:cache:day:';
const READ_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 已读卡 3 天后可清
const stKey = () => `xfeed:state:${S.data.date}`;
const loadJSON = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
const saveJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
function saveState() {
  saveJSON(stKey(), { pos: S.pos, history: S.history, decisions: S.decisions });
  // 同步日缓存决策（供 3 日已读清理）
  try { cacheTouchDecisions(S.data && S.data.date, S.decisions); } catch (e) {}
}

// ---------- 感兴趣永久库（永远不丢） ----------
function likedAll() { return loadJSON(LIKED_KEY, []); }
function likedCount() { return likedAll().length; }
function likedUpsert(card, date) {
  if (!card || !card.id) return;
  const all = likedAll().filter(x => x.id !== card.id);
  all.unshift({
    id: card.id, date: date || (S.data && S.data.date) || '',
    title: card.title || '', url: card.url || '', handle: card.handle || '',
    source_tag: card.source_tag || '', section: card.section || '',
    section_name: card.section_name || '', section_en: card.section_en || '',
    emoji: card.emoji || '', image: card.image || '',
    summary: (card.summary || card.detail || '').slice(0, 280),
    liked_at: new Date().toISOString(),
  });
  saveJSON(LIKED_KEY, all);
}
function likedRemove(id) {
  if (!id) return;
  saveJSON(LIKED_KEY, likedAll().filter(x => x.id !== id));
}
/** 按日期分组，新→旧；供感兴趣列表 */
function likedGrouped() {
  const map = new Map();
  for (const it of likedAll()) {
    const d = it.date || (it.liked_at || '').slice(0, 10) || '未知';
    if (!map.has(d)) map.set(d, []);
    map.get(d).push(it);
  }
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}

// ---------- 新闻日缓存：未读全留；已读 >3 天可清；感兴趣永不进清理 ----------
function cacheMeta() { return loadJSON(CACHE_META_KEY, { days: {} }); }
function cacheSaveMeta(m) { saveJSON(CACHE_META_KEY, m); }
function cachePutDay(dayObj) {
  if (!dayObj || !dayObj.date) return;
  const key = CACHE_DAY_PREFIX + dayObj.date;
  const prev = loadJSON(key, null);
  const decisions = (prev && prev.decisions) || {};
  const readAt = (prev && prev.readAt) || {};
  saveJSON(key, { date: dayObj.date, saved_at: new Date().toISOString(), payload: dayObj, decisions, readAt });
  const m = cacheMeta(); m.days[dayObj.date] = { saved_at: new Date().toISOString(), n: (dayObj.cards || []).length }; cacheSaveMeta(m);
}
function cacheTouchDecisions(date, decisions) {
  if (!date || !decisions) return;
  const key = CACHE_DAY_PREFIX + date;
  const cur = loadJSON(key, null); if (!cur) return;
  const now = new Date().toISOString();
  cur.decisions = decisions;
  cur.readAt = cur.readAt || {};
  for (const [id, act] of Object.entries(decisions)) {
    if (act && !cur.readAt[id]) cur.readAt[id] = now;
  }
  saveJSON(key, cur);
}
function cacheGetDay(date) {
  return loadJSON(CACHE_DAY_PREFIX + date, null);
}
function cachePurge() {
  const likedIds = new Set(likedAll().map(x => x.id));
  const m = cacheMeta();
  const now = Date.now();
  for (const date of Object.keys(m.days || {})) {
    const key = CACHE_DAY_PREFIX + date;
    const cur = loadJSON(key, null);
    if (!cur || !cur.payload) continue;
    const cards = cur.payload.cards || [];
    const readAt = cur.readAt || {};
    const decisions = cur.decisions || {};
    const kept = cards.filter(c => {
      if (likedIds.has(c.id)) return true; // 感兴趣永久
      const decided = !!decisions[c.id];
      if (!decided) return true; // 未读全留
      const t = Date.parse(readAt[c.id] || cur.saved_at || 0);
      if (!t || (now - t) < READ_TTL_MS) return true; // 已读未满 3 天
      return false; // 已读且 >3 天 → 丢掉
    });
    if (kept.length === cards.length) continue;
    if (!kept.length) {
      try { localStorage.removeItem(key); } catch (e) {}
      delete m.days[date];
    } else {
      cur.payload = Object.assign({}, cur.payload, { cards: kept });
      // 重算 counts
      const counts = {};
      for (const c of kept) counts[c.section] = (counts[c.section] || 0) + 1;
      cur.payload.counts = counts;
      saveJSON(key, cur);
      m.days[date] = { saved_at: cur.saved_at, n: kept.length };
    }
  }
  cacheSaveMeta(m);
}

function shareNative({ url, title, text } = {}) {
  if (!url) return Promise.resolve(false);
  const payload = { url, title: title || '', text: text || (title ? (title + '\n' + url) : url) };
  try {
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.share) {
      window.webkit.messageHandlers.share.postMessage(payload);
      return Promise.resolve(true);
    }
  } catch (e) {}
  if (navigator.share) {
    return navigator.share({ title: title || 'XFeed', url }).then(() => true).catch(() => false);
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(url).then(() => true).catch(() => false);
  }
  try {
    const ta = document.createElement('textarea'); ta.value = url; ta.style.cssText = 'position:fixed;left:-9999px';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    return Promise.resolve(true);
  } catch (e) { return Promise.resolve(false); }
}

// ---------- 反馈事件（格式与 v1 完全一致） ----------
function logEvent(action, card) {
  const ev = { date: S.data.date, url: card.url, section: card.section, action, ts: new Date().toISOString(), card_id: card.id };
  const all = loadJSON(EV_KEY, []); all.push(ev); saveJSON(EV_KEY, all);
  scheduleFlush();
  return ev;
}
const R = { syncState: CONFIG.FEEDBACK_ENDPOINT ? '待同步' : '未配置上报端点，仅存本地' };
let flushT, flushing = false;
function scheduleFlush() { clearTimeout(flushT); flushT = setTimeout(() => flush(false), 1500); }
async function flush(beacon = false) {
  if (!CONFIG.FEEDBACK_ENDPOINT) return false;
  if (flushing && !beacon) return false;
  const all = loadJSON(EV_KEY, []), sent = loadJSON(SENT_KEY, 0);
  const batch = all.slice(sent);
  if (!batch.length) { R.syncState = sent ? `已同步 ${sent} 条` : '无新事件'; return true; }
  const payload = {
    initData: inTg ? tg.initData : '',
    token: CONFIG.FEEDBACK_TOKEN || '',
    source: inTg ? 'miniapp' : 'ios',
    events: batch,
  };
  const body = JSON.stringify(payload);
  flushing = true;
  try {
    if (beacon && navigator.sendBeacon) {
      const ok = navigator.sendBeacon(CONFIG.FEEDBACK_ENDPOINT, new Blob([body], { type: 'application/json' }));
      if (!ok) throw new Error('beacon rejected');
      // beacon 无法读响应：乐观推进游标，失败会在下次全量重试时由服务端去重（同 ts+card_id）
      saveJSON(SENT_KEY, all.length); R.syncState = `已同步 ${all.length} 条`; return true;
    }
    const headers = { 'Content-Type': 'application/json' };
    if (CONFIG.FEEDBACK_TOKEN) headers['X-XFeed-Token'] = CONFIG.FEEDBACK_TOKEN;
    const r = await fetch(CONFIG.FEEDBACK_ENDPOINT, { method: 'POST', headers, body, keepalive: true, mode: 'cors' });
    if (!r.ok) throw new Error(r.status);
    saveJSON(SENT_KEY, all.length); R.syncState = `已同步 ${all.length} 条`; return true;
  } catch (e) {
    R.syncState = '同步失败，稍后重试';
    // 退避再试
    clearTimeout(flushT); flushT = setTimeout(() => flush(false), 8000);
    return false;
  } finally { flushing = false; }
}
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(true); });
addEventListener('pagehide', () => { flush(true); });
function compactPayload() {
  const ev = loadJSON(EV_KEY, []).filter(e => e.date === S.data.date && e.action !== 'open');
  const p = { v: 1, t: 'xfeed_feedback', date: S.data.date, ev: ev.map(e => [e.card_id, e.action, Math.round(Date.parse(e.ts) / 1000)]) };
  let s = JSON.stringify(p);
  while (s.length > 4000 && p.ev.length) { p.ev.shift(); s = JSON.stringify(p); }
  return s;
}
async function submitTg() {
  await flush();
  if (tg.initDataUnsafe && tg.initDataUnsafe.query_id) tg.close();
  else tg.sendData(compactPayload());
}
function showMainButton() { if (inTg) { tg.MainButton.setText('提交反馈并关闭'); tg.MainButton.show(); tg.MainButton.onClick(submitTg); } }
function hideMainButton() { if (inTg) { tg.MainButton.offClick(submitTg); tg.MainButton.hide(); } }
function exportFeedback() {
  // 不再提供「复制 JSON」；自动上报。无端点时静默留本地，不弹「暂存」toast。
  if (inTg) return submitTg();
  return flush(false).then(ok => {
    if (ok) toast('反馈已同步');
    else if (CONFIG.FEEDBACK_ENDPOINT) toast('同步失败，稍后重试');
    // 未配置端点：事件已在 localStorage，不打扰
  });
}
function restart() {
  localStorage.removeItem(stKey());
  const p = new URLSearchParams({ date: S.data.date, theme: THEME }); if (MODE) p.set('mode', MODE);
  location.search = '?' + p.toString();
}
window.XFeed = { events: () => loadJSON(EV_KEY, []), payload: () => compactPayload(), flush, theme: THEME, state: S, setColorScheme, applyTheme };

// ---------- 数据 / 统计 ----------
function readingMinutes(cards) {
  const chars = cards.reduce((n, c) => n + (c.title + c.summary).length, 0);
  return Math.max(1, Math.round(chars / CONFIG.CHARS_PER_MIN + cards.length * CONFIG.SECONDS_PER_CARD / 60));
}
const byId = id => S.data.cards.find(c => c.id === id);
const idsOf = a => S.data.cards.filter(c => S.decisions[c.id] === a).map(c => c.id);
function sectionStats() {
  return S.data.sections.filter(s => S.data.counts[s.key]).map(s => {
    const n = S.data.cards.filter(c => c.section === s.key && (S.decisions[c.id] === 'like' || S.decisions[c.id] === 'save')).length;
    return { ...s, n, total: S.data.counts[s.key] };
  });
}
// 卡片在全部卡片中的序号（1-based）与在板块内的序号
const cardIndex = c => S.data.cards.indexOf(c) + 1;
function sectionRange(key) {
  const idx = S.data.cards.map((c, i) => c.section === key ? i + 1 : 0).filter(Boolean);
  return [idx[0], idx[idx.length - 1]];
}
const bodyText = c => c.title_derived ? (c.detail || '') : c.summary;
const hostOf = c => c.handle;

const SECTION_ORDER = ['ideas', 'tech', 'products', 'business', 'signals'];
function reorderIdeasFirst(data) {
  if (!data || !Array.isArray(data.cards)) return data;
  const rank = k => { const i = SECTION_ORDER.indexOf(k); return i < 0 ? 99 : i; };
  data.cards = data.cards.slice().sort((a, b) => rank(a.section) - rank(b.section));
  if (Array.isArray(data.sections)) {
    data.sections = data.sections.slice().sort((a, b) => rank(a.key) - rank(b.key));
  }
  return data;
}
async function loadData() {
  let dates = [];
  cachePurge();
  if (window.XFEED_CARDS) S.data = window.XFEED_CARDS;
  else {
    let date = qs.get('date');
    try { const idx = await (await fetch(CONFIG.DATA_BASE + 'index.json', { cache: 'no-cache' })).json(); dates = idx.dates || []; date = date || idx.latest; } catch (e) {}
    try {
      S.data = await (await fetch(CONFIG.DATA_BASE + date + '.json', { cache: 'no-cache' })).json();
      cachePutDay(S.data);
    } catch (e) {
      const cached = cacheGetDay(date);
      if (cached && cached.payload) S.data = cached.payload;
      else throw e;
    }
  }
  S.data = reorderIdeasFirst(S.data);
  S.data._dates = dates;
  S.deck = [{ type: 'cover' }, ...S.data.cards];
  if (qs.get('reset')) localStorage.removeItem(stKey());
  const st = loadJSON(stKey(), null);
  let restored = false;
  if (st && st.pos > 0) { S.pos = Math.min(st.pos, S.deck.length); S.history = st.history || []; S.decisions = st.decisions || {}; restored = S.pos < S.deck.length; }
  // 冷启动：把历史 like 决策补进永久库（幂等）
  try {
    for (const c of S.data.cards) {
      if (S.decisions[c.id] === 'like') likedUpsert(c, S.data.date);
    }
  } catch (e) {}
  return { restored };
}
function pastLinks() {
  return (S.data._dates || []).filter(d => d !== S.data.date).slice(0, 3).map(d => {
    const p = new URLSearchParams({ date: d, theme: THEME }); if (MODE) p.set('mode', MODE);
    return { d, href: '?' + p.toString() };
  });
}

window.X = { qs, CONFIG, THEME, tg, inTg, haptic, $, clamp, esc, fmtDate, dObj, WEEK, WEEK_EN, pad2, toast, openLink, icon, metricIcon,
  S, saveState, logEvent, flush, R, compactPayload, submitTg, showMainButton, hideMainButton, exportFeedback, restart,
  readingMinutes, byId, idsOf, sectionStats, cardIndex, sectionRange, bodyText, hostOf, loadData, pastLinks, loadJSON,
  likedAll, likedCount, likedUpsert, likedRemove, likedGrouped, shareNative, applyTheme, setColorScheme, SECTION_ORDER };
window.XFeed = Object.assign(window.XFeed || {}, { events: () => loadJSON(EV_KEY, []), payload: () => compactPayload(), flush, theme: THEME, state: S, setColorScheme, applyTheme, liked: likedAll });
})();

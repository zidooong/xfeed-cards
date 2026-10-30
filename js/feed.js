/* XFeed v2 — 方向 C：全屏竖屏信息流（TikTok / Reels 式）。
   手势：上滑 = 下一条（不记决策）、下滑 = 上一条；右滑 = 感兴趣并下一条、左滑 = 不感兴趣并下一条；
   双击 = 感兴趣（不跳走）；右侧操作栏：感兴趣 / 不感兴趣（并下一条）/ 稍后看 / 原文；轻点文字 = 原文。
   事件格式与 v1 一致（like | nope | save | open | undo）。 */
(() => {
'use strict';
const { S, $, esc, clamp, icon, metricIcon, haptic, toast, openLink, logEvent, saveState, fmtDate, pad2, dObj, WEEK,
  readingMinutes, byId, idsOf, sectionStats, cardIndex, sectionRange, bodyText, pastLinks, R, flush, inTg, showMainButton, hideMainButton,
  exportFeedback, restart } = window.X;
const N = () => S.data.cards.length;
const SECC = { tech: '#5B8CFF', products: '#FF6A3D', ideas: '#FFC83D', business: '#2FD6A0', signals: '#B57BFF' };

$('#app').innerHTML = `
  <div class="feed" id="feed"></div>
  <div class="fx" id="fx"><div class="edge like"></div><div class="edge nope"></div><div class="fb-l like">${icon('heart', '', 2.2)}感兴趣</div><div class="fb-l nope">${icon('x', '', 2.4)}不感兴趣</div></div>
  <header class="top" id="top">
    <div class="segs" id="progress"></div>
    <div class="top-row">
      <div class="brand"><b>XFeed</b><span id="hdrDate"></span></div>
      <div class="top-r">
        <button class="tbtn" id="btnUndo" aria-label="撤销">${icon('undo', '', 2)}</button>
        <button class="tbtn fav" id="favBtn" aria-label="稍后看列表">${icon('bookmark', '', 2)}<span id="favCount">0</span></button>
      </div>
    </div>
  </header>`;
document.body.insertAdjacentHTML('beforeend', `<div class="sheet-mask" id="sheetMask" hidden></div><aside class="sheet" id="sheet" hidden></aside><div class="toast" id="toast"></div><div class="bursts" id="bursts"></div>`);

// ---------- 渲染 ----------
const total = () => S.deck.length + 1; // 封面 + 卡片 + 结束页
const isEnd = k => k === S.deck.length;
function posterSize(t) {
  const n = [...t].reduce((a, ch) => a + (/[\u0000-\u00ff]/.test(ch) ? 0.55 : 1), 0);
  return n <= 8 ? 60 : n <= 14 ? 50 : n <= 22 ? 42 : 36;
}
function railHTML(c) {
  const d = S.decisions[c.id];
  return `<div class="rail">
    <button class="rb like ${d === 'like' ? 'on' : ''}" data-r="like" aria-label="感兴趣"><span class="rb-i">${icon('heart', '', 2)}</span><span class="rb-t">感兴趣</span></button>
    <button class="rb nope ${d === 'nope' ? 'on' : ''}" data-r="nope" aria-label="不感兴趣"><span class="rb-i">${icon('thumbsDown', '', 2)}</span><span class="rb-t">不感兴趣</span></button>
    <button class="rb save ${d === 'save' ? 'on' : ''}" data-r="save" aria-label="稍后看"><span class="rb-i">${icon('bookmark', '', 2)}</span><span class="rb-t">稍后看</span></button>
    <button class="rb open" data-r="open" aria-label="原文"><span class="rb-i">${icon('arrowUpRight', '', 2)}</span><span class="rb-t">原文</span></button>
  </div>`;
}
function cardHTML(c) {
  const i = cardIndex(c), col = SECC[c.section];
  const metric = c.metric_raw ? `<span class="metric">${icon(metricIcon(c), '', 2)}<b>${esc(c.metric_raw.value)}</b>${esc(c.metric_raw.label)}</span>` : '';
  const extras = c.extra_links.length ? c.extra_links.map(l => `<a class="xl" href="${esc(l.url)}" data-link="${esc(l.url)}">${icon('link', '', 2)}${esc(l.text)}</a>`).join('') : '';
  const kicker = `<div class="kick"><span class="sec" style="--sc:${col}">${esc(c.section_name)}</span><span class="idx">${pad2(i)} / ${pad2(N())}</span></div>`;
  if (c.image) {
    return `<div class="bg"><img class="blur" src="${esc(c.image)}" alt="" draggable="false"><figure class="media"><img src="${esc(c.image)}" alt="" draggable="false" onerror="this.closest('.slide').classList.add('img-failed')"></figure></div>
      <div class="scrim"></div>
      <div class="info" data-open>${kicker}
        <h2 class="t">${esc(c.title)}</h2>
        ${bodyText(c) ? `<p class="d">${esc(bodyText(c))}</p>` : ''}
        <div class="by"><span class="h">${esc(c.handle)}</span>${c.source_tag ? `<span class="via">${esc(c.source_tag)}</span>` : ''}${metric}${extras}</div>
      </div>`;
  }
  const big = c.metric_raw ? `<div class="p-metric" style="--sc:${col}"><b>${esc(c.metric_raw.value)}</b><span>${esc(c.metric_raw.label)}</span></div>` : `<div class="p-metric" style="--sc:${col}"><b>${pad2(i)}</b><span>${esc(c.section_en)}</span></div>`;
  return `<div class="bg poster-bg" style="--sc:${col}"></div>
    <div class="poster" data-open style="--sc:${col}">
      <div class="p-kick"><span>${esc(c.section_en)}</span><span>${pad2(i)} / ${pad2(N())}</span></div>
      <h2 class="p-t" style="font-size:${posterSize(c.title)}px">${esc(c.title)}</h2>
      ${big}
    </div>
    <div class="scrim soft"></div>
    <div class="info" data-open>${kicker.replace('<span class="idx">' + pad2(i) + ' / ' + pad2(N()) + '</span>', '')}
      ${bodyText(c) ? `<p class="d lg">${esc(bodyText(c))}</p>` : ''}
      <div class="by"><span class="h">${esc(c.handle)}</span>${c.source_tag ? `<span class="via">${esc(c.source_tag)}</span>` : ''}${extras}</div>
    </div>`;
}
function coverHTML() {
  const d = dObj(S.data.date), n = N();
  const rows = S.data.sections.filter(s => S.data.counts[s.key]).map(s =>
    `<li style="--sc:${SECC[s.key]}"><span class="c-dot"></span><span class="c-t">${s.name}</span><span class="c-n">${S.data.counts[s.key]}</span></li>`).join('');
  const past = pastLinks().map(p => `<a href="${p.href}">${p.d.slice(5).replace('-', '/')}</a>`).join('');
  return `<div class="bg cover-bg"></div><div class="cover-in">
    <div class="c-k">DAILY BRIEF · ${d.getFullYear()}</div>
    <div class="c-date"><b>${d.getMonth() + 1}.${pad2(d.getDate())}</b><span>星期${WEEK[d.getDay()]}</span></div>
    <h1 class="c-h">今天 ${n} 条<br>约 ${readingMinutes(S.data.cards)} 分钟刷完</h1>
    <ul class="c-rows">${rows}</ul>
    ${past ? `<div class="c-past"><span>往期</span>${past}</div>` : ''}
    <div class="c-go" data-act="start"><span class="c-chev">${icon('chevronUp', '', 2.2)}</span><b>上滑开始</b><span class="c-hint">右滑感兴趣 · 左滑不感兴趣 · 双击喜欢</span></div>
  </div>`;
}
function endHTML() {
  const likes = idsOf('like'), saves = idsOf('save'), nopes = idsOf('nope');
  const list = (ids, empty) => ids.length ? `<ul class="e-list">${ids.map(id => { const c = byId(id); return `<li data-link="${esc(c.url)}">${c.image ? `<img src="${esc(c.image)}" alt="">` : `<span class="e-ph" style="--sc:${SECC[c.section]}">${pad2(cardIndex(c))}</span>`}<span class="e-t">${esc(c.title)}<em>${esc(c.handle)}${c.source_tag ? ' · ' + esc(c.source_tag) : ''}</em></span>${icon('arrowUpRight', '', 2)}</li>`; }).join('')}</ul>` : `<p class="e-empty">${empty}</p>`;
  const secs = sectionStats().map(s => `<li style="--sc:${SECC[s.key]}"><span class="c-t">${s.name}</span><span class="e-bar"><i style="width:${s.n / s.total * 100}%"></i></span><span class="c-n">${s.n}/${s.total}</span></li>`).join('');
  return `<div class="bg cover-bg"></div><div class="end-in" id="endScroll">
    <div class="c-k">读完了 · ${fmtDate(S.data.date)}</div>
    <h2 class="e-h">今天的 ${N()} 条<br>刷完了</h2>
    <div class="e-stats"><div class="lk"><b>${likes.length}</b><span>感兴趣</span></div><div class="sv"><b>${saves.length}</b><span>稍后看</span></div><div><b>${nopes.length}</b><span>不感兴趣</span></div></div>
    <h4>各板块兴趣</h4><ul class="e-secs">${secs}</ul>
    <h4>稍后看 · ${saves.length}</h4>${list(saves, '没有稍后看的内容')}
    <h4>感兴趣 · ${likes.length}</h4>${list(likes, '—')}
    <div class="e-btns"><button data-act="restart">${icon('rotate', '', 2)}再刷一遍</button><button class="pri" data-act="export">${inTg ? icon('send', '', 2) + '提交反馈' : icon('copy', '', 2) + '复制反馈 JSON'}</button></div>
    <div class="e-sync" id="syncLine">反馈已存本地 · ${esc(R.syncState)}</div>
  </div>`;
}
const els = new Map();
function elFor(k) {
  if (els.has(k)) return els.get(k);
  const el = document.createElement('section');
  el.dataset.k = k;
  if (isEnd(k)) { el.className = 'slide end'; el.innerHTML = endHTML(); }
  else if (S.deck[k].type === 'cover') { el.className = 'slide cover'; el.innerHTML = coverHTML(); }
  else { const c = S.deck[k]; el.className = 'slide ' + (c.image ? 'has-img' : 'no-img'); el.dataset.section = c.section; el.innerHTML = cardHTML(c) + railHTML(c); }
  els.set(k, el); return el;
}
function fx(pl, pn, fade) { const f = $('#fx'); f.style.transition = fade ? 'opacity .35s' : 'none'; f.style.setProperty('--pl', pl); f.style.setProperty('--pn', pn); }
const H = () => $('#feed').clientHeight, W = () => $('#feed').clientWidth;
function place(el, y, extra = '') { el.style.transform = `translate3d(0,${y}px,0)${extra}`; }
function render(animate = true) {
  const feed = $('#feed'), h = H();
  for (const [k, el] of els) if ((k < S.pos - 1 || k > S.pos + 1) && !el.classList.contains('leaving')) { el.remove(); els.delete(k); }
  for (let k = S.pos - 1; k <= S.pos + 1; k++) {
    if (k < 0 || k >= total()) continue;
    const el = elFor(k);
    if (!el.parentNode) { place(el, (k - S.pos) * h); feed.appendChild(el); void el.offsetWidth; }
    el.style.transition = animate ? 'transform .42s cubic-bezier(.2,.85,.25,1)' : 'none';
    el.style.zIndex = k === S.pos ? 3 : 2;
    el.classList.toggle('cur', k === S.pos);
    place(el, (k - S.pos) * h);
  }
  fx(0, 0, true);
  if (isEnd(S.pos)) {
    if (!els.get(S.pos)._shown) { els.get(S.pos)._shown = true; haptic.notify('success'); showMainButton();
      flush().then(() => { const s = $('#syncLine'); if (s) s.textContent = '反馈已存本地 · ' + R.syncState; }); }
  } else hideMainButton();
  chrome();
}
function refreshEnd() { const k = S.deck.length, el = els.get(k); if (el) { el.remove(); els.delete(k); } }
function chrome() {
  const prog = $('#progress');
  if (prog.children.length !== N()) prog.innerHTML = S.data.cards.map(() => '<i></i>').join('');
  [...prog.children].forEach((s, i) => { s.className = i + 1 < S.pos ? 'done' : i + 1 === S.pos ? 'cur' : ''; });
  $('#favCount').textContent = Object.values(S.decisions).filter(a => a === 'save').length;
  $('#btnUndo').disabled = !S.history.length;
  const cur = S.deck[S.pos];
  document.documentElement.classList.toggle('on-cover', !!(cur && cur.type === 'cover'));
  document.documentElement.classList.toggle('on-end', isEnd(S.pos));
}
function syncRail(k) {
  const el = els.get(k), c = S.deck[k]; if (!el || !c || !c.id) return;
  const d = S.decisions[c.id];
  el.querySelectorAll('.rb[data-r]').forEach(b => b.classList.toggle('on', b.dataset.r === d));
}

// ---------- 导航与决策 ----------
function go(delta) {
  const np = clamp(S.pos + delta, 0, total() - 1);
  if (np === S.pos) { render(); return; }
  S.pos = np; saveState(); refreshEndIfNeeded(); render(); haptic.select();
}
function refreshEndIfNeeded() { if (S.pos >= S.deck.length - 1) { const k = S.deck.length, el = els.get(k); if (el && !isEnd(S.pos)) { el.remove(); els.delete(k); } } }
function decide(a, { advance = false, toggle = false } = {}) {
  const c = S.deck[S.pos]; if (!c || !c.id) { if (advance) go(1); return; }
  const prev = S.decisions[c.id];
  if (toggle && prev === a) { // 再点一次 = 撤销该决策
    delete S.decisions[c.id]; logEvent('undo', c);
    for (let i = S.history.length - 1; i >= 0; i--) if (S.history[i].pos === S.pos) { S.history.splice(i, 1); break; }
    saveState(); syncRail(S.pos); chrome(); haptic.impact('soft'); return;
  }
  if (prev !== a) {
    S.decisions[c.id] = a; logEvent(a, c); S.history.push({ pos: S.pos, act: a, prev: prev || null });
    if (a === 'save') { haptic.notify('success'); toast('已加入稍后看'); bump(); } else haptic.impact(a === 'like' ? 'medium' : 'light');
  }
  saveState(); syncRail(S.pos); chrome();
  if (advance) setTimeout(() => go(1), a === 'nope' ? 160 : 0);
}
function bump() { const b = $('#favBtn'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
function undo() {
  if (!S.history.length) return;
  const h = S.history.pop(); const c = S.deck[h.pos];
  if (h.prev) S.decisions[c.id] = h.prev; else delete S.decisions[c.id];
  logEvent('undo', c);
  S.pos = h.pos; saveState(); refreshEnd();
  els.forEach((el, k) => { if (k !== S.pos) return; }); syncRail(S.pos);
  render(); haptic.impact('soft'); toast('已撤销');
}
function flingSide(a, dx = 0, dy = 0) {
  const el = els.get(S.pos), c = S.deck[S.pos];
  if (!el) return;
  const next = els.get(S.pos + 1) || (S.pos + 1 < total() ? elFor(S.pos + 1) : null);
  if (next && !next.parentNode) $('#feed').appendChild(next);
  el.classList.add('leaving');
  fx(a === 'like' ? 1 : 0, a === 'nope' ? 1 : 0); setTimeout(() => fx(0, 0, true), 140);
  const sgn = a === 'like' ? 1 : -1, w = W();
  const anim = el.animate([{ transform: `translate3d(${dx}px,${dy}px,0) rotate(${dx / 30}deg)`, opacity: 1 }, { transform: `translate3d(${sgn * w * 1.2}px,${dy - 40}px,0) rotate(${sgn * 10}deg)`, opacity: .6 }],
    { duration: 300, easing: 'cubic-bezier(.3,.6,.35,1)', fill: 'forwards' });
  anim.onfinish = () => { el.remove(); el.classList.remove('leaving'); for (const [k, v] of els) if (v === el) els.delete(k); };
  if (next) { next.style.transition = 'transform .32s cubic-bezier(.2,.85,.25,1)'; next.style.transform = 'translate3d(0,0,0) scale(1)'; next.style.zIndex = 2; }
  if (c && c.id) {
    const prev = S.decisions[c.id];
    if (prev !== a) { S.decisions[c.id] = a; logEvent(a, c); S.history.push({ pos: S.pos, act: a, prev: prev || null }); }
    haptic.impact(a === 'like' ? 'medium' : 'light');
  }
  S.pos++; saveState();
  els.delete(S.pos - 1);
  chrome();
  setTimeout(() => render(false), 330);
}

// ---------- 手势 ----------
let drag = null, lastTap = 0, tapT = 0;
const feed = $('#feed');
feed.addEventListener('pointerdown', e => {
  const el = e.target.closest('.slide'); if (!el || +el.dataset.k !== S.pos || el.classList.contains('leaving')) return;
  if (e.target.closest('.rb,[data-link],button')) return;
  if (isEnd(S.pos) && $('#endScroll') && $('#endScroll').scrollTop > 0) return;
  if (e.button !== undefined && e.button > 0) return;
  el.setPointerCapture(e.pointerId);
  drag = { el, id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: performance.now(), dx: 0, dy: 0, axis: null, samples: [[performance.now(), e.clientX, e.clientY]], zone: null };
  els.forEach(s => s.style.transition = 'none');
});
feed.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  drag.dx = e.clientX - drag.x0; drag.dy = e.clientY - drag.y0;
  const now = performance.now(); drag.samples.push([now, e.clientX, e.clientY]);
  while (drag.samples.length > 2 && now - drag.samples[0][0] > 90) drag.samples.shift();
  if (!drag.axis && Math.hypot(drag.dx, drag.dy) > 10) drag.axis = Math.abs(drag.dy) > Math.abs(drag.dx) ? 'y' : (S.deck[S.pos] && S.deck[S.pos].id ? 'x' : 'y');
  const h = H();
  if (drag.axis === 'y') {
    let dy = drag.dy;
    if ((S.pos === 0 && dy > 0) || (S.pos === total() - 1 && dy < 0)) dy *= 0.3; // 端点阻尼
    for (const [k, el] of els) place(el, (k - S.pos) * h + dy);
  } else if (drag.axis === 'x') {
    const dx = drag.dx, el = drag.el;
    el.style.transform = `translate3d(${dx}px,${drag.dy * 0.15}px,0) rotate(${dx / 30}deg)`;
    fx(clamp((dx - 10) / 80).toFixed(3), clamp((-dx - 10) / 80).toFixed(3));
    const next = els.get(S.pos + 1);
    if (next) { const p = clamp(Math.abs(dx) / 160); next.style.zIndex = 2; next.style.transform = `translate3d(0,0,0) scale(${0.92 + 0.08 * p})`; next.style.setProperty('--dim', 1 - p); next.classList.add('under'); }
    const z = dx > 90 ? 'like' : dx < -90 ? 'nope' : null;
    if (z !== drag.zone) { if (z) haptic.impact('light'); drag.zone = z; }
  }
});
const endDrag = e => {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag; drag = null;
  const s0 = d.samples[0], s1 = d.samples[d.samples.length - 1], dt = Math.max(16, s1[0] - s0[0]);
  const vx = (s1[1] - s0[1]) / dt, vy = (s1[2] - s0[2]) / dt;
  const next = els.get(S.pos + 1); if (next) next.classList.remove('under');
  if (!d.axis) {
    if (e.type !== 'pointerup' || performance.now() - d.t0 > 400) return render();
    return onTap(e, d.el);
  }
  if (d.axis === 'y') {
    const h = H();
    if (d.dy < -h * 0.18 || (vy < -0.45 && d.dy < -24)) return go(1);
    if (d.dy > h * 0.18 || (vy > 0.45 && d.dy > 24)) return go(-1);
    return render();
  }
  if (d.zone === 'like' || (vx > 0.55 && d.dx > 30)) return flingSide('like', d.dx, d.dy * 0.15);
  if (d.zone === 'nope' || (vx < -0.55 && d.dx < -30)) return flingSide('nope', d.dx, d.dy * 0.15);
  d.el.style.transition = 'transform .4s cubic-bezier(.2,1.2,.3,1)';
  render();
};
feed.addEventListener('pointerup', endDrag); feed.addEventListener('pointercancel', endDrag);

function onTap(e, el) {
  const now = performance.now(), c = S.deck[S.pos];
  if (!c || !c.id) { if (c && c.type === 'cover') go(1); return; }
  if (now - lastTap < 300) { clearTimeout(tapT); lastTap = 0; burst(e.clientX, e.clientY); if (S.decisions[c.id] !== 'like') decide('like'); return; }
  lastTap = now;
  const onText = !!e.target.closest('[data-open]');
  tapT = setTimeout(() => { if (onText) { logEvent('open', c); haptic.select(); openLink(c.url); } }, 300);
}
function burst(x, y) {
  const b = document.createElement('div'); b.className = 'burst';
  b.style.left = x + 'px'; b.style.top = y + 'px'; b.style.setProperty('--r', (Math.random() * 30 - 15).toFixed(1) + 'deg');
  b.innerHTML = `<svg viewBox="0 0 24 24">${'<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>'}</svg>`;
  $('#bursts').appendChild(b); setTimeout(() => b.remove(), 900);
}

// ---------- 点击 ----------
document.addEventListener('click', e => {
  const l = e.target.closest('[data-link]');
  if (l) { e.preventDefault(); const c = S.data.cards.find(x => x.url === l.dataset.link); if (c) logEvent('open', c); openLink(l.dataset.link); return; }
  const r = e.target.closest('.rb[data-r]');
  if (r) {
    const k = r.dataset.r, c = S.deck[S.pos];
    if (k === 'open') { if (c && c.id) { logEvent('open', c); openLink(c.url); } return; }
    if (k === 'like') { if (S.decisions[c.id] !== 'like') { const b = r.getBoundingClientRect(); r.classList.add('pop'); setTimeout(() => r.classList.remove('pop'), 400); } return decide('like', { toggle: true }); }
    if (k === 'save') return decide('save', { toggle: true });
    if (k === 'nope') return decide('nope', { advance: true });
  }
  const a = e.target.closest('[data-act]'); if (!a) return;
  if (a.dataset.act === 'start') go(1);
  if (a.dataset.act === 'restart') restart();
  if (a.dataset.act === 'export') exportFeedback();
});
$('#btnUndo').onclick = undo;
$('#favBtn').onclick = openSheet; $('#sheetMask').onclick = closeSheet;
function openSheet() {
  const ids = idsOf('save'), sh = $('#sheet');
  sh.innerHTML = `<div class="sheet-grip"></div><div class="sheet-h"><h3>稍后看</h3><span>${ids.length}</span></div>` + (ids.length
    ? `<ul class="e-list">${ids.map(id => { const c = byId(id); return `<li data-link="${esc(c.url)}">${c.image ? `<img src="${esc(c.image)}" alt="">` : `<span class="e-ph" style="--sc:${SECC[c.section]}">${pad2(cardIndex(c))}</span>`}<span class="e-t">${esc(c.title)}<em>${esc(c.handle)}${c.source_tag ? ' · ' + esc(c.source_tag) : ''}</em></span>${icon('arrowUpRight', '', 2)}</li>`; }).join('')}</ul>`
    : `<p class="e-empty">还没有稍后看的内容。点右侧书签即可加入。</p>`);
  sh.hidden = false; $('#sheetMask').hidden = false;
  requestAnimationFrame(() => { sh.classList.add('open'); $('#sheetMask').classList.add('open'); });
}
function closeSheet() { const sh = $('#sheet'); sh.classList.remove('open'); $('#sheetMask').classList.remove('open'); setTimeout(() => { sh.hidden = true; $('#sheetMask').hidden = true; }, 260); }
addEventListener('keydown', e => {
  const c = S.deck[S.pos], card = c && c.id;
  if (e.key === 'ArrowDown' || e.key === ' ' || e.key === 'j') { e.preventDefault(); go(1); }
  else if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); go(-1); }
  else if (e.key === 'ArrowRight') card ? flingSide('like') : go(1);
  else if (e.key === 'ArrowLeft') card ? flingSide('nope') : go(1);
  else if (e.key === 's') card && decide('save', { toggle: true });
  else if (e.key === 'l') card && decide('like', { toggle: true });
  else if (e.key === 'z' || e.key === 'Backspace') undo();
  else if (e.key === 'Enter' && card) { logEvent('open', c); openLink(c.url); }
  else if (e.key === 'Escape') closeSheet();
});
addEventListener('resize', () => render(false));
window.XFeedC = { go, decide, openSheet, flingSide };

X.loadData().then(({ restored }) => {
  $('#hdrDate').textContent = fmtDate(S.data.date);
  if (restored) toast(`已恢复到第 ${S.pos} 条`);
  render(false);
}).catch(e => { $('#feed').innerHTML = `<div style="padding:80px 24px;color:#fff">加载失败：${esc(e.message)}</div>`; });
})();

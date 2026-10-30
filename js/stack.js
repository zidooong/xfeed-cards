/* XFeed v2 — 卡片堆引擎（主题 A 编辑部 / B 暗色工具 / D hybrid）。拖拽物理、决策、撤销与 v1 一致。 */
(() => {
'use strict';
const { THEME, S, $, esc, clamp, icon, metricIcon, haptic, toast, openLink, logEvent, saveState, fmtDate, pad2, dObj, WEEK_EN,
  readingMinutes, byId, idsOf, sectionStats, cardIndex, sectionRange, bodyText, pastLinks, R, flush, inTg, showMainButton, hideMainButton,
  exportFeedback, restart, qs, likedUpsert, likedRemove, likedGrouped, likedCount, shareNative } = window.X;
const SECC = { ideas: '#B8A45A', tech: '#6A86C4', products: '#C07A52', business: '#4A9A78', signals: '#8E74B8' };
const SECC_DIM = { ideas: 'rgba(184,164,90,.22)', tech: 'rgba(106,134,196,.22)', products: 'rgba(192,122,82,.22)', business: 'rgba(74,154,120,.22)', signals: 'rgba(142,116,184,.22)' };
const SECC_DONE = { ideas: 'rgba(184,164,90,.55)', tech: 'rgba(106,134,196,.55)', products: 'rgba(192,122,82,.55)', business: 'rgba(74,154,120,.55)', signals: 'rgba(142,116,184,.55)' };

const ACT_ZH = { like: '感兴趣', nope: '不感兴趣', save: '稍后看' };
const N = () => S.data.cards.length;
const imgTag = c => c.image ? `<img src="${esc(c.image)}" alt="" draggable="false" decoding="async" onerror="this.closest('.card').classList.replace('has-img','no-img');this.parentNode.remove()">` : '';
const extrasHTML = (c, cls) => c.extra_links.length ? `<div class="${cls}">${c.extra_links.map(l => `<a href="${esc(l.url)}" data-link="${esc(l.url)}">${esc(l.text)}${icon('arrowUpRight')}</a>`).join('')}</div>` : '';

// =====================================================================
// 主题 A：编辑部 / 杂志
// =====================================================================
const A = {
  rot: 28, rotMax: 9,
  chrome: () => `
  <header class="mast">
    <div class="mast-l"><span class="wordmark">XFeed</span><span class="mast-date" id="hdrDate"></span></div>
    <button class="mast-fav" id="favBtn" aria-label="稍后看列表">稍后看<span class="num" id="favCount">0</span></button>
  </header>
  <div class="hair"><i id="progress"></i></div>
  <main class="stage" id="stage"><div class="stack" id="stack"></div><section class="endview" id="endView" hidden></section></main>
  <footer class="controls" id="controls">
    <button class="ctl ic-only" id="btnUndo" aria-label="撤销" title="撤销 (Z)">${icon('undo')}</button>
    <button class="ctl" id="btnNope" title="不感兴趣 (←)">${icon('arrowLeft', 'dir')}<span>不感兴趣</span></button>
    <button class="ctl" id="btnSave" title="稍后看 (↑)">${icon('arrowUp', 'dir')}<span>稍后看</span></button>
    <button class="ctl pri" id="btnLike" title="感兴趣 (→)"><span>感兴趣</span>${icon('arrowRight', 'dir')}</button>
    <button class="ctl ic-only" id="btnOpen" aria-label="原文" title="原文 (Enter)">${icon('arrowUpRight')}</button>
    <div class="ctl-hint">右滑感兴趣 · 左滑跳过 · 上滑稍后看 · 轻点读原文</div>
  </footer>`,
  hdrDate: d => fmtDate(d),
  cover() {
    const d = dObj(S.data.date), n = N();
    const rows = S.data.sections.filter(s => S.data.counts[s.key]).map(s => {
      const [a, b] = sectionRange(s.key);
      return `<li><span class="toc-no">${pad2(a)}${b > a ? '–' + pad2(b) : ''}</span><span class="toc-t">${s.name}</span><span class="toc-en">${esc(s.en.split(/[ &]/)[0])}</span><span class="toc-n">${S.data.counts[s.key]}</span></li>`;
    }).join('');
    const past = pastLinks().map(p => `<a href="${p.href}">${p.d.slice(5).replace('-', '.')}</a>`).join('');
    return `<div class="cv-top"><span class="kicker">Daily Brief</span><span class="kicker">${d.getFullYear()}</span></div>
      <div class="cv-date"><span class="cv-m">${d.getMonth() + 1}月</span><span class="cv-d">${d.getDate()}</span><span class="cv-w">星期${X.WEEK[d.getDay()]}</span></div>
      <h1 class="cv-h">今日 ${n} 条，<br>约 ${readingMinutes(S.data.cards)} 分钟读完。</h1>
      <ol class="toc">${rows}</ol>
      <div class="cv-go"><button class="cv-btn" data-act="start">开始阅读${icon('arrowRight')}</button>
        ${past ? `<div class="cv-past"><span>往期</span>${past}</div>` : ''}</div>`;
  },
  card(c) {
    const i = cardIndex(c);
    const metric = c.metric_raw ? `<span class="metric"><b>${esc(c.metric_raw.value)}</b> ${esc(c.metric_raw.label)}</span>` : '';
    return `<div class="pg-meta"><span class="no">${pad2(i)}</span><span class="sec">${esc(c.section_name)}</span><span class="sec-en">${esc(c.section_en)}</span></div>
      ${c.image ? `<figure class="plate">${imgTag(c)}</figure>` : ''}<div class="bigno" aria-hidden="true">${pad2(i)}</div>
      <div class="pg-text">
        <h2 class="hl">${esc(c.title)}</h2>
        ${bodyText(c) ? `<p class="dek">${esc(bodyText(c))}</p>` : ''}
        ${extrasHTML(c, 'extras')}
      </div>
      <div class="pg-foot"><div class="src"><span class="host">${esc(c.handle)}</span>${c.source_tag ? `<span class="via">${esc(c.source_tag)}</span>` : ''}</div>${metric}</div>
      <div class="folio"><span>轻点阅读原文</span><span class="num">${pad2(i)} / ${pad2(N())}</span></div>
      <div class="fb"><span class="fb-l like">感兴趣${icon('arrowRight')}</span><span class="fb-l nope">${icon('arrowLeft')}不感兴趣</span><span class="fb-l save">${icon('arrowUp')}稍后看</span></div>`;
  },
  end(st) {
    const list = (ids, empty) => ids.length ? `<ol class="idx">${ids.map(id => { const c = byId(id); return `<li data-link="${esc(c.url)}"><span class="idx-no">${pad2(cardIndex(c))}</span><span class="idx-t">${esc(c.title)}<em>${esc(c.handle)}${c.source_tag ? ' · ' + esc(c.source_tag) : ''}</em></span>${icon('arrowUpRight')}</li>`; }).join('')}</ol>` : `<p class="idx-empty">${empty}</p>`;
    const secs = sectionStats().map(s => `<li><span class="sb-t">${s.name}</span><span class="sb-bar"><i style="width:${s.n / s.total * 100}%"></i></span><span class="sb-n">${s.n}/${s.total}</span></li>`).join('');
    return `<div class="end-k">读毕 · ${fmtDate(S.data.date)}</div>
      <h2 class="end-h">今天的 ${N()} 条看完了。</h2>
      <div class="end-stats"><div><b>${st.likes.length}</b><span>感兴趣</span></div><div><b>${st.saves.length}</b><span>稍后看</span></div><div><b>${st.nopes.length}</b><span>不感兴趣</span></div></div>
      <h4>各板块兴趣</h4><ol class="sbars">${secs}</ol>
      <h4>稍后看 <span class="num">${st.saves.length}</span></h4>${list(st.saves, '没有稍后看的内容。上滑卡片即可加入。')}
      <h4>感兴趣 <span class="num">${st.likes.length}</span></h4>${list(st.likes, '—')}
      <div class="end-btns"><button data-act="restart">${icon('rotate')}再看一遍</button><button class="pri" data-act="export">${inTg ? icon('send') + '提交反馈' : icon('copy') + '复制反馈 JSON'}</button></div>
      <div class="sync" id="syncLine">反馈已存本地 · ${esc(R.syncState)}</div>`;
  },
  sheet: ids => `<div class="sheet-grip"></div><div class="sheet-h"><h3>稍后看</h3><span class="num">${ids.length}</span></div>` + (ids.length
    ? `<ol class="idx">${ids.map(id => { const c = byId(id); return `<li data-link="${esc(c.url)}"><span class="idx-no">${pad2(cardIndex(c))}</span><span class="idx-t">${esc(c.title)}<em>${esc(c.handle)}${c.source_tag ? ' · ' + esc(c.source_tag) : ''}</em></span>${icon('arrowUpRight')}</li>`; }).join('')}</ol>`
    : `<p class="idx-empty">还没有稍后看的内容。上滑卡片即可加入。</p>`),
  progress() { const el = $('#progress'); el.style.transform = `scaleX(${clamp((S.pos - 1) / N())})`; },
};

// =====================================================================
// 主题 B：暗色 / Linear·Raycast
// =====================================================================
const B = {
  rot: 40, rotMax: 6,
  chrome: () => `
  <header class="bar">
    <div class="crumbs"><span class="logo" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></span><span class="crumb-a">XFeed</span><span class="slash">/</span><span class="crumb-b mono" id="hdrDate"></span></div>
    <div class="bar-r"><span class="counter mono" id="counter"></span><button class="pill" id="favBtn" aria-label="稍后看列表">${icon('bookmark')}<span class="mono" id="favCount">0</span></button></div>
  </header>
  <div class="ticks" id="progress"></div>
  <main class="stage" id="stage"><div class="stack" id="stack"></div><section class="endview" id="endView" hidden></section></main>
  <footer class="dock" id="controls">
    <button class="key" id="btnUndo" aria-label="撤销" title="撤销 (Z)">${icon('undo')}</button>
    <div class="seg">
      <button id="btnNope" title="不感兴趣 (←)">${icon('x')}<span>不感兴趣</span></button>
      <button id="btnSave" title="稍后看 (↑)">${icon('bookmark')}<span>稍后看</span></button>
      <button id="btnLike" class="pri" title="感兴趣 (→)">${icon('check', '', 2.2)}<span>感兴趣</span></button>
    </div>
    <button class="key" id="btnOpen" aria-label="原文" title="原文 (Enter)">${icon('arrowUpRight')}</button>
  </footer>`,
  hdrDate: d => d,
  cover() {
    const d = dObj(S.data.date), n = N(), max = Math.max(...Object.values(S.data.counts));
    const rows = S.data.sections.filter(s => S.data.counts[s.key]).map(s => {
      const [a, b] = sectionRange(s.key);
      return `<div class="row"><span class="r-no mono">${pad2(a)}${b > a ? '–' + pad2(b) : ''}</span><span class="r-t">${s.name}<em>${esc(s.en.split(/[ &]/)[0])}</em></span><span class="r-bar"><i style="width:${S.data.counts[s.key] / max * 100}%"></i></span><span class="r-n mono">${S.data.counts[s.key]}</span></div>`;
    }).join('');
    const past = pastLinks().map(p => `<a class="mono" href="${p.href}">${p.d.slice(5)}</a>`).join('');
    return `<div class="cv-k"><span class="badge mono">DAILY BRIEF</span><span class="mono dim">${S.data.date} · ${WEEK_EN[d.getDay()]}</span></div>
      <h1 class="cv-h">今日简报</h1>
      <div class="cv-stats"><div><b class="mono">${n}</b><span>条目</span></div><div><b class="mono">~${readingMinutes(S.data.cards)}</b><span>分钟</span></div><div><b class="mono">${Object.values(S.data.counts).filter(Boolean).length}</b><span>板块</span></div></div>
      <div class="rows">${rows}</div>
      <div class="cv-go"><button class="cv-btn" data-act="start"><span>开始</span>${icon('arrowRight')}</button>
        <div class="cv-hint mono">→ 感兴趣 &nbsp; ← 跳过 &nbsp; ↑ 稍后看 &nbsp; TAP 原文</div>
        ${past ? `<div class="cv-past"><span>往期</span>${past}</div>` : ''}</div>`;
  },
  card(c) {
    const i = cardIndex(c);
    const rows = [
      ['来源', `<span class="trunc">${esc(c.handle)}</span>`],
      c.source_tag ? ['渠道', esc(c.source_tag)] : null,
      c.metric_raw ? ['热度', `<span class="mono">${icon(metricIcon(c))}${esc(c.metric_raw.value)}</span><span class="dim">${esc(c.metric_raw.label)}</span>`] : null,
      c.extra_links.length ? ['链接', c.extra_links.map(l => `<a href="${esc(l.url)}" data-link="${esc(l.url)}">${esc(l.text)}${icon('arrowUpRight')}</a>`).join(' ')] : null,
    ].filter(Boolean);
    return `<div class="cd-head"><span class="cd-sec mono">${esc(c.section_en.toUpperCase())}</span><span class="cd-zh">${esc(c.section_name)}</span><span class="cd-no mono">${pad2(i)}<span class="dim">/${pad2(N())}</span></span></div>
      ${c.image ? `<figure class="shot">${imgTag(c)}</figure>` : ''}
      <div class="cd-main"><h2 class="cd-title">${esc(c.title)}</h2>${bodyText(c) ? `<p class="cd-body">${esc(bodyText(c))}</p>` : ''}</div>
      <div class="next"><div class="next-h mono">UP NEXT</div><div class="next-l">${S.data.cards.slice(i, i + 10).map(n => `<div class="next-r"><span class="mono dim">${pad2(cardIndex(n))}</span><span class="next-t">${esc(n.title)}</span><span class="next-s">${esc(n.section_name)}</span></div>`).join('') || '<div class="next-r"><span class="next-t dim">这是最后一条</span></div>'}</div></div>
      <dl class="props">${rows.map(r => `<div><dt>${r[0]}</dt><dd>${r[1]}</dd></div>`).join('')}</dl>
      <div class="cd-foot"><span class="mono dim">id ${esc(c.id.slice(0, 7))}</span><span class="cd-open">打开原文${icon('arrowUpRight')}</span></div>
      <div class="glow"></div>
      <div class="fb"><span class="fb-l like">${icon('check', '', 2.2)}感兴趣</span><span class="fb-l nope">${icon('x', '', 2.2)}不感兴趣</span><span class="fb-l save">${icon('bookmark', '', 2.2)}稍后看</span></div>`;
  },
  end(st) {
    const list = (ids, empty) => ids.length ? `<div class="lst">${ids.map(id => { const c = byId(id); return `<div class="li" data-link="${esc(c.url)}"><span class="li-no mono">${pad2(cardIndex(c))}</span><span class="li-t">${esc(c.title)}<em>${esc(c.handle)}${c.source_tag ? ' · ' + esc(c.source_tag) : ''}</em></span>${icon('arrowUpRight')}</div>`; }).join('')}</div>` : `<p class="empty">${empty}</p>`;
    const secs = sectionStats().map(s => `<div class="row"><span class="r-t">${s.name}</span><span class="r-bar"><i style="width:${s.n / s.total * 100}%"></i></span><span class="r-n mono">${s.n}<span class="dim">/${s.total}</span></span></div>`).join('');
    return `<div class="cv-k"><span class="badge mono ok">${icon('check', '', 2.4)}DONE</span><span class="mono dim">${S.data.date}</span></div>
      <h2 class="end-h">全部 ${N()} 条已处理</h2>
      <div class="cv-stats"><div><b class="mono acc">${st.likes.length}</b><span>感兴趣</span></div><div><b class="mono">${st.saves.length}</b><span>稍后看</span></div><div><b class="mono dim">${st.nopes.length}</b><span>不感兴趣</span></div></div>
      <h4>板块兴趣度</h4><div class="rows">${secs}</div>
      <h4>稍后看 <span class="mono dim">${st.saves.length}</span></h4>${list(st.saves, '暂无。上滑卡片即可加入。')}
      <h4>感兴趣 <span class="mono dim">${st.likes.length}</span></h4>${list(st.likes, '—')}
      <div class="end-btns"><button data-act="restart">${icon('rotate')}重来</button><button class="pri" data-act="export">${inTg ? icon('send') + '提交反馈' : icon('copy') + '复制反馈 JSON'}</button></div>
      <div class="sync mono" id="syncLine">local · ${esc(R.syncState)}</div>`;
  },
  sheet: ids => `<div class="sheet-grip"></div><div class="sheet-h"><h3>稍后看</h3><span class="mono dim">${ids.length}</span></div>` + (ids.length
    ? `<div class="lst">${ids.map(id => { const c = byId(id); return `<div class="li" data-link="${esc(c.url)}"><span class="li-no mono">${pad2(cardIndex(c))}</span><span class="li-t">${esc(c.title)}<em>${esc(c.handle)}${c.source_tag ? ' · ' + esc(c.source_tag) : ''}</em></span>${icon('arrowUpRight')}</div>`; }).join('')}</div>`
    : `<p class="empty">暂无。上滑卡片即可加入。</p>`),
  progress() {
    const el = $('#progress');
    if (el.children.length !== N()) {
      el.innerHTML = S.data.cards.map(c => {
        const sec = c.section || '';
        return `<i data-sec="${esc(sec)}" style="--tick:${SECC_DIM[sec] || 'var(--line2)'};--tick-done:${SECC_DONE[sec] || 'var(--text2)'};--tick-cur:${SECC[sec] || 'var(--accent)'}"></i>`;
      }).join('');
    }
    [...el.children].forEach((t, i) => {
      const c = S.data.cards[i];
      t.className = i + 1 < S.pos ? 'done' + (S.decisions[c.id] === 'nope' ? ' nope' : '') : i + 1 === S.pos ? 'cur' : '';
    });
    const ctr = $('#counter');
    if (ctr) ctr.textContent = S.pos === 0 ? `00/${pad2(N())}` : `${pad2(Math.min(S.pos, N()))}/${pad2(N())}`;
  },
};


// =====================================================================
// 主题 D / hybrid：B 暗色工具风 + A 单卡杂志层级（无 UP NEXT）
// Jaden 2026-10-29：底部只留撤销；无「稍后看」；感兴趣 = 收藏；去 ID / 打开原文行
// =====================================================================
const isXPost = c => {
  const u = c.url || '';
  return /(?:^|\.)(?:x|twitter)\.com\//i.test(u) || String(c.source_tag || '').toUpperCase() === 'X';
};
// 轻量本地推文预览（不调 API）：用现有 handle / 正文 / 指标拼一块推特风卡片
const xEmbedHTML = c => {
  const handle = (c.handle || '').replace(/^@/, '');
  // title_derived 时 detail 常是残片；X 帖优先完整 summary，再 title
  const text = String(c.summary || c.title || bodyText(c) || '').trim();
  const metric = c.metric_raw ? `<span class="xe-m">${icon(metricIcon(c))}<b>${esc(c.metric_raw.value)}</b>${esc(c.metric_raw.label)}</span>` : '';
  const kind = c.media_kind || '';
  const badge = kind === 'video' ? '<span class="xe-badge" aria-hidden="true">▶</span>' : '';
  const media = c.image ? `<figure class="xe-media${kind === 'video' ? ' is-video' : ''}">${imgTag(c)}${badge}</figure>` : '<figure class="xe-media xe-media-pending" hidden></figure>';
  return `<div class="x-embed" aria-label="X 帖子预览" data-xurl="${esc(c.url || '')}">
    <div class="xe-top"><span class="xe-bird" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.851L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/></svg></span>
      <div class="xe-who"><b>${esc(handle || c.label || 'post')}</b><span class="mono">@${esc(handle || 'x')}</span></div></div>
    <p class="xe-text">${esc(text)}</p>
    ${media}
    <div class="xe-foot"><span class="mono dim">x.com</span>${metric}</div>
  </div>`;
};

// Jaden6：X 帖缺图时用 fxtwitter 补封面（离线包已 bake；在线兜底）
const fxCache = new Map();
async function enrichXMedia(card, el) {
  if (!card || card.image || !isXPost(card)) return;
  const u = card.url || '';
  const m = u.match(/(?:x|twitter)\.com\/([^/]+)\/status\/(\d+)/i);
  if (!m) return;
  const key = m[2];
  let info = fxCache.get(key);
  if (!info) {
    try {
      const r = await fetch(`https://api.fxtwitter.com/${m[1]}/status/${m[2]}`, { cache: 'force-cache' });
      if (!r.ok) return;
      const j = await r.json();
      const media = (j.tweet && j.tweet.media) || {};
      let img = null, kind = 'photo';
      const vids = media.videos || [];
      if (vids[0] && vids[0].thumbnail_url) { img = vids[0].thumbnail_url; kind = 'video'; }
      else {
        const all = media.all || media.photos || [];
        for (const a of all) {
          if (a.type === 'video' && a.thumbnail_url) { img = a.thumbnail_url; kind = 'video'; break; }
          if ((a.type === 'photo' || !a.type) && a.url) { img = a.url; kind = 'photo'; break; }
        }
      }
      if (!img) return;
      info = { img, kind };
      fxCache.set(key, info);
    } catch (e) { return; }
  }
  card.image = info.img;
  card.media_kind = info.kind;
  if (!el) return;
  el.classList.remove('no-img'); el.classList.add('has-img');
  const fig = el.querySelector('.xe-media');
  if (fig) {
    fig.hidden = false;
    fig.classList.toggle('is-video', info.kind === 'video');
    fig.innerHTML = `<img src="${esc(info.img)}" alt="" draggable="false" decoding="async">${info.kind === 'video' ? '<span class="xe-badge" aria-hidden="true">▶</span>' : ''}`;
  }
}

const D = {
  rot: 36, rotMax: 10,
  hdrDate: B.hdrDate,
  progress: B.progress,
  chrome: () => `
  <header class="bar">
    <div class="crumbs"><span class="crumb-b mono" id="hdrDate"></span></div>
    <div class="bar-r"><span class="counter mono" id="counter"></span><button class="pill" id="favBtn" aria-label="感兴趣列表">${icon('heart')}<span class="mono" id="favCount">0</span></button></div>
  </header>
  <div class="ticks" id="progress"></div>
  <main class="stage" id="stage"><div class="stack" id="stack"></div><section class="endview" id="endView" hidden></section></main>
  <footer class="dock dock-undo" id="controls">
    <button class="key undo-only" id="btnUndo" aria-label="撤销" title="撤销 (Z)">${icon('undo')}<span>撤销</span></button>
  </footer>`,
  cover() {
    const d = dObj(S.data.date), n = N(), max = Math.max(...Object.values(S.data.counts));
    const rows = S.data.sections.filter(s => S.data.counts[s.key]).map(s => {
      const [a, b] = sectionRange(s.key);
      return `<div class="row"><span class="r-no mono">${pad2(a)}${b > a ? '–' + pad2(b) : ''}</span><span class="r-t">${s.name}<em>${esc(s.en.split(/[ &]/)[0])}</em></span><span class="r-bar"><i style="width:${S.data.counts[s.key] / max * 100}%"></i></span><span class="r-n mono">${S.data.counts[s.key]}</span></div>`;
    }).join('');
    const past = pastLinks().map(p => `<a class="mono" href="${p.href}">${p.d.slice(5)}</a>`).join('');
    return `<div class="cv-k"><span class="badge mono">DAILY BRIEF</span><span class="mono dim">${S.data.date} · ${WEEK_EN[d.getDay()]}</span></div>
      <h1 class="cv-h">今日简报</h1>
      <div class="cv-stats"><div><b class="mono">${n}</b><span>条目</span></div><div><b class="mono">~${readingMinutes(S.data.cards)}</b><span>分钟</span></div><div><b class="mono">${Object.values(S.data.counts).filter(Boolean).length}</b><span>板块</span></div></div>
      <div class="rows">${rows}</div>
      <div class="cv-go"><button class="cv-btn" data-act="start"><span>开始</span>${icon('arrowRight')}</button>
        <div class="cv-hint mono">→ 感兴趣 &nbsp; ← 不感兴趣 &nbsp; TAP 原文 &nbsp; Z 撤销</div>
        ${past ? `<div class="cv-past"><span>往期</span>${past}</div>` : ''}</div>`;
  },
  card(c) {
    const i = cardIndex(c);
    const x = isXPost(c);
    // X 帖：本地推文风预览；其它：有图才放图，无图不占位
    // Jaden8：文字在上、图在下（普通卡 + X embed 内部已是文上图下）
    const media = x ? xEmbedHTML(c) : (c.image ? `<figure class="shot">${imgTag(c)}</figure>` : '');
    const main = x ? '' : `<div class="cd-main"><h2 class="cd-title">${esc(c.title)}</h2>${bodyText(c) ? `<p class="cd-body">${esc(bodyText(c))}</p>` : ''}</div>`;
    const emo = c.emoji || (S.data.sections.find(sec => sec.key === c.section) || {}).emoji || '';
    const srcBits = [c.handle, c.source_tag].filter(Boolean).map(esc).join(' · ');
    return `<div class="cd-head"><span class="cd-emoji" aria-hidden="true">${esc(emo)}</span><span class="cd-sec mono">${esc(c.section_en.toUpperCase())}</span><span class="cd-zh">${esc(c.section_name)}</span><span class="cd-no mono">${pad2(i)}/${pad2(N())}</span></div>
      ${main}${media}
      <div class="cd-bot">
        <div class="cd-footline">
          <span class="cd-src">${srcBits}</span>
          <button type="button" class="cd-agent" data-act="share-agent" data-url="${esc(c.url || '')}" data-title="${esc(c.title || '')}" aria-label="发给 agent">发给 agent</button>
        </div>
      </div>
      <div class="glow"></div>
      <div class="fb"><span class="fb-l like">${icon('check', '', 2.2)}感兴趣</span><span class="fb-l nope">${icon('x', '', 2.2)}不感兴趣</span></div>`;
  },
  end(st) {
    const list = (ids, empty) => ids.length ? `<div class="lst">${ids.map(id => { const c = byId(id); return `<div class="li" data-link="${esc(c.url)}"><span class="li-no mono">${pad2(cardIndex(c))}</span><span class="li-t">${esc(c.title)}<em>${esc(c.handle)}${c.source_tag ? ' · ' + esc(c.source_tag) : ''}</em></span>${icon('arrowUpRight')}</div>`; }).join('')}</div>` : `<p class="empty">${empty}</p>`;
    const secs = sectionStats().map(s => `<div class="row"><span class="r-t">${s.name}</span><span class="r-bar"><i style="width:${s.n / s.total * 100}%"></i></span><span class="r-n mono">${s.n}<span class="dim">/${s.total}</span></span></div>`).join('');
    // 感兴趣 = 收藏；不再单独列「稍后看」
    return `<div class="cv-k"><span class="badge mono ok">${icon('check', '', 2.4)}DONE</span><span class="mono dim">${S.data.date}</span></div>
      <h2 class="end-h">全部 ${N()} 条已处理</h2>
      <div class="cv-stats"><div><b class="mono acc">${st.likes.length}</b><span>感兴趣</span></div><div><b class="mono dim">${st.nopes.length}</b><span>不感兴趣</span></div><div><b class="mono">${N() - st.likes.length - st.nopes.length}</b><span>其它</span></div></div>
      <h4>板块兴趣度</h4><div class="rows">${secs}</div>
      <h4>感兴趣 <span class="mono dim">${st.likes.length}</span></h4>${list(st.likes, '还没有感兴趣的内容。右滑卡片即可加入。')}
      <div class="end-btns"><button class="pri" data-act="restart">${icon('rotate')}再看一遍</button></div>
      <div class="sync mono" id="syncLine"></div>`;
  },
  sheet() {
    const groups = likedGrouped();
    const total = groups.reduce((n, [, arr]) => n + arr.length, 0);
    const head = `<div class="sheet-grip"></div><div class="sheet-h"><h3>感兴趣</h3><span class="mono dim">${total}</span></div>`;
    if (!total) return head + `<p class="empty">还没有感兴趣的内容。右滑卡片即可加入。</p>`;
    const body = groups.map(([date, items]) => {
      const label = date && date !== '未知' ? date : '未标注日期';
      const rows = items.map(c => {
        const meta = [c.handle, c.source_tag].filter(Boolean).join(' · ');
        return `<div class="li li-liked" data-link="${esc(c.url)}">
          <span class="li-emo" aria-hidden="true">${esc(c.emoji || '·')}</span>
          <span class="li-t">${esc(c.title)}<em>${esc(meta)}</em></span>
          <button type="button" class="li-share" data-act="share-row" data-url="${esc(c.url)}" data-title="${esc(c.title)}" aria-label="分享"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m8 7 4-4 4 4"/><path d="M4 15v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg></button>
        </div>`;
      }).join('');
      return `<div class="sheet-sec"><div class="sheet-date mono">${esc(label)} · ${items.length}</div><div class="lst">${rows}</div></div>`;
    }).join('');
    return head + body;
  },
};

const T = THEME === 'd' ? D : THEME === 'b' ? B : A;
$('#app').innerHTML = T.chrome();
document.body.insertAdjacentHTML('beforeend', `<div class="sheet-mask" id="sheetMask" hidden></div><aside class="sheet" id="sheet" hidden></aside><div class="toast" id="toast"></div>`);

// =====================================================================
// 卡片堆（通用）
// =====================================================================
const els = new Map();
function elFor(k) {
  if (els.has(k)) return els.get(k);
  const item = S.deck[k], el = document.createElement('div');
  if (item.type === 'cover') { el.className = 'card cover'; el.innerHTML = T.cover(); }
  else {
    const x = (THEME === 'd') && isXPost(item);
    el.className = 'card ' + (x ? 'has-x ' : '') + (item.image ? 'has-img' : 'no-img');
    el.innerHTML = T.card(item); el.dataset.section = item.section;
    if (x && !item.image) enrichXMedia(item, el);
  }
  el.dataset.k = k;
  els.set(k, el); return el;
}
// 背后只放一张、与顶卡同位置略缩小：不露出层叠边框
function depthTransform(d) { return d <= 0 ? 'translate3d(0,0,0) scale(1)' : `translate3d(0,0,0) scale(${1 - Math.min(d, 1) * 0.04})`; }
function renderStack() {
  const stack = $('#stack');
  for (const [k, el] of els) if ((k < S.pos || k > S.pos + 1) && !el.classList.contains('leaving')) { el.remove(); els.delete(k); }
  for (let d = 1; d >= 0; d--) {
    const k = S.pos + d; if (k >= S.deck.length) continue;
    const el = elFor(k);
    el.classList.toggle('behind', d > 0);
    el.style.zIndex = 10 - d;
    el.style.transition = 'transform .42s cubic-bezier(.16,.9,.28,1), opacity .42s';
    el.style.transform = depthTransform(d);
    el.style.setProperty('--reveal', d > 0 ? 0 : 1);
    if (!el.parentNode) stack.prepend(el);
  }
  const top = els.get(S.pos);
  if (top) { stack.appendChild(top); bindDrag(top); precacheDissolve(top); }
  [...els.values()].filter(e => e.classList.contains('leaving')).forEach(e => stack.appendChild(e));
  updateChrome();
}
function updateChrome() {
  const cur = S.deck[S.pos];
  T.progress();
  // D：右上角 = 永久感兴趣库总数；A/B 仍统计稍后看
  const fc = $('#favCount');
  if (fc) fc.textContent = THEME === 'd' ? likedCount() : Object.values(S.decisions).filter(a => a === 'save').length;
  const bu = $('#btnUndo'); if (bu) bu.disabled = !S.history.length;
  const isCover = cur && cur.type === 'cover';
  const bo = $('#btnOpen'); if (bo) bo.disabled = !cur || isCover;
  document.documentElement.classList.toggle('on-cover', !!isCover);
}

// ---------- 拖拽物理 ----------
const W = () => $('#stage').clientWidth, H = () => $('#stage').clientHeight;
function zoneOf(dx, dy) {
  // D：无「稍后看」——上滑也记为感兴趣；A/B 仍为 save
  if (-dy > 90 && -dy > Math.abs(dx) * 1.1) return THEME === 'd' ? 'like' : 'save';
  if (dx > 90) return 'like';
  if (dx < -90) return 'nope';
  return null;
}
function paint(el, dx, dy, rotSign = 1) {
  const rot = clamp(dx / T.rot, -T.rotMax, T.rotMax) * rotSign;
  el.style.transform = `translate3d(${dx}px,${dy}px,0) rotate(${rot}deg)`;
  const upDom = -dy > Math.abs(dx) * 1.1;
  let like, nope, save;
  if (THEME === 'd') {
    // D：上滑也亮「感兴趣」；不再用 save 标签
    like = upDom ? clamp((-dy - 15) / 75) : clamp((dx - 15) / 75);
    nope = upDom ? 0 : clamp((-dx - 15) / 75);
    save = 0;
  } else {
    like = upDom ? 0 : clamp((dx - 15) / 75); nope = upDom ? 0 : clamp((-dx - 15) / 75); save = upDom ? clamp((-dy - 15) / 75) : 0;
  }
  el.style.setProperty('--pl', like.toFixed(3)); el.style.setProperty('--pn', nope.toFixed(3)); el.style.setProperty('--ps', save.toFixed(3));
  const p = clamp(Math.hypot(dx, dy) / 160);
  const b = els.get(S.pos + 1);
  if (b) { b.style.transition = 'none'; b.style.transform = depthTransform(1 - p); b.style.setProperty('--reveal', p.toFixed(3)); }
}
let drag = null;
function bindDrag(el) {
  if (el._bound) return; el._bound = true;
  el.addEventListener('pointerdown', e => {
    if (el.classList.contains('leaving') || +el.dataset.k !== S.pos) return;
    if (e.target.closest('[data-link],[data-act]')) return;
    if (e.button !== undefined && e.button > 0) return;
    el.setPointerCapture(e.pointerId);
    const r = el.getBoundingClientRect();
    drag = { el, id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: performance.now(), dx: 0, dy: 0, zone: null, moved: false,
      rotSign: e.clientY - r.top < r.height * 0.6 ? 1 : -1, samples: [[performance.now(), e.clientX, e.clientY]],
      // 静止布局中心/尺寸：粒子本地坐标原点（transform 前），避免 AABB 回正
      ox: r.left + r.width * 0.5, oy: r.top + r.height * 0.5, cw: r.width, ch: r.height };
    el.style.transition = 'none'; el.classList.add('dragging');
    cancelSpring(el);
    cancelDust(true); // 新拖清掉上一张残留尘埃
    if (dissolveMetal()) {
      // 按下即 arm：WK takeSnapshot（transform≈0），避免拖动中途才拍
      nativeArm(el, { ox: drag.ox, oy: drag.oy, cw: drag.cw, ch: drag.ch });
    } else {
      precacheDissolve(el); // legacy：html2canvas 预热
    }
  });
  el.addEventListener('pointermove', e => {
    if (!drag || drag.el !== el || e.pointerId !== drag.id) return;
    drag.dx = e.clientX - drag.x0; drag.dy = e.clientY - drag.y0;
    if (Math.hypot(drag.dx, drag.dy) > 8) drag.moved = true;
    const now = performance.now(); drag.samples.push([now, e.clientX, e.clientY]);
    while (drag.samples.length > 2 && now - drag.samples[0][0] > 90) drag.samples.shift();
    paint(el, drag.dx, drag.dy, drag.rotSign);
    const z = zoneOf(drag.dx, drag.dy);
    if (z !== drag.zone) { if (z) haptic.impact('light'); drag.zone = z; el.dataset.zone = z || ''; }
    // 过阈值即跟手渐散（粒子层跟位置+旋转，不回正）
    tickDragDust(el, drag);
  });
  const end = e => {
    if (!drag || drag.el !== el || e.pointerId !== drag.id) return;
    const d = drag; drag = null; el.classList.remove('dragging'); el.dataset.zone = '';
    // 外链 / 进后台前必须放掉 capture，否则回前台 WK 触控会假死
    try { if (d.id != null) el.releasePointerCapture(d.id); } catch (err) {}
    const s0 = d.samples[0], s1 = d.samples[d.samples.length - 1], dt = Math.max(16, s1[0] - s0[0]);
    const vx = (s1[1] - s0[1]) / dt, vy = (s1[2] - s0[2]) / dt;
    if (!d.moved && performance.now() - d.t0 < 400 && e.type === 'pointerup') {
      cancelDust(true); paint(el, 0, 0); el.style.opacity = ''; return tap(el, e);
    }
    let a = null;
    // RTC swipeThreshold≈0.5（velocity）+ position fallback；Hammer velocity 0.3
    const upSave = d.zone === 'save' || (vy < -0.5 && -vy > Math.abs(vx) * 0.85 && d.dy < -24);
    if (upSave) a = THEME === 'd' ? 'like' : 'save';
    else if (d.zone === 'like' || (vx > 0.5 && d.dx > 20) || (d.dx > W() * 0.28)) a = 'like';
    else if (d.zone === 'nope' || (vx < -0.5 && d.dx < -20) || (d.dx < -W() * 0.28)) a = 'nope';
    if (a) fling(el, a, d.dx, d.dy, vx, vy, d.rotSign, d);
    else {
      cancelDust(true); // 回弹：回收粒子，卡恢复完整
      el.style.opacity = '';
      spring(el, d.dx, d.dy, vx * 1000, vy * 1000, d.rotSign);
    }
  };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
}
function spring(el, x, y, vx, vy, rotSign) {
  // react-tinder-card animateBack ≈ tension 200 / friction 10 → 更软回弹，带一点 overshoot
  const k = 220, c = 16; let last = performance.now();
  el.style.willChange = 'transform';
  const step = now => {
    const dt = Math.min(0.024, (now - last) / 1000); last = now;
    vx += (-k * x - c * vx) * dt; vy += (-k * y - c * vy) * dt; x += vx * dt; y += vy * dt;
    paint(el, x, y, rotSign);
    if (Math.abs(x) + Math.abs(y) < 0.4 && Math.abs(vx) + Math.abs(vy) < 8) {
      paint(el, 0, 0); el.style.willChange = ''; el.style.opacity = ''; el._raf = 0; renderStack(); return;
    }
    el._raf = requestAnimationFrame(step);
  };
  el._raf = requestAnimationFrame(step);
}
function cancelSpring(el) { if (el._raf) cancelAnimationFrame(el._raf); el._raf = 0; }

// ---------- 划走粒子消散（跟手渐散 · 细密物理尘 · 姿态跟随） ----------
// 默认关：普通位移/旋转/淡出。?dissolve=metal 或 pref=1 才开原生；?dissolve=legacy 才走 html2canvas
// 禁止：松手先 snap 回中心/0° 再消散；禁止每帧 html2canvas
const PREF_DISSOLVE = 'xfeed:pref:dissolve';
/** 原生 Metal 桥是否可用（iOS App 注入 XFEED_NATIVE_DISSOLVE） */
function nativeDissolveReady() {
  try {
    if (window.XFEED_NATIVE_DISSOLVE === true) return true;
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.dissolve) return true;
  } catch (e) {}
  return false;
}
/** legacy = html2canvas CPU 尘；metal = 原生；off = 关（默认） */
function dissolveMode() {
  const q = (qs.get('dissolve') || '').toLowerCase();
  if (q === '0' || q === 'off' || q === 'false' || q === 'no') return 'off';
  if (q === 'legacy' || q === 'h5' || q === 'canvas') return 'legacy';
  if (q === '1' || q === 'on' || q === 'true' || q === 'yes' || q === 'metal' || q === 'native') {
    return nativeDissolveReady() ? 'metal' : 'legacy';
  }
  try {
    const v = localStorage.getItem(PREF_DISSOLVE);
    if (v === '0' || v === 'false' || v === 'off') return 'off';
    if (v === 'legacy') return 'legacy';
    if (v === '1' || v === 'metal' || v === 'on') return nativeDissolveReady() ? 'metal' : 'legacy';
  } catch (e) {}
  // App 注入的默认模式（0.1.19+ 为 off → 普通划卡动画）
  try {
    const m = String(window.XFEED_DISSOLVE_MODE || '').toLowerCase();
    if (m === 'off' || m === '0' || m === 'false' || m === 'no') return 'off';
    if (m === 'legacy' || m === 'h5' || m === 'canvas') return 'legacy';
    if (m === 'metal' || m === 'native' || m === 'on' || m === '1') {
      return nativeDissolveReady() ? 'metal' : 'legacy';
    }
  } catch (e) {}
  // 默认：关粒子，走普通位移/旋转/淡出（代码保留，?dissolve=metal 可再开）
  return 'off';
}
function dissolveEnabled() { return dissolveMode() !== 'off'; }
function dissolveLegacy() { return dissolveMode() === 'legacy'; }
function dissolveMetal() { return dissolveMode() === 'metal'; }
function setDissolvePref(on) {
  try { localStorage.setItem(PREF_DISSOLVE, on ? '1' : '0'); } catch (e) {}
}

// ---------- 原生 Metal 消散桥 ----------
window.XFeedNative = window.XFeedNative || {};
const _nat = {
  armed: false,
  waitingArm: false,
  el: null,
  layout: null,
  lastProg: 0,
};
window.XFeedNative._onNative = function (msg) {
  if (!msg || !msg.event) return;
  if (msg.event === 'armed') {
    _nat.armed = true;
    _nat.waitingArm = false;
    // 快照已上屏：藏 DOM 顶卡，避免双影
    if (_nat.el) {
      _nat.el.style.opacity = '0';
      _nat.el.classList.add('native-dissolving');
    }
  } else if (msg.event === 'armFailed') {
    _nat.armed = false;
    _nat.waitingArm = false;
    if (_nat.el) {
      _nat.el.style.opacity = '';
      _nat.el.classList.remove('native-dissolving');
    }
  } else if (msg.event === 'cancelled' || msg.event === 'commitDone') {
    _nat.armed = false;
    _nat.waitingArm = false;
  }
};
function postDissolve(payload) {
  try {
    const h = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.dissolve;
    if (!h) return false;
    h.postMessage(payload);
    return true;
  } catch (e) { return false; }
}
function nativeArm(el, layout) {
  if (!dissolveMetal() || !el) return;
  _nat.el = el;
  _nat.layout = layout;
  _nat.waitingArm = true;
  _nat.armed = false;
  _nat.lastProg = 0;
  postDissolve({
    type: 'arm',
    ox: layout.ox, oy: layout.oy, cw: layout.cw, ch: layout.ch,
    x: layout.ox - layout.cw * 0.5, y: layout.oy - layout.ch * 0.5,
    w: layout.cw, h: layout.ch,
  });
}
function nativeProgress(el, d, prog) {
  if (!dissolveMetal()) return false;
  if (!_nat.armed && !_nat.waitingArm) {
    nativeArm(el, { ox: d.ox, oy: d.oy, cw: d.cw, ch: d.ch });
  }
  _nat.lastProg = prog;
  const len = Math.hypot(d.dx, d.dy) || 1;
  const nx = d.dx / len, ny = d.dy / len;
  postDissolve({
    type: 'progress',
    progress: prog,
    dx: d.dx, dy: d.dy,
    nx, ny,
    dirDeg: Math.atan2(ny, nx) * 180 / Math.PI,
    ox: d.ox, oy: d.oy, cw: d.cw, ch: d.ch,
    rot: clamp(d.dx / T.rot, -T.rotMax, T.rotMax) * d.rotSign,
  });
  // 未 armed 前略淡 DOM；armed 后已 opacity=0
  if (!_nat.armed) el.style.opacity = String(1 - prog * 0.35);
  return true;
}
function nativeCommit(el, nx, ny, speed, layout, dx, dy) {
  if (!dissolveMetal()) return false;
  const lay = layout || _nat.layout;
  if (!lay) return false;
  // 若还没 armed，尽力 arm 一次再 commit（原生会在未 active 时直接 commitDone）
  if (!_nat.armed && !_nat.waitingArm) nativeArm(el, lay);
  postDissolve({
    type: 'commit',
    progress: Math.max(_nat.lastProg, 0.35),
    dx, dy, nx, ny,
    speed,
    dirDeg: Math.atan2(ny, nx) * 180 / Math.PI,
    ox: lay.ox, oy: lay.oy, cw: lay.cw, ch: lay.ch,
  });
  el.style.opacity = '0';
  _nat.armed = false;
  _nat.waitingArm = false;
  return true;
}
function nativeCancel() {
  if (!dissolveMetal()) return;
  postDissolve({ type: 'cancel' });
  if (_nat.el) {
    _nat.el.style.opacity = '';
    _nat.el.classList.remove('native-dissolving');
  }
  _nat.armed = false;
  _nat.waitingArm = false;
  _nat.el = null;
}
function ensureDissolveCanvas() {
  let c = document.getElementById('dissolveLayer');
  if (c) return c;
  c = document.createElement('canvas');
  c.id = 'dissolveLayer';
  c.setAttribute('aria-hidden', 'true');
  Object.assign(c.style, {
    position: 'fixed', inset: '0', width: '100%', height: '100%',
    pointerEvents: 'none', zIndex: '9999',
  });
  document.body.appendChild(c);
  return c;
}

const _snapCache = new WeakMap(); // el → { canvas, t }
let _snapBusy = null;
function captureCardSnap(el) {
  if (!window.html2canvas || !el) return Promise.resolve(null);
  // 拖动预热用略降采样，避免松手卡顿
  const opts = {
    backgroundColor: null,
    scale: Math.min(0.95, (window.devicePixelRatio || 1) * 0.85),
    logging: false,
    useCORS: true,
    allowTaint: true,
    removeContainer: true,
    imageTimeout: 1200,
    foreignObjectRendering: false,
  };
  return window.html2canvas(el, opts).catch(() => null);
}
function precacheDissolve(el) {
  // 仅 legacy html2canvas 路径预热；Metal 用 WK takeSnapshot
  if (!dissolveLegacy() || !el || el.classList.contains('cover')) return;
  if (!window.html2canvas) return;
  const hit = _snapCache.get(el);
  if (hit && performance.now() - hit.t < 6000) return;
  if (_snapBusy === el) return;
  _snapBusy = el;
  requestAnimationFrame(() => {
    captureCardSnap(el).then(c => {
      if (_snapBusy === el) _snapBusy = null;
      if (c && c.width > 8 && c.height > 8) _snapCache.set(el, { canvas: c, t: performance.now() });
    });
  });
}

let _dust = null; // { el, particles, mode:'follow'|'free', ... }
let _dustRaf = 0;

function cancelDust(clearCanvas) {
  if (dissolveMetal()) nativeCancel();
  if (_dustRaf) { cancelAnimationFrame(_dustRaf); _dustRaf = 0; }
  const el = _dust && _dust.el;
  _dust = null;
  if (el && clearCanvas) el.style.opacity = '';
  if (clearCanvas) {
    const c = document.getElementById('dissolveLayer');
    if (c) {
      const ctx = c.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, c.width, c.height);
    }
  }
}

function _hash2(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
function _turb(x, y, t) {
  const a = _hash2(x * 0.018 + t * 0.0009, y * 0.018);
  const b = _hash2(x * 0.047 - t * 0.0011, y * 0.047 + 19.2);
  const c = _hash2(x * 0.11 + t * 0.002, y * 0.09 - 4.7);
  return { tx: (a - 0.5) * 1.4 + (c - 0.5) * 0.55, ty: (b - 0.5) * 1.4 + (c - 0.5) * 0.45 };
}

function buildDustParticles(src, cardW, cardH) {
  const sw = src.width | 0, sh = src.height | 0;
  if (sw < 4 || sh < 4) return null;
  let sctx;
  try { sctx = src.getContext('2d', { willReadFrequently: true }); }
  catch (e) { sctx = src.getContext('2d'); }
  if (!sctx) return null;
  let img;
  try { img = sctx.getImageData(0, 0, sw, sh); }
  catch (e) { return null; }
  const data = img.data;
  // 更细密：目标 ~2.4万；STEP 更小 + 抖动破网格
  const TARGET = 24000;
  const step = Math.max(1, Math.ceil(Math.sqrt((sw * sh) / TARGET)));
  const sx = cardW / sw, sy = cardH / sh;
  const hw = cardW * 0.5, hh = cardH * 0.5;
  const particles = [];
  for (let y = 0; y < sh; y += step) {
    for (let x = 0; x < sw; x += step) {
      // 抖动采样：打破齐整网格
      const jx = x + (Math.random() - 0.5) * step * 0.95;
      const jy = y + (Math.random() - 0.5) * step * 0.95;
      const ix = Math.max(0, Math.min(sw - 1, jx | 0));
      const iy = Math.max(0, Math.min(sh - 1, jy | 0));
      const idx = (iy * sw + ix) << 2;
      const a0 = data[idx + 3];
      if (a0 < 16) continue;
      // 非均匀抽稀：边缘多留、中心略稀 + 随机空洞
      const lx = (jx + 0.5) * sx - hw;
      const ly = (jy + 0.5) * sy - hh;
      const nx = Math.abs(lx) / (hw || 1), ny = Math.abs(ly) / (hh || 1);
      const edge = Math.min(1, Math.max(nx, ny) * 0.65 + Math.hypot(nx, ny) * 0.45);
      const keep = 0.55 + edge * 0.42; // 边缘更密
      if (Math.random() > keep) continue;
      if (Math.random() < 0.04) continue; // 随机空洞
      const mass = 0.45 + Math.random() * 1.15; // 随机质量
      const cell = Math.max(sx, sy) * step;
      particles.push({
        lx, ly,
        // follow 阶段相对漂移（已剥离的粒）
        dx: 0, dy: 0,
        // free 世界坐标（释放后填）
        wx: 0, wy: 0,
        vx: 0, vy: 0,
        r: data[idx], g: data[idx + 1], b: data[idx + 2], a: a0,
        mass,
        edge, // 0 中心 → 1 边缘：边缘先散
        size: Math.max(0.7, cell * (0.35 + Math.random() * 0.7)),
        peeled: false,
        life: 0,
        ttl: 0,
      });
    }
  }
  if (particles.length > 32000) {
    const keepR = 26000 / particles.length;
    for (let i = particles.length - 1; i >= 0; i--) {
      if (Math.random() > keepR) particles.splice(i, 1);
    }
  }
  return particles.length ? particles : null;
}

function ensureDustSession(el, layout) {
  if (!dissolveLegacy() || !el || el.classList.contains('cover')) return null;
  if (_dust && _dust.el === el && _dust.particles) return _dust;
  const hit = _snapCache.get(el);
  if (!hit || !hit.canvas) return null;
  const particles = buildDustParticles(hit.canvas, layout.cw, layout.ch);
  if (!particles) return null;
  _dust = {
    el,
    particles,
    mode: 'follow',
    ox: layout.ox, oy: layout.oy, cw: layout.cw, ch: layout.ch,
    dx: 0, dy: 0, rot: 0, rotSign: 1,
    progress: 0,
    windX: 0, windY: 0,
    t0: performance.now(),
  };
  return _dust;
}

function worldOf(p, dust) {
  const rad = dust.rot * Math.PI / 180;
  const c = Math.cos(rad), s = Math.sin(rad);
  const lx = p.lx + p.dx, ly = p.ly + p.dy;
  return {
    x: dust.ox + dust.dx + lx * c - ly * s,
    y: dust.oy + dust.dy + lx * s + ly * c,
  };
}

function ensureDustRaf() {
  if (_dustRaf) return;
  let last = performance.now();
  const tick = now => {
    if (!_dust) { _dustRaf = 0; return; }
    const dt = Math.min(34, now - last); last = now;
    const dust = _dust;
    const canvas = ensureDissolveCanvas();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const vw = window.innerWidth, vh = window.innerHeight;
    const cw = (vw * dpr) | 0, ch = (vh * dpr) | 0;
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    const ctx = canvas.getContext('2d', { alpha: true });
    const frame = ctx.createImageData(cw, ch);
    const out = frame.data;
    const t = now - dust.t0;
    const g = 0.00105; // 重力 px/ms²
    const air = 0.00155; // 空气阻力
    let alive = 0;

    if (dust.mode === 'follow') {
      const prog = dust.progress;
      for (let i = 0; i < dust.particles.length; i++) {
        const p = dust.particles[i];
        // 边缘先散：edge 高的 peel 阈值低
        const peelAt = (1 - p.edge) * 0.72 + 0.08; // 边缘 ~0.08，中心 ~0.8
        const local = Math.max(0, (prog - peelAt) / Math.max(0.12, 1 - peelAt));
        if (local > 0.02) {
          p.peeled = true;
          const tu = _turb(p.lx, p.ly, t);
          // 沿拖向轻推 + 湍流；质量越大越钝
          const push = (0.012 + local * 0.045) / p.mass;
          const dirX = dust.dx, dirY = dust.dy;
          const len = Math.hypot(dirX, dirY) || 1;
          p.vx += (dirX / len) * push * dt + tu.tx * 0.018 * dt / p.mass;
          p.vy += (dirY / len) * push * dt + tu.ty * 0.018 * dt / p.mass - 0.0015 * dt;
          p.vx *= (1 - air * dt * 0.35);
          p.vy *= (1 - air * dt * 0.35);
          p.dx += p.vx * dt;
          p.dy += p.vy * dt;
        } else {
          continue; // 未剥离：仍由卡面显示，避免双影
        }
        const w = worldOf(p, dust);
        let aa = (p.a * (1 - local * 0.28) * (1 - prog * 0.12)) | 0;
        if (aa < 4) continue;
        alive++;
        const ix = (w.x * dpr) | 0, iy = (w.y * dpr) | 0;
        const s = Math.max(1, (p.size * dpr * 0.88) | 0);
        for (let dy = 0; dy < s; dy++) {
          const yy = iy + dy; if (yy < 0 || yy >= ch) continue;
          const row = yy * cw;
          for (let dx = 0; dx < s; dx++) {
            const xx = ix + dx; if (xx < 0 || xx >= cw) continue;
            const o = (row + xx) << 2;
            if (aa >= out[o + 3]) {
              out[o] = p.r; out[o + 1] = p.g; out[o + 2] = p.b; out[o + 3] = aa;
            }
          }
        }
      }
      ctx.putImageData(frame, 0, 0);
      _dustRaf = requestAnimationFrame(tick);
      return;
    }

    // free：吹散 + 重力 + 阻力 + 湍流
    for (let i = 0; i < dust.particles.length; i++) {
      const p = dust.particles[i];
      p.life += dt;
      if (p.life < p.delay) {
        // 尚未启动：钉在释放瞬间世界坐标
        const ix = (p.wx * dpr) | 0, iy = (p.wy * dpr) | 0;
        const s = Math.max(1, (p.size * dpr) | 0);
        const aa = p.a;
        for (let dy = 0; dy < s; dy++) {
          const yy = iy + dy; if (yy < 0 || yy >= ch) continue;
          const row = yy * cw;
          for (let dx = 0; dx < s; dx++) {
            const xx = ix + dx; if (xx < 0 || xx >= cw) continue;
            const o = (row + xx) << 2;
            out[o] = p.r; out[o + 1] = p.g; out[o + 2] = p.b; out[o + 3] = aa;
          }
        }
        alive++;
        continue;
      }
      const age = p.life - p.delay;
      if (age >= p.ttl) continue;
      alive++;
      const tu = _turb(p.wx, p.wy, t);
      p.vy += g * dt * p.mass; // 重的略沉
      p.vx += (dust.windX * 0.0025 + tu.tx * 0.022) / p.mass * dt;
      p.vy += (dust.windY * 0.0025 + tu.ty * 0.022) / p.mass * dt;
      const damp = 1 - air * dt;
      p.vx *= damp;
      p.vy *= damp * (1 - air * dt * 0.2);
      p.wx += p.vx * dt + (Math.random() - 0.5) * 0.22;
      p.wy += p.vy * dt + (Math.random() - 0.5) * 0.22;
      const fadeT = age / p.ttl;
      const fade = (1 - fadeT) * (1 - fadeT * 0.35);
      const aa = (p.a * fade) | 0;
      if (aa < 4) continue;
      const shrink = 1 - fadeT * 0.6;
      const ix = (p.wx * dpr) | 0, iy = (p.wy * dpr) | 0;
      const s = Math.max(1, (p.size * dpr * shrink) | 0);
      for (let dy = 0; dy < s; dy++) {
        const yy = iy + dy; if (yy < 0 || yy >= ch) continue;
        const row = yy * cw;
        for (let dx = 0; dx < s; dx++) {
          const xx = ix + dx; if (xx < 0 || xx >= cw) continue;
          const o = (row + xx) << 2;
          if (aa >= out[o + 3]) {
            out[o] = p.r; out[o + 1] = p.g; out[o + 2] = p.b; out[o + 3] = aa;
          }
        }
      }
    }
    ctx.putImageData(frame, 0, 0);
    if (alive > 0) _dustRaf = requestAnimationFrame(tick);
    else {
      ctx.clearRect(0, 0, cw, ch);
      _dustRaf = 0;
      _dust = null;
    }
  };
  _dustRaf = requestAnimationFrame(tick);
}

function tickDragDust(el, d) {
  if (!dissolveEnabled() || !d || el.classList.contains('cover')) return;
  const dist = Math.hypot(d.dx, d.dy);
  const START = 18; // px：更早跟手
  const FULL = 120;
  const prog = dist < START ? 0 : clamp((dist - START) / (FULL - START));

  // —— Metal 原生路径 ——
  if (dissolveMetal()) {
    if (dist < START) {
      if (_nat.armed && _nat.lastProg > 0) {
        nativeProgress(el, d, Math.max(0, _nat.lastProg - 0.08));
      }
      return;
    }
    nativeProgress(el, d, prog);
    return;
  }

  // —— legacy html2canvas ——
  if (dist < START) {
    if (_dust && _dust.el === el && _dust.mode === 'follow' && _dust.progress > 0) {
      _dust.progress = Math.max(0, _dust.progress - 0.08);
      _dust.dx = d.dx; _dust.dy = d.dy;
      _dust.rot = clamp(d.dx / T.rot, -T.rotMax, T.rotMax) * d.rotSign;
      el.style.opacity = String(1 - _dust.progress * 0.7);
    }
    return;
  }
  const layout = { ox: d.ox, oy: d.oy, cw: d.cw, ch: d.ch };
  let sess = ensureDustSession(el, layout);
  if (!sess) {
    precacheDissolve(el);
    el.style.opacity = String(1 - prog * 0.25);
    return;
  }
  sess.mode = 'follow';
  sess.dx = d.dx; sess.dy = d.dy;
  sess.rot = clamp(d.dx / T.rot, -T.rotMax, T.rotMax) * d.rotSign;
  sess.rotSign = d.rotSign;
  sess.progress = prog;
  el.style.opacity = String(1 - prog * 0.78);
  ensureDustRaf();
}

function releaseDust(el, nx, ny, speed, layout, dx, dy, rotSign) {
  if (!dissolveEnabled() || !el || el.classList.contains('cover')) return false;
  const lay = layout || (() => {
    const r = el.getBoundingClientRect();
    return { ox: r.left + r.width * 0.5 - dx, oy: r.top + r.height * 0.5 - dy, cw: r.width, ch: r.height };
  })();

  // —— Metal：交给原生吹散 ——
  if (dissolveMetal()) {
    return nativeCommit(el, nx, ny, speed, lay, dx, dy);
  }

  let sess = ensureDustSession(el, lay);
  if (!sess) {
    return false;
  }
  const rot = clamp(dx / T.rot, -T.rotMax, T.rotMax) * (rotSign || 1);
  sess.dx = dx; sess.dy = dy; sess.rot = rot; sess.rotSign = rotSign || 1;
  sess.mode = 'free';
  sess.windX = nx * Math.max(0.7, speed) * 1.35;
  sess.windY = ny * Math.max(0.7, speed) * 1.35;
  const baseSp = Math.max(0.4, Math.min(2.2, speed));
  for (let i = 0; i < sess.particles.length; i++) {
    const p = sess.particles[i];
    const w = worldOf(p, sess);
    p.wx = w.x; p.wy = w.y;
    // 边缘先散：delay 小；中心后散 + 噪声
    const noise = _hash2(p.lx * 0.2, p.ly * 0.2);
    p.delay = (1 - p.edge) * 140 + noise * 90 + Math.random() * 40;
    p.ttl = 680 + Math.random() * 520 + p.mass * 80;
    p.life = 0;
    // 初速：滑向 + 垂直散射 / 质量；保留 follow 阶段速度
    const scatter = (Math.random() - 0.5) * 0.85;
    const along = baseSp * (0.55 + Math.random() * 1.15) / p.mass;
    const perp = scatter * baseSp * 1.35 / p.mass;
    p.vx = p.vx * 0.4 + nx * along + (-ny) * perp + (Math.random() - 0.5) * 0.25;
    p.vy = p.vy * 0.4 + ny * along + nx * perp + (Math.random() - 0.5) * 0.25 - 0.03;
    p.dx = 0; p.dy = 0;
  }
  el.style.opacity = '0';
  _snapCache.delete(el);
  ensureDustRaf();
  return true;
}

function fling(el, a, dx, dy, vx, vy, rotSign = 1, dragMeta = null) {
  // 参数移植自 react-tinder-card（MIT）：velocity-mode exit
  // https://github.com/3DJakob/react-tinder-card — animateOut: final=diag*dir, dur=diag/speed
  // 门槛参考：velocity≥0.5 / position≥~0.28w；按钮 power≈1.3
  // 不整库换（React + 无 behind 升起）；保留 like/nope/undo/感兴趣
  const w = W(), h = H();
  const diag = Math.hypot(w, h);
  let sx = vx, sy = vy;
  const spd0 = Math.hypot(sx, sy);
  // 速度过低时按方向补 floor（按钮/慢拖），对应 RTC power≈1.3
  if (spd0 < 0.55) {
    if (a === 'save') { sx = 0; sy = -1.3; }
    else if (a === 'like') { sx = 1.3; sy = clamp(sy, -0.35, 0.35); }
    else { sx = -1.3; sy = clamp(sy, -0.35, 0.35); }
  } else {
    // 沿释放速度飞出，但保证主轴与决策一致
    if (a === 'save') { if (sy > -0.4) sy = -Math.max(0.9, spd0); }
    else if (a === 'like' && sx < 0.35) sx = Math.max(0.9, Math.abs(sx) || spd0);
    else if (a === 'nope' && sx > -0.35) sx = -Math.max(0.9, Math.abs(sx) || spd0);
  }
  const speed = Math.max(0.7, Math.hypot(sx, sy));
  const nx = sx / speed, ny = sy / speed;
  // 终点：对角距离 × 方向（RTC），从松手处延续
  const throwDist = diag * 1.05;
  const tx = dx + nx * throwDist;
  const ty = dy + ny * throwDist;
  // dur = diag/speed（px/ms），快甩更短、慢拖更长；夹到 260–480 比 0.1.9 更跟手
  const dur = Math.round(clamp(diag / speed, 260, 480));
  const rot0 = clamp(dx / T.rot, -T.rotMax, T.rotMax) * rotSign;
  const rot1 = a === 'save' ? rot0 * 0.35 : clamp(nx * 28, -22, 22) * rotSign; // RTC maxTilt≈25
  el.classList.add('leaving'); el.dataset.zone = a;
  el.style.willChange = 'transform';
  paint(el, dx, dy, rotSign);
  el.style.setProperty('--pl', a === 'like' ? 1 : 0); el.style.setProperty('--pn', a === 'nope' ? 1 : 0); el.style.setProperty('--ps', a === 'save' ? 1 : 0);
  el.style.pointerEvents = 'none';
  // 从当前姿态继续飞出+粒子加强吹散（禁止 snap 回中心/0°）
  const layout = dragMeta ? { ox: dragMeta.ox, oy: dragMeta.oy, cw: dragMeta.cw, ch: dragMeta.ch } : null;
  const doDissolve = releaseDust(el, nx, ny, speed, layout, dx, dy, rotSign);
  // 动量直出（近似 RTC duration 线性），尾部略收
  const easeExit = 'cubic-bezier(.15,.0,.05,1)';
  const easeBehind = 'cubic-bezier(.2,.8,.2,1)'; // behind 同节奏升起
  const behind = els.get(S.pos + 1);
  if (behind) {
    const behindDur = Math.round(dur * 0.92);
    behind.style.transition = `transform ${behindDur}ms ${easeBehind}, --reveal ${behindDur}ms ${easeBehind}`;
    behind.style.transform = depthTransform(0);
    behind.style.setProperty('--reveal', 1);
    behind.classList.remove('behind');
  }
  // 有消散时卡已透明，动画只负责清场；无消散时正常飞出淡出
  const anim = el.animate(
    doDissolve
      ? [
          { transform: `translate3d(${dx}px,${dy}px,0) rotate(${rot0}deg)`, opacity: 0 },
          { transform: `translate3d(${tx}px,${ty}px,0) rotate(${rot1}deg)`, opacity: 0 },
        ]
      : [
          { transform: `translate3d(${dx}px,${dy}px,0) rotate(${rot0}deg)`, opacity: 1 },
          { transform: `translate3d(${tx}px,${ty}px,0) rotate(${rot1}deg)`, opacity: 0.35 },
        ],
    { duration: dur, easing: easeExit, fill: 'forwards' }
  );
  anim.onfinish = () => { el.style.willChange = ''; el.remove(); for (const [k, v] of els) if (v === el) els.delete(k); };
  commit(a);
}
function tap() {
  const item = S.deck[S.pos];
  if (item.type === 'cover') return;
  logEvent('open', item); haptic.select(); openLink(item.url);
}

// ---------- 决策 ----------
function bump() { const b = $('#favBtn'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
function commit(a) {
  const item = S.deck[S.pos];
  S.history.push({ pos: S.pos, act: a });
  if (item.type !== 'cover') {
    S.decisions[item.id] = a; logEvent(a, item);
    if (a === 'save') { haptic.notify('success'); toast('已加入稍后看'); bump(); }
    else if (THEME === 'd' && a === 'like') { likedUpsert(item, S.data.date); haptic.notify('success'); bump(); }
    else if (a === 'like') { likedUpsert(item, S.data.date); haptic.impact('medium'); }
    else haptic.impact('light');
  } else haptic.impact('light');
  S.pos++; saveState(); renderStack();
  if (S.pos >= S.deck.length) setTimeout(showEnd, 260);
}
function act(a) {
  if (S.pos >= S.deck.length) return;
  const el = els.get(S.pos); if (!el || el.classList.contains('leaving')) return;
  cancelSpring(el);
  if (S.deck[S.pos].type === 'cover') a = a === 'nope' ? 'nope' : 'like';
  const v = { like: [1.3, -0.05], nope: [-1.3, -0.05], save: [0, -1.3] }[a]; // RTC power≈1.3
  fling(el, a, 0, 0, v[0], v[1]);
}
function setEnded(on) {
  $('#endView').hidden = !on; $('#stack').hidden = on; $('#controls').classList.toggle('gone', on);
  document.documentElement.classList.toggle('ended', on);
}
function undo() {
  if (!S.history.length) return;
  const h = S.history.pop();
  setEnded(false); hideMainButton();
  S.pos = h.pos;
  const item = S.deck[S.pos];
  if (item.type !== 'cover') {
    if (h.act === 'like') likedRemove(item.id);
    delete S.decisions[item.id]; logEvent('undo', item);
  }
  saveState();
  const old = els.get(S.pos); if (old) { old.remove(); els.delete(S.pos); }
  renderStack();
  const el = els.get(S.pos), w = W(), h2 = H();
  const from = h.act === 'like' ? `translate3d(${w * 1.3}px,-30px,0) rotate(${T.rotMax}deg)` : h.act === 'nope' ? `translate3d(${-w * 1.3}px,-30px,0) rotate(${-T.rotMax}deg)` : `translate3d(0,${-h2}px,0)`;
  el.animate([{ transform: from }, { transform: depthTransform(0) }], { duration: 340, easing: 'cubic-bezier(.2,.9,.3,1)' });
  haptic.impact('soft');
}

// ---------- 结束页 / 稍后看 ----------
function showEnd() {
  const st = { likes: idsOf('like'), saves: idsOf('save'), nopes: idsOf('nope') };
  const v = $('#endView'); v.innerHTML = T.end(st); v.scrollTop = 0;
  setEnded(true);
  haptic.notify('success'); updateChrome();
  // 结束页自动 POST；无端点时静默留本地，不弹「反馈已暂存本地」
  flush(false).then(() => {
    const s = $('#syncLine');
    if (!s) return;
    if (THEME === 'd') s.textContent = window.X.CONFIG.FEEDBACK_ENDPOINT ? ('反馈 · ' + R.syncState) : '';
    else s.textContent = 'local · ' + R.syncState;
  });
  showMainButton();
}
function openSheet() {
  const sh = $('#sheet'); const mask = $('#sheetMask');
  sh.innerHTML = THEME === 'd' ? D.sheet() : T.sheet(idsOf('save'));
  sh.hidden = false; mask.hidden = false; mask.style.pointerEvents = '';
  requestAnimationFrame(() => { sh.classList.add('open'); mask.classList.add('open'); });
}
function closeSheet() {
  const sh = $('#sheet'); const mask = $('#sheetMask');
  sh.classList.remove('open'); mask.classList.remove('open');
  mask.style.pointerEvents = 'none';
  setTimeout(() => { sh.hidden = true; mask.hidden = true; }, 260);
}

// ---------- 事件 ----------
document.addEventListener('click', e => {
  // 先处理 data-act（含 .li-share），再 data-link——避免分享点在 [data-link] 内被 openLink 抢走
  const a = e.target.closest('[data-act]');
  if (a) {
    e.preventDefault(); e.stopPropagation();
    const k = a.dataset.act;
    if (k === 'share-agent' || k === 'copy-agent' || k === 'share-row') {
      const url = a.dataset.url || '';
      const title = a.dataset.title || '';
      if (!url) { toast('分享失败'); return; }
      shareNative({ url, title }).then(ok => {
        haptic.select();
        if (k === 'share-row') return;
        if (!ok) { toast('分享失败'); return; }
        a.classList.add('ok'); a.textContent = '已打开分享';
        clearTimeout(a._t); a._t = setTimeout(() => { a.classList.remove('ok'); a.textContent = '发给 agent'; }, 900);
      });
      return;
    }
    if (k === 'start') act('like');
    if (k === 'restart') restart();
    if (k === 'export') exportFeedback();
    return;
  }
  const l = e.target.closest('[data-link]');
  if (l) {
    e.preventDefault();
    // 列表/sheet 内开原文：先关蒙层，否则回来 sheetMask 继续吃触点
    try { closeSheet(); } catch (err) {}
    const c = S.data.cards.find(x => x.url === l.dataset.link);
    if (c) logEvent('open', c);
    openLink(l.dataset.link);
  }
});
const _on = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
_on('#btnLike', () => act('like'));
_on('#btnNope', () => act('nope'));
_on('#btnSave', () => act('save'));
_on('#btnUndo', undo);
_on('#btnOpen', () => { const c = S.deck[S.pos]; if (c && c.type !== 'cover') { logEvent('open', c); openLink(c.url); } });
_on('#favBtn', openSheet); $('#sheetMask').onclick = closeSheet;
addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') act('like');
  else if (e.key === 'ArrowLeft') act('nope');
  else if (e.key === 'ArrowUp') act(THEME === 'd' ? 'like' : 'save');
  else if (e.key === 'z' || e.key === 'Backspace') undo();
  else if (e.key === 'Enter') { const c = S.deck[S.pos]; if (c && c.type !== 'cover') { logEvent('open', c); openLink(c.url); } }
  else if (e.key === 'Escape') closeSheet();
});

/** 外链 / SFSafari / X App 返回后：清卡住的 pointer/drag/蒙层，恢复划卡（幂等） */
function resumeFromExternal() {
  try {
    if (drag && drag.el) {
      const el = drag.el;
      try { if (drag.id != null) el.releasePointerCapture(drag.id); } catch (e) {}
      el.classList.remove('dragging', 'native-dissolving');
      el.dataset.zone = '';
      el.style.opacity = '';
      el.style.transition = '';
      el.style.transform = '';
      el.style.pointerEvents = '';
      try { paint(el, 0, 0); } catch (e) {}
      try { cancelSpring(el); } catch (e) {}
    }
  } catch (e) {}
  drag = null;
  try { cancelDust && cancelDust(true); } catch (e) {}
  // 任意残留 capture：尽量放掉
  document.querySelectorAll('.card').forEach(el => {
    try {
      if (el.hasPointerCapture && el.hasPointerCapture(1)) el.releasePointerCapture(1);
    } catch (e) {}
    for (let i = 0; i < 8; i++) {
      try { if (typeof el.releasePointerCapture === 'function') el.releasePointerCapture(i); } catch (e) {}
    }
  });
  document.querySelectorAll('.card.dragging, .card.native-dissolving, .card.leaving').forEach(el => {
    el.classList.remove('dragging', 'native-dissolving');
    if (!el.classList.contains('leaving')) {
      el.style.opacity = '';
      el.style.transition = '';
      el.style.transform = '';
      el.style.pointerEvents = '';
      el.dataset.zone = '';
    }
  });
  // 外链返回：强制收起 sheet（即使当时是 open）——蒙层会吃掉全部触点
  const mask = document.getElementById('sheetMask');
  const sheet = document.getElementById('sheet');
  if (mask) {
    mask.classList.remove('open');
    mask.hidden = true;
    mask.style.pointerEvents = 'none';
  }
  if (sheet) {
    sheet.classList.remove('open');
    sheet.hidden = true;
  }
  const dust = document.getElementById('dissolveLayer');
  if (dust) { dust.style.pointerEvents = 'none'; dust.innerHTML = ''; }
  try { if (typeof renderStack === 'function' && S && S.pos < S.deck.length) renderStack(); } catch (e) {}
  return true;
}

/** 开外链之前调用：释放手势，避免进 X/Safari 时 capture 残留 */
function prepareForExternal() {
  try { resumeFromExternal(); } catch (e) {}
  return true;
}

window.XFeed = Object.assign(window.XFeed || {}, {
  dissolveEnabled, setDissolvePref, dissolveMode, dissolveMetal, dissolveLegacy, nativeDissolveReady,
  resumeFromExternal, prepareForExternal,
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    try { resumeFromExternal(); } catch (e) {}
  }
});
addEventListener('pageshow', () => { try { resumeFromExternal(); } catch (e) {} });
X.loadData().then(({ restored }) => {
  // #pos=N / ?pos=N — 截图与调试跳转（含 cover=0）
  const jump = +(qs.get('pos') || ((location.hash.match(/pos=(\d+)/) || [])[1] || NaN));
  if (Number.isFinite(jump) && jump >= 0) {
    S.pos = Math.min(jump, S.deck.length);
    localStorage.removeItem(`xfeed:state:${S.data.date}`);
  }
  $('#hdrDate').textContent = T.hdrDate(S.data.date);
  if (restored && !Number.isFinite(jump)) toast(`已恢复到第 ${S.pos} 条`);
  renderStack();
  // 顶卡若是缺图 X 帖，补封面
  const top = S.deck[S.pos];
  if (top && top.type !== 'cover') enrichXMedia(top, els.get(S.pos));
  if (S.pos >= S.deck.length) showEnd();
}).catch(e => { $('#stack').innerHTML = `<div class="card" style="padding:24px">加载失败：${esc(e.message)}</div>`; });
})();

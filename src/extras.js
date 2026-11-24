// ResultsDesk clone extras: last-changed badges, margin legend, coalition tracker,
// overhang notice and big-screen TV mode. Hooks into the app's own globals.
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
  };
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = n => Number(n || 0).toLocaleString('en-NZ');
  const ds = () => { try { return currentDataset; } catch { return ''; } };
  // Each party's own colour, used everywhere the site colours parties (map, party table, bars) and in
  // our panels. Opportunity is from its website (opportunity.org.nz primary); the rest are the
  // colours Wikipedia's party data (Module:Political party) lists for each NZ party.
  const OPP_CYAN = '#00B9BC';
  const isOppParty = p => /OPPORTUNIT/i.test(String(p || ''));
  const PARTY_COLOURS = [
    [/^NATIONAL/i, '#00529F'],
    [/^LABOUR/i, '#D82A20'],
    [/^GREEN/i, '#098137'],
    [/^ACT\b/i, '#EE2796'], // ACT's magenta (act.org.nz)
    [/NZ FIRST|NEW ZEALAND FIRST/i, '#000000'],
    [/M[AĀ]ORI/i, 'TPM'],
    [/OPPORTUNIT/i, OPP_CYAN],
    [/^ALLIANCE/i, '#33CC66'],
    [/ANIMAL JUSTICE/i, '#5C558C'],
    [/LEGALISE CANNABIS/i, '#33CC33'],
    [/CONSERVATIVE/i, '#00768B'],
    [/FREE PALESTINE/i, '#228847'],
    [/LOYAL/i, '#FDB813'],
    [/OUTDOORS/i, '#008000'],
    [/TE TAI TOKERAU PARTY/i, '#774D27'],
    [/^VISION/i, '#095B7E'],
    [/WOMEN.S RIGHTS/i, '#9C27B0'],
  ];
  // In the Māori electorates Te Pāti Māori is drawn orange, because its red is too close to Labour's.
  const maoriLayer = () => { try { return !!document.getElementById('maoriBtnMap')?.classList.contains('active') || (typeof currentDataset !== 'undefined' && /maori/i.test(String(currentDataset))); } catch { return false; } };
  const ownColour = p => { const s = String(p || ''); const hit = PARTY_COLOURS.find(([re]) => re.test(s)); if (!hit) return null; return hit[1] === 'TPM' ? (maoriLayer() ? '#F28C28' : '#B2001A') : hit[1]; };
  if (typeof window.getPartyColor === 'function' && !window.getPartyColor.__rdColours) {
    const origColor = window.getPartyColor;
    window.getPartyColor = function (p) { return ownColour(p) || origColor.apply(this, arguments); };
    window.getPartyColor.__rdColours = true;
  }
  const partyColor = p => { try { return getPartyColor(p); } catch { return '#94a3b8'; } };
  const partyLabel = p => {
    if (isOppParty(p)) return 'OPP';
    try { if (typeof getDashboardPartyLabel === 'function') return getDashboardPartyLabel(p); } catch { /* fall through */ }
    return String(p || '').replace(/ PARTY$/, '');
  };
  const ago = ms => { const s = Math.max(0, Math.round(ms / 1000)); return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m` : `${Math.floor(s / 3600)}h`; };

  // Remove leftovers in case upstream markup changes and the HTML patch misses them.
  document.querySelectorAll('.app-support-link, .app-contact-link').forEach(n => n.remove());

  // ---------------------------------------------------------------------------
  // Electorate snapshot helpers
  // ---------------------------------------------------------------------------
  function features() {
    const out = [];
    try { geoJsonLayer && geoJsonLayer.eachLayer(l => { const lv = l.feature?.properties?.live; if (lv?.electorate_code) out.push({ layer: l, live: lv }); }); } catch { /* map not ready */ }
    return out;
  }
  function countedPct() {
    let c = 0, t = 0;
    for (const { live } of features()) { c += Number(live.voting_places_counted || 0); t += Number(live.voting_places_total || 0); }
    return t > 0 ? (c / t) * 100 : null;
  }

  // ---------------------------------------------------------------------------
  // 1. "Last changed" badges
  // ---------------------------------------------------------------------------
  const BADGE_TTL = 10 * 60 * 1000;
  let prints = new Map();        // code -> fingerprint
  let changes = new Map();       // code -> {at, name, party, delta, leaderChanged}
  let badgeLayer = null;
  let printsDataset = null;

  const printOf = l => [l.leader_party, l.leader_votes, l.total_votes, l.party_vote_total_votes, l.voting_places_counted].join('|');

  function scanChanges() {
    const now = Date.now();
    const list = features();
    if (!list.length) return;
    if (printsDataset !== ds()) { prints = new Map(); changes = new Map(); printsDataset = ds(); }
    const first = prints.size === 0;
    for (const { live } of list) {
      const code = live.electorate_code;
      const p = printOf(live);
      const prev = prints.get(code);
      if (!first && prev !== undefined && prev !== p) {
        const prevParts = prev.split('|');
        changes.set(code, {
          at: now,
          name: live.electorate_name,
          party: live.leader_party,
          delta: Number(live.total_votes || 0) - Number(prevParts[2] || 0),
          leaderChanged: prevParts[0] !== String(live.leader_party),
          prevParty: prevParts[0],
        });
      }
      prints.set(code, p);
    }
    renderBadges();
    renderTicker();
    renderPins();
  }

  // Map badges are switched off (they piled up and covered the map once results started).
  // Changes are still tracked for TV mode's "Latest updates" list.
  const SHOW_MAP_BADGES = false;
  function renderBadges() {
    if (typeof map === 'undefined' || !map || typeof L === 'undefined') return;
    if (!SHOW_MAP_BADGES) {
      // Drop expired entries so the TV list stays current, and clear anything already drawn.
      const now = Date.now();
      for (const [code, c] of changes) if (now - c.at > BADGE_TTL) changes.delete(code);
      if (badgeLayer) { badgeLayer.clearLayers(); badgeLayer.remove(); badgeLayer = null; }
      return;
    }
    if (!badgeLayer) badgeLayer = L.layerGroup().addTo(map);
    badgeLayer.clearLayers();
    const now = Date.now();
    const byCode = new Map(features().map(f => [f.live.electorate_code, f.layer]));
    for (const [code, c] of changes) {
      const age = now - c.at;
      if (age > BADGE_TTL) { changes.delete(code); continue; }
      const layer = byCode.get(code);
      if (!layer) continue;
      let pos; try { pos = layer.getCenter(); } catch { continue; }
      const fresh = age < 20000 ? ' is-fresh' : '';
      const flip = c.leaderChanged ? ' is-lead-change' : '';
      const label = c.leaderChanged ? `LEAD → ${esc(partyLabel(c.party))}` : (c.delta > 0 ? `+${fmt(c.delta)}` : 'UPDATED');
      const icon = L.divIcon({
        className: 'rd-badge-wrap',
        html: `<div class="rd-badge${fresh}${flip}" style="--rd-age:${Math.max(0.35, 1 - age / BADGE_TTL)}"><b>${label}</b><span data-at="${c.at}">${ago(age)}</span></div>`,
        iconSize: null,
      });
      L.marker(pos, { icon, interactive: false, keyboard: false, zIndexOffset: 1000 }).addTo(badgeLayer);
    }
  }
  // Keep the "x s ago" text ticking without rebuilding markers.
  setInterval(() => {
    const now = Date.now();
    document.querySelectorAll('.rd-badge span[data-at], .rd-ticker [data-at]').forEach(s => { s.textContent = ago(now - Number(s.dataset.at)); });
    document.querySelectorAll('.rd-badge.is-fresh').forEach(b => {
      const at = Number(b.querySelector('[data-at]')?.dataset.at || 0);
      if (now - at > 20000) b.classList.remove('is-fresh');
    });
  }, 1000);
  setInterval(renderBadges, 30000); // expire / fade old badges

  // ---------------------------------------------------------------------------
  // 2. Margin legend (shading itself is in the patched map styles)
  // ---------------------------------------------------------------------------
  window.rdMarginShading = store.get('rd-margin-shading', true);

  // Bottom-right stack on the map, top to bottom: overhang notice, pinned electorates, key.
  // One container so they never overlap; CSS flips it to the top-left on stacked layouts.
  function ensureDock() {
    const wrap = $('#mapWrap');
    if (!wrap) return null;
    let dock = $('#rdDock');
    if (!dock) {
      dock = el('div', 'rd-dock');
      dock.id = 'rdDock';
      wrap.appendChild(dock);
    }
    const slot = (id, cls) => {
      let n = document.getElementById(id);
      if (!n) { n = el('div', cls); n.id = id; n.hidden = true; }
      return n;
    };
    const order = [slot('rdOverhang', 'rd-overhang'), slot('rdPins', 'rd-pins'), $('#rdLegend')].filter(Boolean);
    order.forEach((n, i) => { if (dock.children[i] !== n) dock.insertBefore(n, dock.children[i] || null); });
    return dock;
  }

  function buildLegend() {
    const dock = ensureDock();
    if (!dock || $('#rdLegend')) return;
    const wrap = dock;
    const lg = el('div', 'rd-legend');
    lg.id = 'rdLegend';
    lg.innerHTML = `
      <button type="button" class="rd-legend-toggle" title="Toggle margin shading">Margin</button>
      <span class="rd-sw" style="opacity:.34"></span><small>&lt;2%</small>
      <span class="rd-sw" style="opacity:.5"></span><small>2–5</small>
      <span class="rd-sw" style="opacity:.65"></span><small>5–10</small>
      <span class="rd-sw" style="opacity:.8"></span><small>10–20</small>
      <span class="rd-sw" style="opacity:.92"></span><small>20%+</small>
      <span class="rd-sw rd-sw-hatch"></span><small>Flipped</small>`;
    lg.querySelector('button').addEventListener('click', () => {
      window.rdMarginShading = !window.rdMarginShading;
      store.set('rd-margin-shading', window.rdMarginShading);
      lg.classList.toggle('is-off', !window.rdMarginShading);
      try { geoJsonLayer.setStyle(featureStyle); updateSelectedHighlight(); } catch { /* ignore */ }
    });
    lg.classList.toggle('is-off', !window.rdMarginShading);
    wrap.appendChild(lg);
  }

  // ---------------------------------------------------------------------------
  // 3. Coalition tracker + 4. overhang notice
  // ---------------------------------------------------------------------------
  // Order matters: Opportunity (OPP) sits between the two main blocs in the list and seat bar.
  // OPP's cyan is the party's own brand colour (opportunity.org.nz primary #00B9BC).
  const OPP_COLOR = OPP_CYAN;
  const isOpp = isOppParty;
  const BLOCS = [
    { key: 'right', name: 'National · ACT · NZ First', test: p => /^NATIONAL|^ACT\b|NZ FIRST|NEW ZEALAND FIRST/i.test(p), color: '#2f5fd0' },
    { key: 'opp', name: 'OPP', test: isOpp, color: OPP_COLOR, middle: true },
    { key: 'left', name: 'Labour · Green · Te Pāti Māori', test: p => /^LABOUR|^GREEN|M[AĀ]ORI/i.test(p), color: '#d0342c' },
  ];
  const blocByKey = (st, k) => st.blocs.find(b => b.key === k) || { seats: 0 };
  const mainBlocs = st => st.blocs.filter(b => !b.middle);
  let seatRows = [];
  let coalOpen = store.get('rd-coalition-open', false);
  const histKey = () => `rd-coal-hist-${ds()}`;

  function seatState(rows = seatRows) {
    const parties = (rows || []).filter(r => Number(r.total_seats || 0) > 0).map(r => {
      const elect = Number(r.general_electorate_seats || 0) + Number(r.maori_electorate_seats || 0);
      const over = (() => { try { return getSeatSummaryOverhang(r); } catch { return 0; } })();
      return { party: r.party, seats: Number(r.total_seats || 0), elect, overhang: over, entitled: Number(r.proportional_entitlement ?? (Number(r.total_seats || 0) - over)) };
    }).sort((a, b) => b.seats - a.seats);
    const total = parties.reduce((s, p) => s + p.seats, 0);
    const majority = Math.floor(total / 2) + 1;
    const blocs = BLOCS.map(b => {
      const members = parties.filter(p => b.test(p.party));
      return { ...b, members, seats: members.reduce((s, p) => s + p.seats, 0) };
    });
    const used = new Set(blocs.flatMap(b => b.members.map(m => m.party)));
    const others = parties.filter(p => !used.has(p.party));
    return { parties, total, majority, blocs, others, othersSeats: others.reduce((s, p) => s + p.seats, 0) };
  }

  function recordHistory(st) {
    if (!st.total) return [];
    const hist = store.get(histKey(), []);
    const snap = { t: Date.now(), r: blocByKey(st, 'right').seats, p: blocByKey(st, 'opp').seats, l: blocByKey(st, 'left').seats, o: st.othersSeats, n: st.total };
    const last = hist[hist.length - 1];
    if (!last || last.r !== snap.r || last.p !== snap.p || last.l !== snap.l || last.o !== snap.o || last.n !== snap.n) {
      hist.push(snap);
      while (hist.length > 400) hist.shift();
      store.set(histKey(), hist);
    }
    return hist;
  }

  function sparkline(hist, majority) {
    if (hist.length < 2) return '<div class="rd-spark-empty">Seat history builds up as results come in.</div>';
    const W = 300, H = 70, maxN = Math.max(...hist.map(h => h.n), majority * 2 - 1);
    const t0 = hist[0].t, t1 = hist[hist.length - 1].t || t0 + 1;
    const x = t => ((t - t0) / Math.max(1, t1 - t0)) * W;
    const y = v => H - (v / maxN) * H;
    const line = (k, c) => `<polyline fill="none" stroke="${c}" stroke-width="2" points="${hist.map(h => `${x(h.t).toFixed(1)},${y(h[k] || 0).toFixed(1)}`).join(' ')}"/>`;
    const col = k => BLOCS.find(b => b.key === k).color;
    const hasOpp = hist.some(h => h.p > 0);
    return `<svg class="rd-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <line x1="0" x2="${W}" y1="${y(majority)}" y2="${y(majority)}" stroke="currentColor" stroke-dasharray="4 3" opacity=".5"/>
      ${line('r', col('right'))}${hasOpp ? line('p', col('opp')) : ''}${line('l', col('left'))}</svg>`;
  }

  function blocBarHtml(st) {
    const segs = [...st.blocs, { key: 'other', seats: st.othersSeats, color: '#64748b' }]
      .filter(b => b.seats > 0)
      .map(b => `<span style="flex:${b.seats};background:${b.color}"></span>`).join('');
    const majPos = st.total ? (st.majority / st.total) * 100 : 50;
    return `<div class="rd-bloc-bar">${segs}<i style="left:${majPos}%"></i></div>`;
  }

  function verdict(st) {
    const win = mainBlocs(st).find(b => b.seats >= st.majority);
    if (win) return `<b style="color:${win.color}">${esc(win.name)}</b> has a majority: ${win.seats} of ${st.total}`;
    const best = [...mainBlocs(st)].sort((a, b) => b.seats - a.seats)[0];
    if (!best || !best.seats) return 'Waiting for results';
    const opp = blocByKey(st, 'opp').seats;
    const extra = [opp ? `OPP holds ${opp}` : '', st.othersSeats ? `others hold ${st.othersSeats}` : ''].filter(Boolean).join(', ');
    return `No majority yet: ${esc(best.name)} is ${st.majority - best.seats} short` + (extra ? ` (${extra})` : '');
  }

  function coalitionHtml(st, hist) {
    const blocs = st.blocs.map(b => `
      <div class="rd-bloc">
        <div class="rd-bloc-head"><span class="rd-dot" style="background:${b.color}"></span>${esc(b.name)}<strong>${b.seats}</strong></div>
        ${b.middle ? '' : `<div class="rd-chips">${b.members.map(m => `<span class="rd-chip" style="--c:${partyColor(m.party)}">${esc(partyLabel(m.party))} ${m.seats}</span>`).join('') || '<small>—</small>'}</div>`}
      </div>`).join('');
    const others = st.others.length ? `<div class="rd-bloc"><div class="rd-bloc-head"><span class="rd-dot" style="background:#64748b"></span>Others<strong>${st.othersSeats}</strong></div>
      <div class="rd-chips">${st.others.map(m => `<span class="rd-chip" style="--c:${partyColor(m.party)}">${esc(partyLabel(m.party))} ${m.seats}</span>`).join('')}</div></div>` : '';
    return `
      <div class="rd-coal-head"><strong>Coalition tracker</strong><span>${st.total} seats · ${st.majority} to govern</span></div>
      ${blocBarHtml(st)}
      <div class="rd-verdict">${verdict(st)}</div>
      ${blocs}${others}
      <div class="rd-spark-label">Bloc seats over time</div>
      ${sparkline(hist, st.majority)}`;
  }

  function overhangHtml(st) {
    const over = st.parties.filter(p => p.overhang > 0);
    if (!over.length) return '';
    const who = over.map(p => `${esc(partyLabel(p.party))} won ${p.elect} electorate seat${p.elect === 1 ? '' : 's'} but its party vote only earns ${p.entitled}`).join('; ');
    const n = over.reduce((s, p) => s + p.overhang, 0);
    return `<b>Overhang +${n}:</b> ${who}. Parliament grows to <b>${st.total}</b> seats, so <b>${st.majority}</b> are needed to govern.`;
  }

  function ensureCoalitionUi() {
    const wrap = $('#mapWrap');
    if (!wrap) return;
    if (!$('#rdCoalition')) {
      const p = el('div', 'rd-coalition');
      p.id = 'rdCoalition';
      p.hidden = !coalOpen;
      wrap.appendChild(p);
    }
    ensureDock(); // creates #rdOverhang and #rdPins in the bottom-right stack
    // Rail button (the rail is rebuilt by the app now and then, so re-add when missing).
    const dock = $('#mapMagicWallControlsRail .map-icon-dock');
    if (dock && !dock.querySelector('[data-map-icon="rdCoalition"]')) {
      const b = el('button', 'map-icon-button rd-coal-btn');
      b.type = 'button';
      b.dataset.mapIcon = 'rdCoalition';
      b.title = 'Coalition tracker';
      b.setAttribute('aria-pressed', String(coalOpen));
      b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M2 20c0-3.3 2.7-6 6-6s6 2.7 6 6M12 14.5c1.1-.3 2.5-.5 4-.5 3.3 0 6 2.7 6 6"/></svg><span>Coalition</span>';
      b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); toggleCoalition(); });
      dock.appendChild(b);
    }
    document.querySelectorAll('.rd-coal-btn').forEach(b => { b.classList.toggle('active', coalOpen); b.setAttribute('aria-pressed', String(coalOpen)); });
  }

  function toggleCoalition(force) {
    coalOpen = typeof force === 'boolean' ? force : !coalOpen;
    store.set('rd-coalition-open', coalOpen);
    ensureCoalitionUi();
    const p = $('#rdCoalition');
    if (p) p.hidden = !coalOpen;
    renderSeatsUi();
  }

  function renderSeatsUi() {
    ensureCoalitionUi();
    const st = seatState();
    updateKeyColour(st);
    renderPins();
    const hist = recordHistory(st);
    const p = $('#rdCoalition');
    if (p && !p.hidden) p.innerHTML = st.total ? coalitionHtml(st, hist) : '<div class="rd-coal-head"><strong>Coalition tracker</strong></div><div class="rd-verdict">Waiting for seat results…</div>';
    const o = $('#rdOverhang');
    if (o) { const h = overhangHtml(st); o.innerHTML = h; o.hidden = !h; }
    if (document.body.classList.contains('rd-tv')) renderTv(st, hist);
    try { renderNewUi(); } catch { /* not ready */ }
  }

  // ---------------------------------------------------------------------------
  // 5. TV mode
  // ---------------------------------------------------------------------------
  const TV_REGIONS = ['resetZoomBtn', 'viewAucklandBtn', 'viewHamiltonBtn', 'viewWellingtonBtn', 'viewChristchurchBtn', 'resetZoomBtn', 'viewTaurangaBtn', 'viewDunedinBtn'];
  let tvTimer = null, tvIdx = 0, tvCycle = true;

  function tvButton() {
    // Next to the light/dark button where the site still has one, otherwise first in the header tools.
    const theme = $('header #themeToggleBtn');
    const nav = theme?.parentElement || $('header .app-header-nav');
    if (!nav || $('#rdTvBtn')) return;
    const b = el('button', 'nav-btn rd-tv-btn', '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="5" width="20" height="13" rx="2"/><path d="M8 21h8"/></svg><span>TV mode</span>');
    b.id = 'rdTvBtn';
    b.type = 'button';
    b.title = 'Big-screen TV mode (T)';
    b.addEventListener('click', () => setTv(true));
    nav.insertBefore(b, theme || nav.querySelector('#rdChangelogBtn, .nav-btn:not(#rdDesignBtn)'));
  }

  // In TV mode the site's map-fit padding (which leaves room for its left panel) is replaced
  // with a small even margin, so the national view and region tours fill the screen.
  (function patchFitOptions() {
    const orig = window.getComposedMapFitOptions;
    if (typeof orig !== 'function') return;
    window.getComposedMapFitOptions = function (...args) {
      const o = orig.apply(this, args);
      if (!document.body.classList.contains('rd-tv') || !o) return o;
      const wrapW = $('#mapWrap')?.clientWidth || 1200;
      const left = tvDetailOpen() ? Math.min(500, wrapW * 0.42) + 40 : 20; // electorate panel sits top-left
      return { ...o, paddingTopLeft: [left, 20], paddingBottomRight: [20, 20], maxZoom: Math.max(Number(o.maxZoom) || 0, 6.6) };
    };
  })();
  // Best fit for the TV-sized map, applied directly (the site's reset waits for animation frames
  // and can run before the map has resized), then once more after the layout settles.
  // The tour's moves are instant (no animation) while a step is starting.
  function smoothTour(go) {
    const orig = {};
    const wrap = (n, f) => { orig[n] = map[n]; map[n] = f; };
    const still = o => ({ ...(o || {}), animate: false, duration: 0 });
    wrap('setView', (c, z, o) => orig.setView.call(map, c, z, still(o)));
    wrap('flyTo', (c, z, o) => orig.setView.call(map, c, z == null ? map.getZoom() : z, still(o)));
    wrap('fitBounds', (b, o) => orig.fitBounds.call(map, b, still(o)));
    wrap('flyToBounds', (b, o) => orig.fitBounds.call(map, b, still(o)));
    wrap('panTo', (c, o) => orig.panTo.call(map, c, still(o)));
    try { go(); } finally {
      setTimeout(() => { for (const n of Object.keys(orig)) { if (orig[n] === Object.getPrototypeOf(map)[n]) delete map[n]; else map[n] = orig[n]; } }, 500);
    }
  }
  function tvFitNz() {
    const fit = () => { try { map.invalidateSize(false); applyBestView(false); } catch { /* ignore */ } };
    fit();
    setTimeout(fit, 600);
  }

  // TV mode: clicking an electorate shows its panel (votes, candidate ladder) top-left over the map.
  const tvDetailOpen = () => document.body.classList.contains('rd-tv') && !!$('#mapDetailPanel.has-result');
  function closeTvDetail() {
    try { hideFeaturePopup(); } catch { /* ignore */ }
    try { updateSelectedHighlight(); } catch { /* ignore */ }
    tvFitNz();
  }
  function tvDetailCloseButton() {
    const p = $('#mapDetailPanel');
    if (!p || p.querySelector(':scope > .rd-tv-detail-close')) return;
    const b = el('button', 'rd-tv-detail-close', '×');
    b.type = 'button';
    b.title = 'Close electorate (Esc)';
    b.setAttribute('aria-label', 'Close electorate');
    b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); closeTvDetail(); });
    p.appendChild(b);
  }

  function setTv(on) {
    const body = document.body;
    if (on === body.classList.contains('rd-tv')) return;
    body.classList.toggle('rd-tv', on);
    setTimeout(() => { try { syncLocalMapSoon(); } catch { /* map not ready */ } }, 300);
    if (on) {
      if (!$('#rdTv')) {
        const tv = el('div', 'rd-tv-panel');
        tv.id = 'rdTv';
        document.body.appendChild(tv);
        tv.addEventListener('click', e => {
          const a = e.target.closest('[data-tv]');
          if (!a) return;
          if (a.dataset.tv === 'exit') setTv(false);
          if (a.dataset.tv === 'areas') { toggleLocalMap(); renderSeatsUi(); }
          if (a.dataset.tv === 'cycle') { tvCycle = !tvCycle; renderSeatsUi(); }
        });
      }
      document.documentElement.requestFullscreen?.().catch(() => {});
      tvIdx = 0;
      clearInterval(tvTimer);
      tvTimer = setInterval(() => {
        if (!tvCycle || tvDetailOpen()) return;
        tvIdx = (tvIdx + 1) % TV_REGIONS.length;
        smoothTour(() => {
          if (TV_REGIONS[tvIdx] === 'resetZoomBtn') { try { map.invalidateSize(false); applyBestView(false); } catch { /* ignore */ } }
          else document.getElementById(TV_REGIONS[tvIdx])?.click();
        });
      }, 20000);
    } else {
      clearInterval(tvTimer);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      document.getElementById('resetZoomBtn')?.click();
    }
    setTimeout(() => {
      try { map.invalidateSize(); } catch { /* ignore */ }
      if (on) tvFitNz();
    }, 250);
    renderSeatsUi();
  }

  function renderTv(st = seatState(), hist = store.get(histKey(), [])) {
    const tv = $('#rdTv');
    if (!tv) return;
    const pct = countedPct();
    const spec = specials();
    const maxSeats = Math.max(1, ...st.parties.map(p => p.seats));
    const rows = st.parties.slice(0, 8).map(p => `
      <div class="rd-tv-row">
        <span class="rd-tv-name">${esc(partyLabel(p.party))}${p.overhang ? '<sup>*</sup>' : ''}</span>
        <span class="rd-tv-bar"><i style="width:${(p.seats / maxSeats) * 100}%;background:${partyColor(p.party)}"></i></span>
        <strong>${p.seats}</strong>
      </div>`).join('');
    const ov = overhangHtml(st);
    tv.innerHTML = `
      <div class="rd-tv-actions"><button data-tv="areas" type="button" aria-pressed="${localMapOn}">Suburbs ${localMapOn ? 'on' : 'off'}</button><button data-tv="cycle" type="button">${tvCycle ? 'Auto-tour on' : 'Auto-tour off'}</button><button data-tv="exit" type="button">Exit ✕</button></div>
      <div class="rd-tv-top">
        <div><div class="rd-tv-title">NZ Election ${esc(String(ds()).match(/\d{4}/)?.[0] || '')}</div>
        <div class="rd-tv-sub">${pct == null ? '' : `${pct.toFixed(1)}% of voting places counted · `}${spec && !spec.counted ? `<b>${fmt(spec.left)} special votes not counted yet</b> (official result ${OFFICIAL_RESULTS_LABEL}) · ` : ''}<span class="rd-tv-clock">${new Date().toLocaleTimeString('en-NZ', { hour: 'numeric', minute: '2-digit' })}</span></div></div>
        
      </div>
      <div class="rd-tv-seats">${rows || '<div class="rd-tv-sub">Waiting for seat results…</div>'}</div>
      ${st.total ? `<div class="rd-tv-coal"><div class="rd-tv-coal-head">${st.total} seats · <b>${st.majority}</b> to govern</div>${blocBarHtml(st)}
        <div class="rd-tv-blocs">${st.blocs.map(b => `<span><i style="background:${b.color}"></i>${esc(b.name)} <b>${b.seats}</b></span>`).join('')}</div>
        <div class="rd-verdict">${verdict(st)}</div></div>` : ''}
      ${ov ? `<div class="rd-overhang rd-tv-overhang">${ov}</div>` : ''}
      <div class="rd-tv-ticker-label">Latest updates</div>
      <div class="rd-ticker"></div>`;
    renderTicker();
  }

  function renderTicker() {
    const t = $('#rdTv .rd-ticker');
    if (!t) return;
    const items = [...changes.values()].sort((a, b) => b.at - a.at).slice(0, 7);
    t.innerHTML = items.length ? items.map(c => `
      <div class="rd-ticker-item${c.leaderChanged ? ' is-lead-change' : ''}">
        <span class="rd-dot" style="background:${partyColor(c.party)}"></span>
        <b>${esc(c.name)}</b>
        <span>${c.leaderChanged ? `lead ${esc(partyLabel(c.prevParty))} → ${esc(partyLabel(c.party))}` : c.delta > 0 ? `+${fmt(c.delta)} votes` : 'updated'}</span>
        <small data-at="${c.at}">${ago(Date.now() - c.at)}</small>
      </div>`).join('') : '<div class="rd-tv-sub">Nothing yet — new counts appear here.</div>';
  }

  document.addEventListener('keydown', e => {
    if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
    if ((e.key === 't' || e.key === 'T') && !e.ctrlKey && !e.metaKey && !e.altKey) setTv(!document.body.classList.contains('rd-tv'));
    if (e.key === 'Escape' && document.body.classList.contains('rd-tv')) { if (tvDetailOpen()) closeTvDetail(); else setTv(false); }
  });
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && document.body.classList.contains('rd-tv')) setTv(false);
  });
  // TV mode: the buttons and the mouse pointer only show while the mouse is moving.
  let tvAwakeTimer = 0;
  const tvSleep = () => document.body.classList.remove('rd-tv-awake');
  document.addEventListener('mousemove', () => {
    if (!document.body.classList.contains('rd-tv')) return;
    document.body.classList.add('rd-tv-awake');
    clearTimeout(tvAwakeTimer);
    tvAwakeTimer = setTimeout(() => { if (!document.querySelector('.rd-tv-actions:hover')) tvSleep(); }, 2500);
  }, { passive: true });
  document.documentElement.addEventListener('mouseleave', tvSleep);
  setInterval(() => { const c = $('#rdTv .rd-tv-clock'); if (c) c.textContent = new Date().toLocaleTimeString('en-NZ', { hour: 'numeric', minute: '2-digit' }); }, 10000);

  // ---------------------------------------------------------------------------
  // 6. Sitting MP ("Held by") in the electorate panel, 2026 live only.
  // 2023 winners, updated for the Port Waikato (2023) and Tāmaki Makaurau (2025)
  // by-elections. Party = the party they were elected for.
  // ---------------------------------------------------------------------------
  const HELD_BY = {"Auckland Central":["Chlöe Swarbrick","GREEN PARTY"],"Bay of Plenty":["Tom Rutherford","NATIONAL PARTY"],"Botany":["Christopher Luxon","NATIONAL PARTY"],"Coromandel":["Scott Simpson","NATIONAL PARTY"],"East Coast Bays":["Erica Stanford","NATIONAL PARTY"],"Epsom":["David Seymour","ACT NEW ZEALAND"],"Hamilton East":["Ryan Hamilton","NATIONAL PARTY"],"Hamilton West":["Tama Potaka","NATIONAL PARTY"],"Kaipara ki Mahurangi":["Chris Penk","NATIONAL PARTY"],"Kelston":["Carmel Sepuloni","LABOUR PARTY"],"Māngere":["Lemauga Lydia Sosene","LABOUR PARTY"],"Manurewa":["Arena Williams","LABOUR PARTY"],"Maungakiekie":["Greg Fleming","NATIONAL PARTY"],"Mt Albert":["Helen White","LABOUR PARTY"],"Mt Roskill":["Carlos Cheung","NATIONAL PARTY"],"New Lynn":["Paulo Garcia","NATIONAL PARTY"],"North Shore":["Simon Watts","NATIONAL PARTY"],"Northcote":["Dan Bidois","NATIONAL PARTY"],"Pakuranga":["Simeon Brown","NATIONAL PARTY"],"Panmure-Ōtāhuhu":["Jenny Salesa","LABOUR PARTY"],"Papakura":["Judith Collins","NATIONAL PARTY"],"Port Waikato":["Andrew Bayly","NATIONAL PARTY"],"Rotorua":["Todd McClay","NATIONAL PARTY"],"Takanini":["Rima Nakhle","NATIONAL PARTY"],"Tāmaki":["Brooke van Velden","ACT NEW ZEALAND"],"Taranaki-King Country":["Barbara Kuriger","NATIONAL PARTY"],"Taupō":["Louise Upston","NATIONAL PARTY"],"Tauranga":["Sam Uffindell","NATIONAL PARTY"],"Te Atatū":["Phil Twyford","LABOUR PARTY"],"Upper Harbour":["Cameron Brewer","NATIONAL PARTY"],"Waikato":["Tim van de Molen","NATIONAL PARTY"],"Whangaparāoa":["Mark Mitchell","NATIONAL PARTY"],"East Coast":["Dana Kirkpatrick","NATIONAL PARTY"],"Hutt South":["Chris Bishop","NATIONAL PARTY"],"Mana":["Barbara Edmonds","LABOUR PARTY"],"Napier":["Katie Nimon","NATIONAL PARTY"],"Ōhāriu":["Greg O'Connor","LABOUR PARTY"],"Ōtaki":["Tim Costley","NATIONAL PARTY"],"Palmerston North":["Tangi Utikere","LABOUR PARTY"],"Rangitīkei":["Suze Redmayne","NATIONAL PARTY"],"Remutaka":["Chris Hipkins","LABOUR PARTY"],"Rongotai":["Julie Anne Genter","GREEN PARTY"],"Tukituki":["Catherine Wedd","NATIONAL PARTY"],"Wairarapa":["Mike Butterick","NATIONAL PARTY"],"Whanganui":["Carl Bates","NATIONAL PARTY"],"Kaikōura":["Stuart Smith","NATIONAL PARTY"],"New Plymouth":["David MacLeod","NATIONAL PARTY"],"Wellington Central":["Tamatha Paul","GREEN PARTY"],"Northland":["Grant McCallum","NATIONAL PARTY"],"Whangārei":["Shane Reti","NATIONAL PARTY"],"Banks Peninsula":["Vanessa Weenink","NATIONAL PARTY"],"Christchurch Central":["Duncan Webb","LABOUR PARTY"],"Christchurch East":["Reuben Davidson","LABOUR PARTY"],"Dunedin":["Rachel Brooking","LABOUR PARTY"],"Ilam":["Hamish Campbell","NATIONAL PARTY"],"Invercargill":["Penny Simmonds","NATIONAL PARTY"],"Nelson":["Rachel Boyack","LABOUR PARTY"],"Rangitata":["James Meager","NATIONAL PARTY"],"Selwyn":["Nicola Grigg","NATIONAL PARTY"],"Southland":["Joseph Mooney","NATIONAL PARTY"],"Taieri":["Ingrid Leary","LABOUR PARTY"],"Waimakariri":["Matt Doocey","NATIONAL PARTY"],"Waitaki":["Miles Anderson","NATIONAL PARTY"],"West Coast-Tasman":["Maureen Pugh","NATIONAL PARTY"],"Wigram":["Megan Woods","LABOUR PARTY"],"Hauraki-Waikato":["Hana-Rawhiti Maipi-Clarke","TE PĀTI MĀORI"],"Tāmaki Makaurau":["Oriini Kaipara","TE PĀTI MĀORI"],"Te Tai Hauāuru":["Debbie Ngarewa-Packer","TE PĀTI MĀORI"],"Te Tai Tokerau":["Mariameno Kapa-Kingi","TE PĀTI MĀORI"],"Waiariki":["Rawiri Waititi","TE PĀTI MĀORI"],"Ikaroa-Rāwhiti":["Cushla Tangaere-Manuel","LABOUR PARTY"],"Te Tai Tonga":["Tākuta Ferris","TE PĀTI MĀORI"]};

  function liveByName(name) {
    for (const { live } of features()) if (live.electorate_name === name) return live;
    return null;
  }

  function heldByHtml(name) {
    const live = liveByName(name);
    let held = HELD_BY[name], formerly = '';
    if (!held) {
      const prev = live?.comparison_candidate_raw?.g_electorate_name;
      if (prev && HELD_BY[prev]) { held = HELD_BY[prev]; formerly = prev; }
    }
    if (!held) {
      return `<span class="rd-held-label">Held by</span><span class="rd-held-new">New electorate · no sitting MP</span>`;
    }
    const [mp, party] = held;
    return `<span class="rd-held-label">Held by</span>
      <span class="rd-held-name">${esc(mp)}</span>
      <span class="rd-held-party" style="--c:${partyColor(party)}" title="Party they were elected for">${esc(partyLabel(party))}</span>
      ${formerly ? `<span class="rd-held-was">(as ${esc(formerly)})</span>` : ''}`;
  }

  function decorateHeldBy() {
    const live = ds() === 'EC_LIVE_2026';
    document.querySelectorAll('.popup-header').forEach(h => {
      const name = h.querySelector('h3')?.textContent.trim();
      let tag = h.querySelector('.rd-held');
      // Only electorate panels (not the "New Zealand" national summary, which uses the same header).
      const isElectorate = name && (HELD_BY[name] || liveByName(name));
      if (!live || !isElectorate) { tag?.remove(); return; }
      if (tag && tag.dataset.for === name) return;
      if (!tag) {
        tag = el('div', 'rd-held');
        const after = h.querySelector('.popup-context-label') || h.querySelector('h3');
        after.insertAdjacentElement('afterend', tag);
      }
      tag.dataset.for = name;
      tag.innerHTML = heldByHtml(name);
    });
  }

  // ---------------------------------------------------------------------------
  // 6b. Special votes (2026 live only). Election-night counts leave out special votes
  // (overseas, enrolled late, voted outside their electorate, etc.); the Electoral Commission
  // feed gives an estimate of how many there are. They're counted for the official results.
  // ---------------------------------------------------------------------------
  const OFFICIAL_RESULTS_AT = Date.parse('2026-11-27T14:00:00+13:00'); // Fri 27 Nov 2026, NZ time
  const OFFICIAL_RESULTS_LABEL = 'Fri 27 Nov';
  function specials() {
    const n = window.__rdNational;
    if (ds() !== 'EC_LIVE_2026' || !n || !(n.specials > 0) || !(n.cast > 0)) return null;
    const total = n.cast + n.specials;
    const enrolled = n.castPct > 0 ? n.cast / (n.castPct / 100) : null;
    return {
      left: n.specials, cast: n.cast, total,
      share: n.specials / total,                       // specials as a share of all votes
      ratio: n.specials / n.cast,                      // specials per vote counted so far
      turnoutNow: n.castPct, turnoutAll: enrolled ? total / enrolled * 100 : null,
      counted: Date.now() >= OFFICIAL_RESULTS_AT,
    };
  }
  function specialsNationalHtml(s) {
    if (s.counted) return `<div class="rd-spec-title">Special votes <span class="rd-spec-tag is-done">Counted</span></div>
      <div class="rd-spec-plain">All <b>${fmt(s.left)}</b> special votes are included in the official results (${OFFICIAL_RESULTS_LABEL}).</div>`;
    const sharePct = s.share * 100;
    return `<div class="rd-spec-title">Special votes <span class="rd-spec-tag">Not counted yet</span></div>
      <div class="rd-spec-big"><b>${fmt(s.left)}</b> votes still to count <small>(estimate)</small></div>
      <div class="rd-spec-bar" role="img" aria-label="${(100 - sharePct).toFixed(0)}% of votes counted, ${sharePct.toFixed(0)}% still to count"><i style="width:${(100 - sharePct).toFixed(1)}%"></i></div>
      <div class="rd-spec-legend">
        <span><i class="is-counted"></i>Counted <b>${fmt(s.cast)}</b> (${(100 - sharePct).toFixed(0)}%)</span>
        <span><i class="is-left"></i>Specials <b>${fmt(s.left)}</b> (${sharePct.toFixed(0)}%)</span>
      </div>`;
  }
  // Per electorate there's no figure, so estimate from the national ratio (it varies a lot:
  // city and student seats usually have far more specials than average).
  const SPECIALS_SWING = 0.2; // flag seats where the lead is under ~20% of their estimated specials
  function specialsSeatHtml(s, live) {
    const votes = Number(live?.total_votes) || 0;
    if (!(votes > 0) || s.counted) return '';
    const est = Math.round(votes * s.ratio / 10) * 10;
    const margin = Number(live?.margin_votes) || 0;
    const close = margin > 0 && margin < est * SPECIALS_SWING;
    const tip = `Estimate: the national rate of ${(s.ratio * 100).toFixed(1)} special votes per 100 counted. The real number varies by electorate (cities and student areas usually have more).`;
    return `<span class="rd-held-label">Special votes</span><span class="rd-spec-seat" title="${tip}">about <b>${fmt(est)}</b> still to count</span>
      ${close ? `<span class="rd-spec-warn">⚠ Lead of only ${fmt(margin)} votes: specials could change who wins</span>` : ''}`;
  }
  function decorateSpecials() {
    const s = specials();
    // National summary: a strip under the header.
    const nat = $('#mapDetailPanel .map-national-summary > .popup-header');
    let box = nat?.parentElement.querySelector(':scope > .rd-specials');
    if (!s || !nat) box?.remove();
    else {
      if (!box) { box = el('div', 'rd-specials'); nat.insertAdjacentElement('afterend', box); }
      const h = specialsNationalHtml(s);
      if (box.dataset.h !== h) { box.dataset.h = h; box.innerHTML = h; setTimeout(fitPartyRows, 0); }
    }
    // Electorate panels: a line under "Held by".
    document.querySelectorAll('.popup-header').forEach(hd => {
      const name = hd.querySelector('h3')?.textContent.trim();
      const live = name ? liveByName(name) : null;
      let tag = hd.querySelector('.rd-spec-line');
      const h = s && live ? specialsSeatHtml(s, live) : '';
      if (!h) { tag?.remove(); return; }
      if (!tag) {
        tag = el('div', 'rd-spec-line');
        (hd.querySelector('.rd-held') || hd.querySelector('.popup-context-label') || hd.querySelector('h3')).insertAdjacentElement('afterend', tag);
      }
      if (tag.dataset.h !== h) { tag.dataset.h = h; tag.innerHTML = h; }
    });
  }
  window.addEventListener('rd-national', () => { decorateSpecials(); if (document.body.classList.contains('rd-tv')) renderTv(); });

  // ---------------------------------------------------------------------------
  // 11. Pinned electorates: a faint pin icon beside the name in the electorate panel;
  // pinned seats show as small chips above the key (leader colour, margin, % counted).
  // Nothing extra appears until something is pinned. Remembered between visits.
  // ---------------------------------------------------------------------------
  const PIN_MAX = 6;
  let pins = store.get('rd-pins', []);
  const PIN_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>';

  // Every electorate's latest row, General and Māori, whichever map layer is showing.
  function allRows() {
    const out = [];
    try {
      for (const kind of ['General', 'Maori']) {
        const rows = cachedResultsRows?.[`${ds()}:${kind}:results`];
        if (Array.isArray(rows)) rows.forEach(row => out.push({ row, kind }));
      }
    } catch { /* not loaded yet */ }
    return out;
  }
  function rowByName(name) {
    const live = liveByName(name); // the map's own copy carries previous-winner data for flips
    if (live) return live;
    return allRows().find(x => x.row.electorate_name === name)?.row || null;
  }
  const isPinnable = name => !!name && !!(HELD_BY[name] || rowByName(name));

  function pinChipHtml(name) {
    const r = rowByName(name);
    const pv = (() => { try { return currentViewMode === 'partyvote'; } catch { return false; } })();
    const lead = r && (pv ? r.party_vote_leader_party : r.leader_party);
    const leadVotes = Number(r && (pv ? r.party_vote_leader_votes : r.leader_votes)) || 0;
    const margin = Number(r && (pv ? r.party_vote_margin_votes : r.margin_votes)) || 0;
    const has = lead && lead !== 'Unknown' && leadVotes > 0;
    // Leader's share of the votes counted so far (fraction in the data; fall back to votes / total).
    const shareRaw = Number(r && (pv ? r.party_vote_leader_pct : r.leader_pct));
    const totalVotes = Number(r && (pv ? r.party_vote_total_votes : r.total_votes)) || 0;
    const share = Number.isFinite(shareRaw) && shareRaw > 0 ? shareRaw * 100 : (totalVotes > 0 ? leadVotes / totalVotes * 100 : null);
    const total = Number(r?.voting_places_total) || 0;
    const pct = total > 0 ? (Number(r.voting_places_counted) || 0) / total * 100 : (r ? Number(r.reporting_pct) || 0 : null);
    let flip = false;
    try { flip = has && getMapDataResultStatus(r) === 'flipped'; } catch { /* no comparison data */ }
    return `<div class="rd-pin-chip">
      <button type="button" class="rd-pin-open" data-pin="${esc(name)}" title="Open ${esc(name)}">
        <span class="rd-pin-bar${flip ? ' is-flip' : ''}" style="--c:${has ? partyColor(lead) : '#64748b'}"></span>
        <b>${esc(name)}</b>
        <span class="rd-pin-lead">${has ? `${esc(partyLabel(lead))}${share != null ? ` <span class="rd-pin-share">${share.toFixed(0)}%</span>` : ''} · +${fmt(margin)}` : 'no votes yet'}</span>
        ${pct == null ? '' : `<span class="rd-pin-pct">${pct.toFixed(0)}% counted</span>`}
      </button>
      <button type="button" class="rd-pin-x" data-unpin="${esc(name)}" title="Unpin" aria-label="Unpin ${esc(name)}">×</button>
    </div>`;
  }

  function renderPins() {
    ensureDock();
    const box = $('#rdPins');
    if (!box) return;
    box.hidden = !pins.length;
    const html = pins.map(pinChipHtml).join('');
    if (box.innerHTML !== html) box.innerHTML = html;
  }

  function togglePin(name) {
    pins = pins.includes(name) ? pins.filter(n => n !== name) : [...pins, name].slice(-PIN_MAX);
    store.set('rd-pins', pins);
    renderPins();
    decoratePinButtons();
  }

  async function openElectorate(name) {
    const find = () => { let hit = null; try { geoJsonLayer.eachLayer(l => { if (l.feature?.properties?.live?.electorate_name === name) hit = l; }); } catch { /* no map */ } return hit; };
    let layer = find();
    if (!layer) { // pinned seat is on the other layer (General vs Māori): switch, then wait for it
      const kind = allRows().find(x => x.row.electorate_name === name)?.kind;
      document.getElementById(kind === 'Maori' ? 'maoriBtnMap' : 'generalBtnMap')?.click();
      for (let i = 0; i < 40 && !(layer = find()); i++) await new Promise(r => setTimeout(r, 100));
    }
    if (layer) layer.fire('click', { latlng: layer.getCenter(), originalEvent: new MouseEvent('click') });
  }

  function decoratePinButtons() {
    document.querySelectorAll('.popup-header h3').forEach(h3 => {
      const name = h3.textContent.trim();
      let b = h3.querySelector('.rd-pin-btn');
      if (!isPinnable(name)) { b?.remove(); return; }
      if (!b) {
        b = el('button', 'rd-pin-btn', PIN_SVG);
        b.type = 'button';
        b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); togglePin(b.dataset.for); });
        h3.appendChild(b);
      }
      const on = pins.includes(name);
      if (b.dataset.for !== name || b.classList.contains('is-pinned') !== on) {
        b.dataset.for = name;
        b.classList.toggle('is-pinned', on);
        b.title = on ? `Unpin ${name}` : `Pin ${name}`;
        b.setAttribute('aria-label', b.title);
        b.setAttribute('aria-pressed', String(on));
      }
    });
  }

  // ---------------------------------------------------------------------------
  // 12. National party list shows every party, scrolling inside the same-size box.
  // Measure the list while collapsed (8 parties + "Show N more" row), then expand it with
  // the site's own button; CSS caps the list at the measured height and hides that button.
  // ---------------------------------------------------------------------------
  let partyExpandAt = 0;
  try { localStorage.removeItem('rd-party-body-h'); } catch { /* old versions saved it; no longer used */ }
  function expandPartyList() {
    if (!window.matchMedia('(min-width: 901px)').matches) return;
    const list = $('#mapDetailPanel .map-national-results');
    const btn = list?.querySelector('[data-result-expander="map-national"]');
    if (!btn || btn.getAttribute('aria-expanded') === 'true' || Date.now() - partyExpandAt < 800) return;
    partyExpandAt = Date.now();
    btn.click();
  }

  // Shrink the party rows (all by the same factor) so every party on 4%+ of the vote fits in the
  // list without scrolling, whatever the screen size. Smaller parties stay below, scrollable.
  // Rows never grow, and never shrink below 55% so they stay readable.
  const PARTY_FIT_THRESHOLD = 0.04;
  const MIN_ROW_SCALE = 0.55;
  let naturalRowH = 0, blocBuilderH = 0;
  function fitPartyRows() {
    const body = $('#mapDetailPanel .map-national-results > .candidate-results-body');
    if (!body) return;
    const rows = [...body.querySelectorAll(':scope > .candidate-result-row')];
    if (!rows.length) return;
    // The site's bloc builder below the totals ("Majority … Left Bloc / Right Bloc"). On screens too
    // short to fit the 4%+ parties even at the smallest row size, it's hidden to make room (the
    // coalition tracker shows the same thing).
    const builder = cleanDesign ? null : $('#mapDetailPanel .map-national-coalition-popover');
    const builderShown = !!builder && builder.style.display !== 'none';
    if (builderShown) blocBuilderH = builder.offsetHeight || blocBuilderH;
    let scale = 1, hideBuilder = false;
    if (window.matchMedia('(min-width: 901px)').matches) {
      const big = (seatRows || []).filter(r => Number(r.vote_pct) > PARTY_FIT_THRESHOLD).length;
      if (!naturalRowH) {
        const prev = rows[0].style.zoom;
        rows[0].style.zoom = '';
        naturalRowH = rows[0].getBoundingClientRect().height || 0;
        rows[0].style.zoom = prev;
      }
      const availWith = builderShown ? body.clientHeight : body.clientHeight - blocBuilderH;
      const availWithout = builderShown ? body.clientHeight + blocBuilderH : body.clientHeight;
      const need = big * naturalRowH;
      if (big > 0 && naturalRowH > 0) {
        hideBuilder = !!builder && availWith < need * MIN_ROW_SCALE;
        const avail = hideBuilder ? availWithout : availWith;
        if (avail > 0) scale = Math.max(MIN_ROW_SCALE, Math.min(1, (avail - 4) / need)); // 4px slack for rounding
      }
    }
    if (builder) { const d = hideBuilder ? 'none' : ''; if (builder.style.display !== d) builder.style.display = d; }
    const z = scale >= 0.995 ? '' : scale.toFixed(3);
    for (const r of rows) if (r.style.zoom !== z) r.style.zoom = z;
  }
  window.addEventListener('resize', () => setTimeout(fitPartyRows, 100));

  // ---------------------------------------------------------------------------
  // 15. Changelog replaces the Help button in the header.
  // ---------------------------------------------------------------------------
  const CHANGELOG = [
    ['2.9.0', ['Panning no longer shows blank edges that fill in afterwards: each map layer is re-centred while you pan as the view nears the edge of what it has drawn.', 'Voting place dots now scale with the map, and the dots setting in Settings looks like a button.', 'Faster page loading, especially in Firefox: the script no longer does its rebranding work on every one of the thousands of changes the page makes while loading.']],
    ['2.8.4', ['Settings has a Voting place dots switch that cycles Off, When zoomed and Always. When zoomed also shows the dots on the open electorate at any zoom.', 'Panning shows the map as you go instead of filling in afterwards: the map layers now draw a wider margin around the view.', 'In the Māori electorates Te Pāti Māori is shown in orange so it can’t be mistaken for Labour.', 'Smoother zooming and panning with suburbs showing: a cheaper hover and click test, cached place results, and gentler mouse-wheel zoom steps.', 'Zoom in on the suburbs and each voting place gets a dot, coloured by who won there; click a dot to see that place’s results. Clicking a suburb or a dot scrolls the left panel to that row.', 'Suburb lines are shown at every zoom level again, including when zoomed right out, and the “flipped” stripes now sit under the lines instead of on top of them.', 'Settings now has a suburb line thickness slider (0 turns the lines off, 25 is the default) and a Light mode switch that leaves fonts and party colours alone. Help is shorter and lists what this script adds; the About and Legal parts are gone.', '“Counted tonight” now reads “Counted”.', 'TV mode uses the new design when it is on, and has a Suburbs button that shows every electorate’s suburbs on the TV map. Its buttons sit at the top of the sidebar and, like the mouse pointer, hide when the mouse is idle and come back when it moves, and the info below slides up into the space. The auto-tour now moves between areas instantly.']],
    ['2.8.3', ['“Areas” are now called “suburbs”, and the Suburbs button on the map always starts switched off (it is no longer remembered between visits). Opening an electorate still shows its suburbs.', 'Smoother zooming and panning with every electorate’s suburbs showing, especially in Firefox: they are redrawn once per zoom step instead of several times, drawn in far fewer steps, and the fine lines are left out when zoomed right out.', 'With suburbs showing, the diagonal “flipped” stripes are drawn over them so they stay clearly visible, and electorate borders use the same line style as the suburb borders instead of fading.']],
    ['2.8.2', ['Much smoother map: moving the mouse over the areas no longer redraws the whole map, the areas are built a few at a time so pressing the Areas button doesn’t freeze the page, and the area layer is lighter to move and zoom.']],
    ['2.8.1', ['The Electorates and Trends tabs now fill the whole window (no empty band at the bottom or gutters at the sides, and no page scroll).']],
    ['2.8.0', ['Areas on the map are redrawn: each is clipped exactly to the electorate’s outline (no stray lines), built from the voting places it contains, and they follow the map when zooming.', 'Opening an electorate always shows its areas; the Areas button now shows every electorate’s areas at once.']],
    ['2.7.1', ['Fixed: after areas were shown on the map, clicking off a region could leave the whole map unclickable.', 'The “Show areas on the map” switch moved to the map toolbar (top right in the new design, side controls in the old), and the Local results panel is shorter: five rows to start, votes beside each name, and a one-line source.']],
    ['2.7.0', ['Local results on the map: a “Show areas on the map” switch in the Local results section splits the electorate into areas coloured by who won each (the part of the electorate nearest each area’s voting places, so approximate), with details on hover. Locations come from LINZ’s NZ Addresses data.', 'Fixed advance voting compared with election day for Papakura and Southland.']],
    ['2.6.0', ['Local results: electorate panels now show how each area and voting place voted (by area or by place, candidate or party vote, advance voting compared with election day), from the Electoral Commission’s own published results by voting place.']],
    ['2.5.0', ['Hides the site’s new “Get PRO” button, its Pro promo cards and locked Area button, and the NZ / Switzerland switch. (Pro features stay Pro.)', 'Fixes for the site’s latest update: its new Settings button is no longer hidden, and the TV mode button is back.']],
    ['2.4.1', ['New design: removed the seats box from the top of the New Zealand panel.']],
    ['2.4.0', ['Faster and lighter: the full results file is no longer re-downloaded every 5 seconds (a tiny check still spots new results within a second), the script starts sooner, and it does far less work while the page updates.', 'New design: the arrow that hides and shows the top bar is visible again.']],
    ['2.3.0', ['Results are explained in plain words: the panel opens with who can govern and a seats bar, electorates open with who is winning and by how much, and changes are labelled (pts, seats, votes ahead).', 'Top bar is simpler: the seat scoreboard moved into the results panel.']],
    ['2.2.0', ['Complete redesign (the “New design” switch in the top bar still goes back to the old look): a seat scoreboard in the top bar, a new results panel for the country and each electorate, a new map toolbar, and a new neutral colour scheme and typeface across every tab.', 'The map key no longer shows over the Electorates and Trends tabs.']],
    ['2.0.2', ['Special votes box is shorter (explanation text removed) so the party list has more room.']],
    ['2.0.1', ['Special votes are explained in plain words: how many are left, counted vs still to count, what they are, and when they are counted. Close electorates say how small the lead is.']],
    ['2.0.0', ['Special votes: the New Zealand panel shows how many are still to count, their share of all votes, turnout with them included and when the official count is due; electorate panels show an estimate for that seat and flag leads they could overturn. TV mode shows the total too.']],
    ['1.9.4', ['TV mode: clicking an electorate shows its votes and candidates; × or Esc closes it.']],
    ['1.9.3', ['Pinned electorates show the leader’s share of the vote, and the counted % is labelled "counted".']],
    ['1.9.2', ['ACT is magenta instead of yellow.']],
    ['1.9.1', ['Removed the city labels from the map.']],
    ['1.9.0', ['Every party uses its own colour.', 'The party list reaches further down, and rows shrink so every party on 4% or more fits without scrolling.', 'On short screens the bloc builder under the totals is hidden to make room.']],
    ['1.8.5', ['Coalition tracker: OPP sits between the two blocs, in Opportunity’s cyan.', 'Opportunity shows in cyan across the site.', 'Removed the Coalition button from TV mode.']],
    ['1.8.4', ['Removed the update badges from the map (they covered it once results started).']],
    ['1.8.3', ['TV mode: Coalition button in the top-left corner shows the coalition tracker there.']],
    ['1.8.2', ['The Help button is now this changelog.']],
    ['1.8.1', ['TV mode fills the screen.', 'Reset view leaves a little more room around New Zealand.']],
    ['1.8.0', ['Better light mode: tinted sea, clearer grey land before results, readable highlights, and TV mode follows the theme.', 'Pinned electorates stack vertically.']],
    ['1.7.7', ['Map key back on one line.', 'Removed the old house-icon Reset button (Reset view replaces it).']],
    ['1.7.6', ['The map fit ignores pinned electorates, so they no longer shrink the map.']],
    ['1.7.4', ['New Zealand fits bigger on small laptop screens.']],
    ['1.7.3', ['The best-fit view now holds on slower machines.', 'Hiding or showing the top bar re-fits the map.']],
    ['1.7.2', ['The map uses the space beside the key.']],
    ['1.7.1', ['The starting view fits all of New Zealand as large as possible without anything covering it.']],
    ['1.7.0', ['Reset view button at the bottom of the map controls.', 'Removed the "next refresh in" countdown.']],
    ['1.6.0', ['The New Zealand panel lists every party in a scrolling list, with no "Show more" button.']],
    ['1.5.0', ['Pin electorates from their panel; pinned seats show above the map key.', 'Edge to edge on every tab.']],
    ['1.4.0', ['Works on Firefox.']],
    ['1.3.0', ['Full-window map with no footer.', 'Arrow to hide and show the top bar.', 'Map key takes the leading party’s colour.']],
    ['1.2.0', ['ResultsDeskPlus branding.', 'The page no longer shifts up and down when scrolling.']],
    ['1.1.0', ['Sitting MP ("Held by") shown in each electorate panel.']],
    ['1.0.0', ['Faster live updates, about a second after results are published.', 'Striped electorates that changed party, margin shading, last-changed badges.', 'Coalition tracker, overhang notice and TV mode.']],
  ];
  function openChangelog() {
    let modal = $('#rdChangelog');
    if (!modal) {
      modal = el('div', 'rd-cl-backdrop');
      modal.id = 'rdChangelog';
      modal.innerHTML = `
        <section class="rd-cl" role="dialog" aria-modal="true" aria-labelledby="rdClTitle">
          <header class="rd-cl-head">
            <div><h2 id="rdClTitle">Changelog</h2><p>ResultsDeskPlus v${esc(CHANGELOG[0][0])}</p></div>
            <button type="button" class="rd-cl-close" aria-label="Close changelog">×</button>
          </header>
          <div class="rd-cl-body">${CHANGELOG.map(([v, items]) => `
            <article class="rd-cl-ver"><h3>v${esc(v)}</h3><ul>${items.map(t => `<li>${esc(t)}</li>`).join('')}</ul></article>`).join('')}
          </div>
        </section>`;
      modal.addEventListener('click', e => { if (e.target === modal || e.target.closest('.rd-cl-close')) closeChangelog(); });
      document.body.appendChild(modal);
    }
    modal.hidden = false;
    modal.dataset.returnFocus = '1';
    openChangelog.returnTo = document.activeElement;
    modal.querySelector('.rd-cl-close').focus();
  }
  function closeChangelog() {
    const modal = $('#rdChangelog');
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    try { openChangelog.returnTo?.focus?.(); } catch { /* ignore */ }
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#rdChangelog') && !$('#rdChangelog').hidden) { e.stopPropagation(); closeChangelog(); } }, true);
  // ---------------------------------------------------------------------------
  // 19. Hide the site's "Get PRO" upsells and the NZ / Switzerland switch.
  // Only hides them; nothing Pro is unlocked. The site's promo opens a modal dialog, so its
  // open() is made a no-op rather than just hidden (a hidden modal would still block the page).
  // ---------------------------------------------------------------------------
  const hideHard = n => { if (n && n.style.display !== 'none') n.style.setProperty('display', 'none', 'important'); };
  let promoPatched = false, previewObserved = false;
  function hideUpsells() {
    document.querySelectorAll('.pro-header-cta, [data-pro-promo-trigger="header"], .rd-nz-country-switch, [data-map-icon="area"]').forEach(hideHard);
    const promo = window.ResultsDeskProPromo;
    if (promo && !promoPatched) {
      promoPatched = true;
      try {
        promo.open = () => {};
        promo.syncElectorateCard = () => clearPreview();
      } catch { /* object frozen: CSS still hides the card */ }
    }
    const dlg = $('#proPromoDialog');
    if (dlg?.open) { try { dlg.close(); } catch { /* ignore */ } }
    clearPreview();
    const view = $('#mapDataView');
    if (view && !previewObserved) {
      previewObserved = true;
      new MutationObserver(clearPreview).observe(view, { attributes: true, attributeFilter: ['class'] });
    }
  }
  function clearPreview() {
    const card = $('#freeProAreaPreview');
    if (card && !card.hidden) card.hidden = true;
    const view = $('#mapDataView');
    if (view?.classList.contains('has-pro-preview')) view.classList.remove('has-pro-preview');
  }

  function changelogButton() {
    const help = $('header .nav-btn[data-nav="help"]');
    if (!help) return;
    // The site's Help button became a Settings button (same data-nav="help"): keep that one.
    const isSettings = help.classList.contains('legal-settings-trigger') || /settings/i.test(help.getAttribute('aria-label') || '');
    if (isSettings) { if (help.style.display === 'none') help.style.removeProperty('display'); }
    else if (help.style.display !== 'none') help.style.setProperty('display', 'none', 'important'); // site CSS outranks a stylesheet rule
    if ($('#rdChangelogBtn')) return;
    const b = el('button', 'nav-btn rd-cl-btn', '<svg class="utility-nav-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v4l2.5 2.5"/><path d="M3.05 11a9 9 0 1 1 .5 4"/><path d="M3 4v5h5"/></svg><span>Changelog</span>');
    b.id = 'rdChangelogBtn';
    b.type = 'button';
    b.setAttribute('aria-haspopup', 'dialog');
    b.addEventListener('click', openChangelog);
    help.insertAdjacentElement('beforebegin', b);
  }

  // Repaint the map when switching light/dark (light mode uses a different "no result" grey).
  let wasLight = document.body.classList.contains('rd-light');
  new MutationObserver(() => {
    const isLight = document.body.classList.contains('rd-light');
    if (isLight === wasLight) return;
    wasLight = isLight; try { renderNewUi(); } catch { /* not ready */ }
    try { geoJsonLayer.setStyle(featureStyle); updateSelectedHighlight(); } catch { /* map not ready */ }
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  // ---------------------------------------------------------------------------
  // 13. No "next refresh in Xs" in the footer (it only adds " · …" when this is non-empty).
  // ---------------------------------------------------------------------------
  if (typeof window.formatNextRefreshStatus === 'function') window.formatNextRefreshStatus = () => '';

  // ---------------------------------------------------------------------------
  // 14. Default map view = all of New Zealand (Cape Reinga to Stewart Island) as large as
  // possible in the part of the map you can actually see: clear of the results panel on the
  // left and the controls on the right, no zoom cap. Recalculated for the current window and
  // panel. Used for the page's starting view, the site's own Reset, TV mode and our
  // "Reset view" button, which shows only when the map isn't at this view.
  // ---------------------------------------------------------------------------
  const NZ_BOUNDS = [[-47.35, 166.3], [-34.1, 178.65]]; // incl. Three Kings Islands; excl. Chathams
  // While the page loads, the site moves the map itself (sometimes late, on slow machines or
  // connections). Until the user touches the map or its controls, correct any such move back to
  // the best fit, for up to 20 s. After a user action, their view is never overridden.
  const startupUntil = Date.now() + 20000;
  let userMoved = false, lastUserAt = 0;
  const markUserMove = () => { userMoved = true; lastUserAt = Date.now(); };
  const forceDefault = () => !userMoved && Date.now() < startupUntil;
  const visibleRect = node => {
    if (!node) return null;
    const r = node.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(node).display !== 'none' && getComputedStyle(node).visibility !== 'hidden' ? r : null;
  };
  // Coastline points (sampled from the electorate shapes) so the key/pins box only blocks the
  // map where it would actually cover land, not a whole strip across the bottom.
  let landPts = null;
  function landPoints() {
    if (landPts && landPts.length) return landPts;
    const pts = [];
    const walk = ll => { if (Array.isArray(ll)) ll.forEach(walk); else if (ll && Number.isFinite(ll.lat)) pts.push(ll); };
    try { geoJsonLayer.eachLayer(l => { if (l.getLatLngs) walk(l.getLatLngs()); }); } catch { /* not drawn */ }
    const nz = L.latLngBounds(NZ_BOUNDS).pad(0.02); // drops the Chatham Islands
    const inNz = pts.filter(p => nz.contains(p));
    const step = Math.max(1, Math.floor(inNz.length / 4000));
    landPts = inNz.filter((_, i) => i % step === 0);
    return landPts;
  }
  let bestCache = { key: '', view: null };
  function bestView() {
    try {
      const m = map.getContainer().getBoundingClientRect();
      const gap = document.body.classList.contains('rd-tv') ? 16 : 24; // breathing room at the edges
      let left = gap, right = gap;
      const panel = visibleRect($('#rdPanel')) || visibleRect($('#mapDetailPanel'));
      if (panel && panel.left < m.left + m.width / 2) left = Math.max(left, panel.right - m.left + gap);
      const rail = visibleRect($('#mapMagicWallControlsRail'));
      if (rail && rail.right > m.left + m.width / 2) right = Math.max(right, m.right - rail.left + gap);
      if (left + right > m.width - 120) { left = gap; right = gap; } // too narrow to dodge them; just fit
      // The key and overhang notice are obstacles (each on its own). Pinned chips are ignored:
      // they may sit over land rather than shrink the map.
      const items = $('#rdDock') ? [...$('#rdDock').querySelectorAll(':scope > .rd-overhang, :scope > .rd-legend')] : [];
      if ($('#rdTools')) items.push($('#rdTools'));
      const boxes = items.map(visibleRect).filter(Boolean)
        .map(d => ({ l: d.left - m.left - gap, t: d.top - m.top - gap, r: d.right - m.left + gap, b: d.bottom - m.top + gap }));
      const box = boxes.length ? boxes : null;

      const key = [m.width, m.height, gap, left, right, boxes.map(b => [b.l, b.t, b.r, b.b].map(Math.round).join(',')).join(';')].join('|');
      if (bestCache.key === key && bestCache.view) return bestCache.view;

      // Fit the actual coastline (falls back to the NZ box before the shapes load) into the free
      // area. For each zoom from the largest down, try placing NZ at several spots within the
      // spare room (centred first) and take the first that keeps land off the key/notice.
      const W = m.width, H = m.height;
      const free = { l: left, r: W - right, t: gap, b: H - gap };
      const fw = free.r - free.l, fh = free.b - free.t;
      if (fw < 60 || fh < 60) return null;
      let pts = landPoints();
      const haveShapes = pts.length > 0;
      if (!haveShapes) { const nb = L.latLngBounds(NZ_BOUNDS); pts = [nb.getNorthWest(), nb.getNorthEast(), nb.getSouthWest(), nb.getSouthEast()]; }
      const p0 = pts.map(p => map.project(p, 0)); // Web Mercator: pixels at zoom z = pixels at 0 × 2^z
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of p0) { if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x; if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y; }
      const w0 = maxX - minX, h0 = maxY - minY;
      const snap = map.options.zoomSnap || 0.05;
      const rz = z => Math.round(z / snap) * snap;
      const maxZ = Number.isFinite(map.getMaxZoom()) ? map.getMaxZoom() : 18; // the site sets no max (null)
      const minZ = Number.isFinite(map.getMinZoom()) ? map.getMinZoom() : 0;
      const zFit = Math.min(maxZ, Math.floor(Math.log2(Math.min(fw / w0, fh / h0)) / snap + 1e-9) * snap);
      if (!(zFit >= minZ)) return null;
      const fracs = [0.5, 0.35, 0.65, 0.2, 0.8, 0, 1];
      const spots = fracs.flatMap(fx => fracs.map(fy => [fx, fy])).sort((a, b) => (Math.abs(a[0] - 0.5) + Math.abs(a[1] - 0.5)) - (Math.abs(b[0] - 0.5) + Math.abs(b[1] - 0.5)));
      let view = null;
      outer:
      for (let z = rz(zFit); z >= Math.max(minZ, zFit - 3); z = rz(z - snap)) {
        const s = Math.pow(2, z);
        const sx = fw - w0 * s, sy = fh - h0 * s;
        if (sx < -0.5 || sy < -0.5) continue;
        for (const [fx, fy] of spots) {
          const ox = minX * s - (free.l + fx * Math.max(0, sx)), oy = minY * s - (free.t + fy * Math.max(0, sy));
          let hit = false;
          if (boxes.length && haveShapes) {
            for (const p of p0) {
              const qx = p.x * s - ox, qy = p.y * s - oy;
              for (const bx of boxes) if (qx > bx.l && qx < bx.r && qy > bx.t && qy < bx.b) { hit = true; break; }
              if (hit) break;
            }
          }
          if (!hit) { view = { center: map.unproject(L.point(ox + W / 2, oy + H / 2), z), zoom: z }; break outer; }
          if (!boxes.length) break; // nothing to dodge: centred is best
        }
      }
      if (view && haveShapes) bestCache = { key, view }; // don't cache a fit made before the shapes loaded
      return view;
    } catch { return null; }
  }
  function atDefaultView() {
    const t = bestView();
    if (!t) return true;
    try {
      if (Math.abs(map.getZoom() - t.zoom) > 0.06) return false;
      const size = map.getSize();
      const p = map.latLngToContainerPoint(t.center);
      return Math.hypot(p.x - size.x / 2, p.y - size.y / 2) < 14;
    } catch { return true; }
  }
  let wasAtDefault = true;
  function updateResetViewBtn() {
    wasAtDefault = atDefaultView();
    const b = $('.rd-reset-view-btn');
    if (b) b.hidden = wasAtDefault;
  }
  function applyBestView(animate) {
    const t = bestView();
    if (!t) return false;
    try {
      map.stop(); // cancel any half-finished animation first
      if (animate && !document.hidden) {
        map.flyTo(t.center, t.zoom, { duration: 0.6 });
        // Land exactly even if the animation is interrupted or the tab is in the background.
        setTimeout(() => { if (!atDefaultView()) { const u = bestView(); if (u) map.setView(u.center, u.zoom, { animate: false }); } }, 900);
      } else {
        map.setView(t.center, t.zoom, { animate: false });
      }
      if (typeof setActiveRegionButton === 'function') setActiveRegionButton(null);
      if (typeof updatePoiVisibility === 'function') setTimeout(() => { try { updatePoiVisibility(); } catch { /* ignore */ } }, 50);
    } catch { return false; }
    return true;
  }
  // The site's own default/reset now uses the same best fit.
  if (typeof window.applyDefaultMapView === 'function') {
    const origDefault = window.applyDefaultMapView;
    window.applyDefaultMapView = function () {
      try { map.invalidateSize(false); } catch { /* ignore */ }
      if (!applyBestView(false)) return origDefault.apply(this, arguments);
    };
  }
  const resetView = () => applyBestView(true);
  // Anything the user does to the map or its controls counts as "they've taken over".
  ['mousedown', 'wheel', 'touchstart', 'keydown', 'dblclick'].forEach(type =>
    document.addEventListener(type, e => {
      if (e.target.closest?.('#map, #mapMagicWallControlsRail, .region-btn, .rd-pin-chip, #mapDetailPanel, .map-data-view')) {
        if (!e.target.closest('.rd-reset-view-btn')) markUserMove();
      }
    }, { capture: true, passive: true }));
  let resetViewWired = false;
  function ensureResetViewBtn() {
    const dock = $('#mapMagicWallControlsRail .map-icon-dock');
    if (!dock) return;
    let b = dock.querySelector('.rd-reset-view-btn');
    if (!b) {
      b = el('button', 'map-icon-button rd-reset-view-btn');
      b.type = 'button';
      b.dataset.mapIcon = 'rdResetView';
      b.title = 'Reset map position and zoom';
      b.setAttribute('aria-label', b.title);
      b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><circle cx="12" cy="12" r="2.2"/></svg><span>Reset view</span>';
      b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); resetView(); });
      b.hidden = true;
    }
    if (dock.lastElementChild !== b) dock.appendChild(b); // always the bottom control
    if (!resetViewWired && typeof map !== 'undefined' && map?.on) {
      resetViewWired = true;
      // Starting view: best fit, re-applied while the site is still positioning the map on load.
      setTimeout(() => applyBestView(false), 300);
      map.on('moveend', () => {
        if (forceDefault() && !atDefaultView()) applyBestView(false);
        else updateResetViewBtn();
      });
      // Window resized (or top bar hidden) while at the default view: keep it at the new default.
      map.on('resize', () => { if (wasAtDefault || forceDefault()) setTimeout(() => applyBestView(false), 0); else updateResetViewBtn(); });
      // The panel or key changing size also changes the best fit; follow it while still at default.
      setInterval(() => {
        const busy = map._animatingZoom || map._panAnim?._inProgress || map.dragging?._draggable?._moving || Date.now() - lastUserAt < 2000;
        if (!busy && (wasAtDefault || forceDefault()) && !atDefaultView()) applyBestView(false);
      }, 1500);
    }
    updateResetViewBtn();
  }

  document.addEventListener('click', e => {
    const x = e.target.closest?.('.rd-pin-x');
    if (x) { e.preventDefault(); togglePin(x.dataset.unpin); return; }
    const open = e.target.closest?.('.rd-pin-open');
    if (open) { e.preventDefault(); openElectorate(open.dataset.pin); }
  });

  // ---------------------------------------------------------------------------
  // 7. Rebrand: "ResultsDesk" -> BRAND in visible text, tab title, labels and logo.
  // The footer design credit to ResultsDesk.nz is left as-is.
  // ---------------------------------------------------------------------------
  const BRAND = 'ResultsDeskPlus';
  const BRAND_RE = /ResultsDesk(?!Plus)/g;

  function rebrandText(root) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: n => (BRAND_RE.lastIndex = 0, BRAND_RE.test(n.nodeValue) && !n.parentElement?.closest('script, style, .dashboard-footer'))
        ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const n of nodes) n.nodeValue = n.nodeValue.replace(BRAND_RE, BRAND);
  }
  function rebrandAttrs(root) {
    (root.querySelectorAll ? root.querySelectorAll('[aria-label*="ResultsDesk"], [title*="ResultsDesk"], [alt*="ResultsDesk"], [placeholder*="ResultsDesk"]') : [])
      .forEach(e => ['aria-label', 'title', 'alt', 'placeholder'].forEach(a => {
        const v = e.getAttribute(a);
        if (v && BRAND_RE.test((BRAND_RE.lastIndex = 0, v))) e.setAttribute(a, v.replace(BRAND_RE, BRAND));
      }));
  }
  function rebrandTitle() {
    if (/ResultsDesk(?!Plus)/.test(document.title)) document.title = document.title.replace(BRAND_RE, BRAND);
  }
  function rebrandLogo() {
    const a = $('.app-brand');
    if (!a || a.querySelector('.rd-brand-text')) return;
    // The site's CSS forces the logo <img> visible with !important, so hide it the same way.
    a.querySelectorAll('img').forEach(img => img.style.setProperty('display', 'none', 'important'));
    a.insertAdjacentHTML('beforeend', '<span class="rd-brand-text" aria-hidden="true">RESULTSDESK<b>PLUS</b>.NZ</span>');
  }
  function rebrandAll(root = document.body) {
    rebrandText(root);
    rebrandAttrs(document);
    rebrandTitle();
    rebrandLogo();
  }
  // ---------------------------------------------------------------------------
  // 8. Keep the desktop map view still: the page is a few px taller than the window,
  // and the site's own scrollIntoView calls would nudge it. CSS blocks wheel/touch
  // scrolling; this snaps any programmatic scroll back to the top.
  // ---------------------------------------------------------------------------
  const pinPage = () => window.matchMedia('(min-width: 901px)').matches && document.body?.dataset.dashboardView === 'map';
  window.addEventListener('scroll', () => { if (pinPage() && (window.scrollY || window.scrollX)) window.scrollTo(0, 0); }, { passive: true });

  // ---------------------------------------------------------------------------
  // 9. Full-height map + top bar show/hide arrow.
  // --rd-header-h positions the arrow under the header; --rd-map-top lets CSS size
  // the map to exactly fill the window below the header and tabs.
  // ---------------------------------------------------------------------------
  let headerHidden = store.get('rd-header-hidden', false);
  let layoutTimer = 0;
  function measureLayout() {
    const root = document.documentElement.style;
    const hdr = $('.app-header');
    root.setProperty('--rd-header-h', `${headerHidden || !hdr ? 0 : Math.round(hdr.getBoundingClientRect().height)}px`);
    const tabs = $('.dashboard-view-tabs');
    if (tabs) {
      // New design: the tabs sit inside the top bar, so the page content starts below the bar itself.
      const bar = tabs.closest('.app-header');
      const bottom = bar ? (headerHidden ? 0 : bar.getBoundingClientRect().bottom) : tabs.getBoundingClientRect().bottom;
      root.setProperty('--rd-map-top', `${Math.max(0, Math.round(bottom + window.scrollY))}px`);
    }
    try { map.invalidateSize({ pan: false }); } catch { /* map not ready */ }
  }
  // Measure now, then once more after the site's own layout code has reacted.
  function updateLayoutVars() {
    measureLayout();
    clearTimeout(layoutTimer);
    layoutTimer = setTimeout(measureLayout, 150);
  }
  function setHeaderHidden(hide) {
    // If the map is at its default view, re-fit after the map changes height.
    let keepDefault = false;
    try { keepDefault = atDefaultView() || forceDefault(); } catch { /* map not ready */ }
    headerHidden = hide;
    store.set('rd-header-hidden', hide);
    document.body.classList.toggle('rd-hide-header', hide);
    const b = $('#rdHeaderToggle');
    if (b) {
      b.title = hide ? 'Show top bar' : 'Hide top bar';
      b.setAttribute('aria-label', b.title);
      b.setAttribute('aria-expanded', String(!hide));
    }
    updateLayoutVars();
    if (keepDefault) setTimeout(() => { measureLayout(); applyBestView(false); }, 200);
  }
  function headerToggle() {
    if ($('#rdHeaderToggle') || !$('.app-header')) return;
    const b = el('button', 'rd-header-toggle', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>');
    b.id = 'rdHeaderToggle';
    b.type = 'button';
    b.addEventListener('click', () => setHeaderHidden(!headerHidden));
    document.body.appendChild(b);
    setHeaderHidden(headerHidden);
  }
  window.addEventListener('resize', updateLayoutVars);

  // ---------------------------------------------------------------------------
  // 17. New (cleaner) design, with a switch in the top bar to go back to the old one.
  // The new design is CSS under body.rd-clean, plus the view tabs moved into the top bar.
  // ---------------------------------------------------------------------------
  let cleanDesign = store.get('rd-clean', true) !== false;
  let suburbThick = Math.max(0, Math.min(100, Number(store.get('rd-suburb-thick', 25)) || 0));   // 0 = off, 100 = the full line
  let lightTheme = store.get('rd-light', false) === true;
  const DOT_MODES = ['off', 'zoom', 'always'], DOT_LABELS = { off: 'Off', zoom: 'When zoomed', always: 'Always' };
  let dotsMode = DOT_MODES.includes(store.get('rd-dots', 'off')) ? store.get('rd-dots', 'off') : 'off';
  function redrawSuburbs() {
    try { const r = Object.values(map._layers).find(l => l.options && l.options.pane === 'rdLocal' && l._redraw); if (r) r._redraw(); } catch { /* map not ready */ }
  }
  // Two switches added to the site's Settings dialog.
  function settingsExtras() {
    const body = $('.legal-settings-body');
    if (!body) return;
    const help = $('#legalSettingsHelp');
    if (help && !help.querySelector('.rd-help')) {
      help.innerHTML = `<div class="rd-help"><h4>Using the site</h4>
<p>Use the Map, Electorates and Trends tabs. Click an electorate, on the map or in the table, for its candidates, votes and margin. Switch between General and Māori with the map controls. Results refresh on their own, and we don’t call races.</p>
<h4>What ResultsDesk Plus adds</h4>
<ul>
<li><b>New design:</b> a cleaner layout. Switch back to the old one any time with the top-bar toggle.</li>
<li><b>Suburbs:</b> open an electorate to see how each suburb and voting place voted. The Suburbs button on the map shows every electorate’s suburbs at once.</li>
<li><b>Flipped seats:</b> electorates that changed hands are striped on the map.</li>
<li><b>Special votes:</b> how many are counted and how many are still to come.</li>
<li><b>Faster updates:</b> new results show within seconds.</li>
<li><b>Coalition builder, pinned electorates, TV mode and a changelog</b> are in the toolbar.</li>
</ul>
<h4>Settings</h4>
<p>Set the suburb line thickness (0 hides the lines) and switch between dark and light mode above.</p></div>`;
    }
    if (body.querySelector('.rd-set')) return;
    const sec = el('div', 'rd-set', '');
    const row = (label, get, set) => {
      const b = el('button', 'rd-set-row', `<span>${label}</span><span class="rd-switch" aria-hidden="true"><i></i></span>`);
      b.type = 'button'; b.setAttribute('role', 'switch');
      const sync = () => { b.setAttribute('aria-checked', String(get())); };
      b.addEventListener('click', () => { set(!get()); sync(); });
      sync(); return b;
    };
    const sl = el('label', 'rd-set-row rd-set-slider', `<span>Suburb line thickness</span><output>${suburbThick}</output><input type="range" min="0" max="100" step="1" value="${suburbThick}" aria-label="Suburb line thickness">`);
    const inp = sl.querySelector('input'), out = sl.querySelector('output');
    inp.addEventListener('input', () => { suburbThick = +inp.value; out.textContent = suburbThick; store.set('rd-suburb-thick', suburbThick); redrawSuburbs(); });
    sec.appendChild(sl);
    const dr = el('button', 'rd-set-row', `<span>Voting place dots</span><span class="rd-set-val"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/></svg><b>${DOT_LABELS[dotsMode]}</b></span>`);
    dr.type = 'button';
    dr.title = 'Click to change: Off, When zoomed (or on an open electorate), Always';
    dr.addEventListener('click', () => {
      dotsMode = DOT_MODES[(DOT_MODES.indexOf(dotsMode) + 1) % DOT_MODES.length];
      store.set('rd-dots', dotsMode);
      dr.querySelector('.rd-set-val b').textContent = DOT_LABELS[dotsMode];
      try { if (localDots) localDots._redraw(); } catch { /* not drawn yet */ }
    });
    sec.appendChild(dr);
    sec.appendChild(row('Light mode', () => lightTheme, v => { lightTheme = v; store.set('rd-light', v); applyDesign(); }));
    body.insertBefore(sec, body.firstChild);
  }
  // A canvas map layer only covers a bit more than the screen, so a quick pan outruns it and shows blank edges until the pan stops.
  // Re-centre (and redraw) a layer as soon as the view gets near the edge of what it has drawn, while the pan is still going.
  let freshTimer = 0;
  function keepFresh() {
    if (freshTimer) return;
    freshTimer = setTimeout(() => {
      freshTimer = 0;
      try {
        if (map._animatingZoom) return;
        const size = map.getSize(), tl = map.containerPointToLayerPoint([0, 0]), br = tl.add(size), m = Math.max(size.x, size.y) * 0.07;
        for (const r of Object.values(map._layers)) {
          if (!(r instanceof L.Canvas) || !r._bounds) continue;
          const b = r._bounds;
          if (tl.x - m < b.min.x || tl.y - m < b.min.y || br.x + m > b.max.x || br.y + m > b.max.y) r._update();
        }
      } catch { /* map busy */ }
    }, 40);
  }
  function widenCanvases() {
    try {
      if (!map.__rdFresh) { map.__rdFresh = true; map.on('move', keepFresh); }
      for (const r of Object.values(map._layers)) {
        if (r instanceof L.Canvas && !r.__rdWide) { r.__rdWide = true; if (!/^rdLocal/.test(r.options.pane || '')) { r.options.padding = 0.2; r._update(); } }
      }
    } catch { /* map not ready */ }
  }
  function applyDesign() {
    const body = document.body;
    widenCanvases();
    if (body.classList.contains('rd-light') !== lightTheme) body.classList.toggle('rd-light', lightTheme);   // the site's own dark-mode class stays, so fonts and party colours don't change
    settingsExtras();
    if (body.classList.contains('rd-clean') !== cleanDesign) body.classList.toggle('rd-clean', cleanDesign);
    const desktop = window.matchMedia('(min-width: 901px)').matches;
    const tabs = $('.dashboard-view-tabs'), inner = $('.app-header-inner'), shell = $('.dashboard-shell');
    if (tabs && inner && shell) {
      const inHeader = cleanDesign && desktop;
      if (inHeader && tabs.parentElement !== inner) inner.insertBefore(tabs, inner.querySelector('.app-header-nav'));
      if (!inHeader && tabs.parentElement !== shell) shell.insertBefore(tabs, shell.firstChild);
    }
    const b = $('#rdDesignBtn');
    if (b && b.getAttribute('aria-checked') !== String(cleanDesign)) {
      b.setAttribute('aria-checked', String(cleanDesign));
      b.title = cleanDesign ? 'Switch to the old design' : 'Switch to the new design';
    }
    // Icon-only buttons in the new design still need a name on hover.
    for (const nb of document.querySelectorAll('.app-header-nav .nav-btn:not(#rdDesignBtn)')) {
      const t = nb.querySelector('span')?.textContent.trim();
      if (t && !nb.title) nb.title = t;
    }
  }
  function setDesign(on) {
    let keepDefault = false;
    try { keepDefault = atDefaultView() || forceDefault(); } catch { /* map not ready */ }
    cleanDesign = on;
    store.set('rd-clean', on);
    applyDesign();
    renderNewUi();
    naturalRowH = 0; blocBuilderH = 0;
    updateLayoutVars();
    setTimeout(() => { measureLayout(); fitPartyRows(); if (keepDefault) applyBestView(false); }, 250);
  }
  function designToggle() {
    const nav = $('.app-header-nav');
    if (nav && !$('#rdDesignBtn')) {
      const b = el('button', 'nav-btn rd-design-btn', '<span class="rd-switch" aria-hidden="true"><i></i></span><span>New design</span>');
      b.id = 'rdDesignBtn';
      b.type = 'button';
      b.setAttribute('role', 'switch');
      b.addEventListener('click', () => setDesign(!cleanDesign));
      nav.insertBefore(b, nav.firstChild);
    }
    applyDesign();
  }
  window.addEventListener('resize', () => setTimeout(applyDesign, 0));

  // ---------------------------------------------------------------------------
  // 18. New design components (only shown with the new design on, desktop width):
  //   #rdScore  seat scoreboard in the top bar
  //   #rdPanel  results panel (national summary / electorate), replaces the site's panel
  //   #rdTools  map toolbar, replaces the site's controls rail
  // All three are drawn from the site's data; the site's own panel and rail stay in the
  // page (hidden) so its logic, and the old design, keep working.
  // ---------------------------------------------------------------------------
  const newUi = () => cleanDesign && window.matchMedia('(min-width: 901px)').matches && !document.body.classList.contains('rd-tv');
  const setHtml = (node, html) => { if (node && node.__rdHtml !== html) { node.__rdHtml = html; node.innerHTML = html; } };
  const viewMode = () => { try { return currentViewMode === 'partyvote' ? 'partyvote' : 'electorate'; } catch { return 'electorate'; } };
  const uiColor = p => { const c = partyColor(p); return /^#0{3}(0{3})?$/.test(String(c)) && !document.body.classList.contains('rd-light') ? '#5d6370' : c; };
  const pct1 = f => `${(f * 100).toFixed(1)}%`;
  const ICON = {
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
    caret: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>',
    reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>',
    people: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M2 20c0-3.3 2.7-6 6-6s6 2.7 6 6M12 14.5c1.1-.3 2.5-.5 4-.5 3.3 0 6 2.7 6 6"/></svg>',
  };

  ICON.areas = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/></svg>';
  // "BUTTERICK, Mike" -> "Mike Butterick"
  function personName(raw) {
    const s = String(raw || '').replace(/\*$/, '').trim();
    const i = s.indexOf(',');
    if (i < 0) return s;
    let sur = s.slice(0, i).trim();
    if (sur === sur.toUpperCase() || /^Mc[A-Z]/.test(sur)) {
      sur = sur.toLowerCase().replace(/(^|[\s\-'’])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).replace(/^Mc(\p{L})/u, (m, a) => 'Mc' + a.toUpperCase());
    }
    return `${s.slice(i + 1).trim()} ${sur}`;
  }
  const changeHtml = (pts, digits = 1, unit = '') => {
    if (!Number.isFinite(pts) || Math.abs(pts) < (digits ? 0.05 : 0.5)) return '';
    return `<span class="rdn-chg ${pts > 0 ? 'is-up' : 'is-down'}">${pts > 0 ? '▲' : '▼'} ${Math.abs(pts).toFixed(digits)}${unit}</span>`;
  };

  // ----- seats summary (top of the national panel) -----
  const listWords = names => names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  const blocWords = b => listWords(b.name.split(' · '));
  function seatsHtml(st) {
    if (!st.total) return '';
    const LB = blocByKey(st, 'left'), RB = blocByKey(st, 'right'), mid = st.blocs.filter(b => b.middle);
    const seg = m => `<i style="flex:${m.seats};background:${uiColor(m.party)}" title="${esc(partyLabel(m.party))}: ${m.seats} seats"></i>`;
    const segs = [...LB.members.map(seg), '<u></u>', ...mid.flatMap(b => b.members).map(seg), ...st.others.map(seg), '<u></u>', ...[...RB.members].reverse().map(seg)].join('');
    const win = [LB, RB].find(b => b.seats >= st.majority);
    const best = [LB, RB].sort((x, y) => y.seats - x.seats)[0];
    const headline = win
      ? `<b>${esc(blocWords(win))}</b> have enough seats to govern`
      : `No group has enough seats to govern yet. <b>${esc(blocWords(best))}</b> are ${st.majority - best.seats} short`;
    const side = (b, cls) => `<span class="rdn-seats-side ${cls}${b === win ? ' is-win' : ''}"><b>${b.seats}</b><em>${esc(b.name)}</em></span>`;
    const midSeats = st.total - LB.seats - RB.seats;
    return `<button type="button" class="rdn-seats" data-rdn="coalition" title="Open the coalition tracker">
        <span class="rdn-headline">${headline}</span>
        <span class="rdn-seats-top">${side(LB, 'is-left')}${side(RB, 'is-right')}</span>
        <span class="rd-score-bar">${segs}<s></s></span>
        <span class="rdn-seats-mid">${st.majority} of ${st.total} seats needed to govern${midSeats > 0 ? ` · ${midSeats} with other parties` : ''}</span>
      </button>`;
  }
  function renderScore() { $('#rdScore')?.remove(); }

  // ----- results panel -----
  let panelExpanded = false, panelFor = '';
  const META_KEY = /^(g_|electorate_|updated_at$|last_reported_at$|REPORTING$|VOTING_|ec_stats$|TOTAL$|__)/;
  const partyVotes = raw => Object.entries(raw || {}).filter(([k, v]) => typeof v === 'number' && !META_KEY.test(k));

  function selectedElectorate() {
    const p = $('#mapDetailPanel');
    if (!p || !p.classList.contains('has-result')) return null;
    const h3 = p.querySelector('.popup-header h3');
    const name = h3 ? [...h3.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim() || h3.textContent.trim() : '';
    const live = name ? liveByName(name) : null;
    return live ? { name, live } : null;
  }

  function specialsRowHtml() {
    const s = specials();
    if (!s) return '';
    if (s.counted) return `<div class="rdn-note"><i class="is-done"></i><span><b>${fmt(s.left)}</b> special votes counted</span></div>`;
    return `<div class="rdn-note" title="Counted ${fmt(s.cast)} (${(100 - s.share * 100).toFixed(0)}%) · special votes ${fmt(s.left)} (${(s.share * 100).toFixed(0)}%)"><i></i><span><b>${fmt(s.left)}</b> special votes still to count<small>Official result ${OFFICIAL_RESULTS_LABEL}</small></span></div>`;
  }

  function rowHtml(r, max) {
    return `<div class="rdn-row${r.lead ? ' is-lead' : ''}" style="--c:${r.color}">
      <div class="rdn-who"><span class="rdn-name">${esc(r.name)}${r.tag ? `<em>${esc(r.tag)}</em>` : ''}</span><span class="rdn-sub">${r.sub}</span></div>
      <div class="rdn-num"><b>${r.a}</b><span>${r.aSub || ''}</span></div>
      <div class="rdn-num is-big"><b>${r.b}</b><span>${r.bSub || ''}</span></div>
      <div class="rdn-bar"><i style="width:${max > 0 ? Math.max(0.6, (r.share / max) * 100).toFixed(1) : 0}%"></i></div>
    </div>`;
  }
  const moreHtml = n => n > 0 ? `<button type="button" class="rdn-more" data-rdn="more">${panelExpanded ? 'Show fewer' : `Show ${n} more`}</button>` : '';

  function nationalHtml() {
    const rows = (seatRows || []).filter(r => Number(r.votes) > 0 || Number(r.total_seats) > 0)
      .sort((a, b) => Number(b.votes || 0) - Number(a.votes || 0));
    // Changes since the last election, read from the site's own (hidden) panel when it has them.
    const chg = {};
    document.querySelectorAll('#mapDetailPanel .candidate-result-row[data-row-key^="NZ::"]').forEach(n => {
      const read = sel => { const t = n.querySelector(sel)?.textContent.trim() || ''; const v = parseFloat(t.replace(/[^\d.]/g, '')); return Number.isFinite(v) ? (t.includes('▼') ? -v : v) : NaN; };
      chg[n.dataset.rowKey.slice(4)] = { v: read('.map-national-vote-change'), s: read('.map-national-seat-change') };
    });
    const main = rows.filter(r => Number(r.total_seats) > 0 || Number(r.vote_pct) >= PARTY_FIT_THRESHOLD);
    const rest = rows.filter(r => !main.includes(r));
    const shown = panelExpanded ? rows : main;
    const max = Math.max(0, ...rows.map(r => Number(r.vote_pct) || 0));
    const list = shown.map(r => {
      const elect = Number(r.general_electorate_seats || 0) + Number(r.maori_electorate_seats || 0);
      const c = chg[r.party] || {};
      return rowHtml({
        name: partyLabel(r.party), color: uiColor(r.party), share: Number(r.vote_pct) || 0,
        sub: `${fmt(r.votes)} votes${elect ? ` · ${elect} electorate${elect === 1 ? '' : 's'}` : ''}`,
        a: pct1(Number(r.vote_pct) || 0), aSub: changeHtml(c.v, 1, ' pts'),
        b: Number(r.total_seats || 0), bSub: changeHtml(c.s, 0),
      }, max);
    }).join('');
    const pct = countedPct();
    const st = seatState();
    const year = String(ds()).match(/\d{4}/)?.[0] || '';
    let label = ''; try { label = DATASETS[ds()]?.label || ''; } catch { /* ignore */ }
    const updated = $('#mapDetailPanel [data-live-refresh-status]')?.textContent.trim() || '';
    return `<header class="rdn-head">
        <div class="rdn-kicker">${esc(label || year)}${pct == null ? '' : ` · ${pct.toFixed(pct >= 99.95 ? 0 : 1)}% counted`}</div>
        <h2>New Zealand</h2>
        ${pct == null ? '' : `<div class="rdn-progress"><i style="width:${Math.min(100, pct).toFixed(1)}%"></i></div>`}
      </header>
      ${specialsRowHtml()}
      <div class="rdn-cols"><span>Party</span><span>Party vote</span><span>Seats</span></div>
      <div class="rdn-list">${list || '<div class="rdn-empty">Waiting for results…</div>'}${moreHtml(rest.length)}</div>
      <footer class="rdn-foot">${updated ? `<span>${esc(updated)}</span>` : ''}<span>▲▼ compared with the last election</span></footer>`;
  }

  function electorateHtml({ name, live }) {
    const pv = viewMode() === 'partyvote';
    const prev = pv ? live.comparison_party_vote_raw : live.comparison_candidate_raw;
    const prevTotal = Number(prev?.TOTAL) || 0;
    let entries;
    if (pv) {
      entries = partyVotes(live.party_vote_raw).map(([party, votes]) => ({ party, votes, name: partyLabel(party), sub: '' }));
    } else if (Array.isArray(live.candidate_entries) && live.candidate_entries.length) {
      entries = live.candidate_entries.map(c => ({ party: c.party, votes: Number(c.votes) || 0, name: personName(c.candidate_name), tag: c.incumbent ? 'MP' : '', sub: esc(partyLabel(c.party)) }));
    } else {
      entries = partyVotes(live.raw).map(([party, votes]) => ({ party, votes, name: personName(live.candidates?.[party] || partyLabel(party)), sub: esc(partyLabel(party)) }));
    }
    entries = entries.filter(e => e.votes > 0 || !pv).sort((a, b) => b.votes - a.votes);
    const total = Number(pv ? live.party_vote_total_votes : live.total_votes) || entries.reduce((s, e) => s + e.votes, 0);
    const max = total > 0 && entries[0] ? entries[0].votes / total : 0;
    const LIMIT = 6;
    const shown = panelExpanded ? entries : entries.slice(0, LIMIT);
    const list = shown.map((e, i) => {
      const share = total > 0 ? e.votes / total : 0;
      const was = prevTotal > 0 && typeof prev[e.party] === 'number' ? prev[e.party] / prevTotal : NaN;
      return rowHtml({
        name: e.name, tag: e.tag, color: uiColor(e.party), share, lead: i === 0 && e.votes > 0,
        sub: e.sub || (Number.isFinite(was) ? `${pct1(was)} last time` : ''),
        a: pct1(share), aSub: changeHtml((share - was) * 100, 1, ' pts'),
        b: fmt(e.votes), bSub: i === 0 && entries[1] && e.votes > 0 ? `${fmt(e.votes - entries[1].votes)} ahead` : '',
      }, max);
    }).join('');

    const lead = entries[0], margin = lead && entries[1] ? lead.votes - entries[1].votes : 0;
    const placesTotal = Number(live.voting_places_total) || 0;
    const counted = placesTotal > 0 ? (Number(live.voting_places_counted) || 0) / placesTotal * 100 : Number(live.reporting_pct) || 0;
    let status = ''; try { status = getMapDataResultStatus(live); } catch { /* no comparison data */ }
    let chip = '', headline = '';
    const done = counted >= 99.95;
    if (lead && lead.votes > 0 && !pv) {
      const who = esc(partyLabel(lead.party));
      const word = !done ? (status === 'flipped' ? 'ahead (gain)' : 'ahead') : status === 'flipped' ? 'gain' : status === 'held' ? 'hold' : 'win';
      chip = `<span class="rdn-chip${status === 'flipped' ? ' is-flip' : ''}" style="--c:${uiColor(lead.party)}">${who} ${word}</span>`;
      const verb = !done ? 'is leading' : status === 'flipped' ? `has taken the seat for ${who}` : status === 'held' ? `has kept the seat for ${who}` : 'has won';
      headline = `<b>${esc(lead.name)}</b> ${verb}${margin > 0 ? `, ${fmt(margin)} votes ahead of ${esc(entries[1].name)}` : ''}`;
    } else if (lead && lead.votes > 0) {
      headline = `<b>${esc(lead.name)}</b> ${done ? 'won' : 'is winning'} the party vote here${margin > 0 ? ` by ${fmt(margin)} votes` : ''}`;
    }
    const liveSet = ds() === 'EC_LIVE_2026';
    const s = specials();
    const est = s && !s.counted && !pv ? Math.round((Number(live.total_votes) || 0) * s.ratio / 10) * 10 : 0;
    const close = est > 0 && margin > 0 && margin < est * SPECIALS_SWING;
    const pinned = pins.includes(name);
    const turnout = Number(live.ec_stats?.turnoutPct);
    return `<header class="rdn-head">
        <div class="rdn-topline">
          <button type="button" class="rdn-back" data-rdn="back">${ICON.back}<span>New Zealand</span></button>
          <button type="button" class="rdn-pin${pinned ? ' is-on' : ''}" data-rdn="pin" title="${pinned ? 'Unpin' : 'Pin'} ${esc(name)}" aria-pressed="${pinned}">${PIN_SVG}</button>
        </div>
        <div class="rdn-kicker">${pv ? 'Party vote' : 'Candidate vote'} · ${counted.toFixed(counted >= 99.95 ? 0 : 1)}% counted</div>
        <h2>${esc(name)}</h2>
        <div class="rdn-progress"><i style="width:${Math.min(100, counted).toFixed(1)}%"></i></div>
        ${headline ? `<div class="rdn-headline">${headline}</div>` : ''}
        <div class="rdn-meta">${chip}${liveSet ? `<span class="rdn-held">${heldByHtml(name)}</span>` : ''}</div>
      </header>
      ${est > 0 ? `<div class="rdn-note${close ? ' is-warn' : ''}" title="Estimate from the national rate of special votes; the real number varies by electorate"><i></i><span>About <b>${fmt(est)}</b> special votes still to count${close ? `<small>The lead of ${fmt(margin)} could change</small>` : ''}</span></div>` : ''}
      <div class="rdn-cols"><span>${pv ? 'Party' : 'Candidate'}</span><span>Share of votes</span><span>Votes</span></div>
      <div class="rdn-list">${list || '<div class="rdn-empty">No votes counted yet</div>'}${moreHtml(entries.length - LIMIT)}${localSectionHtml({ name, live })}</div>
      <footer class="rdn-foot"><span>${fmt(total)} votes</span>${Number.isFinite(turnout) && turnout > 0 ? `<span>${turnout.toFixed(1)}% turnout</span>` : ''}<span>▲▼ compared with the last election</span></footer>`;
  }

  function renderPanel() {
    const wrap = $('#mapWrap');
    if (!wrap) return;
    let p = $('#rdPanel');
    if (!p) {
      p = el('section', 'rd-panel');
      p.id = 'rdPanel';
      p.setAttribute('aria-label', 'Results');
      p.addEventListener('click', e => {
        const a = e.target.closest('[data-rdn]');
        if (!a) return;
        e.preventDefault(); e.stopPropagation();
        if (a.dataset.rdn === 'more') { panelExpanded = !panelExpanded; renderPanel(); }
        if (a.dataset.rdn === 'back') { try { hideFeaturePopup(); updateSelectedHighlight(); } catch { /* ignore */ } renderPanel(); }
        if (a.dataset.rdn === 'coalition') toggleCoalition();
        if (a.dataset.rdn === 'pin' && panelFor) { togglePin(panelFor); renderPanel(); }
      });
      wrap.appendChild(p);
    }
    if (!newUi()) { document.body.classList.remove('rd-own-panel'); return; }
    const sel = selectedElectorate();
    const key = sel ? sel.name : '';
    if (key !== panelFor) { panelFor = key; panelExpanded = false; p.scrollTop = 0; }
    let html = '';
    try { html = sel ? electorateHtml(sel) : nationalHtml(); } catch (err) { html = ''; console.warn('[ResultsDesk Plus] panel', err); }
    // If our panel can't be drawn (site data changed shape), fall back to the site's own panel.
    document.body.classList.toggle('rd-own-panel', !!html);
    p.classList.toggle('is-electorate', !!sel);
    setHtml(p, html);
  }

  // ----- map toolbar -----
  let toolsMenu = '';
  const REGIONS = [['resetZoomBtn', 'All of New Zealand'], ['viewAucklandBtn', 'Auckland'], ['viewHamiltonBtn', 'Hamilton'], ['viewTaurangaBtn', 'Tauranga'], ['viewWellingtonBtn', 'Wellington'], ['viewChristchurchBtn', 'Christchurch'], ['viewDunedinBtn', 'Dunedin']];
  function datasetList() {
    const out = [];
    try {
      for (const [k, v] of Object.entries(DATASETS)) {
        if (/^(EC_DEMO|SANDBOX|TEST|2026)$/.test(k)) continue;
        out.push({ k, label: v.label || k, by: /^BY/.test(k) });
      }
    } catch { /* not ready */ }
    const rank = d => d.k === 'EC_LIVE_2026' ? 9999 : d.by ? 0 : Number(d.k) || 1;
    return out.sort((a, b) => rank(b) - rank(a));
  }
  function renderTools() {
    const wrap = $('#mapWrap');
    if (!wrap) return;
    let t = $('#rdTools');
    if (!t) {
      t = el('div', 'rd-tools');
      t.id = 'rdTools';
      t.setAttribute('role', 'toolbar');
      t.setAttribute('aria-label', 'Map controls');
      t.addEventListener('click', e => {
        const a = e.target.closest('[data-t]');
        if (!a) return;
        e.preventDefault(); e.stopPropagation();
        const [act, arg] = a.dataset.t.split(':');
        if (act === 'menu') { toolsMenu = toolsMenu === arg ? '' : arg; renderTools(); return; }
        toolsMenu = '';
        if (act === 'mode') document.getElementById(arg === 'partyvote' ? 'partyBtnMap' : 'candidateBtnMap')?.click();
        if (act === 'layer') document.getElementById(arg === 'Maori' ? 'maoriBtnMap' : 'generalBtnMap')?.click();
        if (act === 'ds') { try { window.switchDataset(arg); } catch { /* ignore */ } }
        if (act === 'region') { if (arg === 'resetZoomBtn') applyBestView(true); else document.getElementById(arg)?.click(); }
        if (act === 'zoom') { try { arg === 'in' ? map.zoomIn() : map.zoomOut(); } catch { /* ignore */ } }
        if (act === 'reset') $('.rd-reset-view-btn')?.click();
        if (act === 'areas') toggleLocalMap();
        if (act === 'coalition') toggleCoalition();
        setTimeout(() => { renderTools(); renderPanel(); }, 60);
      });
      document.addEventListener('click', e => { if (toolsMenu && !e.target.closest?.('#rdTools')) { toolsMenu = ''; renderTools(); } });
      wrap.appendChild(t);
    }
    const rail = $('#mapMagicWallControlsRail');
    if (rail) { const want = newUi() ? 'none' : ''; if (rail.style.display !== want) { if (want) rail.style.setProperty('display', 'none', 'important'); else rail.style.removeProperty('display'); } }
    if (!newUi()) return;
    const mode = viewMode();
    const maori = !!$('#maoriBtnMap.active') || $('#layerSelect')?.value === 'Maori';
    let label = ''; try { label = DATASETS[ds()]?.label || String(ds()); } catch { /* ignore */ }
    const moved = (() => { const b = $('.rd-reset-view-btn'); return !!b && !b.hidden && b.style.display !== 'none'; })();
    const seg = (act, val, text, on) => `<button type="button" data-t="${act}:${val}" class="${on ? 'is-on' : ''}" aria-pressed="${on}">${text}</button>`;
    const menu = (id, items) => toolsMenu === id ? `<div class="rd-tools-menu" role="menu">${items}</div>` : '';
    const dsItems = datasetList().map((d, i, all) => `${d.by && !all[i - 1]?.by ? '<div class="rd-tools-sep">By-elections</div>' : ''}<button type="button" role="menuitem" data-t="ds:${esc(d.k)}" class="${d.k === ds() ? 'is-on' : ''}">${esc(d.label)}</button>`).join('');
    const regionItems = REGIONS.map(([id, text]) => `<button type="button" role="menuitem" data-t="region:${id}">${text}</button>`).join('');
    setHtml(t, `
      <div class="rd-tools-group has-menu"><button type="button" class="rd-tools-drop" data-t="menu:ds" aria-haspopup="menu" aria-expanded="${toolsMenu === 'ds'}">${esc(label)}${ICON.caret}</button>${menu('ds', dsItems)}</div>
      <div class="rd-tools-group rd-seg">${seg('mode', 'electorate', 'Candidate', mode === 'electorate')}${seg('mode', 'partyvote', 'Party', mode === 'partyvote')}</div>
      <div class="rd-tools-group rd-seg">${seg('layer', 'General', 'General', !maori)}${seg('layer', 'Maori', 'Māori', maori)}</div>
      <div class="rd-tools-group has-menu"><button type="button" class="rd-tools-drop" data-t="menu:region" aria-haspopup="menu" aria-expanded="${toolsMenu === 'region'}">Go to${ICON.caret}</button>${menu('region', regionItems)}</div>
      <div class="rd-tools-group rd-tools-icons">
        <button type="button" data-t="zoom:out" title="Zoom out" aria-label="Zoom out">${ICON.minus}</button>
        <button type="button" data-t="zoom:in" title="Zoom in" aria-label="Zoom in">${ICON.plus}</button>
        <button type="button" data-t="reset:1" title="Reset view" aria-label="Reset view"${moved ? '' : ' disabled'}>${ICON.reset}</button>
        <button type="button" data-t="areas:1" class="${localMapOn ? 'is-on' : ''}" title="Show all suburbs on map" aria-label="Show all suburbs on map" aria-pressed="${localMapOn}">${ICON.areas}</button>
        <button type="button" data-t="coalition:1" class="${coalOpen ? 'is-on' : ''}" title="Coalition tracker" aria-label="Coalition tracker" aria-pressed="${coalOpen}">${ICON.people}</button>
      </div>`);
  }

  function renderNewUi() {
    renderScore();
    renderPanel();
    renderTools();
  }
  window.addEventListener('rd-national', () => renderPanel());
  window.addEventListener('resize', () => setTimeout(renderNewUi, 0));

  // ---------------------------------------------------------------------------
  // 20. Local results: how each area and voting place voted (2026 live only).
  // The Electoral Commission publishes votes by voting place as one PDF per electorate; they were turned into
  // data by tools/build_local_data.py and travel inside this script as RD_LOCAL_DATA (the site's security
  // policy stops the page loading them from elsewhere). An electorate is unpacked when it is first opened.
  // ---------------------------------------------------------------------------
  const localData = new Map();                              // slug -> data | 'loading' | 'none'
  let localView = store.get('rd-local-view', 'area');       // 'area' | 'place'
  let localExpanded = false;
  const MOBILE_TEAMS = 'Hospitals, care homes and mobile teams';
  const slugOf = name => String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const asciiUpper = s => String(s || '').normalize('NFD').replace(/[^A-Za-z]/g, '').toUpperCase();

  async function unpackLocal(packed) {
    const [len, s] = [+packed.slice(0, packed.indexOf(':')), packed.slice(packed.indexOf(':') + 1)];
    const idx = {};
    for (let i = 0; i < RD_B85.length; i++) idx[RD_B85[i]] = i;
    const bytes = new Uint8Array(Math.ceil(len / 4) * 4);
    for (let i = 0, o = 0; i < s.length; i += 5, o += 4) {
      let v = 0;
      for (let k = 0; k < 5; k++) v = v * 85 + idx[s[i + k]];
      bytes[o] = v >>> 24; bytes[o + 1] = (v >>> 16) & 255; bytes[o + 2] = (v >>> 8) & 255; bytes[o + 3] = v & 255;
    }
    const stream = new Blob([bytes.subarray(0, len)]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    const [meta, loc, venue, sec, pv, cv, xs, ys] = (await new Response(stream).text()).split('\u0001');
    const m = JSON.parse(meta), L = loc.split('\n'), V = venue.split('\n'), S = sec.split('\n');
    const PV = pv.split(';'), CV = cv.split(';'), X = xs.split(','), Y = ys.split(',');
    let px = 0, py = 0;
    m.R = L.slice(0, m.N).map((l, i) => {
      let lon = null, lat = null;
      if (X[i] !== '') { px += +X[i]; py += +Y[i]; lon = px / 1e4; lat = py / 1e4; }
      return [l, V[i], +S[i], PV[i].split(',').map(Number), CV[i].split(',').map(Number), lon, lat];
    });
    return m;
  }
  function localFor(name) {
    if (ds() !== 'EC_LIVE_2026' || typeof RD_LOCAL_DATA === 'undefined') return null;
    const slug = slugOf(name);
    const have = localData.get(slug);
    if (have) return have;
    if (!RD_LOCAL_DATA[slug] || typeof DecompressionStream === 'undefined') { localData.set(slug, 'none'); return 'none'; }
    localData.set(slug, 'loading');
    unpackLocal(RD_LOCAL_DATA[slug])
      .then(d => localData.set(slug, d), () => localData.set(slug, 'none'))
      .then(() => { try { const sel = selectedElectorate(); if (sel && slugOf(sel.name) === slug) { renderPanel(); decorateLocalOld(); } syncLocalMapSoon(); } catch { /* ignore */ } });
    return 'loading';
  }

  // One entry per column of the vote table: a candidate or a party, with its name and colour.
  function localColumns(d, mode, live) {
    if (mode === 'partyvote') return d.P.map(p => ({ label: partyLabel(p), sub: '', color: uiColor(p) }));
    const entries = Array.isArray(live?.candidate_entries) ? live.candidate_entries : [];
    return d.C.map(([party, sur]) => {
      const e = entries.find(x => asciiUpper(String(x.candidate_name).split(',')[0]) === sur && (!party || x.party === party)) || entries.find(x => asciiUpper(String(x.candidate_name).split(',')[0]) === sur);
      const label = e ? personName(e.candidate_name) : sur.charAt(0) + sur.slice(1).toLowerCase();
      return { label, sub: party ? partyLabel(party) : '', color: uiColor(party || 'INDEPENDENT') };
    });
  }
  const sumVotes = (rows, n) => { const v = new Array(n).fill(0); for (const r of rows) for (let i = 0; i < n; i++) v[i] += r.votes[i] || 0; return v; };
  function leaderOf(votes) {
    let best = -1, total = 0;
    votes.forEach((x, i) => { total += x; if (best < 0 || x > votes[best]) best = i; });
    return { i: best, total, share: total > 0 && best >= 0 ? votes[best] / total : 0, top: best >= 0 ? votes[best] : 0 };
  }
  const SHORT_MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function localBarHtml(votes, cols, total) {
    if (!(total > 0)) return '<span class="rdl-bar is-empty"></span>';
    const order = votes.map((v, i) => i).sort((a, b) => votes[b] - votes[a]);
    const top = order.slice(0, 3).filter(i => votes[i] > 0);
    const rest = total - top.reduce((s, i) => s + votes[i], 0);
    const seg = (w, c, t) => `<i style="width:${(w * 100).toFixed(2)}%;background:${c}" title="${esc(t)}"></i>`;
    return `<span class="rdl-bar">${top.map(i => seg(votes[i] / total, cols[i].color, `${cols[i].label} ${(votes[i] / total * 100).toFixed(0)}%`)).join('')}${rest > 0 ? seg(rest / total, 'var(--l-faint)', `Others ${(rest / total * 100).toFixed(0)}%`) : ''}</span>`;
  }

  function localSectionHtml(sel) {
    const d = localFor(sel.name);
    if (!d || d === 'none') return '';
    if (d === 'loading') return '<section class="rdl"><div class="rdl-head"><h4>Local results</h4></div><div class="rdl-empty">Loading…</div></section>';
    const mode = viewMode();
    const an = localAnalysis(d, mode, sel.live);
    if (!an) return '';
    const { cols, n, rows, areas } = an;

    // plain-words summary: who won most areas
    const wins = new Map();
    for (const a of areas) wins.set(a.i, (wins.get(a.i) || 0) + 1);
    const ranked = [...wins.entries()].sort((a, b) => b[1] - a[1]);
    const pick = ranked.slice(0, 3).map(([i, c]) => `<b>${esc(cols[i].label)}</b> ${c}`).join(' · ');
    const summary = areas.length > 1
      ? `Winner of each of the ${areas.length} suburbs: ${pick}${ranked.length > 3 ? ' …' : ''}`
      : '';

    // advance voting compared with election day
    const bySec = [0, 1].map(s => { const rs = rows.filter(r => r.sec === s); const v = sumVotes(rs, n); return { s, ...leaderOf(v) }; }).filter(x => x.total > 0);
    const secHtml = bySec.length === 2 && bySec[0].i !== bySec[1].i
      ? `<p class="rdl-summary">Advance voting went to <b>${esc(cols[bySec[0].i].label)}</b> (${(bySec[0].share * 100).toFixed(0)}%), election day to <b>${esc(cols[bySec[1].i].label)}</b> (${(bySec[1].share * 100).toFixed(0)}%)</p>` : '';

    const LIMIT = 5;
    let list;
    if (localView === 'place') {
      const places = rows.filter(r => r.total > 0).map(r => ({ ...r, ...leaderOf(r.votes) })).sort((a, b) => b.total - a.total);
      const shown = localExpanded ? places : places.slice(0, LIMIT);
      list = shown.map(p => {
        const title = p.loc ? (p.venue || p.loc) : p.venue;
        const where = p.loc && p.venue ? p.loc : '';
        return `<div class="rdl-row" data-rdk="p:${p.ri}" style="--c:${cols[p.i].color}" title="${esc(where)}${where ? ' · ' : ''}${p.sec === 0 ? 'advance voting' : 'election day'}">
          <div class="rdl-main"><span class="rdl-name">${esc(title)}<small>${fmt(p.total)}</small></span><span class="rdl-win"><i></i>${esc(cols[p.i].label)} <b>${(p.share * 100).toFixed(0)}%</b></span></div>
          ${localBarHtml(p.votes, cols, p.total)}
        </div>`;
      }).join('');
      var more = places.length - LIMIT, noun = 'places';
    } else {
      const shown = localExpanded ? areas : areas.slice(0, LIMIT);
      list = shown.map(a => `<div class="rdl-row" data-rdk="a:${esc(a.name)}" style="--c:${cols[a.i].color}" title="${a.places} voting place${a.places === 1 ? '' : 's'}">
          <div class="rdl-main"><span class="rdl-name">${esc(a.name)}<small>${fmt(a.total)}</small></span><span class="rdl-win"><i></i>${esc(cols[a.i].label)} <b>${(a.share * 100).toFixed(0)}%</b></span></div>
          ${localBarHtml(a.votes, cols, a.total)}
        </div>`).join('');
      var more = areas.length - LIMIT, noun = 'suburbs';
    }
    const kind = String(d.k || 'Preliminary results');
    const when = d.p ? `${+d.p.slice(8, 10)} ${SHORT_MONTH[+d.p.slice(5, 7) - 1] || ''}` : '';
    const prelim = /prelim/i.test(kind);
    return `<section class="rdl">
      <div class="rdl-head"><h4>Local results</h4>
        <span class="rdl-seg" role="group" aria-label="Group by">
          <button type="button" data-rdl="view:area" class="${localView === 'area' ? 'is-on' : ''}" aria-pressed="${localView === 'area'}">By suburb</button>
          <button type="button" data-rdl="view:place" class="${localView === 'place' ? 'is-on' : ''}" aria-pressed="${localView === 'place'}">By place</button>
        </span></div>
      ${summary ? `<p class="rdl-summary">${summary}</p>` : ''}
      ${secHtml}
      <div class="rdl-list">${list}</div>
      ${more > 0 ? `<button type="button" class="rdl-more" data-rdl="all">${localExpanded ? 'Show fewer' : `Show all ${more + LIMIT} ${noun}`}</button>` : ''}
      <p class="rdl-src" title="Places with fewer than 6 votes show as zero. Map suburbs are the part of the electorate nearest each suburb’s voting places, so they are approximate.">Electoral Commission ${esc(kind.toLowerCase())}${when ? ` (${when})` : ''}${prelim ? ', before special votes' : ''}. Map locations: LINZ NZ Addresses (CC BY 4.0).</p>
    </section>`;
  }

  // Everything about one electorate's voting places for the chosen vote type (candidate or party).
  function localAnalysis(d, mode, live) {
    const cols = localColumns(d, mode, live);
    const n = cols.length;
    const rows = d.R.map(([loc, venue, sec, pv, cv, x, y], ri) => {
      const votes = mode === 'partyvote' ? pv : cv;
      return { loc, venue, sec, votes, total: votes.reduce((a, b) => a + b, 0), x, y, ri };
    });
    if (!(sumVotes(rows, n).reduce((a, b) => a + b, 0) > 0)) return null;
    // group voting places into areas (suburb or town); care-home and hospital teams go together
    const groups = new Map();
    for (const r of rows) {
      const key = r.loc || MOBILE_TEAMS;
      if (!groups.has(key)) groups.set(key, { name: key, rows: [] });
      groups.get(key).rows.push(r);
    }
    const areas = [...groups.values()].map(g => {
      const votes = sumVotes(g.rows, n);
      return { name: g.name, places: g.rows.length, rows: g.rows, votes, ...leaderOf(votes) };
    }).filter(a => a.total > 0).sort((a, b) => b.total - a.total);
    return { cols, n, rows, areas };
  }

  // ----- local results on the map -----
  // Every voting place inside an electorate claims the ground nearest to it (a Voronoi diagram of the places) and
  // places in the same area are joined, so an area's region is the sum of its places' cells. Everything is drawn on one
  // canvas clipped to the electorate's own outline, so nothing can spill outside it and the coastline is exact.
  // Open electorate: its areas always show. The Areas button shows every electorate's areas at once.
  let localMapOn = false;                       // the Suburbs button always starts off (an older version remembered it)
  try { localStorage.removeItem('rd-local-map'); } catch { /* no storage */ }
  const localItems = new Map();                 // electorate name -> geometry + cells, built once its data is unpacked
  let localRenderer = null, localHi = null, localDots = null, localPop = null, localKey = '', localSyncTimer = 0;
  let localHover = null, localTip = null, localMoveTimer = 0, localMoveAt = null;

  const electorateGeom = name => {
    let g = null;
    try { geoJsonLayer.eachLayer(l => { if (!g && l.feature?.properties?.live?.electorate_name === name) g = l.feature.geometry; }); } catch { /* map not drawn yet */ }
    return g;
  };
  // Map positions are kept as Web Mercator "world" coordinates (zoom 0), which only need scaling to reach the screen.
  const worldPt = (lon, lat) => { const p = map.project(L.latLng(lat, lon), 0); return [p.x, p.y]; };
  function ringHasF(r, x, y) {
    let inside = false;
    for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
      const xi = r[i], yi = r[i + 1], xj = r[j], yj = r[j + 1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  const inParts = (parts, x, y) => parts.some(pt => x >= pt.bb[0] && x <= pt.bb[2] && y >= pt.bb[1] && y <= pt.bb[3] &&
    ringHasF(pt.rings[0], x, y) && !pt.rings.slice(1).some(h => ringHasF(h, x, y)));

  // Clip a convex polygon to the side nx*x + ny*y <= c. Each vertex is [x, y, owner of the edge to the next vertex].
  function clipOwned(poly, nx, ny, c, owner) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const da = nx * a[0] + ny * a[1] - c, db = nx * b[0] + ny * b[1] - c;
      if (da <= 0) {
        out.push(a);
        if (db > 0) { const t = da / (da - db); out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), owner]); }   // leaving: new edge starts here
      } else if (db < 0) {
        const t = da / (da - db); out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), a[2]]);                     // coming back in
      }
    }
    return out;
  }
  function voronoiCells(seeds, bb) {
    const pad = Math.max(bb[2] - bb[0], bb[3] - bb[1]) * 0.05 + 1e-6;
    const box = [[bb[0] - pad, bb[1] - pad, -1], [bb[2] + pad, bb[1] - pad, -1], [bb[2] + pad, bb[3] + pad, -1], [bb[0] - pad, bb[3] + pad, -1]];
    return seeds.map((s, i) => {
      let poly = box.map(v => v.slice()), reach = Infinity;
      const order = seeds.map((t, j) => [(t.x - s.x) ** 2 + (t.y - s.y) ** 2, j]).filter(t => t[1] !== i).sort((a, b) => a[0] - b[0]);
      for (let m = 0; m < order.length && order[m][0] <= 4 * reach; m++) {          // far seeds cannot change this cell
        const j = order[m][1], o = seeds[j];
        poly = clipOwned(poly, o.x - s.x, o.y - s.y, (o.x * o.x + o.y * o.y - s.x * s.x - s.y * s.y) / 2, j);
        if (poly.length < 3) break;
        if (m >= 2) { reach = 0; for (const v of poly) { const d2 = (v[0] - s.x) ** 2 + (v[1] - s.y) ** 2; if (d2 > reach) reach = d2; } }
      }
      return poly;
    });
  }

  function buildLocalItem(name, d) {
    const geom = electorateGeom(name);
    if (!geom) return null;
    const polys = geom.type === 'MultiPolygon' ? geom.coordinates : [geom.coordinates];
    let x0 = 1e18, y0 = 1e18, x1 = -1e18, y1 = -1e18;
    const parts = polys.map(poly => {
      const rings = poly.map(r => { const a = new Float64Array(r.length * 2); for (let i = 0; i < r.length; i++) { const p = worldPt(r[i][0], r[i][1]); a[2 * i] = p[0]; a[2 * i + 1] = p[1]; } return a; });
      let a = 1e18, b = 1e18, c = -1e18, e = -1e18;
      const o = rings[0];
      for (let i = 0; i < o.length; i += 2) { if (o[i] < a) a = o[i]; if (o[i] > c) c = o[i]; if (o[i + 1] < b) b = o[i + 1]; if (o[i + 1] > e) e = o[i + 1]; }
      x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, c); y1 = Math.max(y1, e);
      return { rings, bb: [a, b, c, e] };
    });
    // seeds: the voting places inside this electorate (places at the same spot are one seed)
    const seeds = [], seen = new Set(), places = [];
    d.R.forEach((row, ri) => {
      const loc = row[0], lon = row[5], lat = row[6];
      if (!loc || lon == null) return;
      const [x, y] = worldPt(lon, lat);
      if (!inParts(parts, x, y)) return;
      places.push({ x, y, ri });
      const key = Math.round(x * 4e5) + ',' + Math.round(y * 4e5);
      if (seen.has(key)) return;
      seen.add(key);
      seeds.push({ x, y, area: loc });
    });
    const bb = [x0, y0, x1, y1];
    const polys2 = seeds.length ? voronoiCells(seeds, bb) : [];
    const cells = polys2.map((pts, i) => {
      let a = 1e18, b = 1e18, c = -1e18, e = -1e18;
      for (const v of pts) { if (v[0] < a) a = v[0]; if (v[0] > c) c = v[0]; if (v[1] < b) b = v[1]; if (v[1] > e) e = v[1]; }
      return { pts, bb: [a, b, c, e], area: seeds[i].area, sx: seeds[i].x, sy: seeds[i].y };
    });
    // lines are only drawn where two different areas meet
    const borders = [];
    polys2.forEach((pts, i) => {
      for (let k = 0; k < pts.length; k++) {
        const o = pts[k][2];
        if (o < 0 || seeds[o].area === seeds[i].area) continue;
        const b = pts[(k + 1) % pts.length];
        borders.push([pts[k][0], pts[k][1], b[0], b[1], seeds[i].area]);
      }
    });
    const byArea = new Map();
    for (const e of borders) { const l = byArea.get(e[4]); if (l) l.push(e); else byArea.set(e[4], [e]); }
    return {
      name, d, bb, parts, cells, borders, byArea, places, live: liveByName(name), _st: null,
      isFlipped() { try { return getMapDataResultStatus(liveByName(this.name) || this.live) === 'flipped'; } catch { return false; } },
      style(mode) {
        if (this._st && this._st.mode === mode) return this._st.map;
        const an = localAnalysis(this.d, mode, liveByName(this.name) || this.live);
        const map2 = new Map();
        if (an) for (const a of an.areas) {
          const share = Math.max(0, Math.min(1, (a.share - 0.3) / 0.4));         // 30% of the vote = faint, 70% = strong
          map2.set(a.name, { color: an.cols[a.i].color, op: 0.32 + 0.5 * share,
            html: `<b>${esc(a.name)}</b><br>${esc(an.cols[a.i].label)} ${(a.share * 100).toFixed(0)}%<br>${fmt(a.total)} votes · ${a.places} voting place${a.places === 1 ? '' : 's'}` });
        }
        const groups = new Map();
        for (const cell of this.cells) {
          const st = map2.get(cell.area);
          if (!st) continue;
          const op = Math.round(st.op * 12) / 12, key = st.color + '|' + op;
          let g = groups.get(key);
          if (!g) { g = { color: st.color, op, cells: [] }; groups.set(key, g); }
          g.cells.push(cell);
        }
        map2.groups = [...groups.values()];
        this._st = { mode, map: map2 };
        return map2;
      },
    };
  }

  // Leaflet requests a redraw more than once per zoom or pan; do it once, before the browser paints.
  function redrawOnce() {
    if (this._rdQueued) return;
    this._rdQueued = true;
    queueMicrotask(() => { this._rdQueued = false; if (this._map) L.Canvas.prototype._redraw.call(this); });
  }
  const outlinePath = (it, sc, o) => {                           // the electorate's outline, thinned to what a screen can show
    const path = new Path2D();
    for (const part of it.parts) for (const ring of part.rings) {
      let lx = 0, ly = 0;
      for (let i = 0; i < ring.length; i += 2) {
        const x = ring[i] * sc - o.x, y = ring[i + 1] * sc - o.y;
        if (i === 0) path.moveTo(x, y);
        else if (Math.abs(x - lx) >= 0.5 || Math.abs(y - ly) >= 0.5) path.lineTo(x, y); else continue;
        lx = x; ly = y;
      }
      path.closePath();
    }
    return path;
  };
  // Diagonal stripes for electorates that changed hands, the same look as the site's own, drawn over the areas.
  let hatchPat = null;
  function hatchFor(ctx) {
    if (hatchPat) return hatchPat;
    const n = 12, c = document.createElement('canvas');
    c.width = c.height = n;
    const x = c.getContext('2d');
    x.strokeStyle = 'rgba(10,14,24,0.72)'; x.lineWidth = 3.4; x.lineCap = 'square';
    x.beginPath();
    for (const k of [-n, 0, n]) { x.moveTo(k, n); x.lineTo(k + n, 0); }
    x.stroke();
    hatchPat = ctx.createPattern(c, 'repeat');
    return hatchPat;
  }

  // Drawing: runs inside Leaflet's own canvas machinery, so it is cleared, repositioned and scaled with the map.
  // Only what is on screen is drawn, and it only redraws when the map stops moving or the data changes.
  function drawLocal() {
    const items = this.items || [];
    if (!items.length) return;
    const map2 = this._map, ctx = this._ctx, b = this._bounds;
    const sc = map2.getZoomScale(map2.getZoom(), 0), o = map2.getPixelOrigin();
    const vx0 = b.min.x, vy0 = b.min.y, vx1 = b.max.x, vy1 = b.max.y, zoom = map2.getZoom();
    for (const it of items) {
      if (it.bb[2] * sc - o.x < vx0 || it.bb[0] * sc - o.x > vx1 || it.bb[3] * sc - o.y < vy0 || it.bb[1] * sc - o.y > vy1) continue;
      const style = it.style(this.mode);
      const outline = outlinePath(it, sc, o);
      ctx.save();
      ctx.clip(outline, 'evenodd');
      for (const g of style.groups) {                                                 // one fill per colour, not one per cell
        ctx.beginPath();
        let any = false;
        for (const cell of g.cells) {
          const cb = cell.bb;
          if (cb[2] * sc - o.x < vx0 || cb[0] * sc - o.x > vx1 || cb[3] * sc - o.y < vy0 || cb[1] * sc - o.y > vy1) continue;
          any = true;
          const pts = cell.pts;
          for (let k = 0; k < pts.length; k++) { const x = pts[k][0] * sc - o.x, y = pts[k][1] * sc - o.y; if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
          ctx.closePath();
        }
        if (any) { ctx.globalAlpha = g.op; ctx.fillStyle = g.color; ctx.fill(); }
      }
      ctx.globalAlpha = 1;
      if (it.isFlipped()) { ctx.fillStyle = hatchFor(ctx); ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0); }   // stripes sit under the lines
      if (suburbThick > 0) {                                                          // suburb lines are drawn at every zoom
        ctx.beginPath();
        for (const e of it.borders) {
          const ax = e[0] * sc - o.x, ay = e[1] * sc - o.y, bx = e[2] * sc - o.x, by = e[3] * sc - o.y;
          if ((ax < vx0 && bx < vx0) || (ax > vx1 && bx > vx1) || (ay < vy0 && by < vy0) || (ay > vy1 && by > vy1)) continue;
          ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
        }
        ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 0.9 * suburbThick / 100; ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 0.9; ctx.stroke(outline);                    // electorate border, same as the suburb borders
    }
  }
  // The area under the mouse is outlined on its own small canvas, so moving the mouse never redraws the whole map of areas.
  function drawLocalHi() {
    const h = this.hover;
    if (!h) return;
    const edges = h.it.byArea.get(h.area);
    if (!edges) return;
    const map2 = this._map, ctx = this._ctx;
    const sc = map2.getZoomScale(map2.getZoom(), 0), o = map2.getPixelOrigin();
    ctx.save();
    ctx.clip(outlinePath(h.it, sc, o), 'evenodd');
    ctx.beginPath();
    for (const e of edges) { ctx.moveTo(e[0] * sc - o.x, e[1] * sc - o.y); ctx.lineTo(e[2] * sc - o.x, e[3] * sc - o.y); }
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.4; ctx.stroke();
    ctx.restore();
  }

  // Voting places: a dot on each one once zoomed in; click a dot for that place's results.
  const DOT_ZOOM = 12.5;
  // Off: never. When zoomed: once zoomed in, and always on the open electorate. Always: everywhere.
  const dotsFor = (it, z, openName) => dotsMode === 'always' || (dotsMode === 'zoom' && (z >= DOT_ZOOM || it.name === openName));
  const openElectorateName = () => { try { return selectedElectorate()?.name || null; } catch { return null; } };
  const placeAnalysis = (it, mode) => {
    const live = liveByName(it.name) || it.live;
    if (it._pa && it._pa.mode === mode && it._pa.live === live) return it._pa.an;
    const an = localAnalysis(it.d, mode, live);
    it._pa = { mode, live, an };
    return an;
  };
  function drawDots() {
    const rd = localRenderer, map2 = this._map, ctx = this._ctx;
    if (!rd || dotsMode === 'off') return;
    const openName = openElectorateName();
    const sc = map2.getZoomScale(map2.getZoom(), 0), o = map2.getPixelOrigin();
    const b = this._bounds, vx0 = b.min.x - 8, vy0 = b.min.y - 8, vx1 = b.max.x + 8, vy1 = b.max.y + 8;
    const z = map2.getZoom(), r = Math.max(1.8, Math.min(12, 3.2 * Math.pow(2, z - 13.5)));   // grows and shrinks with the map
    for (const it of rd.items) {
      const bx0 = it.bb[0] * sc - o.x, bx1 = it.bb[2] * sc - o.x, by0 = it.bb[1] * sc - o.y, by1 = it.bb[3] * sc - o.y;
      if (bx1 < vx0 || bx0 > vx1 || by1 < vy0 || by0 > vy1 || !dotsFor(it, map2.getZoom(), openName)) continue;
      const an = placeAnalysis(it, rd.mode);
      if (!an) continue;
      for (const p of it.places) {
        const x = p.x * sc - o.x, y = p.y * sc - o.y;
        if (x < vx0 || x > vx1 || y < vy0 || y > vy1) continue;
        const row = an.rows[p.ri], lead = leaderOf(row.votes);
        ctx.beginPath(); ctx.arc(x, y, r + 1.2, 0, 6.2832); ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fill();
        ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fillStyle = lead.i >= 0 && row.total > 0 ? an.cols[lead.i].color : '#94a3b8'; ctx.fill();
        ctx.lineWidth = 1.4; ctx.strokeStyle = '#fff'; ctx.stroke();
      }
    }
  }
  function nearestDot(latlng) {
    const rd = localRenderer;
    if (!rd || dotsMode === 'off') return null;
    const openName = openElectorateName(), z = map.getZoom();
    const w = map.project(latlng, 0), sc = map.getZoomScale(map.getZoom(), 0);
    const reach = Math.max(8, Math.min(14, 3.2 * Math.pow(2, z - 13.5) + 4)) / sc, r2 = reach * reach;   // a bit more than the dot's size, in map units
    let best = null, bd = r2;
    for (const it of rd.items) {
      if (w.x < it.bb[0] - reach || w.x > it.bb[2] + reach || w.y < it.bb[1] - reach || w.y > it.bb[3] + reach || !dotsFor(it, z, openName)) continue;
      for (const p of it.places) {
        const dx = p.x - w.x, dy = p.y - w.y, d2 = dx * dx + dy * dy;
        if (d2 < bd) { bd = d2; best = { it, p }; }
      }
    }
    return best;
  }
  function placeHtml(hit) {
    const an = placeAnalysis(hit.it, localRenderer.mode);
    if (!an) return '';
    // places at the very same spot (a venue with several booths) are listed together
    const same = hit.it.places.filter(q => Math.abs(q.x - hit.p.x) < 1e-6 && Math.abs(q.y - hit.p.y) < 1e-6).map(q => an.rows[q.ri]);
    return same.map(r => {
      const tot = r.total || 0;
      const top = r.votes.map((v, i) => ({ v, i })).filter(t => t.v > 0).sort((a, b) => b.v - a.v).slice(0, 5);
      return `<div class="rdl-place"><b>${esc(r.venue || r.loc)}</b><small>${esc(r.loc || '')}${r.sec ? ' · ' + esc(r.sec) : ''}</small>
        ${top.map(t => `<div class="rdl-prow"><i style="background:${an.cols[t.i].color}"></i><span>${esc(an.cols[t.i].label)}</span><b>${tot ? Math.round(t.v / tot * 100) : 0}%</b><em>${fmt(t.v)}</em></div>`).join('') || '<div class="rdl-prow"><span>No votes counted yet</span></div>'}
        <small>${fmt(tot)} votes counted here</small></div>`;
    }).join('');
  }
  // Scroll the left panel to the row for a clicked suburb or voting place and flash it.
  function revealLocal(itemName, kind, key) {
    setTimeout(() => {
      try {
        const sel = selectedElectorate();
        if (!sel || sel.name !== itemName) return;
        const view = kind === 'a' ? 'area' : 'place';
        if (localView !== view || !localExpanded) { localView = view; store.set('rd-local-view', view); localExpanded = true; renderPanel(); decorateLocalOld(); }
        setTimeout(() => {
          const row = [...document.querySelectorAll('.rdl-row[data-rdk]')].find(r => r.dataset.rdk === key);
          if (!row) return;
          row.scrollIntoView({ block: 'center', behavior: 'smooth' });
          row.classList.add('rdl-flash');
          setTimeout(() => row.classList.remove('rdl-flash'), 1900);
        }, 80);
      } catch { /* panel not ready */ }
    }, 350);
  }
  function areaAt(latlng) {
    const rd = localRenderer;
    if (!rd) return null;
    const pt = map.project(latlng, 0);
    for (const it of rd.items) {
      if (pt.x < it.bb[0] || pt.x > it.bb[2] || pt.y < it.bb[1] || pt.y > it.bb[3] || !inParts(it.parts, pt.x, pt.y)) continue;
      let best = Infinity, area = null;
      for (const c of it.cells) { const d2 = (c.sx - pt.x) ** 2 + (c.sy - pt.y) ** 2; if (d2 < best) { best = d2; area = c.area; } }
      return area ? { it, area } : null;
    }
    return null;
  }
  function onDotClick(e) {
    if (!localRenderer) return;
    let ll; try { ll = map.mouseEventToLatLng(e); } catch { return; }
    const hit = nearestDot(ll);
    if (!hit) {                                          // a click on a suburb (not a dot): scroll the panel to it
      if (map.getZoom() >= 9) { const a = areaAt(ll); if (a) revealLocal(a.it.name, 'a', 'a:' + a.area); }
      return;
    }
    let sameOpen = false;
    try { sameOpen = selectedElectorate()?.name === hit.it.name; } catch { /* none */ }
    if (sameOpen) { e.stopPropagation(); e.preventDefault(); }
    const html = placeHtml(hit);
    if (!html) return;
    const at = map.unproject(L.point(hit.p.x, hit.p.y), 0);
    if (!localPop) localPop = L.popup({ className: 'rdl-pop', offset: [0, -6], maxWidth: 280, autoPanPadding: [60, 60] });
    localPop.setLatLng(at).setContent(html).openOn(map);
    revealLocal(hit.it.name, 'p', 'p:' + hit.p.ri);
  }
  function setLocalHover(found) {
    if (!localRenderer) return;
    if (!localHi) {
      if (!map.getPane('rdLocalHi')) { map.createPane('rdLocalHi'); map.getPane('rdLocalHi').style.zIndex = 461; }
      map.getPane('rdLocalHi').style.pointerEvents = 'none';
      const Hi = L.Canvas.extend({ _draw: drawLocalHi, _redraw: redrawOnce });
      localHi = new Hi({ pane: 'rdLocalHi', padding: 0.2 });
      map.addLayer(localHi);
    }
    localHi.hover = found;
    localHi._redraw();
  }
  function hideLocalTip() {
    if (localTip) { try { map.removeLayer(localTip); } catch { /* not open */ } }
    if (localHover) { localHover = null; setLocalHover(null); }
  }
  // The areas ignore the mouse (so they can never block a click); hover is worked out from the map's own mouse position.
  function onLocalMove(e) {
    localMoveAt = e.latlng;
    if (localMoveTimer) return;
    localMoveTimer = setTimeout(() => {
      localMoveTimer = 0;
      const ll = localMoveAt, rd = localRenderer;
      if (!ll || !rd) return;
      const p = map.project(ll, 0);
      let found = null;
      for (const it of rd.items) {
        if (p.x < it.bb[0] || p.x > it.bb[2] || p.y < it.bb[1] || p.y > it.bb[3] || !inParts(it.parts, p.x, p.y)) continue;
        let best = Infinity, area = null;
        for (const c of it.cells) { const d2 = (c.sx - p.x) ** 2 + (c.sy - p.y) ** 2; if (d2 < best) { best = d2; area = c.area; } }
        const info = area && it.style(rd.mode).get(area);
        if (info) found = { it, area, html: (rd.items.length > 1 ? `<small>${esc(it.name)}</small><br>` : '') + info.html };
        break;
      }
      try { map.getContainer().style.cursor = nearestDot(ll) ? 'pointer' : ''; } catch { /* ignore */ }
      if (!found) { hideLocalTip(); return; }
      if (!localHover || localHover.it !== found.it || localHover.area !== found.area) { localHover = found; setLocalHover(found); }
      if (!localTip) localTip = L.tooltip({ className: 'rdl-tip', direction: 'top', offset: [0, -4], opacity: 1 });
      localTip.setContent(found.html).setLatLng(ll);
      if (!map.hasLayer(localTip)) localTip.addTo(map);
    }, 40);
  }

  function dropLocalLayer() {
    hideLocalTip();
    if (localRenderer) { try { map.removeLayer(localRenderer); } catch { /* gone */ } localRenderer = null; }
    if (localHi) { try { map.removeLayer(localHi); } catch { /* gone */ } localHi = null; }
    if (localDots) { try { map.removeLayer(localDots); } catch { /* gone */ } localDots = null; }
    try { map.getContainer().removeEventListener('click', onDotClick, true); if (localPop) map.closePopup(localPop); map.getContainer().style.cursor = ''; } catch { /* no map */ }
    localKey = '';
    try { map.off('mousemove', onLocalMove).off('mouseout', hideLocalTip); } catch { /* no map */ }
  }
  const syncLocalMapSoon = (ms = 60) => { clearTimeout(localSyncTimer); localSyncTimer = setTimeout(() => { try { syncLocalMap(); } catch { /* ignore */ } }, ms); };

  function syncLocalMap() {
    let names = [];
    try {
      if (ds() === 'EC_LIVE_2026' && typeof map !== 'undefined') {
        if (localMapOn) names = features().map(f => f.live.electorate_name);              // every electorate on the map
        else { const sel = selectedElectorate(); if (sel) names = [sel.name]; }             // just the open one
      }
    } catch { /* not ready */ }
    const items = [];
    let more = false, built = 0;
    const t0 = performance.now();
    for (const nm of names) {
      const d = localFor(nm);                                                              // unpacks on first use, then calls back
      if (!d || d === 'none' || d === 'loading') continue;
      let it = localItems.get(nm);
      if (!it) {
        if (built > 0 && performance.now() - t0 > 10) { more = true; continue; }          // a few at a time, so the page stays responsive
        it = buildLocalItem(nm, d); built++;
        if (it) localItems.set(nm, it);
      }
      if (it) items.push(it);
    }
    if (more) syncLocalMapSoon(16);
    if (!items.length) { dropLocalLayer(); return; }
    const mode = viewMode(), key = items.map(i => i.name).join('|') + '#' + mode;
    if (key === localKey && localRenderer && map.hasLayer(localRenderer)) return;
    if (!localRenderer) {
      if (!map.getPane('rdLocal')) { map.createPane('rdLocal'); map.getPane('rdLocal').style.zIndex = 460; }
      map.getPane('rdLocal').style.pointerEvents = 'none';
      const Regions = L.Canvas.extend({ _draw: drawLocal, _redraw: redrawOnce });
      localRenderer = new Regions({ pane: 'rdLocal', padding: 0.2 });                     // a small margin: a bigger canvas just costs more to move
      map.addLayer(localRenderer);
      map.on('mousemove', onLocalMove).on('mouseout', hideLocalTip);
      try { map.options.wheelPxPerZoomLevel = 100; map.options.wheelDebounceTime = 25; } catch { /* ignore */ }
      if (!map.getPane('rdLocalDots')) { map.createPane('rdLocalDots'); map.getPane('rdLocalDots').style.zIndex = 462; }
      map.getPane('rdLocalDots').style.pointerEvents = 'none';
      const Dots = L.Canvas.extend({ _draw: drawDots, _redraw: redrawOnce });
      localDots = new Dots({ pane: 'rdLocalDots', padding: 0.2 });
      map.addLayer(localDots);
      map.getContainer().addEventListener('click', onDotClick, true);
    }
    localRenderer.items = items; localRenderer.mode = mode;
    hideLocalTip();
    localKey = key;
    localRenderer._redraw();
    if (localDots) localDots._redraw();
  }

  function toggleLocalMap() {
    localMapOn = !localMapOn;
    try { renderTools(); ensureAreasBtn(); syncLocalMap(); } catch { /* ignore */ }
  }
  // Old design: a button in the site's side controls, next to Coalition.
  function ensureAreasBtn() {
    const dock = $('#mapMagicWallControlsRail .map-icon-dock');
    if (!dock) return;
    let b = dock.querySelector('.rd-areas-btn');
    if (!b) {
      b = el('button', 'map-icon-button rd-areas-btn');
      b.type = 'button';
      b.dataset.mapIcon = 'rdAreas';
      b.title = 'Show all suburbs on map';
      b.innerHTML = ICON.areas.replace('<svg ', '<svg width="20" height="20" ') + '<span>Suburbs</span>';
      b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); toggleLocalMap(); });
      dock.insertBefore(b, dock.querySelector('.rd-coal-btn'));
    }
    b.classList.toggle('active', localMapOn);
    b.setAttribute('aria-pressed', String(localMapOn));
  }

  // Old design: the site's own panel is showing, so add the section to it.
  function decorateLocalOld() {
    const panel = $('#mapDetailPanel');
    let box = $('#rdLocalOld');
    const sel = panel && !document.body.classList.contains('rd-own-panel') && !document.body.classList.contains('rd-tv') ? selectedElectorate() : null;
    const html = sel ? localSectionHtml(sel) : '';
    if (!html) { box?.remove(); return; }
    const pop = panel.querySelector('.popup');
    if (!pop) return;
    if (!box) { box = el('div', 'rdl-old'); box.id = 'rdLocalOld'; }
    const foot = pop.querySelector('.popup-footer');                 // some panels have a footer; the electorate panel does not
    if (foot) { if (box.parentElement !== pop || box.nextElementSibling !== foot) foot.insertAdjacentElement('beforebegin', box); }
    else if (box.parentElement !== pop || box.nextElementSibling) pop.appendChild(box);
    setHtml(box, html);
  }
  document.addEventListener('click', e => {
    const a = e.target.closest?.('[data-rdl]');
    if (!a) return;
    e.preventDefault(); e.stopPropagation();
    const [act, arg] = a.dataset.rdl.split(':');
    if (act === 'view') { localView = arg === 'place' ? 'place' : 'area'; store.set('rd-local-view', localView); localExpanded = false; }
    if (act === 'all') localExpanded = !localExpanded;
    try { renderPanel(); decorateLocalOld(); syncLocalMap(); } catch { /* ignore */ }
  }, true);


  // ---------------------------------------------------------------------------
  // 10. Key colour follows the leading party (most seats, then most votes); blue by default.
  // ---------------------------------------------------------------------------
  function updateKeyColour(st) {
    let lead = st.parties.find(p => p.seats > 0) ? st.parties[0].party : null;
    if (!lead) {
      const byVotes = (seatRows || []).filter(r => Number(r.votes) > 0).sort((a, b) => Number(b.votes) - Number(a.votes));
      lead = byVotes[0]?.party || null;
    }
    const c = lead ? partyColor(lead) : null;
    const root = document.documentElement.style;
    if (c && typeof c === 'string') root.setProperty('--rd-key', c); else root.removeProperty('--rd-key');
    const lg = $('#rdLegend');
    if (lg) lg.title = lead ? `Key colour: ${partyLabel(lead)} (currently leading)` : '';
  }

  rebrandAll();
  // The page changes thousands of times while it loads, so changes are queued and handled together every 80 ms.
  const brandQueue = new Map();
  let brandTimer = 0;
  function flushBrand() {
    brandTimer = 0;
    const items = [...brandQueue]; brandQueue.clear();
    for (const [n, kind] of items) {
      if (!n || !n.isConnected) continue;
      if (kind === 'c') { if (BRAND_RE.test((BRAND_RE.lastIndex = 0, n.nodeValue))) rebrandText(n.parentElement); }
      else if (kind === 'e') { rebrandText(n); rebrandAttrs(n); }
      else if (n.parentElement) rebrandText(n.parentElement);
    }
    rebrandTitle();
    rebrandLogo();
  }
  new MutationObserver(muts => {
    for (const m of muts) {
      if (m.type === 'characterData') brandQueue.set(m.target, 'c');
      else m.addedNodes.forEach(n => { if (n.nodeType === 1) brandQueue.set(n, 'e'); else if (n.nodeType === 3) brandQueue.set(n, 't'); });
    }
    if (!brandTimer) brandTimer = setTimeout(flushBrand, 80);
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  // ---------------------------------------------------------------------------
  // Hook into the app
  // ---------------------------------------------------------------------------
  function wrap(name, after) {
    const orig = window[name];
    if (typeof orig !== 'function' || orig.__rdWrapped) return false;
    const w = function (...args) {
      const r = orig.apply(this, args);
      const done = () => { try { after(args); } catch (e) { console.warn('[rd extras]', name, e); } };
      if (r && typeof r.then === 'function') r.then(done, done); else done();
      return r;
    };
    w.__rdWrapped = true;
    window[name] = w;
    return true;
  }

  function init() {
    wrap('renderSeatSummary', args => { seatRows = Array.isArray(args[0]) ? args[0] : []; renderSeatsUi(); });
    wrap('refreshMap', scanChanges);
    wrap('switchDataset', () => { prints = new Map(); changes = new Map(); printsDataset = null; setTimeout(scanChanges, 1500); });
    try { seatRows = Array.isArray(lastSeatSummaryRows) ? lastSeatSummaryRows : []; } catch { /* not yet */ }
    buildLegend();
    tvButton();
    changelogButton();
    headerToggle();
    updateLayoutVars();
    renderSeatsUi();
    scanChanges();
    decorateHeldBy(); decorateSpecials();
    decoratePinButtons();
    renderPins();
    expandPartyList();
    fitPartyRows();
    // Repaint once so the party colours apply to anything drawn before the script loaded.
    try { geoJsonLayer.setStyle(featureStyle); updateSelectedHighlight(); } catch { /* map not drawn yet */ }
    try { if (Array.isArray(lastSeatSummaryRows) && lastSeatSummaryRows.length) renderSeatSummary(lastSeatSummaryRows); } catch { /* ignore */ }
    ensureResetViewBtn();
    designToggle();
    hideUpsells();
    // The site changes the page many times a second (animated numbers, map redraws). Run our
    // upkeep at most once per 120 ms: straight away if it has been quiet, otherwise once at the end.
    const upkeep = () => { decorateLocalOld(); syncLocalMap(); hideUpsells(); ensureCoalitionUi(); ensureAreasBtn(); ensureResetViewBtn(); tvButton(); changelogButton(); designToggle(); renderNewUi(); buildLegend(); decorateHeldBy(); decorateSpecials(); decoratePinButtons(); headerToggle(); expandPartyList(); fitPartyRows(); tvDetailCloseButton(); };
    let upkeepAt = 0, upkeepTimer = null;
    const runUpkeep = () => { upkeepTimer = null; upkeepAt = Date.now(); try { upkeep(); } catch (err) { console.warn('[ResultsDesk Plus] upkeep', err); } };
    new MutationObserver(() => {
      if (upkeepTimer) return;
      const wait = 120 - (Date.now() - upkeepAt);
      if (wait <= 0) runUpkeep(); else upkeepTimer = setTimeout(runUpkeep, wait);
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'complete') setTimeout(init, 300);
  else window.addEventListener('load', () => setTimeout(init, 300));

  window.rdExtras = { setTv, toggleCoalition, seatState, scanChanges };
})();

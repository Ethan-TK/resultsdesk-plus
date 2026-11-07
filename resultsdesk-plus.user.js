// ==UserScript==
// @name         ResultsDesk Plus
// @namespace    resultsdesk-plus
// @version      1.3.0
// @description  Faster live updates, striped flipped seats, margin shading, last-changed badges, sitting MPs, coalition tracker, overhang notice and TV mode for resultsdesk.nz
// @homepageURL  https://github.com/Ethan-TK/resultsdesk-plus
// @supportURL   https://github.com/Ethan-TK/resultsdesk-plus/issues
// @downloadURL  https://raw.githubusercontent.com/Ethan-TK/resultsdesk-plus/main/resultsdesk-plus.user.js
// @updateURL    https://raw.githubusercontent.com/Ethan-TK/resultsdesk-plus/main/resultsdesk-plus.user.js
// @match        https://resultsdesk.nz/*
// @match        https://www.resultsdesk.nz/*
// @run-at       document-start
// @inject-into  page
// @sandbox      raw
// @grant        none
// ==/UserScript==
//
// document-start matters: resultsdesk.nz sets a <meta> Content-Security-Policy that blocks
// injected page scripts once parsed. Starting before it is parsed lets the script run on
// Firefox and Chrome; it then waits for the app's globals before hooking in.

// Unofficial add-on. Not affiliated with ResultsDesk. Built from https://github.com/Ethan-TK/resultsdesk-plus/tree/main/src

(() => {
  'use strict';

  console.log('[ResultsDesk Plus] loaded, waiting for the site…');

  // ---- styles (added once <head> exists; at document-start it may not yet) ----
  function addStyles() {
    if (document.getElementById('rdPlusStyles')) return;
    const style = document.createElement('style');
    style.id = 'rdPlusStyles';
    style.textContent = "/* ResultsDesk clone extras */\n@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');\n.app-support-link, .app-contact-link { display: none !important; }\n\n/* ---------- rebrand logo ---------- */\n.app-brand .rd-brand-text {\n  font: 400 34px/1 'Bebas Neue', 'Oswald', Impact, sans-serif; letter-spacing: .01em;\n  color: #fff; white-space: nowrap; display: inline-block; transform: translateY(2px);\n}\n.app-brand .rd-brand-text b { font-weight: 400; color: #fde047; }\nbody.light-mode .app-brand .rd-brand-text { color: #0f1d33; }\nbody.light-mode .app-brand .rd-brand-text b { color: #b45309; }\n@media (max-width: 660px) { .app-brand .rd-brand-text { font-size: 26px; } }\n\n/* ---------- no footer ---------- */\nbody.dashboard-body .dashboard-footer { display: none !important; }\n\n/* ---------- desktop map view: edge to edge, fills the window, never moves ----------\n   1181px+ is the site's desktop layout (below that it switches to a scrolling layout).\n   `clip` (unlike `hidden`) also stops the site's own scrollIntoView calls nudging the page.\n   --rd-map-top is the map's top edge, kept up to date by extras.js. */\nhtml, body { overscroll-behavior: none; }\n@media (min-width: 1181px) {\n  html:has(body.dashboard-body[data-dashboard-view=\"map\"]) { overflow: clip !important; height: 100% !important; }\n  html body.dashboard-body[data-dashboard-view=\"map\"] { overflow: clip !important; height: 100vh !important; min-height: 0 !important; }\n  html body.dashboard-body[data-dashboard-view=\"map\"] .dashboard-shell {\n    width: 100% !important; max-width: none !important; margin: 0 !important; padding: 0 !important;\n  }\n  html body.dashboard-body[data-dashboard-view=\"map\"] .app-header-inner {\n    width: 100% !important; max-width: none !important; margin: 0 !important; padding: 0 16px !important;\n  }\n  html body.dashboard-body[data-dashboard-view=\"map\"] .dashboard-view-tabs { padding-left: 8px !important; }\n  html body.dashboard-body[data-dashboard-view=\"map\"] .map-card,\n  html body.dashboard-body[data-dashboard-view=\"map\"] .map-card-body,\n  html body.dashboard-body[data-dashboard-view=\"map\"] #mapWrap,\n  html body.dashboard-body[data-dashboard-view=\"map\"] #map {\n    height: calc(100vh - var(--rd-map-top, 81px)) !important; max-height: none !important; min-height: 0 !important;\n    border-radius: 0 !important;\n  }\n}\n\n/* ---------- top bar show/hide arrow ---------- */\nbody.rd-hide-header .app-header { display: none !important; }\n.rd-header-toggle {\n  position: fixed; left: 50%; top: var(--rd-header-h, 50px); transform: translateX(-50%); z-index: 9500;\n  width: 44px; height: 18px; padding: 0; display: grid; place-items: center; cursor: pointer;\n  border: 1px solid var(--rd-panel-line); border-top: 0; border-radius: 0 0 8px 8px;\n  background: var(--rd-panel-bg); color: var(--rd-panel-fg); opacity: .75;\n}\n.rd-header-toggle:hover, .rd-header-toggle:focus-visible { opacity: 1; }\n.rd-header-toggle svg { width: 14px; height: 14px; transition: transform .2s; }\nbody.rd-hide-header .rd-header-toggle { top: 0; }\nbody.rd-hide-header .rd-header-toggle svg { transform: rotate(180deg); }\nbody.rd-tv .rd-header-toggle { display: none; }\n\n:root {\n  --rd-panel-bg: rgba(7, 20, 38, .94);\n  --rd-panel-fg: #e5edf7;\n  --rd-panel-muted: #94a3b8;\n  --rd-panel-line: rgba(148, 163, 184, .22);\n}\nbody.light-mode {\n  --rd-panel-bg: rgba(255, 255, 255, .96);\n  --rd-panel-fg: #0f1d33;\n  --rd-panel-muted: #55657d;\n  --rd-panel-line: rgba(15, 29, 51, .14);\n}\n\n/* ---------- last-changed badges ---------- */\n.rd-badge-wrap { background: none !important; border: 0 !important; width: 0 !important; height: 0 !important; }\n.rd-badge {\n  position: absolute; transform: translate(-50%, -50%);\n  display: inline-flex; align-items: center; gap: 5px; white-space: nowrap;\n  padding: 2px 7px; border-radius: 999px;\n  font: 800 10.5px/1.5 Montserrat, system-ui, sans-serif; letter-spacing: .02em;\n  background: #fde047; color: #111827; border: 1px solid rgba(0, 0, 0, .35);\n  box-shadow: 0 2px 6px rgba(0, 0, 0, .35);\n  opacity: var(--rd-age, 1); pointer-events: none;\n}\n.rd-badge span { font-weight: 600; opacity: .72; }\n.rd-badge.is-lead-change { background: #fff; outline: 2px solid #f43f5e; }\n.rd-badge.is-fresh { animation: rd-pulse 1.3s ease-out infinite; }\n@keyframes rd-pulse {\n  0% { box-shadow: 0 0 0 0 rgba(253, 224, 71, .85); }\n  100% { box-shadow: 0 0 0 14px rgba(253, 224, 71, 0); }\n}\n\n/* ---------- margin legend ---------- */\n.rd-legend {\n  position: absolute; right: 84px; bottom: 10px; z-index: 820;\n  display: flex; align-items: center; gap: 4px; padding: 5px 9px;\n  background: var(--rd-panel-bg); color: var(--rd-panel-fg); border: 1px solid var(--rd-panel-line);\n  font: 600 11px Montserrat, system-ui, sans-serif; white-space: nowrap;\n}\n.rd-legend small { margin-right: 5px; color: var(--rd-panel-muted); font-size: 10.5px; }\n/* --rd-key = colour of the currently leading party (set by extras.js); blue until results arrive */\n.rd-legend .rd-sw { width: 14px; height: 11px; background: var(--rd-key, #3b82f6); transition: background .4s; }\n.rd-legend .rd-sw-hatch { opacity: .9; background: repeating-linear-gradient(-45deg, var(--rd-key, #3b82f6) 0 4px, rgba(10, 14, 24, .75) 4px 7px); }\n.rd-legend-toggle {\n  margin-right: 6px; padding: 2px 7px; border: 1px solid var(--rd-panel-line); background: transparent;\n  color: inherit; font: 800 10.5px Montserrat, system-ui, sans-serif; text-transform: uppercase; cursor: pointer;\n}\n.rd-legend.is-off .rd-sw:not(.rd-sw-hatch) { opacity: .85 !important; filter: grayscale(1); }\n.rd-legend.is-off .rd-legend-toggle { text-decoration: line-through; }\n/* Compact layout: the results sheet covers the bottom of the map, so sit at the top instead. */\n@media (max-width: 1100px) {\n  .rd-legend { top: 52px; bottom: auto; left: 8px; right: auto; }\n  .rd-legend small { display: none; }\n}\n\n/* ---------- coalition tracker ---------- */\n.rd-coal-btn.active { color: #fde047 !important; }\n.rd-coalition {\n  position: absolute; top: 12px; right: 84px; z-index: 830; width: 330px; max-height: calc(100% - 70px); overflow: auto;\n  padding: 12px; background: var(--rd-panel-bg); color: var(--rd-panel-fg); border: 1px solid var(--rd-panel-line);\n  font: 500 12.5px/1.4 Montserrat, system-ui, sans-serif; box-shadow: 0 10px 30px rgba(0, 0, 0, .35);\n}\n.rd-coalition[hidden] { display: none; }\n.rd-coal-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-bottom: 8px; }\n.rd-coal-head strong { font-weight: 800; font-size: 14px; }\n.rd-coal-head span { color: var(--rd-panel-muted); font-size: 11.5px; }\n.rd-bloc-bar { position: relative; display: flex; height: 14px; background: rgba(148, 163, 184, .2); overflow: visible; }\n.rd-bloc-bar span { height: 100%; }\n.rd-bloc-bar i { position: absolute; top: -4px; bottom: -4px; width: 2px; margin-left: -1px; background: var(--rd-panel-fg); }\n.rd-verdict { margin: 8px 0 10px; font-size: 12px; }\n.rd-bloc { padding: 7px 0; border-top: 1px solid var(--rd-panel-line); }\n.rd-bloc-head { display: flex; align-items: center; gap: 7px; font-weight: 700; }\n.rd-bloc-head strong { margin-left: auto; font-size: 18px; font-weight: 900; }\n.rd-dot { width: 10px; height: 10px; border-radius: 50%; flex: none; display: inline-block; }\n.rd-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px; }\n.rd-chip { padding: 1px 6px; border-left: 4px solid var(--c); background: rgba(148, 163, 184, .14); font-size: 11.5px; font-weight: 700; }\n.rd-spark-label { margin-top: 8px; color: var(--rd-panel-muted); font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; }\n.rd-spark { display: block; width: 100%; height: 70px; margin-top: 4px; color: var(--rd-panel-muted); }\n.rd-spark-empty { color: var(--rd-panel-muted); font-size: 11.5px; margin-top: 4px; }\n@media (max-width: 760px) { .rd-coalition { right: 8px; left: 8px; width: auto; top: 8px; } }\n\n/* ---------- overhang notice ---------- */\n.rd-overhang {\n  position: absolute; bottom: 48px; right: 84px; z-index: 825; max-width: min(460px, calc(100% - 120px));\n  padding: 7px 12px; background: #fef3c7; color: #422006; border: 1px solid #f59e0b;\n  font: 500 12.5px/1.45 Montserrat, system-ui, sans-serif; box-shadow: 0 6px 18px rgba(0, 0, 0, .25);\n}\n.rd-overhang[hidden] { display: none; }\n@media (max-width: 1100px) { .rd-overhang { top: 88px; bottom: auto; left: 8px; right: 84px; max-width: none; font-size: 11.5px; } }\n\n/* ---------- sitting MP in electorate panel ---------- */\n.rd-held {\n  grid-column: 1; /* the panel header is a 2-column grid; stay under the title, left of the % box */\n  display: flex; flex-wrap: wrap; align-items: center; gap: 4px 7px; margin-top: 6px;\n  font: 600 12px/1.3 Montserrat, system-ui, sans-serif; color: inherit;\n}\n.rd-held-label { font-size: 9.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; opacity: .6; }\n.rd-held-name { font-weight: 800; }\n.rd-held-party { padding: 1px 6px; border-left: 4px solid var(--c); background: rgba(148, 163, 184, .16); font-size: 10.5px; font-weight: 800; text-transform: uppercase; }\n.rd-held-was, .rd-held-new { opacity: .7; font-size: 11px; }\n\n/* ---------- TV mode ---------- */\n.rd-tv-btn { display: inline-flex !important; align-items: center; gap: 6px; }\n.rd-tv-panel { display: none; }\nbody.rd-tv { overflow: hidden !important; }\n/* .rd-tv repeated to outrank the site's own body.dashboard-body[data-dashboard-view] rules */\nbody.rd-tv.rd-tv.rd-tv #mapWrap {\n  position: fixed !important; inset: 0 31vw 0 0 !important; width: auto !important; height: auto !important;\n  z-index: 9000 !important; margin: 0 !important; background: #050b16; display: block !important;\n}\nbody.rd-tv.rd-tv.rd-tv #map { position: absolute !important; inset: 0 !important; width: 100% !important; height: 100% !important; display: block !important; }\nbody.rd-tv.rd-tv.rd-tv #mapWrap > :not(#map):not(.rd-legend):not(.map-stage-texture):not(#featurePopup) { display: none !important; }\nbody.rd-tv .rd-coalition, body.rd-tv #rdOverhang { display: none !important; }\nbody.rd-tv .rd-legend { right: 12px !important; }\nbody.rd-tv .rd-legend { font-size: 13px; }\nbody.rd-tv .rd-badge { font-size: 13px; }\nbody.rd-tv .rd-tv-panel {\n  display: flex; flex-direction: column; gap: 1.2vh;\n  position: fixed; top: 0; right: 0; bottom: 0; width: 31vw; z-index: 9001; overflow: hidden;\n  padding: 2.4vh 1.8vw; background: #071426; color: #e5edf7; border-left: 1px solid rgba(148, 163, 184, .2);\n  font: 500 clamp(13px, 1.05vw, 22px)/1.35 Montserrat, system-ui, sans-serif;\n}\n.rd-tv-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }\n.rd-tv-title { font-weight: 900; font-size: 1.9em; letter-spacing: -.01em; }\n.rd-tv-sub { color: #94a3b8; }\n.rd-tv-actions { display: flex; gap: 6px; }\n.rd-tv-actions button { white-space: nowrap; padding: .3em .7em; border: 1px solid rgba(148, 163, 184, .35); background: transparent; color: inherit; font: 700 .8em Montserrat, sans-serif; cursor: pointer; }\n.rd-tv-seats { display: grid; gap: .55vh; }\n.rd-tv-row { display: grid; grid-template-columns: 8.5em 1fr 2.4em; align-items: center; gap: .6em; font-weight: 700; }\n.rd-tv-row strong { text-align: right; font-size: 1.45em; font-weight: 900; }\n.rd-tv-row sup { color: #f59e0b; }\n.rd-tv-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.rd-tv-bar { height: 1.15em; background: rgba(148, 163, 184, .12); }\n.rd-tv-bar i { display: block; height: 100%; }\n.rd-tv-coal { padding-top: 1vh; border-top: 1px solid rgba(148, 163, 184, .2); }\n.rd-tv-coal-head { margin-bottom: .5em; color: #94a3b8; }\n.rd-tv-coal .rd-bloc-bar { height: 1.3em; }\n.rd-tv-coal .rd-bloc-bar i { background: #fff; }\n.rd-tv-blocs { display: grid; gap: .2em; margin-top: .6em; }\n.rd-tv-blocs span { display: flex; align-items: center; gap: .5em; }\n.rd-tv-blocs i { width: .8em; height: .8em; border-radius: 50%; }\n.rd-tv-blocs b { margin-left: auto; font-size: 1.25em; }\n.rd-tv-overhang { position: static; transform: none; max-width: none; font-size: .9em; }\n.rd-tv-ticker-label { padding-top: 1vh; border-top: 1px solid rgba(148, 163, 184, .2); color: #94a3b8; font-size: .78em; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; }\n.rd-ticker { display: grid; gap: .45em; min-height: 0; overflow: hidden; }\n.rd-ticker-item { display: grid; grid-template-columns: auto auto 1fr auto; align-items: center; gap: .55em; font-size: .92em; }\n.rd-ticker-item span:not(.rd-dot) { color: #cbd5e1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.rd-ticker-item small { color: #94a3b8; }\n.rd-ticker-item.is-lead-change b { color: #fda4af; }\n@media (max-width: 900px) {\n  body.rd-tv #mapWrap { inset: 0 0 46vh 0 !important; }\n  body.rd-tv .rd-tv-panel { top: 54vh; width: 100%; border-left: 0; overflow: auto; }\n}\n";
    (document.head || document.documentElement).appendChild(style);
  }
  if (document.head) addStyles();
  else document.addEventListener('DOMContentLoaded', addStyles, { once: true });

  // ---- core: speed + map styling ----
// Core runtime hooks: faster live updates + flipped-seat hatching + margin shading.
// Runs in the page after the ResultsDesk app script has defined its globals.
function rdInstallCore() {
  'use strict';
  const isLive = ds => { try { return isLiveDataset(ds); } catch { return false; } };

  // ---------- 1. Speed ----------
  // Live data requests skip the browser cache.
  const realFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    try {
      const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const u = new URL(raw, location.href);
      if (/(^|\.)resultsdesk\.nz$/.test(u.hostname) && /results-bundle|trend-history|live-bundle|live-2026|collector-state/.test(u.pathname)) {
        init = Object.assign({}, init, { cache: 'no-store' });
      }
    } catch { /* leave untouched */ }
    return realFetch(input, init);
  };

  // Replace the 30 s shared "rd_live_tick" URL bucket with a unique URL per request,
  // which also defeats the app's 10 s in-memory bundle cache.
  const origShared = window.buildSharedRefreshUrl;
  if (typeof origShared === 'function') {
    window.buildSharedRefreshUrl = function (url, force, opts) {
      if (opts && Number(opts.resultsBundleSharedCacheMs) > 0) return appendUrlParam(url, 't', Date.now());
      return origShared.apply(this, arguments);
    };
  }

  // Fallback poll every 5 s on live datasets (was 30 s).
  const origInterval = window.getRefreshIntervalMs;
  if (typeof origInterval === 'function') {
    window.getRefreshIntervalMs = function (ds) {
      const v = origInterval.apply(this, arguments);
      try { if (!PERF.refreshMs && v > 5000 && isLive(ds === undefined ? currentDataset : ds)) return 5000; } catch { /* keep */ }
      return v;
    };
    try { if (isLive(currentDataset)) startAutoRefreshTimer(currentDataset); } catch { /* app not ready */ }
  }

  // Watch the live bundle with a cheap HEAD request every second; redraw the moment it changes.
  let lastTag = null, lastUrl = null, busyRetry = null;
  function liveBundleUrl() {
    try {
      const u = DATASETS[currentDataset]?.resultsBundleUrl;
      if (isLive(currentDataset) && u && /results-bundle\.json/.test(u)) return new URL(u, location.href).href;
    } catch { /* fall through */ }
    return null;
  }
  function refreshNow() {
    clearTimeout(busyRetry);
    if (typeof window.refreshMap !== 'function') return;
    Promise.resolve(window.refreshMap({ manual: true }))
      .then(r => { if (r && r.status === 'busy') busyRetry = setTimeout(refreshNow, 300); })
      .catch(() => {});
  }
  async function watch() {
    const url = liveBundleUrl();
    if (!url || document.visibilityState === 'hidden') return;
    if (url !== lastUrl) { lastUrl = url; lastTag = null; }
    try {
      const res = await realFetch(url + (url.includes('?') ? '&' : '?') + 'h=' + Date.now(), { method: 'HEAD', cache: 'no-store' });
      const tag = res.headers.get('etag') || res.headers.get('last-modified');
      if (!tag) return;
      if (lastTag !== null && tag !== lastTag) refreshNow();
      lastTag = tag;
    } catch { /* network blip */ }
  }
  setInterval(watch, 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && liveBundleUrl()) refreshNow(); });

  // ---------- 2. Map styling ----------
  const hatchCache = new Map();
  function hatchPattern(color) {
    if (hatchCache.has(color)) return hatchCache.get(color);
    const s = 12, c = document.createElement('canvas');
    c.width = c.height = s;
    const x = c.getContext('2d');
    x.fillStyle = color; x.fillRect(0, 0, s, s);
    x.strokeStyle = 'rgba(10,14,24,0.62)'; x.lineWidth = 3.2; x.lineCap = 'square';
    x.beginPath();
    for (const o of [-s, 0, s]) { x.moveTo(o, s); x.lineTo(o + s, 0); }
    x.stroke();
    const p = x.createPattern(c, 'repeat');
    hatchCache.set(color, p);
    return p;
  }
  function isFlipped(f) {
    try { const l = f?.properties?.live; return !!l && getMapDataResultStatus(l) === 'flipped'; } catch { return false; }
  }
  const MARGIN_STEPS = [[0.02, 0.34], [0.05, 0.5], [0.1, 0.65], [0.2, 0.8], [Infinity, 0.92]];
  function marginOpacity(l) {
    if (!l || window.rdMarginShading === false) return null;
    const pv = (() => { try { return currentViewMode === 'partyvote'; } catch { return false; } })();
    const m = Number(pv ? l.party_vote_margin_pct : l.margin_pct);
    const lv = Number(pv ? l.party_vote_leader_votes : l.leader_votes);
    if (!Number.isFinite(m) || !(lv > 0)) return null;
    for (const [max, op] of MARGIN_STEPS) if (m < max) return op;
    return null;
  }
  function restyle(f, st) {
    if (!st || typeof st.fillColor !== 'string') return st;
    const op = marginOpacity(f?.properties?.live);
    let out = st;
    if (op != null) out = { ...out, fillOpacity: op };
    if (isFlipped(f)) out = { ...out, fillColor: hatchPattern(st.fillColor), fillOpacity: Math.max(out.fillOpacity ?? 0.8, 0.6) };
    return out;
  }
  for (const name of ['featureStyle', 'selectedStyle']) {
    const orig = window[name];
    if (typeof orig === 'function') window[name] = function (f) { return restyle(f, orig.apply(this, arguments)); };
  }
  try { if (geoJsonLayer) { geoJsonLayer.setStyle(window.featureStyle); updateSelectedHighlight(); } } catch { /* not drawn yet */ }
}


  // ---- extras: badges, legend, sitting MPs, coalition tracker, overhang, TV mode ----
  function rdInstallExtras() {
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
  const partyColor = p => { try { return getPartyColor(p); } catch { return '#94a3b8'; } };
  const partyLabel = p => {
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
  }

  function renderBadges() {
    if (typeof map === 'undefined' || !map || typeof L === 'undefined') return;
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
  function buildLegend() {
    const wrap = $('#mapWrap');
    if (!wrap || $('#rdLegend')) return;
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
  const BLOCS = [
    { key: 'right', name: 'National · ACT · NZ First', test: p => /^NATIONAL|^ACT\b|NZ FIRST|NEW ZEALAND FIRST/i.test(p), color: '#2f5fd0' },
    { key: 'left', name: 'Labour · Green · Te Pāti Māori', test: p => /^LABOUR|^GREEN|M[AĀ]ORI/i.test(p), color: '#d0342c' },
  ];
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
    const snap = { t: Date.now(), r: st.blocs[0].seats, l: st.blocs[1].seats, o: st.othersSeats, n: st.total };
    const last = hist[hist.length - 1];
    if (!last || last.r !== snap.r || last.l !== snap.l || last.o !== snap.o || last.n !== snap.n) {
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
    const line = (k, c) => `<polyline fill="none" stroke="${c}" stroke-width="2" points="${hist.map(h => `${x(h.t).toFixed(1)},${y(h[k]).toFixed(1)}`).join(' ')}"/>`;
    return `<svg class="rd-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <line x1="0" x2="${W}" y1="${y(majority)}" y2="${y(majority)}" stroke="currentColor" stroke-dasharray="4 3" opacity=".5"/>
      ${line('r', BLOCS[0].color)}${line('l', BLOCS[1].color)}</svg>`;
  }

  function blocBarHtml(st) {
    const segs = [...st.blocs, { key: 'other', seats: st.othersSeats, color: '#64748b' }]
      .filter(b => b.seats > 0)
      .map(b => `<span style="flex:${b.seats};background:${b.color}"></span>`).join('');
    const majPos = st.total ? (st.majority / st.total) * 100 : 50;
    return `<div class="rd-bloc-bar">${segs}<i style="left:${majPos}%"></i></div>`;
  }

  function verdict(st) {
    const win = st.blocs.find(b => b.seats >= st.majority);
    if (win) return `<b style="color:${win.color}">${esc(win.name)}</b> has a majority: ${win.seats} of ${st.total}`;
    const best = [...st.blocs].sort((a, b) => b.seats - a.seats)[0];
    if (!best || !best.seats) return 'Waiting for results';
    return `No majority yet: ${esc(best.name)} is ${st.majority - best.seats} short` + (st.othersSeats ? ` (others hold ${st.othersSeats})` : '');
  }

  function coalitionHtml(st, hist) {
    const blocs = st.blocs.map(b => `
      <div class="rd-bloc">
        <div class="rd-bloc-head"><span class="rd-dot" style="background:${b.color}"></span>${esc(b.name)}<strong>${b.seats}</strong></div>
        <div class="rd-chips">${b.members.map(m => `<span class="rd-chip" style="--c:${partyColor(m.party)}">${esc(partyLabel(m.party))} ${m.seats}</span>`).join('') || '<small>—</small>'}</div>
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
    if (!$('#rdOverhang')) {
      const o = el('div', 'rd-overhang');
      o.id = 'rdOverhang';
      o.hidden = true;
      wrap.appendChild(o);
    }
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
    const hist = recordHistory(st);
    const p = $('#rdCoalition');
    if (p && !p.hidden) p.innerHTML = st.total ? coalitionHtml(st, hist) : '<div class="rd-coal-head"><strong>Coalition tracker</strong></div><div class="rd-verdict">Waiting for seat results…</div>';
    const o = $('#rdOverhang');
    if (o) { const h = overhangHtml(st); o.innerHTML = h; o.hidden = !h; }
    if (document.body.classList.contains('rd-tv')) renderTv(st, hist);
  }

  // ---------------------------------------------------------------------------
  // 5. TV mode
  // ---------------------------------------------------------------------------
  const TV_REGIONS = ['resetZoomBtn', 'viewAucklandBtn', 'viewHamiltonBtn', 'viewWellingtonBtn', 'viewChristchurchBtn', 'resetZoomBtn', 'viewTaurangaBtn', 'viewDunedinBtn'];
  let tvTimer = null, tvIdx = 0, tvCycle = true;

  function tvButton() {
    const nav = $('#themeToggleBtn')?.parentElement;
    if (!nav || $('#rdTvBtn')) return;
    const b = el('button', 'nav-btn rd-tv-btn', '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="5" width="20" height="13" rx="2"/><path d="M8 21h8"/></svg><span>TV mode</span>');
    b.id = 'rdTvBtn';
    b.type = 'button';
    b.title = 'Big-screen TV mode (T)';
    b.addEventListener('click', () => setTv(true));
    nav.insertBefore(b, $('#themeToggleBtn'));
  }

  // In TV mode the site's map-fit padding (which leaves room for its left panel) is replaced
  // with a small even margin, so the national view and region tours fill the screen.
  (function patchFitOptions() {
    const orig = window.getComposedMapFitOptions;
    if (typeof orig !== 'function') return;
    window.getComposedMapFitOptions = function (...args) {
      const o = orig.apply(this, args);
      if (!document.body.classList.contains('rd-tv') || !o) return o;
      return { ...o, paddingTopLeft: [20, 20], paddingBottomRight: [20, 20], maxZoom: Math.max(Number(o.maxZoom) || 0, 6.6) };
    };
  })();
  function tvFitNz() {
    try { if (typeof resetMapView === 'function') return resetMapView(); } catch { /* fall back */ }
    try { map.fitBounds(L.latLngBounds([[-46.8, 166.3], [-34.3, 178.7]]), { padding: [16, 16], animate: false }); } catch { /* ignore */ }
  }

  function setTv(on) {
    const body = document.body;
    if (on === body.classList.contains('rd-tv')) return;
    body.classList.toggle('rd-tv', on);
    if (on) {
      if (!$('#rdTv')) {
        const tv = el('div', 'rd-tv-panel');
        tv.id = 'rdTv';
        document.body.appendChild(tv);
        tv.addEventListener('click', e => {
          const a = e.target.closest('[data-tv]');
          if (!a) return;
          if (a.dataset.tv === 'exit') setTv(false);
          if (a.dataset.tv === 'cycle') { tvCycle = !tvCycle; renderSeatsUi(); }
        });
      }
      document.documentElement.requestFullscreen?.().catch(() => {});
      tvIdx = 0;
      clearInterval(tvTimer);
      tvTimer = setInterval(() => {
        if (!tvCycle) return;
        tvIdx = (tvIdx + 1) % TV_REGIONS.length;
        if (TV_REGIONS[tvIdx] === 'resetZoomBtn') tvFitNz();
        else document.getElementById(TV_REGIONS[tvIdx])?.click();
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
    const maxSeats = Math.max(1, ...st.parties.map(p => p.seats));
    const rows = st.parties.slice(0, 8).map(p => `
      <div class="rd-tv-row">
        <span class="rd-tv-name">${esc(partyLabel(p.party))}${p.overhang ? '<sup>*</sup>' : ''}</span>
        <span class="rd-tv-bar"><i style="width:${(p.seats / maxSeats) * 100}%;background:${partyColor(p.party)}"></i></span>
        <strong>${p.seats}</strong>
      </div>`).join('');
    const ov = overhangHtml(st);
    tv.innerHTML = `
      <div class="rd-tv-top">
        <div><div class="rd-tv-title">NZ Election ${esc(String(ds()).match(/\d{4}/)?.[0] || '')}</div>
        <div class="rd-tv-sub">${pct == null ? '' : `${pct.toFixed(1)}% of voting places counted · `}<span class="rd-tv-clock">${new Date().toLocaleTimeString('en-NZ', { hour: 'numeric', minute: '2-digit' })}</span></div></div>
        <div class="rd-tv-actions"><button data-tv="cycle" type="button">${tvCycle ? 'Auto-tour on' : 'Auto-tour off'}</button><button data-tv="exit" type="button">Exit ✕</button></div>
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
    if (e.key === 'Escape' && document.body.classList.contains('rd-tv')) setTv(false);
  });
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && document.body.classList.contains('rd-tv')) setTv(false);
  });
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
  const pinPage = () => window.matchMedia('(min-width: 1181px)').matches && document.body?.dataset.dashboardView === 'map';
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
    if (tabs) root.setProperty('--rd-map-top', `${Math.max(0, Math.round(tabs.getBoundingClientRect().bottom + window.scrollY))}px`);
    try { map.invalidateSize({ pan: false }); } catch { /* map not ready */ }
  }
  // Measure now, then once more after the site's own layout code has reacted.
  function updateLayoutVars() {
    measureLayout();
    clearTimeout(layoutTimer);
    layoutTimer = setTimeout(measureLayout, 150);
  }
  function setHeaderHidden(hide) {
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
  new MutationObserver(muts => {
    for (const m of muts) {
      if (m.type === 'characterData') { if (BRAND_RE.test((BRAND_RE.lastIndex = 0, m.target.nodeValue))) rebrandText(m.target.parentElement); }
      else m.addedNodes.forEach(n => { if (n.nodeType === 1) { rebrandText(n); rebrandAttrs(n); } else if (n.nodeType === 3 && n.parentElement) rebrandText(n.parentElement); });
    }
    rebrandTitle();
    rebrandLogo();
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
    headerToggle();
    updateLayoutVars();
    renderSeatsUi();
    scanChanges();
    decorateHeldBy();
    new MutationObserver(() => { ensureCoalitionUi(); tvButton(); buildLegend(); decorateHeldBy(); headerToggle(); })
      .observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'complete') setTimeout(init, 300);
  else window.addEventListener('load', () => setTimeout(init, 300));

  window.rdExtras = { setTv, toggleCoalition, seatState, scanChanges };
})();

  }

  // Wait until the ResultsDesk app has defined its globals, then install.
  let tries = 0;
  (function whenReady() {
    if (typeof window.refreshMap === 'function' && typeof window.featureStyle === 'function') {
      addStyles();
      try { rdInstallCore(); } catch (e) { console.warn('[ResultsDesk Plus] core', e); }
      try { rdInstallExtras(); } catch (e) { console.warn('[ResultsDesk Plus] extras', e); }
      console.log('[ResultsDesk Plus] active');
    } else if (++tries < 900) {
      setTimeout(whenReady, 100);
    } else {
      console.warn('[ResultsDesk Plus] app globals not found — site may have changed');
    }
  })();
})();

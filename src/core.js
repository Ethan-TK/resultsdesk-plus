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
    const live = f?.properties?.live;
    // Light mode: electorates with no result yet get a mid grey so the country stands out from the sea.
    if (document.body?.classList.contains('light-mode')) {
      const lead = (() => { try { return currentViewMode === 'partyvote' ? live?.party_vote_leader_party : live?.leader_party; } catch { return live?.leader_party; } })();
      if (!lead || lead === 'Unknown') return { ...st, fillColor: '#aeb8c5', fillOpacity: 0.9 };
    }
    const op = marginOpacity(live);
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

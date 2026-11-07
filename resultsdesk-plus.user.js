// ==UserScript==
// @name         ResultsDesk Plus
// @namespace    resultsdesk-plus
// @version      1.8.3
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

(function () {
'use strict';

// Everything runs inside rdPlusMain, which must execute in the page itself (it hooks the
// site's own functions and variables). Chrome's Tampermonkey runs it there directly.
// Firefox's Tampermonkey may run it in an isolated sandbox instead, where the site's code is
// invisible; in that case we move it into the page with a <script> element. That has to
// happen before the site's <meta> CSP is parsed, which @run-at document-start allows.
function rdPlusMain() {
  if (document.documentElement.dataset.rdPlus) return; // already running
  document.documentElement.dataset.rdPlus = 'loaded';

  console.log('[ResultsDesk Plus] loaded, waiting for the site…');

  // ---- styles (added once <head> exists; at document-start it may not yet) ----
  function addStyles() {
    if (document.getElementById('rdPlusStyles')) return;
    const style = document.createElement('style');
    style.id = 'rdPlusStyles';
    style.textContent = "/* ResultsDesk clone extras */\n@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');\n.app-support-link, .app-contact-link { display: none !important; }\n\n/* ---------- rebrand logo ---------- */\n.app-brand .rd-brand-text {\n  font: 400 34px/1 'Bebas Neue', 'Oswald', Impact, sans-serif; letter-spacing: .01em;\n  color: #fff; white-space: nowrap; display: inline-block; transform: translateY(2px);\n}\n.app-brand .rd-brand-text b { font-weight: 400; color: #fde047; }\nbody.light-mode .app-brand .rd-brand-text { color: #0f1d33; }\nbody.light-mode .app-brand .rd-brand-text b { color: #b45309; }\n@media (max-width: 660px) { .app-brand .rd-brand-text { font-size: 26px; } }\n\n/* ---------- no footer ---------- */\nbody.dashboard-body .dashboard-footer { display: none !important; }\n\n/* ---------- desktop map view: edge to edge, fills the window, never moves ----------\n   901px+ is the site's map-with-side-panel layout (below that it stacks into a scrolling sheet).\n   `clip` (unlike `hidden`) also stops the site's own scrollIntoView calls nudging the page.\n   --rd-map-top is the map's top edge, kept up to date by extras.js. */\nhtml, body { overscroll-behavior: none; }\n@media (min-width: 901px) {\n  /* Edge to edge on every tab (Map, Electorates, Trends). The [data-dashboard-view] attribute\n     selector matches the site's own per-view rules so ours win. */\n  html body.dashboard-body[data-dashboard-view] .dashboard-shell {\n    width: 100% !important; max-width: none !important; margin-left: 0 !important; margin-right: 0 !important;\n    padding-left: 0 !important; padding-right: 0 !important;\n  }\n  html body.dashboard-body[data-dashboard-view] .app-header-inner {\n    width: 100% !important; max-width: none !important; margin: 0 !important; padding: 0 16px !important;\n  }\n  html body.dashboard-body[data-dashboard-view] .dashboard-view-tabs { padding-left: 8px !important; }\n  /* Map tab only: exact window height, no page scroll. */\n  html:has(body.dashboard-body[data-dashboard-view=\"map\"]) { overflow: clip !important; height: 100% !important; }\n  html body.dashboard-body[data-dashboard-view=\"map\"] { overflow: clip !important; height: 100vh !important; min-height: 0 !important; }\n  html body.dashboard-body[data-dashboard-view=\"map\"] .dashboard-shell { margin: 0 !important; padding: 0 !important; }\n  html body.dashboard-body[data-dashboard-view=\"map\"] .map-card,\n  html body.dashboard-body[data-dashboard-view=\"map\"] .map-card-body,\n  html body.dashboard-body[data-dashboard-view=\"map\"] #mapWrap,\n  html body.dashboard-body[data-dashboard-view=\"map\"] #map {\n    height: calc(100vh - var(--rd-map-top, 81px)) !important; max-height: none !important; min-height: 0 !important;\n    border-radius: 0 !important;\n  }\n}\n\n/* ---------- national party list: all parties, scrolling inside the same-size box ----------\n   extras.js measures the list while collapsed (--rd-party-body-h) and then expands it, so the\n   box keeps its size; the column headings, totals row and footer stay fixed. On short windows\n   the list shrinks instead, so the footer is never pushed off screen. */\n@media (min-width: 901px) {\n  #mapDetailPanel.has-national-summary { display: flex !important; flex-direction: column; overflow: hidden !important; }\n  #mapDetailPanel.has-national-summary > #mapDetailContent { flex: 0 1 auto; min-height: 0; display: flex; flex-direction: column; }\n  #mapDetailPanel .map-national-summary { flex: 0 1 auto; min-height: 0; display: flex; flex-direction: column; }\n  #mapDetailPanel .map-national-summary > .popup-header,\n  #mapDetailPanel .map-national-summary > .popup-footer { flex: none; }\n  #mapDetailPanel .map-national-results { flex: 0 1 auto; min-height: 0; display: flex; flex-direction: column; }\n  #mapDetailPanel .map-national-results > .candidate-results-head,\n  #mapDetailPanel .map-national-results > .map-national-total-row { flex: none; }\n  #mapDetailPanel .map-national-results > .candidate-results-body {\n    flex: 0 1 auto; min-height: 0; max-height: var(--rd-party-body-h, none);\n    overflow-y: auto; overscroll-behavior: contain;\n    scrollbar-width: none; /* Firefox: still scrolls, no visible bar */\n  }\n  #mapDetailPanel .map-national-results > .candidate-results-body::-webkit-scrollbar { display: none; } /* Chrome/Edge */\n  #mapDetailPanel .map-national-results .candidate-result-show-more-row:has([aria-expanded=\"true\"]) { display: none !important; }\n}\n\n/* ---------- top bar show/hide arrow ---------- */\nbody.rd-hide-header .app-header { display: none !important; }\n.rd-header-toggle {\n  position: fixed; left: 50%; top: var(--rd-header-h, 50px); transform: translateX(-50%); z-index: 9500;\n  width: 44px; height: 18px; padding: 0; display: grid; place-items: center; cursor: pointer;\n  border: 1px solid var(--rd-panel-line); border-top: 0; border-radius: 0 0 8px 8px;\n  background: var(--rd-panel-bg); color: var(--rd-panel-fg); opacity: .75;\n}\n.rd-header-toggle:hover, .rd-header-toggle:focus-visible { opacity: 1; }\n.rd-header-toggle svg { width: 14px; height: 14px; transition: transform .2s; }\nbody.rd-hide-header .rd-header-toggle { top: 0; }\nbody.rd-hide-header .rd-header-toggle svg { transform: rotate(180deg); }\nbody.rd-tv .rd-header-toggle { display: none; }\n\n:root {\n  --rd-panel-bg: rgba(7, 20, 38, .94);\n  --rd-panel-fg: #e5edf7;\n  --rd-panel-muted: #94a3b8;\n  --rd-panel-line: rgba(148, 163, 184, .22);\n}\nbody.light-mode {\n  --rd-panel-bg: rgba(255, 255, 255, .96);\n  --rd-panel-fg: #0f1d33;\n  --rd-panel-muted: #55657d;\n  --rd-panel-line: rgba(15, 29, 51, .14);\n}\n\n/* ---------- last-changed badges ---------- */\n.rd-badge-wrap { background: none !important; border: 0 !important; width: 0 !important; height: 0 !important; }\n.rd-badge {\n  position: absolute; transform: translate(-50%, -50%);\n  display: inline-flex; align-items: center; gap: 5px; white-space: nowrap;\n  padding: 2px 7px; border-radius: 999px;\n  font: 800 10.5px/1.5 Montserrat, system-ui, sans-serif; letter-spacing: .02em;\n  background: #fde047; color: #111827; border: 1px solid rgba(0, 0, 0, .35);\n  box-shadow: 0 2px 6px rgba(0, 0, 0, .35);\n  opacity: var(--rd-age, 1); pointer-events: none;\n}\n.rd-badge span { font-weight: 600; opacity: .72; }\n.rd-badge.is-lead-change { background: #fff; outline: 2px solid #f43f5e; }\n.rd-badge.is-fresh { animation: rd-pulse 1.3s ease-out infinite; }\n@keyframes rd-pulse {\n  0% { box-shadow: 0 0 0 0 rgba(253, 224, 71, .85); }\n  100% { box-shadow: 0 0 0 14px rgba(253, 224, 71, 0); }\n}\n\n/* ---------- bottom-right stack: overhang notice, pinned electorates, key ---------- */\n.rd-dock {\n  position: absolute; right: 84px; bottom: 10px; z-index: 825;\n  display: flex; flex-direction: column; align-items: flex-end; gap: 6px;\n  /* Kept fairly narrow so it tucks into the sea south-east of Otago instead of shrinking the map fit. */\n  max-width: min(560px, calc(100% - 120px)); pointer-events: none;\n}\n.rd-dock > * { pointer-events: auto; }\n.rd-dock > [hidden] { display: none !important; }\n/* Stacked layout: the results sheet covers the bottom of the map, so sit at the top instead. */\n@media (max-width: 900px) {\n  .rd-dock { top: 52px; bottom: auto; left: 8px; right: 84px; max-width: none; flex-direction: column-reverse; align-items: flex-start; }\n}\nbody.rd-tv .rd-dock { right: 12px; }\n\n/* ---------- pinned electorates ---------- */\n.rd-pins { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }\n.rd-pin-chip {\n  display: inline-flex; align-items: stretch; padding: 0 3px 0 0;\n  background: var(--rd-panel-bg); color: var(--rd-panel-fg); border: 1px solid var(--rd-panel-line);\n  font: 600 11.5px/1.2 Montserrat, system-ui, sans-serif; white-space: nowrap;\n  box-shadow: 0 4px 12px rgba(0, 0, 0, .25);\n}\n.rd-pin-chip:hover { border-color: var(--rd-panel-muted); }\n.rd-pin-open {\n  display: inline-flex; align-items: center; gap: 6px; padding: 4px 2px 4px 0; margin: 0;\n  border: 0; background: transparent; color: inherit; font: inherit; cursor: pointer; text-align: left;\n}\n.rd-pin-bar { align-self: stretch; width: 5px; background: var(--c, #64748b); }\n.rd-pin-bar.is-flip { background: repeating-linear-gradient(-45deg, var(--c) 0 3px, rgba(10, 14, 24, .7) 3px 5px); }\n.rd-pin-chip b { font-weight: 800; }\n.rd-pin-chip .rd-pin-lead { color: var(--rd-panel-muted); font-weight: 700; }\n.rd-pin-chip .rd-pin-pct { color: var(--rd-panel-muted); font-size: 10.5px; }\n.rd-pin-x {\n  display: grid; place-items: center; align-self: center; width: 18px; height: 18px; margin-left: 2px; padding: 0;\n  border: 0; border-radius: 3px; background: transparent; cursor: pointer;\n  color: var(--rd-panel-muted); font: 400 14px/1 system-ui, sans-serif;\n}\n.rd-pin-x:hover { background: rgba(148, 163, 184, .2); color: var(--rd-panel-fg); }\n@media (max-width: 900px) { .rd-pins { align-items: flex-start; } }\n\n/* pin toggle in the electorate panel header */\n.rd-pin-btn {\n  display: inline-grid; place-items: center; width: 22px; height: 22px; margin-left: 6px; padding: 0;\n  vertical-align: middle; border: 0; border-radius: 4px; background: transparent; cursor: pointer;\n  color: inherit; opacity: .35; transition: opacity .15s, color .15s;\n}\n.rd-pin-btn svg { width: 15px; height: 15px; }\n.popup-header:hover .rd-pin-btn, .rd-pin-btn:focus-visible { opacity: .75; }\n.rd-pin-btn:hover { opacity: 1; background: rgba(148, 163, 184, .16); }\n.rd-pin-btn.is-pinned { opacity: 1; color: #fde047; }\n.rd-pin-btn.is-pinned svg { fill: currentColor; }\n\n/* ---------- margin legend ---------- */\n.rd-legend {\n  position: static;\n  display: flex; align-items: center; gap: 4px; padding: 5px 9px;\n  background: var(--rd-panel-bg); color: var(--rd-panel-fg); border: 1px solid var(--rd-panel-line);\n  font: 600 11px Montserrat, system-ui, sans-serif; white-space: nowrap;\n}\n.rd-legend small { margin-right: 5px; color: var(--rd-panel-muted); font-size: 10.5px; }\n/* --rd-key = colour of the currently leading party (set by extras.js); blue until results arrive */\n.rd-legend .rd-sw { width: 14px; height: 11px; background: var(--rd-key, #3b82f6); transition: background .4s; }\n.rd-legend .rd-sw-hatch { opacity: .9; background: repeating-linear-gradient(-45deg, var(--rd-key, #3b82f6) 0 4px, rgba(10, 14, 24, .75) 4px 7px); }\n.rd-legend-toggle {\n  margin-right: 6px; padding: 2px 7px; border: 1px solid var(--rd-panel-line); background: transparent;\n  color: inherit; font: 800 10.5px Montserrat, system-ui, sans-serif; text-transform: uppercase; cursor: pointer;\n}\n.rd-legend.is-off .rd-sw:not(.rd-sw-hatch) { opacity: .85 !important; filter: grayscale(1); }\n.rd-legend.is-off .rd-legend-toggle { text-decoration: line-through; }\n@media (max-width: 900px) { .rd-legend small { display: none; } }\n\n/* ---------- coalition tracker ---------- */\n.rd-coal-btn.active { color: #fde047 !important; }\n.map-icon-button.rd-reset-view-btn[hidden] { display: none !important; }\n/* The site's own house-icon Reset is replaced by our Reset view button. */\n#mapMagicWallControlsRail .map-icon-button[data-map-icon=\"reset\"] { display: none !important; }\n.rd-coalition {\n  position: absolute; top: 12px; right: 84px; z-index: 830; width: 330px; max-height: calc(100% - 70px); overflow: auto;\n  padding: 12px; background: var(--rd-panel-bg); color: var(--rd-panel-fg); border: 1px solid var(--rd-panel-line);\n  font: 500 12.5px/1.4 Montserrat, system-ui, sans-serif; box-shadow: 0 10px 30px rgba(0, 0, 0, .35);\n}\n.rd-coalition[hidden] { display: none; }\n.rd-coal-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-bottom: 8px; }\n.rd-coal-head strong { font-weight: 800; font-size: 14px; }\n.rd-coal-head span { color: var(--rd-panel-muted); font-size: 11.5px; }\n.rd-bloc-bar { position: relative; display: flex; height: 14px; background: rgba(148, 163, 184, .2); overflow: visible; }\n.rd-bloc-bar span { height: 100%; }\n.rd-bloc-bar i { position: absolute; top: -4px; bottom: -4px; width: 2px; margin-left: -1px; background: var(--rd-panel-fg); }\n.rd-verdict { margin: 8px 0 10px; font-size: 12px; }\n.rd-bloc { padding: 7px 0; border-top: 1px solid var(--rd-panel-line); }\n.rd-bloc-head { display: flex; align-items: center; gap: 7px; font-weight: 700; }\n.rd-bloc-head strong { margin-left: auto; font-size: 18px; font-weight: 900; }\n.rd-dot { width: 10px; height: 10px; border-radius: 50%; flex: none; display: inline-block; }\n.rd-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px; }\n.rd-chip { padding: 1px 6px; border-left: 4px solid var(--c); background: rgba(148, 163, 184, .14); font-size: 11.5px; font-weight: 700; }\n.rd-spark-label { margin-top: 8px; color: var(--rd-panel-muted); font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; }\n.rd-spark { display: block; width: 100%; height: 70px; margin-top: 4px; color: var(--rd-panel-muted); }\n.rd-spark-empty { color: var(--rd-panel-muted); font-size: 11.5px; margin-top: 4px; }\n@media (max-width: 760px) { .rd-coalition { right: 8px; left: 8px; width: auto; top: 8px; } }\n\n/* ---------- overhang notice ---------- */\n.rd-overhang {\n  max-width: 460px;\n  padding: 7px 12px; background: #fef3c7; color: #422006; border: 1px solid #f59e0b;\n  font: 500 12.5px/1.45 Montserrat, system-ui, sans-serif; box-shadow: 0 6px 18px rgba(0, 0, 0, .25);\n}\n.rd-overhang[hidden] { display: none; }\n@media (max-width: 900px) { .rd-overhang { max-width: none; font-size: 11.5px; } }\n\n/* ---------- sitting MP in electorate panel ---------- */\n.rd-held {\n  grid-column: 1; /* the panel header is a 2-column grid; stay under the title, left of the % box */\n  display: flex; flex-wrap: wrap; align-items: center; gap: 4px 7px; margin-top: 6px;\n  font: 600 12px/1.3 Montserrat, system-ui, sans-serif; color: inherit;\n}\n.rd-held-label { font-size: 9.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; opacity: .6; }\n.rd-held-name { font-weight: 800; }\n.rd-held-party { padding: 1px 6px; border-left: 4px solid var(--c); background: rgba(148, 163, 184, .16); font-size: 10.5px; font-weight: 800; text-transform: uppercase; }\n.rd-held-was, .rd-held-new { opacity: .7; font-size: 11px; }\n\n/* ---------- TV mode ---------- */\n.rd-tv-btn { display: inline-flex !important; align-items: center; gap: 6px; }\n.rd-tv-panel { display: none; }\nbody.rd-tv { overflow: hidden !important; }\n/* .rd-tv repeated to outrank the site's own body.dashboard-body[data-dashboard-view] rules */\nbody.rd-tv.rd-tv.rd-tv #mapWrap {\n  position: fixed !important; inset: 0 31vw 0 0 !important; width: auto !important; height: auto !important;\n  z-index: 9000 !important; margin: 0 !important; background: #050b16; display: block !important;\n}\nbody.rd-tv.rd-tv.rd-tv #map { position: absolute !important; inset: 0 !important; width: 100% !important; height: 100% !important; display: block !important; }\nbody.rd-tv.rd-tv.rd-tv #mapWrap > :not(#map):not(.rd-dock):not(.map-stage-texture):not(#featurePopup):not(.rd-coalition):not(.rd-tv-coal-toggle) { display: none !important; }\nbody.rd-tv #rdOverhang { display: none !important; }\nbody.rd-tv .rd-legend { font-size: 13px; }\nbody.rd-tv .rd-pin-chip { font-size: 14px; }\nbody.rd-tv .rd-badge { font-size: 13px; }\nbody.rd-tv .rd-tv-panel {\n  display: flex; flex-direction: column; gap: 1.2vh;\n  position: fixed; top: 0; right: 0; bottom: 0; width: 31vw; z-index: 9001; overflow: hidden;\n  padding: 2.4vh 1.8vw; background: #071426; color: #e5edf7; border-left: 1px solid rgba(148, 163, 184, .2);\n  font: 500 clamp(13px, 1.05vw, 22px)/1.35 Montserrat, system-ui, sans-serif;\n}\n.rd-tv-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }\n.rd-tv-title { font-weight: 900; font-size: 1.9em; letter-spacing: -.01em; }\n.rd-tv-sub { color: #94a3b8; }\n.rd-tv-actions { display: flex; gap: 6px; }\n.rd-tv-actions button { white-space: nowrap; padding: .3em .7em; border: 1px solid rgba(148, 163, 184, .35); background: transparent; color: inherit; font: 700 .8em Montserrat, sans-serif; cursor: pointer; }\n.rd-tv-seats { display: grid; gap: .55vh; }\n.rd-tv-row { display: grid; grid-template-columns: 8.5em 1fr 2.4em; align-items: center; gap: .6em; font-weight: 700; }\n.rd-tv-row strong { text-align: right; font-size: 1.45em; font-weight: 900; }\n.rd-tv-row sup { color: #f59e0b; }\n.rd-tv-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.rd-tv-bar { height: 1.15em; background: rgba(148, 163, 184, .12); }\n.rd-tv-bar i { display: block; height: 100%; }\n.rd-tv-coal { padding-top: 1vh; border-top: 1px solid rgba(148, 163, 184, .2); }\n.rd-tv-coal-head { margin-bottom: .5em; color: #94a3b8; }\n.rd-tv-coal .rd-bloc-bar { height: 1.3em; }\n.rd-tv-coal .rd-bloc-bar i { background: #fff; }\n.rd-tv-blocs { display: grid; gap: .2em; margin-top: .6em; }\n.rd-tv-blocs span { display: flex; align-items: center; gap: .5em; }\n.rd-tv-blocs i { width: .8em; height: .8em; border-radius: 50%; }\n.rd-tv-blocs b { margin-left: auto; font-size: 1.25em; }\n.rd-tv-overhang { position: static; transform: none; max-width: none; font-size: .9em; }\n.rd-tv-ticker-label { padding-top: 1vh; border-top: 1px solid rgba(148, 163, 184, .2); color: #94a3b8; font-size: .78em; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; }\n.rd-ticker { display: grid; gap: .45em; min-height: 0; overflow: hidden; }\n.rd-ticker-item { display: grid; grid-template-columns: auto auto 1fr auto; align-items: center; gap: .55em; font-size: .92em; }\n.rd-ticker-item span:not(.rd-dot) { color: #cbd5e1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.rd-ticker-item small { color: #94a3b8; }\n.rd-ticker-item.is-lead-change b { color: #fda4af; }\n@media (max-width: 900px) {\n  body.rd-tv #mapWrap { inset: 0 0 46vh 0 !important; }\n  body.rd-tv .rd-tv-panel { top: 54vh; width: 100%; border-left: 0; overflow: auto; }\n}\n\n/* ---------- light mode ---------- */\n/* Tint the sea so pale land (no results yet) stands out from it. */\nbody.light-mode #map.leaflet-container,\nbody.light-mode .map-wrap { background: #edf2f7 !important; }\n/* Yellow accents are unreadable on white; use a deep amber instead. */\nbody.light-mode .rd-coal-btn.active { color: #b45309 !important; }\nbody.light-mode .rd-pin-btn.is-pinned { color: #d97706; }\nbody.light-mode .rd-badge { border-color: rgba(15, 29, 51, .35); box-shadow: 0 2px 6px rgba(15, 29, 51, .2); }\nbody.light-mode .rd-pin-chip, body.light-mode .rd-legend, body.light-mode .rd-coalition { box-shadow: 0 4px 14px rgba(15, 29, 51, .12); }\nbody.light-mode .rd-bloc-bar { background: rgba(15, 29, 51, .08); }\nbody.light-mode .rd-chip, body.light-mode .rd-held-party { background: rgba(15, 29, 51, .06); }\n/* TV mode follows the theme too. */\nbody.light-mode.rd-tv.rd-tv.rd-tv #mapWrap { background: #edf2f7 !important; }\nbody.light-mode.rd-tv .rd-tv-panel { background: #ffffff; color: #0f1d33; border-left-color: rgba(15, 29, 51, .14); }\nbody.light-mode .rd-tv-sub, body.light-mode .rd-tv-coal-head, body.light-mode .rd-tv-ticker-label,\nbody.light-mode .rd-ticker-item small { color: #55657d; }\nbody.light-mode .rd-ticker-item span:not(.rd-dot) { color: #334155; }\nbody.light-mode .rd-ticker-item.is-lead-change b { color: #be123c; }\nbody.light-mode .rd-tv-bar { background: rgba(15, 29, 51, .08); }\nbody.light-mode .rd-tv-coal, body.light-mode .rd-tv-ticker-label { border-top-color: rgba(15, 29, 51, .12); }\nbody.light-mode .rd-tv-coal .rd-bloc-bar i { background: #0f1d33; }\nbody.light-mode .rd-tv-actions button { border-color: rgba(15, 29, 51, .25); }\n\n/* ---------- changelog (replaces Help) ---------- */\nheader .nav-btn[data-nav=\"help\"] { display: none !important; }\n.rd-cl-btn { display: inline-flex !important; align-items: center; gap: 6px; }\n.rd-cl-backdrop {\n  position: fixed; inset: 0; z-index: 10000; display: grid; place-items: center; padding: 16px;\n  background: rgba(2, 8, 20, .6);\n}\n.rd-cl-backdrop[hidden] { display: none; }\n.rd-cl {\n  width: min(520px, 100%); max-height: min(80vh, 720px); display: flex; flex-direction: column;\n  background: #0f1d33; color: #e5edf7; border: 1px solid rgba(148, 163, 184, .25);\n  box-shadow: 0 24px 60px rgba(0, 0, 0, .5); font: 500 14px/1.5 Montserrat, system-ui, sans-serif;\n}\n.rd-cl-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 20px 22px 14px; border-bottom: 1px solid rgba(148, 163, 184, .2); }\n.rd-cl-head h2 { margin: 0; font-size: 24px; font-weight: 800; }\n.rd-cl-head p { margin: 2px 0 0; color: #94a3b8; font-size: 12.5px; font-weight: 600; }\n.rd-cl-close {\n  width: 34px; height: 34px; flex: none; border: 1px solid rgba(148, 163, 184, .3); background: transparent;\n  color: inherit; font: 400 20px/1 system-ui, sans-serif; cursor: pointer;\n}\n.rd-cl-close:hover, .rd-cl-close:focus-visible { background: rgba(148, 163, 184, .15); }\n.rd-cl-body { overflow-y: auto; padding: 6px 22px 18px; overscroll-behavior: contain; }\n.rd-cl-ver { padding: 12px 0; border-bottom: 1px solid rgba(148, 163, 184, .14); }\n.rd-cl-ver:last-child { border-bottom: 0; }\n.rd-cl-ver h3 { margin: 0 0 4px; font-size: 13px; font-weight: 800; letter-spacing: .04em; color: #fde047; }\n.rd-cl-ver ul { margin: 0; padding-left: 18px; }\n.rd-cl-ver li { margin: 2px 0; }\nbody.light-mode .rd-cl-backdrop { background: rgba(15, 29, 51, .35); }\nbody.light-mode .rd-cl { background: #ffffff; color: #0f1d33; border-color: rgba(15, 29, 51, .14); box-shadow: 0 24px 60px rgba(15, 29, 51, .25); }\nbody.light-mode .rd-cl-head { border-bottom-color: rgba(15, 29, 51, .1); }\nbody.light-mode .rd-cl-head p { color: #55657d; }\nbody.light-mode .rd-cl-close { border-color: rgba(15, 29, 51, .2); }\nbody.light-mode .rd-cl-ver { border-bottom-color: rgba(15, 29, 51, .08); }\nbody.light-mode .rd-cl-ver h3 { color: #b45309; }\n\n/* ---------- TV mode: coalition tracker, top-left ---------- */\n.rd-tv-coal-toggle { display: none; }\nbody.rd-tv .rd-tv-coal-toggle {\n  position: absolute; top: 14px; left: 14px; z-index: 840;\n  display: inline-flex; align-items: center; gap: 7px; padding: 7px 12px; cursor: pointer;\n  background: var(--rd-panel-bg); color: var(--rd-panel-fg); border: 1px solid var(--rd-panel-line);\n  font: 700 13px/1 Montserrat, system-ui, sans-serif; box-shadow: 0 4px 14px rgba(0, 0, 0, .3);\n}\nbody.rd-tv .rd-tv-coal-toggle svg { width: 16px; height: 16px; }\nbody.rd-tv .rd-tv-coal-toggle:hover, body.rd-tv .rd-tv-coal-toggle:focus-visible { border-color: var(--rd-panel-muted); }\nbody.rd-tv .rd-tv-coal-toggle[aria-pressed=\"true\"] { color: #fde047; }\nbody.light-mode.rd-tv .rd-tv-coal-toggle[aria-pressed=\"true\"] { color: #b45309; }\nbody.light-mode.rd-tv .rd-tv-coal-toggle { box-shadow: 0 4px 14px rgba(15, 29, 51, .14); }\nbody.rd-tv .rd-coalition { top: 58px; left: 14px; right: auto; width: 340px; max-height: calc(100% - 80px); font-size: 13.5px; }\n";
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
    renderPins();
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
    tvCoalitionButton();
  }

  function toggleCoalition(force) {
    coalOpen = typeof force === 'boolean' ? force : !coalOpen;
    store.set('rd-coalition-open', coalOpen);
    ensureCoalitionUi();
    const p = $('#rdCoalition');
    if (p) p.hidden = !coalOpen;
    renderSeatsUi();
    // In TV mode the tracker sits top-left over the map: re-fit NZ around it.
    if (document.body.classList.contains('rd-tv')) setTimeout(() => { try { applyBestView(false); } catch { /* ignore */ } }, 50);
  }

  // TV mode: "Coalition" button in the top-left corner of the map (shares the tracker's open state).
  function tvCoalitionButton() {
    const wrap = $('#mapWrap');
    if (!wrap) return;
    let b = wrap.querySelector(':scope > .rd-tv-coal-toggle');
    if (!b) {
      b = el('button', 'rd-tv-coal-toggle', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M2 20c0-3.3 2.7-6 6-6s6 2.7 6 6M12 14.5c1.1-.3 2.5-.5 4-.5 3.3 0 6 2.7 6 6"/></svg><span>Coalition</span>');
      b.type = 'button';
      b.title = 'Show or hide the coalition tracker';
      b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); toggleCoalition(); });
      wrap.appendChild(b);
    }
    if (b.getAttribute('aria-pressed') !== String(coalOpen)) b.setAttribute('aria-pressed', String(coalOpen));
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
  // Best fit for the TV-sized map, applied directly (the site's reset waits for animation frames
  // and can run before the map has resized), then once more after the layout settles.
  function tvFitNz() {
    const fit = () => { try { map.invalidateSize(false); applyBestView(false); } catch { /* ignore */ } };
    fit();
    setTimeout(fit, 600);
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
    const total = Number(r?.voting_places_total) || 0;
    const pct = total > 0 ? (Number(r.voting_places_counted) || 0) / total * 100 : (r ? Number(r.reporting_pct) || 0 : null);
    let flip = false;
    try { flip = has && getMapDataResultStatus(r) === 'flipped'; } catch { /* no comparison data */ }
    return `<div class="rd-pin-chip">
      <button type="button" class="rd-pin-open" data-pin="${esc(name)}" title="Open ${esc(name)}">
        <span class="rd-pin-bar${flip ? ' is-flip' : ''}" style="--c:${has ? partyColor(lead) : '#64748b'}"></span>
        <b>${esc(name)}</b>
        <span class="rd-pin-lead">${has ? `${esc(partyLabel(lead))} +${fmt(margin)}` : 'no votes yet'}</span>
        ${pct == null ? '' : `<span class="rd-pin-pct">${pct.toFixed(0)}%</span>`}
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
    const body = list.querySelector('.candidate-results-body');
    // Measure the list's natural collapsed height (uncapped), then cap the expanded list at it.
    const root = document.documentElement.style;
    root.removeProperty('--rd-party-body-h');
    const h = Math.round(body?.getBoundingClientRect().height || 0);
    if (h > 0) root.setProperty('--rd-party-body-h', `${h}px`);
    partyExpandAt = Date.now();
    btn.click();
  }

  // ---------------------------------------------------------------------------
  // 15. Changelog replaces the Help button in the header.
  // ---------------------------------------------------------------------------
  const CHANGELOG = [
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
  function changelogButton() {
    const help = $('header .nav-btn[data-nav="help"]');
    if (!help) return;
    if (help.style.display !== 'none') help.style.setProperty('display', 'none', 'important'); // site CSS outranks a stylesheet rule
    if ($('#rdChangelogBtn')) return;
    const b = el('button', 'nav-btn rd-cl-btn', '<svg class="utility-nav-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v4l2.5 2.5"/><path d="M3.05 11a9 9 0 1 1 .5 4"/><path d="M3 4v5h5"/></svg><span>Changelog</span>');
    b.id = 'rdChangelogBtn';
    b.type = 'button';
    b.setAttribute('aria-haspopup', 'dialog');
    b.addEventListener('click', openChangelog);
    help.insertAdjacentElement('beforebegin', b);
  }

  // Repaint the map when switching light/dark (light mode uses a different "no result" grey).
  let wasLight = document.body.classList.contains('light-mode');
  new MutationObserver(() => {
    const isLight = document.body.classList.contains('light-mode');
    if (isLight === wasLight) return;
    wasLight = isLight;
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
      const panel = visibleRect($('#mapDetailPanel'));
      if (panel && panel.left < m.left + m.width / 2) left = Math.max(left, panel.right - m.left + gap);
      const rail = visibleRect($('#mapMagicWallControlsRail'));
      if (rail && rail.right > m.left + m.width / 2) right = Math.max(right, m.right - rail.left + gap);
      if (left + right > m.width - 120) { left = gap; right = gap; } // too narrow to dodge them; just fit
      // The key and overhang notice are obstacles (each on its own). Pinned chips are ignored:
      // they may sit over land rather than shrink the map.
      const items = $('#rdDock') ? [...$('#rdDock').querySelectorAll(':scope > .rd-overhang, :scope > .rd-legend')] : [];
      // TV mode: the top-left Coalition button and tracker sit over the map, so keep land clear of them.
      if (document.body.classList.contains('rd-tv')) items.push($('#mapWrap > .rd-tv-coal-toggle'), $('#rdCoalition'));
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
    changelogButton();
    headerToggle();
    updateLayoutVars();
    renderSeatsUi();
    scanChanges();
    decorateHeldBy();
    decoratePinButtons();
    renderPins();
    expandPartyList();
    ensureResetViewBtn();
    new MutationObserver(() => { ensureCoalitionUi(); ensureResetViewBtn(); tvButton(); changelogButton(); buildLegend(); decorateHeldBy(); decoratePinButtons(); headerToggle(); expandPartyList(); })
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
      document.documentElement.dataset.rdPlus = 'active';
      console.log('[ResultsDesk Plus] active v' + '1.8.3' + ' · window ' + innerWidth + 'x' + innerHeight + (innerWidth < 901 ? ' (stacked layout: full-window map changes need 901px+)' : ''));
    } else if (++tries < 900) {
      setTimeout(whenReady, 100);
    } else {
      console.warn('[ResultsDesk Plus] app globals not found — site may have changed');
    }
  })();
}

// Firefox content-script sandboxes expose window.wrappedJSObject; the real page does not.
const sandboxed = typeof window.wrappedJSObject !== 'undefined' ||
  (typeof unsafeWindow !== 'undefined' && unsafeWindow !== window);

if (!sandboxed) {
  rdPlusMain();
} else {
  console.log('[ResultsDesk Plus] v1.8.3 in Firefox sandbox, moving into the page…');
  const s = document.createElement('script');
  s.textContent = '(' + rdPlusMain.toString() + ')();';
  (document.head || document.documentElement).appendChild(s);
  s.remove();
  // Inline scripts run synchronously on insertion, so if the marker isn't set now, the
  // site's CSP blocked it (Tampermonkey started us too late). Fall back to the sandbox so
  // at least the styling still applies, and say how to fix it.
  if (!document.documentElement.dataset.rdPlus) {
    console.warn('[ResultsDesk Plus] Firefox blocked the script from entering the page because Tampermonkey started it ' +
      "after the site's security policy loaded. Only the styling will work. Fix: Tampermonkey > Dashboard > Settings > " +
      'Config mode: Advanced, then under Experimental set Inject Mode: Instant, save, and reload resultsdesk.nz.');
    rdPlusMain();
  } else {
    console.log('[ResultsDesk Plus] moved into the page OK');
  }
}
})();

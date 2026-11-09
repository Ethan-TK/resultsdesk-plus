// ==UserScript==
// @name         ResultsDesk Plus
// @namespace    resultsdesk-plus
// @version      2.3.0
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
    style.textContent = "/* ResultsDesk clone extras */\r\n@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');\r\n.app-support-link, .app-contact-link { display: none !important; }\r\n\r\n/* ---------- rebrand logo ---------- */\r\n.app-brand .rd-brand-text {\r\n  font: 400 34px/1 'Bebas Neue', 'Oswald', Impact, sans-serif; letter-spacing: .01em;\r\n  color: #fff; white-space: nowrap; display: inline-block; transform: translateY(2px);\r\n}\r\n.app-brand .rd-brand-text b { font-weight: 400; color: #fde047; }\r\nbody.light-mode .app-brand .rd-brand-text { color: #0f1d33; }\r\nbody.light-mode .app-brand .rd-brand-text b { color: #b45309; }\r\n@media (max-width: 660px) { .app-brand .rd-brand-text { font-size: 26px; } }\r\n\r\n/* ---------- no footer ---------- */\r\nbody.dashboard-body .dashboard-footer { display: none !important; }\r\n\r\n/* ---------- desktop map view: edge to edge, fills the window, never moves ----------\r\n   901px+ is the site's map-with-side-panel layout (below that it stacks into a scrolling sheet).\r\n   `clip` (unlike `hidden`) also stops the site's own scrollIntoView calls nudging the page.\r\n   --rd-map-top is the map's top edge, kept up to date by extras.js. */\r\nhtml, body { overscroll-behavior: none; }\r\n@media (min-width: 901px) {\r\n  /* Edge to edge on every tab (Map, Electorates, Trends). The [data-dashboard-view] attribute\r\n     selector matches the site's own per-view rules so ours win. */\r\n  html body.dashboard-body[data-dashboard-view] .dashboard-shell {\r\n    width: 100% !important; max-width: none !important; margin-left: 0 !important; margin-right: 0 !important;\r\n    padding-left: 0 !important; padding-right: 0 !important;\r\n  }\r\n  html body.dashboard-body[data-dashboard-view] .app-header-inner {\r\n    width: 100% !important; max-width: none !important; margin: 0 !important; padding: 0 16px !important;\r\n  }\r\n  html body.dashboard-body[data-dashboard-view] .dashboard-view-tabs { padding-left: 8px !important; }\r\n  /* Map tab only: exact window height, no page scroll. */\r\n  html:has(body.dashboard-body[data-dashboard-view=\"map\"]) { overflow: clip !important; height: 100% !important; }\r\n  html body.dashboard-body[data-dashboard-view=\"map\"] { overflow: clip !important; height: 100vh !important; min-height: 0 !important; }\r\n  html body.dashboard-body[data-dashboard-view=\"map\"] .dashboard-shell { margin: 0 !important; padding: 0 !important; }\r\n  html body.dashboard-body[data-dashboard-view=\"map\"] .map-card,\r\n  html body.dashboard-body[data-dashboard-view=\"map\"] .map-card-body,\r\n  html body.dashboard-body[data-dashboard-view=\"map\"] #mapWrap,\r\n  html body.dashboard-body[data-dashboard-view=\"map\"] #map {\r\n    height: calc(100vh - var(--rd-map-top, 81px)) !important; max-height: none !important; min-height: 0 !important;\r\n    border-radius: 0 !important;\r\n  }\r\n}\r\n\r\n/* ---------- national party list: all parties, scrolling inside the same-size box ----------\r\n   extras.js measures the list while collapsed (--rd-party-body-h) and then expands it, so the\r\n   box keeps its size; the column headings, totals row and footer stay fixed. On short windows\r\n   the list shrinks instead, so the footer is never pushed off screen. */\r\n@media (min-width: 901px) {\r\n  #mapDetailPanel.has-national-summary { display: flex !important; flex-direction: column; overflow: hidden !important; }\r\n  #mapDetailPanel.has-national-summary > #mapDetailContent { flex: 0 1 auto; min-height: 0; display: flex; flex-direction: column; }\r\n  #mapDetailPanel .map-national-summary { flex: 0 1 auto; min-height: 0; display: flex; flex-direction: column; }\r\n  #mapDetailPanel .map-national-summary > .popup-header,\r\n  #mapDetailPanel .map-national-summary > .popup-footer { flex: none; }\r\n  #mapDetailPanel .map-national-results { flex: 0 1 auto; min-height: 0; display: flex; flex-direction: column; }\r\n  #mapDetailPanel .map-national-results > .candidate-results-head,\r\n  #mapDetailPanel .map-national-results > .map-national-total-row { flex: none; }\r\n  #mapDetailPanel .map-national-results > .candidate-results-body {\r\n    flex: 1 1 auto; min-height: 0; max-height: none;\r\n    overflow-y: auto; overscroll-behavior: contain;\r\n    scrollbar-width: none; /* Firefox: still scrolls, no visible bar */\r\n  }\r\n  #mapDetailPanel .map-national-results > .candidate-results-body::-webkit-scrollbar { display: none; } /* Chrome/Edge */\r\n  #mapDetailPanel .map-national-results .candidate-result-show-more-row:has([aria-expanded=\"true\"]) { display: none !important; }\r\n}\r\n\r\n/* ---------- top bar show/hide arrow ---------- */\r\nbody.rd-hide-header .app-header { display: none !important; }\r\n.rd-header-toggle {\r\n  position: fixed; left: 50%; top: var(--rd-header-h, 50px); transform: translateX(-50%); z-index: 9500;\r\n  width: 44px; height: 18px; padding: 0; display: grid; place-items: center; cursor: pointer;\r\n  border: 1px solid var(--rd-panel-line); border-top: 0; border-radius: 0 0 8px 8px;\r\n  background: var(--rd-panel-bg); color: var(--rd-panel-fg); opacity: .75;\r\n}\r\n.rd-header-toggle:hover, .rd-header-toggle:focus-visible { opacity: 1; }\r\n.rd-header-toggle svg { width: 14px; height: 14px; transition: transform .2s; }\r\nbody.rd-hide-header .rd-header-toggle { top: 0; }\r\nbody.rd-hide-header .rd-header-toggle svg { transform: rotate(180deg); }\r\nbody.rd-tv .rd-header-toggle { display: none; }\r\n\r\n:root {\r\n  --rd-panel-bg: rgba(7, 20, 38, .94);\r\n  --rd-panel-fg: #e5edf7;\r\n  --rd-panel-muted: #94a3b8;\r\n  --rd-panel-line: rgba(148, 163, 184, .22);\r\n}\r\nbody.light-mode {\r\n  --rd-panel-bg: rgba(255, 255, 255, .96);\r\n  --rd-panel-fg: #0f1d33;\r\n  --rd-panel-muted: #55657d;\r\n  --rd-panel-line: rgba(15, 29, 51, .14);\r\n}\r\n\r\n/* ---------- last-changed badges ---------- */\r\n.rd-badge-wrap { background: none !important; border: 0 !important; width: 0 !important; height: 0 !important; }\r\n.rd-badge {\r\n  position: absolute; transform: translate(-50%, -50%);\r\n  display: inline-flex; align-items: center; gap: 5px; white-space: nowrap;\r\n  padding: 2px 7px; border-radius: 999px;\r\n  font: 800 10.5px/1.5 Montserrat, system-ui, sans-serif; letter-spacing: .02em;\r\n  background: #fde047; color: #111827; border: 1px solid rgba(0, 0, 0, .35);\r\n  box-shadow: 0 2px 6px rgba(0, 0, 0, .35);\r\n  opacity: var(--rd-age, 1); pointer-events: none;\r\n}\r\n.rd-badge span { font-weight: 600; opacity: .72; }\r\n.rd-badge.is-lead-change { background: #fff; outline: 2px solid #f43f5e; }\r\n.rd-badge.is-fresh { animation: rd-pulse 1.3s ease-out infinite; }\r\n@keyframes rd-pulse {\r\n  0% { box-shadow: 0 0 0 0 rgba(253, 224, 71, .85); }\r\n  100% { box-shadow: 0 0 0 14px rgba(253, 224, 71, 0); }\r\n}\r\n\r\n/* ---------- bottom-right stack: overhang notice, pinned electorates, key ---------- */\r\n.rd-dock {\r\n  position: absolute; right: 84px; bottom: 10px; z-index: 825;\r\n  display: flex; flex-direction: column; align-items: flex-end; gap: 6px;\r\n  /* Kept fairly narrow so it tucks into the sea south-east of Otago instead of shrinking the map fit. */\r\n  max-width: min(560px, calc(100% - 120px)); pointer-events: none;\r\n}\r\n.rd-dock > * { pointer-events: auto; }\r\n.rd-dock > [hidden] { display: none !important; }\r\n/* Stacked layout: the results sheet covers the bottom of the map, so sit at the top instead. */\r\n@media (max-width: 900px) {\r\n  .rd-dock { top: 52px; bottom: auto; left: 8px; right: 84px; max-width: none; flex-direction: column-reverse; align-items: flex-start; }\r\n}\r\nbody.rd-tv .rd-dock { right: 12px; }\r\n\r\n/* ---------- pinned electorates ---------- */\r\n.rd-pins { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }\r\n.rd-pin-chip {\r\n  display: inline-flex; align-items: stretch; padding: 0 3px 0 0;\r\n  background: var(--rd-panel-bg); color: var(--rd-panel-fg); border: 1px solid var(--rd-panel-line);\r\n  font: 600 11.5px/1.2 Montserrat, system-ui, sans-serif; white-space: nowrap;\r\n  box-shadow: 0 4px 12px rgba(0, 0, 0, .25);\r\n}\r\n.rd-pin-chip:hover { border-color: var(--rd-panel-muted); }\r\n.rd-pin-open {\r\n  display: inline-flex; align-items: center; gap: 6px; padding: 4px 2px 4px 0; margin: 0;\r\n  border: 0; background: transparent; color: inherit; font: inherit; cursor: pointer; text-align: left;\r\n}\r\n.rd-pin-bar { align-self: stretch; width: 5px; background: var(--c, #64748b); }\r\n.rd-pin-bar.is-flip { background: repeating-linear-gradient(-45deg, var(--c) 0 3px, rgba(10, 14, 24, .7) 3px 5px); }\r\n.rd-pin-chip b { font-weight: 800; }\r\n.rd-pin-chip .rd-pin-lead { color: var(--rd-panel-muted); font-weight: 700; }\r\n.rd-pin-chip .rd-pin-pct { color: var(--rd-panel-muted); font-size: 10.5px; }\r\n.rd-pin-x {\r\n  display: grid; place-items: center; align-self: center; width: 18px; height: 18px; margin-left: 2px; padding: 0;\r\n  border: 0; border-radius: 3px; background: transparent; cursor: pointer;\r\n  color: var(--rd-panel-muted); font: 400 14px/1 system-ui, sans-serif;\r\n}\r\n.rd-pin-x:hover { background: rgba(148, 163, 184, .2); color: var(--rd-panel-fg); }\r\n@media (max-width: 900px) { .rd-pins { align-items: flex-start; } }\r\n\r\n/* pin toggle in the electorate panel header */\r\n.rd-pin-btn {\r\n  display: inline-grid; place-items: center; width: 22px; height: 22px; margin-left: 6px; padding: 0;\r\n  vertical-align: middle; border: 0; border-radius: 4px; background: transparent; cursor: pointer;\r\n  color: inherit; opacity: .35; transition: opacity .15s, color .15s;\r\n}\r\n.rd-pin-btn svg { width: 15px; height: 15px; }\r\n.popup-header:hover .rd-pin-btn, .rd-pin-btn:focus-visible { opacity: .75; }\r\n.rd-pin-btn:hover { opacity: 1; background: rgba(148, 163, 184, .16); }\r\n.rd-pin-btn.is-pinned { opacity: 1; color: #fde047; }\r\n.rd-pin-btn.is-pinned svg { fill: currentColor; }\r\n\r\n/* ---------- margin legend ---------- */\r\n.rd-legend {\r\n  position: static;\r\n  display: flex; align-items: center; gap: 4px; padding: 5px 9px;\r\n  background: var(--rd-panel-bg); color: var(--rd-panel-fg); border: 1px solid var(--rd-panel-line);\r\n  font: 600 11px Montserrat, system-ui, sans-serif; white-space: nowrap;\r\n}\r\n.rd-legend small { margin-right: 5px; color: var(--rd-panel-muted); font-size: 10.5px; }\r\n/* --rd-key = colour of the currently leading party (set by extras.js); blue until results arrive */\r\n.rd-legend .rd-sw { width: 14px; height: 11px; background: var(--rd-key, #3b82f6); transition: background .4s; }\r\n.rd-legend .rd-sw-hatch { opacity: .9; background: repeating-linear-gradient(-45deg, var(--rd-key, #3b82f6) 0 4px, rgba(10, 14, 24, .75) 4px 7px); }\r\n.rd-legend-toggle {\r\n  margin-right: 6px; padding: 2px 7px; border: 1px solid var(--rd-panel-line); background: transparent;\r\n  color: inherit; font: 800 10.5px Montserrat, system-ui, sans-serif; text-transform: uppercase; cursor: pointer;\r\n}\r\n.rd-legend.is-off .rd-sw:not(.rd-sw-hatch) { opacity: .85 !important; filter: grayscale(1); }\r\n.rd-legend.is-off .rd-legend-toggle { text-decoration: line-through; }\r\n@media (max-width: 900px) { .rd-legend small { display: none; } }\r\n\r\n/* ---------- coalition tracker ---------- */\r\n.rd-coal-btn.active { color: #fde047 !important; }\r\n.map-icon-button.rd-reset-view-btn[hidden] { display: none !important; }\r\n/* The site's own house-icon Reset is replaced by our Reset view button. */\r\n#mapMagicWallControlsRail .map-icon-button[data-map-icon=\"reset\"] { display: none !important; }\r\n.rd-coalition {\r\n  position: absolute; top: 12px; right: 84px; z-index: 830; width: 330px; max-height: calc(100% - 70px); overflow: auto;\r\n  padding: 12px; background: var(--rd-panel-bg); color: var(--rd-panel-fg); border: 1px solid var(--rd-panel-line);\r\n  font: 500 12.5px/1.4 Montserrat, system-ui, sans-serif; box-shadow: 0 10px 30px rgba(0, 0, 0, .35);\r\n}\r\n.rd-coalition[hidden] { display: none; }\r\n.rd-coal-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-bottom: 8px; }\r\n.rd-coal-head strong { font-weight: 800; font-size: 14px; }\r\n.rd-coal-head span { color: var(--rd-panel-muted); font-size: 11.5px; }\r\n.rd-bloc-bar { position: relative; display: flex; height: 14px; background: rgba(148, 163, 184, .2); overflow: visible; }\r\n.rd-bloc-bar span { height: 100%; }\r\n.rd-bloc-bar i { position: absolute; top: -4px; bottom: -4px; width: 2px; margin-left: -1px; background: var(--rd-panel-fg); }\r\n.rd-verdict { margin: 8px 0 10px; font-size: 12px; }\r\n.rd-bloc { padding: 7px 0; border-top: 1px solid var(--rd-panel-line); }\r\n.rd-bloc-head { display: flex; align-items: center; gap: 7px; font-weight: 700; }\r\n.rd-bloc-head strong { margin-left: auto; font-size: 18px; font-weight: 900; }\r\n.rd-dot { width: 10px; height: 10px; border-radius: 50%; flex: none; display: inline-block; }\r\n.rd-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px; }\r\n.rd-chip { padding: 1px 6px; border-left: 4px solid var(--c); background: rgba(148, 163, 184, .14); font-size: 11.5px; font-weight: 700; }\r\n.rd-spark-label { margin-top: 8px; color: var(--rd-panel-muted); font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; }\r\n.rd-spark { display: block; width: 100%; height: 70px; margin-top: 4px; color: var(--rd-panel-muted); }\r\n.rd-spark-empty { color: var(--rd-panel-muted); font-size: 11.5px; margin-top: 4px; }\r\n@media (max-width: 760px) { .rd-coalition { right: 8px; left: 8px; width: auto; top: 8px; } }\r\n\r\n/* ---------- overhang notice ---------- */\r\n.rd-overhang {\r\n  max-width: 460px;\r\n  padding: 7px 12px; background: #fef3c7; color: #422006; border: 1px solid #f59e0b;\r\n  font: 500 12.5px/1.45 Montserrat, system-ui, sans-serif; box-shadow: 0 6px 18px rgba(0, 0, 0, .25);\r\n}\r\n.rd-overhang[hidden] { display: none; }\r\n@media (max-width: 900px) { .rd-overhang { max-width: none; font-size: 11.5px; } }\r\n\r\n/* ---------- sitting MP in electorate panel ---------- */\r\n.rd-held {\r\n  grid-column: 1; /* the panel header is a 2-column grid; stay under the title, left of the % box */\r\n  display: flex; flex-wrap: wrap; align-items: center; gap: 4px 7px; margin-top: 6px;\r\n  font: 600 12px/1.3 Montserrat, system-ui, sans-serif; color: inherit;\r\n}\r\n.rd-held-label { font-size: 9.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; opacity: .6; }\r\n.rd-held-name { font-weight: 800; }\r\n.rd-held-party { padding: 1px 6px; border-left: 4px solid var(--c); background: rgba(148, 163, 184, .16); font-size: 10.5px; font-weight: 800; text-transform: uppercase; }\r\n.rd-held-was, .rd-held-new { opacity: .7; font-size: 11px; }\r\n\r\n/* ---------- TV mode ---------- */\r\n.rd-tv-btn { display: inline-flex !important; align-items: center; gap: 6px; }\r\n.rd-tv-panel { display: none; }\r\nbody.rd-tv { overflow: hidden !important; }\r\n/* .rd-tv repeated to outrank the site's own body.dashboard-body[data-dashboard-view] rules */\r\nbody.rd-tv.rd-tv.rd-tv #mapWrap {\r\n  position: fixed !important; inset: 0 31vw 0 0 !important; width: auto !important; height: auto !important;\r\n  z-index: 9000 !important; margin: 0 !important; background: #050b16; display: block !important;\r\n}\r\nbody.rd-tv.rd-tv.rd-tv #map { position: absolute !important; inset: 0 !important; width: 100% !important; height: 100% !important; display: block !important; }\r\nbody.rd-tv.rd-tv.rd-tv #mapWrap > :not(#map):not(.rd-dock):not(.map-stage-texture):not(#featurePopup):not(#mapDetailPanel) { display: none !important; }\r\nbody.rd-tv .rd-coalition, body.rd-tv #rdOverhang { display: none !important; }\r\nbody.rd-tv .rd-legend { font-size: 13px; }\r\nbody.rd-tv .rd-pin-chip { font-size: 14px; }\r\nbody.rd-tv .rd-badge { font-size: 13px; }\r\nbody.rd-tv .rd-tv-panel {\r\n  display: flex; flex-direction: column; gap: 1.2vh;\r\n  position: fixed; top: 0; right: 0; bottom: 0; width: 31vw; z-index: 9001; overflow: hidden;\r\n  padding: 2.4vh 1.8vw; background: #071426; color: #e5edf7; border-left: 1px solid rgba(148, 163, 184, .2);\r\n  font: 500 clamp(13px, 1.05vw, 22px)/1.35 Montserrat, system-ui, sans-serif;\r\n}\r\n.rd-tv-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }\r\n.rd-tv-title { font-weight: 900; font-size: 1.9em; letter-spacing: -.01em; }\r\n.rd-tv-sub { color: #94a3b8; }\r\n.rd-tv-actions { display: flex; gap: 6px; }\r\n.rd-tv-actions button { white-space: nowrap; padding: .3em .7em; border: 1px solid rgba(148, 163, 184, .35); background: transparent; color: inherit; font: 700 .8em Montserrat, sans-serif; cursor: pointer; }\r\n.rd-tv-seats { display: grid; gap: .55vh; }\r\n.rd-tv-row { display: grid; grid-template-columns: 8.5em 1fr 2.4em; align-items: center; gap: .6em; font-weight: 700; }\r\n.rd-tv-row strong { text-align: right; font-size: 1.45em; font-weight: 900; }\r\n.rd-tv-row sup { color: #f59e0b; }\r\n.rd-tv-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\r\n.rd-tv-bar { height: 1.15em; background: rgba(148, 163, 184, .12); }\r\n.rd-tv-bar i { display: block; height: 100%; }\r\n.rd-tv-coal { padding-top: 1vh; border-top: 1px solid rgba(148, 163, 184, .2); }\r\n.rd-tv-coal-head { margin-bottom: .5em; color: #94a3b8; }\r\n.rd-tv-coal .rd-bloc-bar { height: 1.3em; }\r\n.rd-tv-coal .rd-bloc-bar i { background: #fff; }\r\n.rd-tv-blocs { display: grid; gap: .2em; margin-top: .6em; }\r\n.rd-tv-blocs span { display: flex; align-items: center; gap: .5em; }\r\n.rd-tv-blocs i { width: .8em; height: .8em; border-radius: 50%; }\r\n.rd-tv-blocs b { margin-left: auto; font-size: 1.25em; }\r\n.rd-tv-overhang { position: static; transform: none; max-width: none; font-size: .9em; }\r\n.rd-tv-ticker-label { padding-top: 1vh; border-top: 1px solid rgba(148, 163, 184, .2); color: #94a3b8; font-size: .78em; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; }\r\n.rd-ticker { display: grid; gap: .45em; min-height: 0; overflow: hidden; }\r\n.rd-ticker-item { display: grid; grid-template-columns: auto auto 1fr auto; align-items: center; gap: .55em; font-size: .92em; }\r\n.rd-ticker-item span:not(.rd-dot) { color: #cbd5e1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\r\n.rd-ticker-item small { color: #94a3b8; }\r\n.rd-ticker-item.is-lead-change b { color: #fda4af; }\r\n@media (max-width: 900px) {\r\n  body.rd-tv #mapWrap { inset: 0 0 46vh 0 !important; }\r\n  body.rd-tv .rd-tv-panel { top: 54vh; width: 100%; border-left: 0; overflow: auto; }\r\n}\r\n\r\n/* ---------- light mode ---------- */\r\n/* Tint the sea so pale land (no results yet) stands out from it. */\r\nbody.light-mode #map.leaflet-container,\r\nbody.light-mode .map-wrap { background: #edf2f7 !important; }\r\n/* Yellow accents are unreadable on white; use a deep amber instead. */\r\nbody.light-mode .rd-coal-btn.active { color: #b45309 !important; }\r\nbody.light-mode .rd-pin-btn.is-pinned { color: #d97706; }\r\nbody.light-mode .rd-badge { border-color: rgba(15, 29, 51, .35); box-shadow: 0 2px 6px rgba(15, 29, 51, .2); }\r\nbody.light-mode .rd-pin-chip, body.light-mode .rd-legend, body.light-mode .rd-coalition { box-shadow: 0 4px 14px rgba(15, 29, 51, .12); }\r\nbody.light-mode .rd-bloc-bar { background: rgba(15, 29, 51, .08); }\r\nbody.light-mode .rd-chip, body.light-mode .rd-held-party { background: rgba(15, 29, 51, .06); }\r\n/* TV mode follows the theme too. */\r\nbody.light-mode.rd-tv.rd-tv.rd-tv #mapWrap { background: #edf2f7 !important; }\r\nbody.light-mode.rd-tv .rd-tv-panel { background: #ffffff; color: #0f1d33; border-left-color: rgba(15, 29, 51, .14); }\r\nbody.light-mode .rd-tv-sub, body.light-mode .rd-tv-coal-head, body.light-mode .rd-tv-ticker-label,\r\nbody.light-mode .rd-ticker-item small { color: #55657d; }\r\nbody.light-mode .rd-ticker-item span:not(.rd-dot) { color: #334155; }\r\nbody.light-mode .rd-ticker-item.is-lead-change b { color: #be123c; }\r\nbody.light-mode .rd-tv-bar { background: rgba(15, 29, 51, .08); }\r\nbody.light-mode .rd-tv-coal, body.light-mode .rd-tv-ticker-label { border-top-color: rgba(15, 29, 51, .12); }\r\nbody.light-mode .rd-tv-coal .rd-bloc-bar i { background: #0f1d33; }\r\nbody.light-mode .rd-tv-actions button { border-color: rgba(15, 29, 51, .25); }\r\n\r\n/* ---------- changelog (replaces Help) ---------- */\r\nheader .nav-btn[data-nav=\"help\"] { display: none !important; }\r\n.rd-cl-btn { display: inline-flex !important; align-items: center; gap: 6px; }\r\n.rd-cl-backdrop {\r\n  position: fixed; inset: 0; z-index: 10000; display: grid; place-items: center; padding: 16px;\r\n  background: rgba(2, 8, 20, .6);\r\n}\r\n.rd-cl-backdrop[hidden] { display: none; }\r\n.rd-cl {\r\n  width: min(520px, 100%); max-height: min(80vh, 720px); display: flex; flex-direction: column;\r\n  background: #0f1d33; color: #e5edf7; border: 1px solid rgba(148, 163, 184, .25);\r\n  box-shadow: 0 24px 60px rgba(0, 0, 0, .5); font: 500 14px/1.5 Montserrat, system-ui, sans-serif;\r\n}\r\n.rd-cl-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 20px 22px 14px; border-bottom: 1px solid rgba(148, 163, 184, .2); }\r\n.rd-cl-head h2 { margin: 0; font-size: 24px; font-weight: 800; }\r\n.rd-cl-head p { margin: 2px 0 0; color: #94a3b8; font-size: 12.5px; font-weight: 600; }\r\n.rd-cl-close {\r\n  width: 34px; height: 34px; flex: none; border: 1px solid rgba(148, 163, 184, .3); background: transparent;\r\n  color: inherit; font: 400 20px/1 system-ui, sans-serif; cursor: pointer;\r\n}\r\n.rd-cl-close:hover, .rd-cl-close:focus-visible { background: rgba(148, 163, 184, .15); }\r\n.rd-cl-body { overflow-y: auto; padding: 6px 22px 18px; overscroll-behavior: contain; }\r\n.rd-cl-ver { padding: 12px 0; border-bottom: 1px solid rgba(148, 163, 184, .14); }\r\n.rd-cl-ver:last-child { border-bottom: 0; }\r\n.rd-cl-ver h3 { margin: 0 0 4px; font-size: 13px; font-weight: 800; letter-spacing: .04em; color: #fde047; }\r\n.rd-cl-ver ul { margin: 0; padding-left: 18px; }\r\n.rd-cl-ver li { margin: 2px 0; }\r\nbody.light-mode .rd-cl-backdrop { background: rgba(15, 29, 51, .35); }\r\nbody.light-mode .rd-cl { background: #ffffff; color: #0f1d33; border-color: rgba(15, 29, 51, .14); box-shadow: 0 24px 60px rgba(15, 29, 51, .25); }\r\nbody.light-mode .rd-cl-head { border-bottom-color: rgba(15, 29, 51, .1); }\r\nbody.light-mode .rd-cl-head p { color: #55657d; }\r\nbody.light-mode .rd-cl-close { border-color: rgba(15, 29, 51, .2); }\r\nbody.light-mode .rd-cl-ver { border-bottom-color: rgba(15, 29, 51, .08); }\r\nbody.light-mode .rd-cl-ver h3 { color: #b45309; }\r\n\r\n/* ---------- no city labels on the map ---------- */\r\n.leaflet-marker-icon.poi-label-icon, .poi-label-icon .map-place-label, .poi-label-icon .poi-marker-dot { display: none !important; }\r\n.rd-pin-chip .rd-pin-share { color: var(--rd-panel-fg); font-weight: 800; }\r\n\r\n/* ---------- TV mode: selected electorate panel, top-left over the map ---------- */\r\nbody.rd-tv.rd-tv.rd-tv #mapWrap > #mapDetailPanel:not(.has-result) { display: none !important; }\r\nbody.rd-tv.rd-tv.rd-tv #mapWrap > #mapDetailPanel.has-result {\r\n  display: block !important; position: absolute !important; top: 14px !important; left: 14px !important;\r\n  right: auto !important; bottom: auto !important; width: min(500px, 42%) !important; max-width: none !important;\r\n  max-height: calc(100% - 28px) !important; overflow: auto !important; z-index: 850 !important; transform: none !important;\r\n}\r\n.rd-tv-detail-close { display: none; }\r\nbody.rd-tv #mapDetailPanel.has-result > .rd-tv-detail-close {\r\n  display: grid; place-items: center; position: absolute; top: 10px; right: 10px; z-index: 5;\r\n  width: 32px; height: 32px; padding: 0; cursor: pointer;\r\n  background: var(--rd-panel-bg); color: var(--rd-panel-fg); border: 1px solid var(--rd-panel-line);\r\n  font: 400 20px/1 system-ui, sans-serif;\r\n}\r\nbody.rd-tv #mapDetailPanel.has-result > .rd-tv-detail-close:hover { border-color: var(--rd-panel-muted); }\r\nbody.rd-tv #mapDetailPanel.has-result .popup-reporting-wrap { margin-right: 36px; }\r\n\r\n/* ---------- special votes ---------- */\r\n.rd-specials {\r\n  margin: 0 0 10px; padding: 10px 12px; border-radius: 6px;\r\n  background: rgba(245, 158, 11, .08); border: 1px solid rgba(245, 158, 11, .35);\r\n  font: 600 12px/1.4 Montserrat, system-ui, sans-serif; color: inherit;\r\n}\r\n.rd-spec-title { display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }\r\n.rd-spec-tag { margin-left: auto; padding: 2px 7px; border-radius: 3px; background: #f59e0b; color: #1a1205; font-size: 10px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; white-space: nowrap; }\r\n.rd-spec-tag.is-done { background: #22c55e; color: #05170c; }\r\n.rd-spec-big { margin-top: 4px; font-size: 13px; }\r\n.rd-spec-big b { font-size: 22px; font-weight: 800; font-variant-numeric: tabular-nums; margin-right: 3px; }\r\n.rd-spec-big small { font-size: 11px; opacity: .65; font-weight: 600; }\r\n.rd-spec-bar { display: flex; height: 8px; margin: 7px 0 6px; border-radius: 4px; background: repeating-linear-gradient(135deg, #f59e0b 0 4px, rgba(245, 158, 11, .45) 4px 8px); overflow: hidden; }\r\n.rd-spec-bar i { display: block; height: 100%; background: #94a3b8; }\r\n.rd-spec-legend { display: flex; flex-wrap: wrap; gap: 3px 14px; font-size: 11.5px; }\r\n.rd-spec-legend span { display: inline-flex; align-items: center; gap: 5px; }\r\n.rd-spec-legend i { width: 10px; height: 10px; border-radius: 2px; background: #94a3b8; }\r\n.rd-spec-legend i.is-left { background: #f59e0b; }\r\n.rd-spec-legend b { font-variant-numeric: tabular-nums; }\r\n.rd-spec-plain { margin-top: 6px; font-size: 11.5px; font-weight: 500; opacity: .85; }\r\n.rd-spec-line {\r\n  grid-column: 1; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 7px; margin-top: 4px;\r\n  font: 600 12px/1.3 Montserrat, system-ui, sans-serif; color: inherit;\r\n}\r\n.rd-spec-seat b { font-variant-numeric: tabular-nums; }\r\n.rd-spec-warn { flex-basis: 100%; padding: 3px 7px; border-radius: 3px; background: rgba(245, 158, 11, .16); color: #f59e0b; font-size: 11.5px; font-weight: 700; }\r\nbody.light-mode .rd-specials { background: rgba(245, 158, 11, .07); border-color: rgba(180, 83, 9, .35); }\r\nbody.light-mode .rd-spec-warn { color: #92400e; background: rgba(245, 158, 11, .18); }\r\nbody.light-mode .rd-spec-bar i, body.light-mode .rd-spec-legend i { background: #64748b; }\r\nbody.light-mode .rd-spec-legend i.is-left { background: #f59e0b; }\r\n\r\n/* ---------- map key only belongs on the Map tab ---------- */\r\nbody.dashboard-body[data-dashboard-view]:not([data-dashboard-view=\"map\"]) #rdDock { display: none !important; }\r\n\r\n/* ---------- design switch (shown in both designs) ---------- */\r\n.rd-design-btn { display: inline-flex !important; align-items: center; gap: 7px; }\r\n.rd-switch { position: relative; width: 26px; height: 14px; border-radius: 7px; background: rgba(148, 163, 184, .35); transition: background .15s; flex: none; }\r\n.rd-switch i { position: absolute; top: 2px; left: 2px; width: 10px; height: 10px; border-radius: 50%; background: #fff; transition: transform .15s; }\r\n.rd-design-btn[aria-checked=\"true\"] .rd-switch { background: #3b82f6; }\r\n.rd-design-btn[aria-checked=\"true\"] .rd-switch i { transform: translateX(12px); }\r\nbody.rd-tv .rd-design-btn { display: none !important; }\r\n\r\n/* =====================================================================================\r\n   NEW DESIGN (body.rd-clean, 901px and wider). Off = the old design, untouched.\r\n   A neutral graphite theme, one typeface, and three components of our own:\r\n   #rdScore (seat scoreboard), #rdPanel (results), #rdTools (map toolbar).\r\n   ===================================================================================== */\r\n.rd-score, .rd-panel, .rd-tools { display: none; }\r\n\r\n@media (min-width: 901px) {\r\n  /* ---------- theme: re-point the site's own variables ---------- */\r\n  html body.rd-clean.dashboard-body {\r\n    --n-font: \"Inter\", \"Segoe UI Variable Text\", \"Segoe UI\", system-ui, -apple-system, \"Helvetica Neue\", Arial, sans-serif;\r\n    --n-bg: #0c0d10; --n-surface: #16181d; --n-surface-2: #1e2128; --n-surface-3: #282c35;\r\n    --n-text: #f3f4f6; --n-soft: #d3d6dc; --n-muted: #9299a6; --n-faint: #6c7381;\r\n    --n-line: rgba(255, 255, 255, .08); --n-line-2: rgba(255, 255, 255, .15);\r\n    --n-accent: #f5b83d; --n-shadow: 0 12px 36px rgba(0, 0, 0, .45);\r\n    --n-r: 14px; --n-r-sm: 9px;\r\n\r\n    --font-ui: var(--n-font); --font-cond: var(--n-font); --rd-active-font: var(--n-font); --rd-display-font: var(--n-font);\r\n    --rd-page: var(--n-bg); --rd-page-alt: var(--n-bg); --rd-header: var(--n-bg); --rd-map-bg: var(--n-bg); --rd-bg: var(--n-bg);\r\n    --rd-panel: var(--n-surface); --rd-panel-2: var(--n-surface-2); --rd-panel-3: var(--n-surface-3); --rd-panel-subtle: var(--n-surface);\r\n    --rd-text: var(--n-text); --rd-text-soft: var(--n-soft); --rd-muted: var(--n-muted); --rd-faint: var(--n-faint);\r\n    --rd-border: var(--n-line); --rd-border-strong: var(--n-line-2); --rd-rule: var(--n-line);\r\n    --rd-button: var(--n-surface); --rd-button-hover: var(--n-surface-2); --rd-button-selected: var(--n-surface-3);\r\n    --rd-active-bg: var(--n-text); --rd-active-text: var(--n-bg); --rd-accent: var(--n-muted);\r\n    --rd-panel-bg: var(--n-surface); --rd-panel-fg: var(--n-text); --rd-panel-muted: var(--n-muted); --rd-panel-line: var(--n-line);\r\n    --rd-shadow-float: var(--n-shadow); --rd-shadow-soft: 0 4px 14px rgba(0, 0, 0, .3);\r\n    --radius-surface: var(--n-r); --radius-toolbar: var(--n-r-sm); --radius-control: var(--n-r-sm); --radius-modal: 18px;\r\n    font-family: var(--n-font) !important; background: var(--n-bg) !important;\r\n  }\r\n  html body.rd-clean.dashboard-body.light-mode {\r\n    --n-bg: #f3f3f1; --n-surface: #ffffff; --n-surface-2: #f4f4f2; --n-surface-3: #e9e9e6;\r\n    --n-text: #15161a; --n-soft: #2c2f36; --n-muted: #666c77; --n-faint: #8a909b;\r\n    --n-line: rgba(0, 0, 0, .08); --n-line-2: rgba(0, 0, 0, .16);\r\n    --n-accent: #b7791f; --n-shadow: 0 12px 32px rgba(20, 22, 28, .12);\r\n    --rd-map-bg: #e9ecef;\r\n  }\r\n  html body.rd-clean :where(button, input, select, textarea, h1, h2, h3, h4, table, th, td):not(.rd-brand-text, .rd-brand-text *) { font-family: var(--n-font) !important; }\r\n  html body.rd-clean :where(.card, .map-card, .map-card-body, #mapWrap, #map, .leaflet-container, .dashboard-shell, .dashboard-grid) { background-color: var(--rd-map-bg) !important; }\r\n\r\n  /* ---------- top bar: logo, tabs, scoreboard, tools ---------- */\r\n  html body.rd-clean .app-header { background: var(--n-bg) !important; border: 0 !important; border-bottom: 1px solid var(--n-line) !important; box-shadow: none !important; }\r\n  html body.rd-clean .app-header-inner { height: 48px !important; min-height: 48px !important; gap: 18px !important; justify-content: flex-start !important; padding: 0 16px !important; }\r\n  html body.rd-clean .app-brand { flex: none; }\r\n  html body.rd-clean .app-brand .rd-brand-text { font-size: 24px !important; line-height: 48px !important; }\r\n  html body.rd-clean .app-brand .rd-brand-text b { color: var(--n-accent) !important; }\r\n  /* tabs: a segmented control */\r\n  html body.rd-clean .app-header-inner > .dashboard-view-tabs {\r\n    display: flex !important; grid-template-columns: none !important; gap: 2px !important; margin: 0 !important; padding: 3px !important;\r\n    background: var(--n-surface) !important; border: 1px solid var(--n-line) !important; border-radius: 11px !important; flex: none; width: auto !important;\r\n  }\r\n  html body.rd-clean .app-header-inner > .dashboard-view-tabs .dashboard-view-tab {\r\n    height: 28px !important; min-height: 0 !important; width: auto !important; padding: 0 12px !important; border: 0 !important; border-radius: 8px !important;\r\n    background: none !important; box-shadow: none !important; color: var(--n-muted) !important;\r\n    font-size: 12.5px !important; font-weight: 600 !important; letter-spacing: 0 !important; text-transform: none !important;\r\n    display: inline-flex !important; align-items: center; gap: 6px;\r\n  }\r\n  html body.rd-clean .app-header-inner > .dashboard-view-tabs .dashboard-view-tab::before,\r\n  html body.rd-clean .app-header-inner > .dashboard-view-tabs .dashboard-view-tab::after { display: none !important; }\r\n  html body.rd-clean .app-header-inner > .dashboard-view-tabs .dashboard-view-tab:hover { color: var(--n-text) !important; }\r\n  html body.rd-clean .app-header-inner > .dashboard-view-tabs .dashboard-view-tab.active { background: var(--n-surface-3) !important; color: var(--n-text) !important; }\r\n  html body.rd-clean .app-header-inner > .dashboard-view-tabs svg { width: 14px !important; height: 14px !important; }\r\n  /* tools: icon buttons, plus the design switch */\r\n  html body.rd-clean .app-header-nav { margin-left: auto !important; gap: 2px !important; display: flex !important; align-items: center; flex: none; }\r\n  html body.rd-clean .app-header-nav .nav-btn:not(.rd-design-btn) {\r\n    width: 34px !important; height: 34px !important; min-height: 0 !important; justify-content: center !important; border-radius: 9px !important; gap: 0 !important; color: var(--n-muted) !important;\r\n  }\r\n  html body.rd-clean .app-header-nav .nav-btn:not(.rd-design-btn):hover { background: var(--n-surface-2) !important; color: var(--n-text) !important; }\r\n  html body.rd-clean .app-header-nav .nav-btn:not(.rd-design-btn) > span { display: none !important; }\r\n  html body.rd-clean .app-header-nav .rd-tv-btn svg, html body.rd-clean .app-header-nav .rd-cl-btn svg { display: block !important; width: 17px !important; height: 17px !important; }\r\n  html body.rd-clean .app-header-nav .rd-design-btn { margin-right: 6px; font-size: 11.5px !important; font-weight: 600 !important; letter-spacing: 0 !important; text-transform: none !important; color: var(--n-muted) !important; }\r\n  html body.rd-clean .rd-design-btn[aria-checked=\"true\"] .rd-switch { background: var(--n-accent); }\r\n  html body.rd-clean .rd-header-toggle { opacity: 0; }\r\n  html body.rd-clean .rd-header-toggle:hover, html body.rd-clean .rd-header-toggle:focus-visible, html body.rd-clean.rd-hide-header .rd-header-toggle { opacity: .9; }\r\n\r\n  /* scoreboard */\r\n  html body.rd-clean .rd-score {\r\n    display: flex; align-items: center; gap: 14px; flex: 1 1 auto; min-width: 0; height: 40px; margin: 0 6px; padding: 0 14px;\r\n    border: 1px solid var(--n-line); border-radius: 12px; background: var(--n-surface); color: var(--n-text); cursor: pointer;\r\n    font: 500 12px/1.2 var(--n-font); text-align: left;\r\n  }\r\n  html body.rd-clean .rd-score:hover { border-color: var(--n-line-2); }\r\n  .rd-score-side { display: flex; align-items: baseline; gap: 7px; flex: none; min-width: 0; white-space: nowrap; color: var(--n-muted); }\r\n  .rd-score-side b { font-size: 21px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--n-text); letter-spacing: -.02em; }\r\n  .rd-score-side em { font-style: normal; overflow: hidden; text-overflow: ellipsis; }\r\n  .rd-score-side.is-right { flex-direction: row-reverse; }\r\n  .rd-score-side.is-win b { color: var(--n-accent); }\r\n  .rd-score-side.is-win em { color: var(--n-text); }\r\n  .rd-score-mid { position: relative; flex: 1 1 auto; min-width: 80px; display: flex; flex-direction: column; align-items: center; gap: 3px; }\r\n  .rd-score-bar { position: relative; display: flex; width: 100%; height: 8px; border-radius: 4px; overflow: hidden; background: var(--n-surface-3); }\r\n  .rd-score-bar i { display: block; height: 100%; min-width: 1px; }\r\n  .rd-score-bar u { flex: 0 0 2px; background: var(--n-surface); }\r\n  .rd-score-bar s { position: absolute; left: 50%; top: 0; bottom: 0; width: 2px; margin-left: -1px; background: var(--n-text); }\r\n  .rd-score-mid small { font-size: 10px; color: var(--n-faint); letter-spacing: .02em; line-height: 1; }\r\n  .rd-score-wait { color: var(--n-muted); }\r\n  @media (max-width: 1320px) { .rd-score-side em { display: none; } }\r\n  @media (max-width: 1040px) { html body.rd-clean .rd-score { display: none; } html body.rd-clean .app-header-nav { margin-left: auto !important; } }\r\n\r\n  /* ---------- hide the site's panel and rail; ours take their place ---------- */\r\n  html body.rd-clean.rd-own-panel:not(.rd-tv) #mapWrap > #mapDetailPanel { display: none !important; }\r\n  html body.rd-clean:not(.rd-tv) #mapMagicWallControlsRail { display: none !important; }\r\n\r\n  /* ---------- results panel ---------- */\r\n  html body.rd-clean.rd-own-panel:not(.rd-tv)[data-dashboard-view=\"map\"] .rd-panel {\r\n    display: flex; flex-direction: column; position: absolute; z-index: 820; left: 16px; top: 16px; max-height: calc(100% - 32px);\r\n    width: clamp(360px, 27vw, 420px); overflow: hidden;\r\n    background: var(--n-surface); color: var(--n-text); border: 1px solid var(--n-line); border-radius: 18px; box-shadow: var(--n-shadow);\r\n    font: 500 13px/1.35 var(--n-font);\r\n  }\r\n  .rdn-head { padding: 18px 20px 12px; flex: none; }\r\n  .rdn-topline { display: flex; align-items: center; justify-content: space-between; margin: -6px -8px 8px; }\r\n  .rdn-back, .rdn-pin { display: inline-flex; align-items: center; gap: 4px; height: 28px; padding: 0 8px; border: 0; border-radius: 8px; background: none; color: var(--n-muted); font: 600 12px/1 var(--n-font); cursor: pointer; }\r\n  .rdn-back:hover, .rdn-pin:hover { background: var(--n-surface-2); color: var(--n-text); }\r\n  .rdn-back svg { width: 15px; height: 15px; }\r\n  .rdn-pin svg { width: 15px; height: 15px; }\r\n  .rdn-pin.is-on { color: var(--n-accent); }\r\n  .rdn-kicker { font-size: 11.5px; font-weight: 600; color: var(--n-muted); }\r\n  .rdn-head h2 { margin: 3px 0 0; font: 700 25px/1.15 var(--n-font); letter-spacing: -.025em; color: var(--n-text); text-transform: none; }\r\n  .rdn-progress { height: 3px; margin-top: 11px; border-radius: 2px; background: var(--n-surface-3); overflow: hidden; }\r\n  .rdn-progress i { display: block; height: 100%; border-radius: 2px; background: var(--n-text); opacity: .75; }\r\n  .rdn-verdict { margin-top: 11px; font-size: 12.5px; color: var(--n-soft); }\r\n  .rdn-verdict b, .rdn-verdict strong { color: var(--n-text); }\r\n  .rdn-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; margin-top: 11px; font-size: 12px; color: var(--n-muted); }\r\n  .rdn-meta:empty { display: none; }\r\n  .rdn-chip { display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 10px 0 8px; border-radius: 12px; background: color-mix(in srgb, var(--c) 22%, transparent); color: var(--n-text); font-size: 12px; font-weight: 600; }\r\n  .rdn-chip::before { content: \"\"; width: 8px; height: 8px; border-radius: 50%; background: var(--c); }\r\n  .rdn-chip.is-flip::before { border-radius: 2px; background: repeating-linear-gradient(135deg, var(--c) 0 2px, var(--n-text) 2px 4px); }\r\n  .rdn-held { display: inline-flex; align-items: center; gap: 5px; }\r\n  .rdn-held .rd-held-label { font-size: 12px; font-weight: 500; letter-spacing: 0; text-transform: none; opacity: 1; }\r\n  .rdn-held .rd-held-name { font-weight: 600; color: var(--n-soft); }\r\n  .rdn-held .rd-held-party { padding: 0; border: 0; background: none; font-size: 12px; font-weight: 500; text-transform: none; }\r\n  .rdn-held .rd-held-party::before { content: \"(\"; }\r\n  .rdn-held .rd-held-party::after { content: \")\"; }\r\n  .rdn-note { display: flex; align-items: center; gap: 8px; margin: 0 12px 6px; padding: 8px 10px; border-radius: 10px; background: color-mix(in srgb, #f59e0b 12%, transparent); font-size: 12px; color: var(--n-soft); flex: none; }\r\n  .rdn-note > i { flex: none; width: 7px; height: 7px; border-radius: 50%; background: #f59e0b; }\r\n  .rdn-note > i.is-done { background: #22c55e; }\r\n  .rdn-note b { color: var(--n-text); font-variant-numeric: tabular-nums; }\r\n  .rdn-note small { display: block; margin-top: 1px; font-size: 11px; color: var(--n-muted); }\r\n  .rdn-note.is-warn small { color: #f59e0b; font-weight: 600; }\r\n  .rdn-headline { display: block; margin-top: 12px; font-size: 14.5px; font-weight: 500; line-height: 1.4; color: var(--n-soft); text-align: left; }\r\n  .rdn-headline b { color: var(--n-text); font-weight: 700; }\r\n  .rdn-seats { display: flex; flex-direction: column; gap: 7px; margin: 0 12px 10px; padding: 0 12px 12px; border: 1px solid var(--n-line); border-radius: 12px; background: var(--n-surface-2); color: var(--n-text); font: 500 12px/1.3 var(--n-font); cursor: pointer; text-align: left; flex: none; }\r\n  .rdn-seats:hover { border-color: var(--n-line-2); }\r\n  .rdn-seats-top { display: flex; justify-content: space-between; gap: 12px; margin-top: 2px; }\r\n  .rdn-seats-side { display: flex; flex-direction: column; gap: 1px; min-width: 0; color: var(--n-muted); font-size: 11.5px; }\r\n  .rdn-seats-side.is-right { align-items: flex-end; text-align: right; }\r\n  .rdn-seats-side b { font-size: 26px; font-weight: 700; line-height: 1; letter-spacing: -.02em; font-variant-numeric: tabular-nums; color: var(--n-text); }\r\n  .rdn-seats-side.is-win b { color: var(--n-accent); }\r\n  .rdn-seats-side em { font-style: normal; }\r\n  .rdn-seats .rd-score-bar { height: 10px; border-radius: 5px; }\r\n  .rdn-seats .rd-score-bar u { background: var(--n-surface-2); }\r\n  .rdn-seats-mid { text-align: center; font-size: 11px; color: var(--n-muted); }\r\n  .rdn-cols, .rdn-row { display: grid; grid-template-columns: minmax(0, 1fr) 84px 60px; column-gap: 10px; }\r\n  .rdn-cols { padding: 8px 20px 6px; font-size: 11px; font-weight: 600; color: var(--n-faint); flex: none; }\r\n  .rdn-cols span:not(:first-child) { text-align: right; }\r\n  .rdn-list { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: none; padding: 0 8px 6px; }\r\n  .rdn-list::-webkit-scrollbar { display: none; }\r\n  .rdn-row { position: relative; align-items: center; padding: 9px 12px 13px; border-radius: 10px; }\r\n  .rdn-row:hover { background: var(--n-surface-2); }\r\n  .rdn-who { min-width: 0; display: flex; flex-direction: column; gap: 1px; }\r\n  .rdn-name { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: var(--n-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\r\n  .rdn-name::before { content: \"\"; flex: none; width: 9px; height: 9px; border-radius: 3px; background: var(--c); }\r\n  .rdn-name em { font-style: normal; font-size: 9.5px; font-weight: 700; letter-spacing: .04em; padding: 1px 5px; border-radius: 4px; background: var(--n-surface-3); color: var(--n-muted); }\r\n  .rdn-sub { padding-left: 17px; font-size: 11.5px; color: var(--n-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-height: 15px; }\r\n  .rdn-num { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; font-variant-numeric: tabular-nums; white-space: nowrap; }\r\n  .rdn-num b { font-size: 14px; font-weight: 600; color: var(--n-text); }\r\n  .rdn-num.is-big b { font-size: 17px; font-weight: 700; letter-spacing: -.01em; }\r\n  .rdn-num span { display: inline-flex; gap: 5px; font-size: 11px; color: var(--n-muted); min-height: 14px; }\r\n  .rdn-chg { font-weight: 600; font-size: 10.5px; }\r\n  .rdn-chg.is-up { color: #22c55e; }\r\n  .rdn-chg.is-down { color: #ef4444; }\r\n  .rdn-bar { grid-column: 1 / -1; position: absolute; left: 29px; right: 12px; bottom: 5px; height: 3px; border-radius: 2px; background: var(--n-surface-3); overflow: hidden; }\r\n  .rdn-bar i { display: block; height: 100%; border-radius: 2px; background: var(--c); }\r\n  .rdn-row.is-lead { background: color-mix(in srgb, var(--c) 13%, transparent); }\r\n  .rdn-more { display: block; width: calc(100% - 8px); margin: 4px; height: 32px; border: 0; border-radius: 9px; background: none; color: var(--n-muted); font: 600 12px/1 var(--n-font); cursor: pointer; }\r\n  .rdn-more:hover { background: var(--n-surface-2); color: var(--n-text); }\r\n  .rdn-empty { padding: 18px 12px; color: var(--n-muted); }\r\n  .rdn-foot { display: flex; flex-wrap: wrap; gap: 4px 12px; justify-content: space-between; padding: 9px 20px 11px; border-top: 1px solid var(--n-line); font-size: 11px; color: var(--n-faint); flex: none; }\r\n  html body.rd-clean.light-mode .rdn-chg.is-up { color: #15803d; }\r\n  html body.rd-clean.light-mode .rdn-chg.is-down { color: #b91c1c; }\r\n\r\n  /* ---------- map toolbar ---------- */\r\n  html body.rd-clean:not(.rd-tv)[data-dashboard-view=\"map\"] .rd-tools {\r\n    display: flex; align-items: center; gap: 6px; position: absolute; z-index: 835; top: 16px; right: 16px;\r\n    padding: 5px; border-radius: 14px; background: var(--n-surface); border: 1px solid var(--n-line); box-shadow: var(--n-shadow);\r\n    font: 600 12.5px/1 var(--n-font); color: var(--n-text);\r\n  }\r\n  .rd-tools-group { position: relative; display: flex; align-items: center; gap: 2px; }\r\n  .rd-tools-group + .rd-tools-group { padding-left: 6px; border-left: 1px solid var(--n-line); }\r\n  .rd-tools button { display: inline-flex; align-items: center; justify-content: center; gap: 4px; height: 30px; padding: 0 10px; border: 0; border-radius: 9px; background: none; color: var(--n-muted); font: inherit; cursor: pointer; white-space: nowrap; }\r\n  .rd-tools button:hover { background: var(--n-surface-2); color: var(--n-text); }\r\n  .rd-tools button.is-on { background: var(--n-surface-3); color: var(--n-text); }\r\n  .rd-tools svg { width: 15px; height: 15px; }\r\n  .rd-tools button:disabled { opacity: .3; cursor: default; background: none; }\r\n  .rd-tools-drop { color: var(--n-text) !important; }\r\n  .rd-tools-drop svg { width: 13px; height: 13px; opacity: .6; }\r\n  .rd-tools-icons button { width: 30px; padding: 0; }\r\n  .rd-tools-menu { position: absolute; top: calc(100% + 10px); left: 0; min-width: 190px; max-height: 60vh; overflow: auto; padding: 5px; border-radius: 12px; background: var(--n-surface); border: 1px solid var(--n-line-2); box-shadow: var(--n-shadow); display: flex; flex-direction: column; gap: 1px; }\r\n  .rd-tools-menu button { justify-content: flex-start; height: 32px; width: 100%; color: var(--n-soft); font-weight: 500; }\r\n  .rd-tools-menu button.is-on { color: var(--n-text); font-weight: 600; }\r\n  .rd-tools-sep { padding: 8px 10px 4px; font-size: 10.5px; font-weight: 600; color: var(--n-faint); }\r\n\r\n  /* ---------- our other map pieces, in the new theme ---------- */\r\n  html body.rd-clean .rd-dock { right: 16px; bottom: 16px; }\r\n  html body.rd-clean .rd-legend, html body.rd-clean .rd-pin-chip, html body.rd-clean .rd-overhang, html body.rd-clean .rd-coalition {\r\n    font-family: var(--n-font); background: var(--n-surface); color: var(--n-text); border: 1px solid var(--n-line); border-radius: 12px; box-shadow: var(--n-shadow);\r\n  }\r\n  html body.rd-clean .rd-legend { box-shadow: none; opacity: .85; }\r\n  html body.rd-clean .rd-legend:hover { opacity: 1; }\r\n  html body.rd-clean .rd-pin-chip { overflow: hidden; }\r\n  html body.rd-clean .rd-coalition { top: 66px; right: 16px; border-radius: 16px; padding: 16px; }\r\n  html body.rd-clean .rd-coalition, html body.rd-clean .rd-coalition * { font-family: var(--n-font); }\r\n  html body.rd-clean .rd-chip { border-radius: 6px; }\r\n  html body.rd-clean .rd-cl-modal, html body.rd-clean .help-modal, html body.rd-clean .welcome-modal { font-family: var(--n-font) !important; border-radius: 18px !important; }\r\n\r\n  /* ---------- Electorates / Trends tabs: fill the window ---------- */\r\n  html body.rd-clean.dashboard-body[data-dashboard-view]:not([data-dashboard-view=\"map\"]) .map-card,\r\n  html body.rd-clean.dashboard-body[data-dashboard-view]:not([data-dashboard-view=\"map\"]) .map-card-body,\r\n  html body.rd-clean.dashboard-body[data-dashboard-view]:not([data-dashboard-view=\"map\"]) #mapWrap {\r\n    height: calc(100vh - var(--rd-map-top, 56px)) !important; max-height: none !important; border-radius: 0 !important;\r\n  }\r\n}\r\n";
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
  // National statistics from the Electoral Commission XML inside the results bundle
  // (the site doesn't show these): special votes still to count, votes cast, turnout so far.
  function captureNational(res) {
    if (!res || !res.ok) return;
    res.clone().json().then(j => {
      const x = j && j.election;
      if (typeof x !== 'string') return;
      const num = t => { const m = x.match(new RegExp('<' + t + '>([^<]*)</' + t + '>')); return m && m[1].trim() !== '' ? Number(m[1]) : null; };
      window.__rdNational = {
        dataset: j.dataset, updated: (x.match(/<election[^>]*updated="([^"]+)"/) || [])[1] || null,
        specials: num('total_special_votes'), cast: num('total_votes_cast'), castPct: num('percent_votes_cast'),
        placesPct: num('percent_voting_places_counted'), finalPct: num('percent_electorates_final'), at: Date.now(),
      };
      window.dispatchEvent(new Event('rd-national'));
    }).catch(() => {});
  }
  window.fetch = function (input, init) {
    let bundle = false;
    try {
      const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const u = new URL(raw, location.href);
      if (/(^|\.)resultsdesk\.nz$/.test(u.hostname) && /results-bundle|trend-history|live-bundle|live-2026|collector-state/.test(u.pathname)) {
        init = Object.assign({}, init, { cache: 'no-store' });
      }
      bundle = /results-bundle\.json$/.test(u.pathname) && !(init && init.method && init.method !== 'GET');
    } catch { /* leave untouched */ }
    const p = realFetch(input, init);
    if (bundle) p.then(captureNational, () => {});
    return p;
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
  // The app may have fetched the bundle before these hooks were installed: fetch it once ourselves.
  setTimeout(() => { const u = liveBundleUrl(); if (u && !window.__rdNational) realFetch(u + (u.includes('?') ? '&' : '?') + 'n=' + Date.now(), { cache: 'no-store' }).then(captureNational, () => {}); }, 1500);
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
    [/M[AĀ]ORI/i, '#B2001A'],
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
  const ownColour = p => { const s = String(p || ''); const hit = PARTY_COLOURS.find(([re]) => re.test(s)); return hit ? hit[1] : null; };
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
      const wrapW = $('#mapWrap')?.clientWidth || 1200;
      const left = tvDetailOpen() ? Math.min(500, wrapW * 0.42) + 40 : 20; // electorate panel sits top-left
      return { ...o, paddingTopLeft: [left, 20], paddingBottomRight: [20, 20], maxZoom: Math.max(Number(o.maxZoom) || 0, 6.6) };
    };
  })();
  // Best fit for the TV-sized map, applied directly (the site's reset waits for animation frames
  // and can run before the map has resized), then once more after the layout settles.
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
        if (!tvCycle || tvDetailOpen()) return;
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
      <div class="rd-tv-top">
        <div><div class="rd-tv-title">NZ Election ${esc(String(ds()).match(/\d{4}/)?.[0] || '')}</div>
        <div class="rd-tv-sub">${pct == null ? '' : `${pct.toFixed(1)}% of voting places counted · `}${spec && !spec.counted ? `<b>${fmt(spec.left)} special votes not counted yet</b> (official result ${OFFICIAL_RESULTS_LABEL}) · ` : ''}<span class="rd-tv-clock">${new Date().toLocaleTimeString('en-NZ', { hour: 'numeric', minute: '2-digit' })}</span></div></div>
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
    if (e.key === 'Escape' && document.body.classList.contains('rd-tv')) { if (tvDetailOpen()) closeTvDetail(); else setTv(false); }
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
        <span><i class="is-counted"></i>Counted tonight <b>${fmt(s.cast)}</b> (${(100 - sharePct).toFixed(0)}%)</span>
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
  // 17. New (cleaner) design, with a switch in the top bar to go back to the old one.
  // The new design is CSS under body.rd-clean, plus the view tabs moved into the top bar.
  // ---------------------------------------------------------------------------
  let cleanDesign = store.get('rd-clean', true) !== false;
  function applyDesign() {
    const body = document.body;
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
  const uiColor = p => { const c = partyColor(p); return /^#0{3}(0{3})?$/.test(String(c)) && !document.body.classList.contains('light-mode') ? '#5d6370' : c; };
  const pct1 = f => `${(f * 100).toFixed(1)}%`;
  const ICON = {
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
    caret: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>',
    reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>',
    people: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M2 20c0-3.3 2.7-6 6-6s6 2.7 6 6M12 14.5c1.1-.3 2.5-.5 4-.5 3.3 0 6 2.7 6 6"/></svg>',
  };

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
    return `<div class="rdn-note" title="Counted tonight ${fmt(s.cast)} (${(100 - s.share * 100).toFixed(0)}%) · special votes ${fmt(s.left)} (${(s.share * 100).toFixed(0)}%)"><i></i><span><b>${fmt(s.left)}</b> special votes still to count<small>Official result ${OFFICIAL_RESULTS_LABEL}</small></span></div>`;
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
      ${seatsHtml(st)}
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
      <div class="rdn-list">${list || '<div class="rdn-empty">No votes counted yet</div>'}${moreHtml(entries.length - LIMIT)}</div>
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
    new MutationObserver(() => { ensureCoalitionUi(); ensureResetViewBtn(); tvButton(); changelogButton(); designToggle(); renderNewUi(); buildLegend(); decorateHeldBy(); decorateSpecials(); decoratePinButtons(); headerToggle(); expandPartyList(); fitPartyRows(); tvDetailCloseButton(); })
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
      console.log('[ResultsDesk Plus] active v' + '2.3.0' + ' · window ' + innerWidth + 'x' + innerHeight + (innerWidth < 901 ? ' (stacked layout: full-window map changes need 901px+)' : ''));
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
  console.log('[ResultsDesk Plus] v2.3.0 in Firefox sandbox, moving into the page…');
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

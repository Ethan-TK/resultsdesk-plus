// Builds resultsdesk-plus.user.js from src/core.js + src/extras.js + src/extras.css
// Usage: node build.js   (bump VERSION so Tampermonkey/Violentmonkey pick up the update)
const fs = require('fs');
const path = require('path');

const VERSION = '2.8.3';
const RAW = 'https://raw.githubusercontent.com/Ethan-TK/resultsdesk-plus/main/resultsdesk-plus.user.js';
const HOME = 'https://github.com/Ethan-TK/resultsdesk-plus';

const src = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const core = src('core.js');
const extras = src('extras.js');
const css = src('extras.css');

// ---- local results by voting place (data/2026/*.json, from tools/build_local_data.py) ----
// The site's security policy only lets its page fetch from its own domains, so this data travels inside
// the script itself: one compressed chunk per electorate, unpacked only when that electorate is opened.
const zlib = require('zlib');
const dataDir = path.join(__dirname, 'data', '2026');
const localData = {};
if (fs.existsSync(dataDir)) {
  for (const f of fs.readdirSync(dataDir)) {
    if (!f.endsWith('.json') || f === 'index.json') continue;
    const d = JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8'));
    const R = d.places.map(([name, sec, pv, cv], i) => {
      let loc, venue;
      if (/^Taken in /.test(name)) { loc = ''; venue = name.replace(/^Taken in /, ''); } // hospital / care-home / mobile teams
      else {
        const parts = name.split(', ');
        loc = parts[0];
        const v = [];
        for (const part of parts.slice(1)) {            // venue name only: stop at the street address
          if (/^\d/.test(part)) break;
          if (v.length && (v.join(', ') + ', ' + part).length > 60) break;
          v.push(part);
        }
        venue = v.join(', ');
      }
      const xy = d.xy && d.xy[i];
      return [loc, venue, sec, pv, cv, xy ? Math.round(xy[0] * 1e4) / 1e4 : null, xy ? Math.round(xy[1] * 1e4) / 1e4 : null];
    });
    const compact = { n: d.name, p: d.produced, k: d.kind, P: d.parties, C: d.cands.map(c => [c.p, c.s]), R };
    localData[f.slice(0, -5)] = zlib.deflateSync(Buffer.from(JSON.stringify(compact)), { level: 9 }).toString('base64');
  }
}

const out = `// ==UserScript==
// @name         ResultsDesk Plus
// @namespace    resultsdesk-plus
// @version      ${VERSION}
// @description  Faster live updates, striped flipped seats, margin shading, last-changed badges, sitting MPs, coalition tracker, overhang notice and TV mode for resultsdesk.nz
// @homepageURL  ${HOME}
// @supportURL   ${HOME}/issues
// @downloadURL  ${RAW}
// @updateURL    ${RAW}
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

// Unofficial add-on. Not affiliated with ResultsDesk. Built from ${HOME}/tree/main/src

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
    style.textContent = ${JSON.stringify(css)};
    (document.head || document.documentElement).appendChild(style);
  }
  if (document.head) addStyles();
  else document.addEventListener('DOMContentLoaded', addStyles, { once: true });

  // ---- local results data: ${Object.keys(localData).length} electorates, compressed (see build.js) ----
  const RD_LOCAL_DATA = ${JSON.stringify(localData)};

  // ---- core: speed + map styling ----
${core}

  // ---- extras: badges, legend, sitting MPs, coalition tracker, overhang, TV mode ----
  function rdInstallExtras() {
${extras}
  }

  // Wait until the ResultsDesk app has defined its globals, then install.
  let tries = 0;
  (function whenReady() {
    if (typeof window.refreshMap === 'function' && typeof window.featureStyle === 'function') {
      addStyles();
      try { rdInstallCore(); } catch (e) { console.warn('[ResultsDesk Plus] core', e); }
      try { rdInstallExtras(); } catch (e) { console.warn('[ResultsDesk Plus] extras', e); }
      document.documentElement.dataset.rdPlus = 'active';
      console.log('[ResultsDesk Plus] active v' + '${VERSION}' + ' · window ' + innerWidth + 'x' + innerHeight + (innerWidth < 901 ? ' (stacked layout: full-window map changes need 901px+)' : ''));
    } else if (++tries < 3000) {
      setTimeout(whenReady, 30);
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
  console.log('[ResultsDesk Plus] v${VERSION} in Firefox sandbox, moving into the page…');
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
`;

fs.writeFileSync(path.join(__dirname, 'resultsdesk-plus.user.js'), out);
console.log('built resultsdesk-plus.user.js', VERSION, out.length, 'bytes');

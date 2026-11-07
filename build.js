// Builds resultsdesk-plus.user.js from src/core.js + src/extras.js + src/extras.css
// Usage: node build.js   (bump VERSION so Tampermonkey/Violentmonkey pick up the update)
const fs = require('fs');
const path = require('path');

const VERSION = '1.2.0';
const RAW = 'https://raw.githubusercontent.com/Ethan-TK/resultsdesk-plus/main/resultsdesk-plus.user.js';
const HOME = 'https://github.com/Ethan-TK/resultsdesk-plus';

const src = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const core = src('core.js');
const extras = src('extras.js');
const css = src('extras.css');

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

(() => {
  'use strict';

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
      console.log('[ResultsDesk Plus] active');
    } else if (++tries < 900) {
      setTimeout(whenReady, 100);
    } else {
      console.warn('[ResultsDesk Plus] app globals not found — site may have changed');
    }
  })();
})();
`;

fs.writeFileSync(path.join(__dirname, 'resultsdesk-plus.user.js'), out);
console.log('built resultsdesk-plus.user.js', VERSION, out.length, 'bytes');

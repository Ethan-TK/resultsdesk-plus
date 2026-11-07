// Builds resultsdesk-plus.user.js from src/core.js + src/extras.js + src/extras.css
// Usage: node build.js   (bump VERSION so Tampermonkey/Violentmonkey pick up the update)
const fs = require('fs');
const path = require('path');

const VERSION = '1.1.0';
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
// @run-at       document-end
// @inject-into  page
// @grant        none
// ==/UserScript==

// Unofficial add-on. Not affiliated with ResultsDesk. Built from ${HOME}/tree/main/src

(() => {
  'use strict';

  // ---- styles ----
  const style = document.createElement('style');
  style.id = 'rdPlusStyles';
  style.textContent = ${JSON.stringify(css)};
  (document.head || document.documentElement).appendChild(style);

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
      try { rdInstallCore(); } catch (e) { console.warn('[ResultsDesk Plus] core', e); }
      try { rdInstallExtras(); } catch (e) { console.warn('[ResultsDesk Plus] extras', e); }
      console.log('[ResultsDesk Plus] active');
    } else if (++tries < 300) {
      setTimeout(whenReady, 100);
    } else {
      console.warn('[ResultsDesk Plus] app globals not found — site may have changed');
    }
  })();
})();
`;

fs.writeFileSync(path.join(__dirname, 'resultsdesk-plus.user.js'), out);
console.log('built resultsdesk-plus.user.js', VERSION, out.length, 'bytes');

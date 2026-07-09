// render-ext detector — tiny content script on every page. Decides whether the
// page is a raw text file or a file:// directory listing, records a spec, and
// asks the service worker to inject the viewer app. Heavy libs load only then.
'use strict';

(() => {
  if (window.__rxDetected) return;
  window.__rxDetected = true;
  if (window.top !== window) return; // main frame only

  const DEFAULTS = { enabled: true, markdown: true, code: true, dirlist: true };

  chrome.storage.sync.get(DEFAULTS, (cfg) => {
    if (!cfg.enabled) return;

    // A. file:// directory listing (Chrome's built-in index page)
    if (location.protocol === 'file:' &&
        (document.getElementById('parentDirLink') ||
         document.getElementById('listingParsingErrorBox'))) {
      if (!cfg.dirlist) return;
      window.__rxSpec = { mode: 'dir' };
      send();
      return;
    }

    // B. raw text file (single <pre>, textual content-type)
    const ct = (document.contentType || '').toLowerCase();
    const textual =
      ct === 'text/plain' ||
      ct === 'text/markdown' ||
      ct === 'text/x-markdown' ||
      ct === 'application/json' ||
      ct === 'text/json' ||
      ct === 'application/x-yaml' ||
      ct === 'text/yaml' ||
      ct.startsWith('text/x-');
    if (!textual) return;

    const body = document.body;
    if (!body || body.childElementCount !== 1) return;
    const pre = body.firstElementChild;
    if (!pre || pre.tagName !== 'PRE') return;

    const m = location.pathname.toLowerCase().match(/\.([a-z0-9_]+)$/);
    let hit = m ? rxLookupExt(m[1]) : null;
    if (!hit && (ct === 'text/markdown' || ct === 'text/x-markdown')) hit = { kind: 'markdown' };
    if (!hit) return;
    if (hit.kind === 'markdown' && !cfg.markdown) return;
    if (hit.kind === 'code' && !cfg.code) return;

    window.__rxSpec = {
      mode: 'file',
      kind: hit.kind,
      langKey: hit.langKey || null,
      hljs: hit.hljs || null,
      label: hit.label || 'Markdown',
      file: decodeURIComponent(location.pathname.split('/').pop() || '')
    };
    send();
  });

  function send() {
    chrome.runtime.sendMessage({ action: 'rx-render' }, (res) => {
      if (chrome.runtime.lastError) {
        console.warn('[render-ext] inject failed:', chrome.runtime.lastError.message);
      } else if (res && !res.ok) {
        console.warn('[render-ext] inject failed:', res.error);
      }
    });
  }
})();

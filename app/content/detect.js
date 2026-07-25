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

    // B. raster image opened directly (Chrome shows <body><img>) — take over so
    //    the sidebar is available. SVG/PDF are left to Chrome's own viewer.
    const ctAll = (document.contentType || '').toLowerCase();
    if (ctAll.startsWith('image/') && ctAll !== 'image/svg+xml') {
      if (!cfg.code) return;
      const b = document.body;
      if (!b || b.childElementCount !== 1 || b.firstElementChild.tagName !== 'IMG') return;
      window.__rxSpec = {
        mode: 'file',
        kind: 'image',
        binary: true,
        label: 'Image',
        mime: ctAll,
        file: decodeURIComponent(location.pathname.split('/').pop() || '')
      };
      send();
      return;
    }

    // C. raw text file (single <pre>, textual content-type)
    const ct = ctAll;
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
    if (hit.kind === 'markdown' ? !cfg.markdown : !cfg.code) return;

    window.__rxSpec = Object.assign({ mode: 'file' }, hit, {
      file: decodeURIComponent(location.pathname.split('/').pop() || '')
    });
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

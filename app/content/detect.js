// render-ext detector — tiny content script that runs on every page.
// Decides whether the current page is (a) a raw text file or (b) a file://
// directory listing, then asks the service worker to inject the matching
// renderer. Heavy libs (mermaid ~3.5MB etc.) are NEVER loaded on normal pages.
'use strict';

(() => {
  if (window.__rxDetected) return;
  window.__rxDetected = true;
  if (window.top !== window) return; // main frame only

  const DEFAULTS = { enabled: true, markdown: true, code: true, dirlist: true };

  chrome.storage.sync.get(DEFAULTS, (cfg) => {
    if (!cfg.enabled) return;

    // --- A. file:// directory listing (Chrome's built-in index page) ----
    if (location.protocol === 'file:' &&
        (document.getElementById('parentDirLink') ||
         document.getElementById('listingParsingErrorBox'))) {
      if (!cfg.dirlist) return;
      send({ action: 'rx-render', kind: 'dirlist' });
      return;
    }

    // --- B. raw text file ------------------------------------------------
    // Must be a raw-text response, not a rendered HTML page.
    // (GitHub/GitLab rendered views are text/html -> skipped by design.)
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

    // Chrome's raw text viewer renders the body as a single <pre>.
    const body = document.body;
    if (!body || body.childElementCount !== 1) return;
    const pre = body.firstElementChild;
    if (!pre || pre.tagName !== 'PRE') return;

    // Resolve the file extension from the URL path.
    const m = location.pathname.toLowerCase().match(/\.([a-z0-9_]+)$/);
    let hit = m ? rxLookupExt(m[1]) : null;
    // Markdown served with an explicit markdown MIME but odd/no extension.
    if (!hit && (ct === 'text/markdown' || ct === 'text/x-markdown')) {
      hit = { kind: 'markdown' };
    }
    if (!hit) return;
    if (hit.kind === 'markdown' && !cfg.markdown) return;
    if (hit.kind === 'code' && !cfg.code) return;

    // Hand the spec to the renderer scripts (same isolated world) and ask
    // the service worker to inject them.
    window.__rxSpec = {
      kind: hit.kind,
      langKey: hit.langKey || null,
      hljs: hit.hljs || null,
      label: hit.label || 'Markdown',
      file: decodeURIComponent(location.pathname.split('/').pop() || '')
    };

    send({ action: 'rx-render', kind: hit.kind, langKey: hit.langKey || null });
  });

  function send(msg) {
    chrome.runtime.sendMessage(msg, (res) => {
      if (chrome.runtime.lastError) {
        console.warn('[render-ext] inject failed:', chrome.runtime.lastError.message);
      } else if (res && !res.ok) {
        console.warn('[render-ext] inject failed:', res.error);
      }
    });
  }
})();

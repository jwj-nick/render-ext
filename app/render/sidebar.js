// render-ext left sidebar — persistent directory navigator + markdown TOC.
// rxCreateSidebar({onOpenFile, onOpenDir}) returns a controller the app drives.
// Folder / renderable-file clicks are intercepted (no navigation) and routed to
// the callbacks so the viewer shell stays put. .html and other files keep a
// real link (open in a new tab; the browser renders / downloads them).
'use strict';

// ---- pure helpers (also unit-tested by tests/harness.js) ----------------

function rxUnescapeJs(s) {
  try {
    return JSON.parse(
      '"' + s.replace(/\\x([0-9a-fA-F]{2})/g, '\\u00$1').replace(/\\'/g, "'") + '"'
    );
  } catch (e) {
    return s;
  }
}

function rxParentDir(dir) {
  if (!/^file:\/\/\//.test(dir)) return null;
  const noslash = dir.replace(/\/+$/, '');
  if (noslash === 'file://') return null;
  const idx = noslash.lastIndexOf('/');
  const p = noslash.slice(0, idx + 1);
  return p.length >= 8 ? p : null; // 'file:///'.length === 8
}

function rxExtOf(name) {
  const m = name.toLowerCase().match(/\.([a-z0-9_]+)$/);
  return m ? m[1] : '';
}

// Resolve a listing entry to an absolute URL. String concatenation loses slashes
// when a folder entry has no trailing "/" (dir "…/idea/" + "migration" would give
// "…/ideamigration" on the next hop) — resolve against a slash-terminated base
// with new URL(), and make sure directory results keep a trailing slash so the
// next level resolves correctly too.
function rxChildUrl(dir, entry) {
  if (entry.up) return entry.url; // already absolute (parent link)
  const base = dir.endsWith('/') ? dir : dir + '/';
  let full;
  try {
    full = new URL(entry.url, base).href;
  } catch (e) {
    full = base + entry.url;
  }
  if (entry.isDir && !full.endsWith('/')) full += '/';
  return full;
}

function rxParseListing(html) {
  const out = [];
  const re = /addRow\("((?:[^"\\]|\\.)*)","((?:[^"\\]|\\.)*)",\s*(true|false|1|0)/g;
  let m;
  while ((m = re.exec(html))) {
    const name = rxUnescapeJs(m[1]);
    if (name === '..' || name === '.' || name === '') continue;
    out.push({ name, url: m[2], isDir: m[3] === 'true' || m[3] === '1' });
  }
  if (!out.length) {
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      doc.querySelectorAll('a[href]').forEach((a) => {
        const href = a.getAttribute('href');
        const name = a.textContent.trim();
        if (!href || href[0] === '?' || !name || name === '..' || name === '.') return;
        out.push({ name, url: href, isDir: href.endsWith('/') });
      });
    } catch (e) {}
  }
  return out;
}

// A content script's origin is null on file://, so it cannot fetch/XHR file://.
// The service worker (extension origin + file access) can, so route through it.
// XHR/fetch stay as fallbacks for non-extension contexts (harness/demo).
function rxSwFetch(url) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage({ action: 'rx-fetch', url }, (res) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (res && res.ok) return resolve(res.text || '');
        reject(new Error((res && res.error) || 'no response from service worker'));
      });
    } catch (e) {
      reject(e);
    }
  });
}

function rxXhrText(url) {
  return new Promise((resolve, reject) => {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url);
      xhr.responseType = 'text';
      xhr.onload = () => resolve(xhr.responseText || '');
      xhr.onerror = () => reject(new Error('XHR failed for ' + url));
      xhr.send();
    } catch (e) {
      reject(e);
    }
  });
}

async function rxFetchText(url) {
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    return rxSwFetch(url);
  }
  try {
    return await rxXhrText(url);
  } catch (e) {
    const res = await fetch(url);
    return await res.text();
  }
}

// Binary read -> { b64, mime, size }. Same routing rule as rxFetchText: through
// the service worker inside the extension, direct XHR in the demo/harness.
function rxSwFetchBin(url, mime) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage({ action: 'rx-fetch-bin', url, mime }, (res) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (res && res.ok) return resolve(res);
        reject(new Error((res && res.error) || 'no response from service worker'));
      });
    } catch (e) {
      reject(e);
    }
  });
}

async function rxFetchBinary(url, mime) {
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    return rxSwFetchBin(url, mime);
  }
  const buf = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.responseType = 'arraybuffer';
    xhr.onload = () => resolve(xhr.response);
    xhr.onerror = () => reject(new Error('XHR failed for ' + url));
    xhr.send();
  });
  const bytes = new Uint8Array(buf);
  const CHUNK = 0x8000;
  let bin = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return { b64: btoa(bin), mime: mime || 'application/octet-stream', size: buf.byteLength };
}

// base64 -> Uint8Array (for zip-based formats handled in later phases)
function rxB64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---- sidebar controller --------------------------------------------------

function rxCreateSidebar(opts) {
  const onOpenFile = opts.onOpenFile;
  const onOpenDir = opts.onOpenDir;
  const canFiles = location.protocol === 'file:';

  const aside = document.createElement('aside');
  aside.className = 'rx-sidebar';

  const head = document.createElement('div');
  head.className = 'rx-sb-head';
  const tabsEl = document.createElement('div');
  tabsEl.className = 'rx-sb-tabs';
  const collapseBtn = document.createElement('button');
  collapseBtn.className = 'rx-sb-collapse';
  collapseBtn.title = '사이드바 접기';
  collapseBtn.textContent = '⟨';
  head.append(tabsEl, collapseBtn);

  const bodyEl = document.createElement('div');
  bodyEl.className = 'rx-sb-body';

  const filesPanel = document.createElement('div');
  filesPanel.className = 'rx-sb-panel';
  const tocPanel = document.createElement('div');
  tocPanel.className = 'rx-sb-panel';
  bodyEl.append(filesPanel, tocPanel);
  aside.append(head, bodyEl);

  const reveal = document.createElement('button');
  reveal.className = 'rx-sb-reveal';
  reveal.title = '사이드바 열기';
  reveal.textContent = '☰';

  const filesTab = document.createElement('button');
  filesTab.className = 'rx-sb-tab';
  filesTab.textContent = 'Files';
  const tocTab = document.createElement('button');
  tocTab.className = 'rx-sb-tab';
  tocTab.textContent = 'Contents';
  if (canFiles) tabsEl.append(filesTab);
  tabsEl.append(tocTab);
  tocTab.style.display = 'none';

  let mode = canFiles ? 'files' : 'toc';
  let hasToc = false;
  let dirUrl = null;
  let activeFileUrl = null;

  function applyMode() {
    filesPanel.style.display = mode === 'files' ? '' : 'none';
    tocPanel.style.display = mode === 'toc' ? '' : 'none';
    filesTab.classList.toggle('active', mode === 'files');
    tocTab.classList.toggle('active', mode === 'toc');
    try { chrome.storage.local.set({ sidebarMode: mode }); } catch (e) {}
  }
  function setMode(m) {
    if (m === 'files' && !canFiles) return;
    if (m === 'toc' && !hasToc) return;
    mode = m;
    applyMode();
  }
  filesTab.addEventListener('click', () => setMode('files'));
  tocTab.addEventListener('click', () => setMode('toc'));

  function setCollapsed(c) {
    document.documentElement.classList.toggle('rx-sb-collapsed', c);
    try { chrome.storage.local.set({ sidebarCollapsed: c }); } catch (e) {}
  }
  collapseBtn.addEventListener('click', () => setCollapsed(true));
  reveal.addEventListener('click', () => setCollapsed(false));

  // ---- Files panel ----
  function fileRow(e, dir) {
    const li = document.createElement('li');
    li.className = 'rx-sb-file ' + (e.isDir ? 'rx-sb-dir' : 'rx-sb-doc');
    const full = rxChildUrl(dir, e);
    li.dataset.url = full;

    const a = document.createElement('a');
    a.className = 'rx-sb-link';
    a.href = full;

    const ext = e.isDir ? '' : rxExtOf(e.name);
    const isHtml = ext === 'html' || ext === 'htm';
    const hit = !e.isDir && typeof rxLookupExt === 'function' ? rxLookupExt(ext) : null;
    const renderable = !!hit;

    if (e.isDir) {
      a.addEventListener('click', (ev) => { ev.preventDefault(); onOpenDir(full); });
    } else if (isHtml || !renderable) {
      a.target = '_blank'; // browser renders / downloads in a new tab
    } else {
      a.addEventListener('click', (ev) => { ev.preventDefault(); onOpenFile(full); });
    }

    const icon = document.createElement('span');
    icon.className = 'rx-sb-icon';
    icon.textContent = e.up ? '⬆' : e.isDir ? '📁' : isHtml ? '🌐'
      : hit ? (hit.icon || '📄') : '·';
    const label = document.createElement('span');
    label.className = 'rx-sb-name';
    label.textContent = e.up ? '상위 폴더' : e.name;

    a.append(icon, label);
    li.appendChild(a);
    return li;
  }

  async function showDir(dir, active) {
    if (dir && !dir.endsWith('/')) dir += '/'; // a dir URL must end with '/'
    dirUrl = dir;
    activeFileUrl = active || activeFileUrl;
    setMode('files');
    filesPanel.replaceChildren();

    const label = document.createElement('div');
    label.className = 'rx-sb-dirlabel';
    label.textContent = decodeURIComponent(dir).replace(/^file:\/\/\//, '').replace(/\/$/, '') || dir;
    label.title = label.textContent;
    filesPanel.appendChild(label);

    const list = document.createElement('ul');
    list.className = 'rx-sb-files';
    filesPanel.appendChild(list);

    const parent = rxParentDir(dir);
    if (parent) list.appendChild(fileRow({ name: '..', url: parent, isDir: true, up: true }, dir));

    let text;
    try {
      text = await rxFetchText(dir);
    } catch (e) {
      console.warn('[render-ext] directory load failed:', e);
      filesPanel.appendChild(rxHint('폴더 목록을 불러오지 못했습니다: ' + (e && e.message ? e.message : e)));
      return;
    }
    const entries = rxParseListing(text);
    entries.sort((a, b) => (b.isDir - a.isDir) || a.name.localeCompare(b.name));
    for (const e of entries) list.appendChild(fileRow(e, dir));
    if (!entries.length) filesPanel.appendChild(rxHint('(빈 폴더)'));
    setActiveFile(activeFileUrl);
  }

  function setActiveFile(url) {
    activeFileUrl = url;
    let cur = null;
    for (const li of filesPanel.querySelectorAll('.rx-sb-file')) {
      const on = url && li.dataset.url &&
        decodeURIComponent(li.dataset.url) === decodeURIComponent(url);
      li.classList.toggle('rx-sb-current', !!on);
      if (on) cur = li;
    }
    if (cur) cur.scrollIntoView({ block: 'nearest' });
  }

  // ---- Contents (TOC) panel ----
  function showToc(headings) {
    tocPanel.replaceChildren();
    hasToc = headings && headings.length > 0;
    tocTab.style.display = hasToc ? '' : 'none';
    if (!hasToc) {
      if (mode === 'toc') setMode('files');
      return;
    }
    const ul = document.createElement('ul');
    ul.className = 'rx-toc';
    const links = new Map();
    const minLvl = Math.min(...headings.map((h) => +h.tagName[1]));
    for (const h of headings) {
      const li = document.createElement('li');
      li.className = 'rx-toc-item';
      li.style.paddingLeft = (+h.tagName[1] - minLvl) * 12 + 'px';
      const a = document.createElement('a');
      a.href = '#' + h.id;
      a.textContent = h.textContent;
      a.addEventListener('click', (ev) => {
        ev.preventDefault();
        h.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      li.appendChild(a);
      ul.appendChild(li);
      links.set(h.id, a);
    }
    tocPanel.appendChild(ul);

    let activeId = null;
    const obs = new IntersectionObserver(
      (ents) => {
        for (const en of ents) {
          if (!en.isIntersecting) continue;
          if (activeId && links.get(activeId)) links.get(activeId).classList.remove('active');
          activeId = en.target.id;
          const a = links.get(activeId);
          if (a) { a.classList.add('active'); a.scrollIntoView({ block: 'nearest' }); }
        }
      },
      { rootMargin: '0px 0px -80% 0px', threshold: 0 }
    );
    headings.forEach((h) => obs.observe(h));
  }

  // restore persisted UI state
  try {
    chrome.storage.local.get({ sidebarMode: null, sidebarCollapsed: false }, (st) => {
      if (st.sidebarMode === 'files' && canFiles) setMode('files');
      if (st.sidebarCollapsed) setCollapsed(true);
    });
  } catch (e) {}

  applyMode();
  return { el: aside, reveal, showDir, showToc, setActiveFile };
}

function rxHint(msg) {
  const p = document.createElement('p');
  p.className = 'rx-sb-hint';
  p.textContent = msg;
  return p;
}

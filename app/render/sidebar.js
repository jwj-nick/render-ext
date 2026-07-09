// render-ext left sidebar — directory navigator + markdown TOC.
// Injected before render/markdown.js and render/code.js. Each renderer calls
// rxMountSidebar({kind, tocRoot}) after it finishes.
//
//   Files mode (file:// only): siblings of the current file + parent folder.
//     - folder / renderable doc  -> same tab (extension re-renders)
//     - .html / .htm & anything else -> new tab (browser renders / downloads)
//   Contents mode (markdown only): TOC from h1..h6 with scroll-spy.
//   Code files get Files only; http(s) markdown gets Contents only.
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

// parent of a file:// dir url ("…/a/b/" -> "…/a/"); null at the top.
function rxParentDir(dir) {
  if (!/^file:\/\/\//.test(dir)) return null;
  const noslash = dir.replace(/\/+$/, '');
  if (noslash === 'file://') return null; // dir was file:///
  const idx = noslash.lastIndexOf('/');
  const p = noslash.slice(0, idx + 1);
  return p.length >= 8 ? p : null; // 'file:///'.length === 8
}

function rxExtOf(name) {
  const m = name.toLowerCase().match(/\.([a-z0-9_]+)$/);
  return m ? m[1] : '';
}

// A content script runs with the PAGE's origin ("null" on file://), so both
// fetch() and XHR to file:// are blocked by CORS. The service worker runs with
// the extension origin and can read file:// (host_permissions + file access),
// so we ask it to fetch the directory listing for us. XHR/fetch are kept only
// as fallbacks for non-extension contexts (the test harness / demo pages).
function rxSwListDir(url) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage({ action: 'rx-listdir', url }, (res) => {
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
    return rxSwListDir(url); // extension context — the reliable path
  }
  try {
    return await rxXhrText(url); // demo/harness fallback
  } catch (e) {
    const res = await fetch(url);
    return await res.text();
  }
}

// Chrome's file:// listing embeds addRow("name","url",isDir,…) script calls.
// Parse those; fall back to <a href> anchors for other listing formats.
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

// ---- mount ---------------------------------------------------------------

function rxMountSidebar(opts) {
  if (window.__rxSidebarMounted) return;
  try {
    chrome.storage.sync.get({ sidebar: true }, (cfg) => {
      if (cfg.sidebar) rxMountSidebarNow(opts);
    });
  } catch (e) {
    rxMountSidebarNow(opts); // non-extension context (harness/demo)
  }
}

function rxMountSidebarNow(opts) {
  if (window.__rxSidebarMounted) return;

  const kind = opts.kind;
  const tocRoot = opts.tocRoot;
  const canFiles = location.protocol === 'file:';
  const heads = tocRoot
    ? [...tocRoot.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter((h) => h.id)
    : [];
  const canToc = kind === 'markdown' && heads.length >= 1;
  if (!canFiles && !canToc) return; // nothing to show (e.g. http code file)
  window.__rxSidebarMounted = true;

  const modes = [];
  if (canFiles) modes.push('files');
  if (canToc) modes.push('toc');

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
  aside.append(head, bodyEl);

  const reveal = document.createElement('button');
  reveal.className = 'rx-sb-reveal';
  reveal.title = '사이드바 열기';
  reveal.textContent = '☰';

  document.body.append(aside, reveal);
  document.documentElement.classList.add('rx-has-sidebar');

  function setCollapsed(c) {
    document.documentElement.classList.toggle('rx-sb-collapsed', c);
    try { chrome.storage.local.set({ sidebarCollapsed: c }); } catch (e) {}
  }
  collapseBtn.addEventListener('click', () => setCollapsed(true));
  reveal.addEventListener('click', () => setCollapsed(false));

  const panels = {};
  function show(mode) {
    for (const k of modes) {
      panels[k].el.style.display = k === mode ? '' : 'none';
      if (panels[k].btn) panels[k].btn.classList.toggle('active', k === mode);
    }
    try { chrome.storage.local.set({ sidebarMode: mode }); } catch (e) {}
  }

  for (const mode of modes) {
    const panel = document.createElement('div');
    panel.className = 'rx-sb-panel';
    bodyEl.appendChild(panel);
    panels[mode] = { el: panel };
    if (modes.length > 1) {
      const btn = document.createElement('button');
      btn.className = 'rx-sb-tab';
      btn.textContent = mode === 'files' ? 'Files' : 'Contents';
      btn.addEventListener('click', () => show(mode));
      tabsEl.appendChild(btn);
      panels[mode].btn = btn;
    } else {
      const title = document.createElement('span');
      title.className = 'rx-sb-title';
      title.textContent = mode === 'files' ? 'Files' : 'Contents';
      tabsEl.appendChild(title);
    }
  }

  if (canFiles) rxRenderFiles(panels.files.el);
  if (canToc) rxRenderToc(panels.toc.el, heads);

  const fallback = canToc ? 'toc' : 'files';
  try {
    chrome.storage.local.get({ sidebarMode: null, sidebarCollapsed: false }, (st) => {
      show(modes.includes(st.sidebarMode) ? st.sidebarMode : fallback);
      if (st.sidebarCollapsed) setCollapsed(true);
    });
  } catch (e) {
    show(fallback);
  }
}

// ---- Files panel ---------------------------------------------------------

async function rxRenderFiles(container) {
  const href = location.href;
  const dirUrl = href.slice(0, href.lastIndexOf('/') + 1);
  const curName = decodeURIComponent(href.slice(dirUrl.length).split(/[?#]/)[0]);

  const list = document.createElement('ul');
  list.className = 'rx-sb-files';
  container.appendChild(list);

  const parent = rxParentDir(dirUrl);
  if (parent) list.appendChild(rxFileRow({ name: '..', url: parent, isDir: true, up: true }, dirUrl));

  let text;
  try {
    text = await rxFetchText(dirUrl);
  } catch (e) {
    console.warn('[render-ext] directory load failed:', e);
    container.appendChild(
      rxHint('폴더 목록을 불러오지 못했습니다. chrome://extensions 에서 render-ext의 ' +
             '“파일 URL에 대한 액세스 허용”이 켜져 있어야 합니다.')
    );
    return;
  }

  const entries = rxParseListing(text);
  entries.sort((a, b) => (b.isDir - a.isDir) || a.name.localeCompare(b.name));

  let curRow = null;
  for (const e of entries) {
    const row = rxFileRow(e, dirUrl);
    if (!e.isDir && decodeURIComponent(e.url) === curName) {
      row.classList.add('rx-sb-current');
      curRow = row;
    }
    list.appendChild(row);
  }
  if (!entries.length) container.appendChild(rxHint('(빈 폴더)'));
  if (curRow) curRow.scrollIntoView({ block: 'center' });
}

function rxFileRow(e, dirUrl) {
  const li = document.createElement('li');
  li.className = 'rx-sb-file ' + (e.isDir ? 'rx-sb-dir' : 'rx-sb-doc');

  const a = document.createElement('a');
  a.className = 'rx-sb-link';
  a.href = e.up ? e.url : dirUrl + e.url;

  const ext = e.isDir ? '' : rxExtOf(e.name);
  const isHtml = ext === 'html' || ext === 'htm';
  const renderable = !e.isDir && typeof rxLookupExt === 'function' && !!rxLookupExt(ext);
  // same tab: folders + files we can render. new tab: html + everything else.
  if (!e.isDir && (isHtml || !renderable)) a.target = '_blank';

  const icon = document.createElement('span');
  icon.className = 'rx-sb-icon';
  icon.textContent = e.up ? '⬆' : e.isDir ? '📁' : isHtml ? '🌐' : renderable ? '📄' : '·';

  const label = document.createElement('span');
  label.className = 'rx-sb-name';
  label.textContent = e.up ? '상위 폴더' : e.name;

  a.append(icon, label);
  li.appendChild(a);
  return li;
}

// ---- Contents (TOC) panel ------------------------------------------------

function rxRenderToc(container, heads) {
  const ul = document.createElement('ul');
  ul.className = 'rx-toc';
  const links = new Map();
  const minLvl = Math.min(...heads.map((h) => +h.tagName[1]));

  for (const h of heads) {
    const li = document.createElement('li');
    li.className = 'rx-toc-item';
    li.style.paddingLeft = (+h.tagName[1] - minLvl) * 12 + 'px';
    const a = document.createElement('a');
    a.href = '#' + h.id;
    a.textContent = h.textContent;
    a.addEventListener('click', (ev) => {
      ev.preventDefault();
      h.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.replaceState(null, '', '#' + h.id);
    });
    li.appendChild(a);
    ul.appendChild(li);
    links.set(h.id, a);
  }
  container.appendChild(ul);

  // scroll-spy: highlight the heading nearest the top of the viewport
  let activeId = null;
  const obs = new IntersectionObserver(
    (ents) => {
      for (const en of ents) {
        if (!en.isIntersecting) continue;
        if (activeId && links.get(activeId)) links.get(activeId).classList.remove('active');
        activeId = en.target.id;
        const a = links.get(activeId);
        if (a) {
          a.classList.add('active');
          a.scrollIntoView({ block: 'nearest' });
        }
      }
    },
    { rootMargin: '0px 0px -80% 0px', threshold: 0 }
  );
  heads.forEach((h) => obs.observe(h));
}

function rxHint(msg) {
  const p = document.createElement('p');
  p.className = 'rx-sb-hint';
  p.textContent = msg;
  return p;
}

// render-ext viewer shell — the persistent app.
// Left sidebar (Files / Contents) stays put; the right pane shows the last
// successfully opened file. Folder clicks refresh the list only; file clicks
// load into the right pane in place (no navigation). Open failures show a
// message in the pane while the sidebar remains.
'use strict';

window.rxApp = (() => {
  let sidebar = null;
  let content = null;
  let toolbar = null;
  const state = { dirUrl: null, fileUrl: null, rawText: null, renderedNode: null, showingRaw: false };

  function classify(url, hintSpec) {
    const file = decodeURIComponent((url.split('/').pop() || '').split(/[?#]/)[0]);
    const ext = rxExtOf(file);
    const hit = typeof rxLookupExt === 'function' ? rxLookupExt(ext) : null;
    if (hit && hit.kind === 'markdown') return { kind: 'markdown', file, label: 'Markdown' };
    if (hit && hit.kind === 'code') return { kind: 'code', file, hljs: hit.hljs, label: hit.label };
    if (hintSpec && hintSpec.kind === 'markdown') return { kind: 'markdown', file, label: 'Markdown' };
    // unknown extension -> show as plain text (still readable)
    return { kind: 'code', file, hljs: null, label: 'Text' };
  }

  function mount() {
    if (window.__rxApp) return;
    window.__rxApp = true;

    document.documentElement.classList.add('rx-page', 'rx-has-sidebar');
    document.body.replaceChildren();

    sidebar = rxCreateSidebar({ onOpenFile: openFile, onOpenDir: openDir });
    content = document.createElement('main');
    content.className = 'rx-content';

    toolbar = buildToolbar();

    document.body.append(sidebar.el, sidebar.reveal, content, toolbar.el);
    showEmpty('왼쪽에서 파일을 선택하세요.');
  }

  function buildToolbar() {
    const bar = document.createElement('div');
    bar.className = 'rx-toolbar';
    const tag = document.createElement('span');
    tag.className = 'rx-toolbar-label';
    const btn = document.createElement('button');
    btn.className = 'rx-toolbar-btn';
    btn.type = 'button';
    btn.textContent = 'Raw';
    btn.style.display = 'none';
    btn.addEventListener('click', toggleRaw);
    bar.append(tag, btn);
    return { el: bar, tag, btn };
  }

  function setLabel(txt) { toolbar.tag.textContent = txt || ''; }

  function contentSet(node) {
    content.replaceChildren(node);
    content.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  function showEmpty(msg) {
    setLabel('');
    toolbar.btn.style.display = 'none';
    state.renderedNode = null;
    const box = document.createElement('div');
    box.className = 'rx-msg rx-msg-empty';
    box.textContent = msg;
    contentSet(box);
  }

  function showError(title, detail) {
    setLabel('');
    toolbar.btn.style.display = 'none';
    state.renderedNode = null;
    const box = document.createElement('div');
    box.className = 'rx-msg rx-msg-error';
    const h = document.createElement('p');
    h.className = 'rx-msg-title';
    h.textContent = title;
    box.appendChild(h);
    if (detail) {
      const pre = document.createElement('pre');
      pre.className = 'rx-msg-detail';
      pre.textContent = detail;
      box.appendChild(pre);
    }
    contentSet(box);
  }

  async function render(url, text, hintSpec) {
    const spec = classify(url, hintSpec);
    state.rawText = text;
    state.showingRaw = false;
    toolbar.btn.textContent = 'Raw';

    if (spec.kind === 'markdown') {
      const { node, headings, title } = await rxRenderMarkdown(text, spec);
      state.renderedNode = node;
      contentSet(node);
      await rxRenderDiagrams(node); // node is now attached — safe to measure
      document.title = title || spec.file;
      setLabel(spec.label + ' · ' + spec.file);
      sidebar.showToc(headings);
    } else {
      const { node, note, lines } = rxRenderCode(text, spec);
      state.renderedNode = node;
      contentSet(node);
      document.title = spec.file;
      setLabel(`${spec.label} · ${lines} lines${note ? ' · ' + note : ''}`);
      sidebar.showToc([]);
    }
    toolbar.btn.style.display = '';
  }

  function toggleRaw() {
    if (!state.renderedNode) return;
    state.showingRaw = !state.showingRaw;
    toolbar.btn.textContent = state.showingRaw ? 'Rendered' : 'Raw';
    if (state.showingRaw) {
      const pre = document.createElement('pre');
      pre.className = 'rx-raw';
      pre.textContent = state.rawText;
      content.replaceChildren(pre);
    } else {
      content.replaceChildren(state.renderedNode);
    }
  }

  async function openFile(url, hintSpec) {
    try {
      const text = await rxFetchText(url);
      state.fileUrl = url;
      await render(url, text, hintSpec);
      const dir = url.slice(0, url.lastIndexOf('/') + 1);
      if (dir !== state.dirUrl) {
        state.dirUrl = dir;
        sidebar.showDir(dir, url);
      } else {
        sidebar.setActiveFile(url);
      }
    } catch (e) {
      console.warn('[render-ext] open failed:', e);
      showError('파일을 찾거나 렌더링하지 못했습니다', url + '\n\n' + (e && e.message ? e.message : e));
      // keep the sidebar useful: show the folder this file lives in
      const dir = url.slice(0, url.lastIndexOf('/') + 1);
      if (dir && dir !== state.dirUrl) {
        state.dirUrl = dir;
        sidebar.showDir(dir, null);
      }
    }
  }

  function openDir(url) {
    state.dirUrl = url;
    sidebar.showDir(url, state.fileUrl);
    if (!state.fileUrl) showEmpty('왼쪽에서 파일을 선택하세요.');
  }

  // Initial file already displayed by Chrome (text in a <pre>); render directly.
  async function openInitial(url, text, hintSpec) {
    state.fileUrl = url;
    try {
      await render(url, text, hintSpec);
    } catch (e) {
      showError('렌더링에 실패했습니다', url + '\n\n' + (e && e.message ? e.message : e));
    }
    const dir = url.slice(0, url.lastIndexOf('/') + 1);
    state.dirUrl = dir;
    sidebar.showDir(dir, url);
  }

  function autostart() {
    const spec = window.__rxSpec || {};
    const first = document.body && document.body.firstElementChild;
    const pre = first && first.tagName === 'PRE' ? first : null;
    const initialText = pre ? pre.textContent : null;

    mount();

    if (spec.mode === 'dir') {
      const dir = location.href.endsWith('/') ? location.href : location.href + '/';
      openDir(dir);
    } else if (initialText != null) {
      openInitial(location.href, initialText, spec);
    } else {
      openFile(location.href, spec);
    }
  }

  return { mount, openFile, openDir, openInitial, showError, showEmpty, autostart };
})();

// Auto-run only inside the extension (skip in the harness/demo, which drive it).
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id && !window.__rxApp) {
  rxApp.autostart();
}

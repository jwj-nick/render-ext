// render-ext document renderers — HWPX, DOCX, XLSX, PPTX (text), Jupyter.
// All take bytes (Uint8Array) or text and return { node, title, note }.
//
// HWPX rendering is the hwpx-tool engine, vendored verbatim under
// libs/hwpx/ and pulled in as ES modules (see libs/hwpx/VENDOR.md).
'use strict';

// This file's own URL, captured while it executes. Needed because a dynamic
// import() inside a classic script resolves against the SCRIPT's URL, not the
// document's — a relative specifier would silently point somewhere else.
const RX_DOC_SCRIPT_URL =
  (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) ||
  location.href;

// Resolve a bundled library to an absolute, loadable URL. Inside the extension
// that is an extension-origin URL (the files are web_accessible_resources); in
// the harness/demo it resolves next to this script (app/render/ -> app/).
function rxLibUrl(rel) {
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
    return chrome.runtime.getURL(rel);
  }
  return new URL('../' + rel, RX_DOC_SCRIPT_URL).href;
}

function rxBytesToDataUrl(bytes, mime) {
  const CHUNK = 0x8000;
  let bin = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return 'data:' + (mime || 'application/octet-stream') + ';base64,' + btoa(bin);
}

// ---- HWPX ----------------------------------------------------------------

let rxHwpxMods = null;
async function rxLoadHwpx() {
  if (!rxHwpxMods) {
    const [hwpx, header, render] = await Promise.all([
      import(rxLibUrl('libs/hwpx/hwpx.js')),
      import(rxLibUrl('libs/hwpx/header.js')),
      import(rxLibUrl('libs/hwpx/render.js'))
    ]);
    rxHwpxMods = { hwpx, header, render };
  }
  return rxHwpxMods;
}

async function rxRenderHwpx(bytes, spec) {
  const { hwpx, header, render } = await rxLoadHwpx();
  const doc = await hwpx.openHwpx(bytes); // throws a friendly error on legacy .hwp

  const headerXml = await doc.headerXml();
  const hdr = headerXml ? header.parseHeader(headerXml) : null;

  // BinData (images) as data: URLs — blob: URLs from a file:// page get an
  // opaque origin and may not load.
  const bin = new Map();
  for (const item of doc.manifest) {
    if (!item.href || !item.href.startsWith('BinData/')) continue;
    const path = doc.resolveHref(item.href);
    if (!doc.zip.has(path)) continue;
    try {
      const data = await doc.readEntry(path);
      bin.set(item.id, rxBytesToDataUrl(data, item.mediaType || 'application/octet-stream'));
    } catch (e) { /* skip an unreadable image, keep the document */ }
  }

  const root = document.createElement('div');
  root.className = 'rx-doc rx-doc-hwpx';
  rxEnsureStyle('rx-hwpx-css', render.BASE_CSS);

  for (let i = 0; i < doc.sectionPaths.length; i++) {
    const xml = await doc.sectionXml(i);
    const html = render.renderSection(xml, {
      header: hdr,
      resolveBinData: (id) => bin.get(id) || null
    });
    const sec = document.createElement('div');
    sec.className = 'rx-doc-section';
    sec.innerHTML = DOMPurify.sanitize(html);
    root.appendChild(sec);
  }

  const note = `${doc.sectionPaths.length} section${doc.sectionPaths.length > 1 ? 's' : ''}` +
    (bin.size ? ` · ${bin.size} image${bin.size > 1 ? 's' : ''}` : '');
  return { node: root, title: doc.title || spec.file || '', note };
}

// Inject a <style> once (renderer CSS that ships with the vendored engine).
function rxEnsureStyle(id, css) {
  if (document.getElementById(id)) return;
  const s = document.createElement('style');
  s.id = id;
  s.textContent = css;
  document.head.appendChild(s);
}

// ---- DOCX ----------------------------------------------------------------

async function rxRenderDocx(bytes, spec) {
  const res = await mammoth.convertToHtml(
    { arrayBuffer: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) },
    { convertImage: mammoth.images.imgElement((img) =>
        img.read('base64').then((b64) => ({ src: 'data:' + img.contentType + ';base64,' + b64 })))
    }
  );
  const root = document.createElement('article');
  root.className = 'markdown-body rx-doc rx-doc-docx';
  root.innerHTML = DOMPurify.sanitize(res.value);

  const warn = (res.messages || []).filter((m) => m.type === 'warning').length;
  return {
    node: root,
    title: spec.file || '',
    note: warn ? `${warn} conversion warning${warn > 1 ? 's' : ''}` : ''
  };
}

// ---- XLSX / XLS ----------------------------------------------------------

function rxRenderXlsx(bytes, spec) {
  const wb = XLSX.read(bytes, { type: 'array' });
  const root = document.createElement('div');
  root.className = 'rx-doc rx-doc-xlsx';

  const tabs = document.createElement('div');
  tabs.className = 'rx-sheet-tabs';
  const body = document.createElement('div');
  body.className = 'rx-sheet-body';
  root.append(tabs, body);

  const panes = [];
  wb.SheetNames.forEach((name, i) => {
    const pane = document.createElement('div');
    pane.className = 'rx-table-wrap';
    pane.style.display = i === 0 ? '' : 'none';
    const html = XLSX.utils.sheet_to_html(wb.Sheets[name], { id: 'rx-sheet-' + i });
    pane.innerHTML = DOMPurify.sanitize(html);
    const tbl = pane.querySelector('table');
    if (tbl) tbl.classList.add('rx-table');
    body.appendChild(pane);
    panes.push(pane);

    const btn = document.createElement('button');
    btn.className = 'rx-sheet-tab' + (i === 0 ? ' active' : '');
    btn.textContent = name;
    btn.addEventListener('click', () => {
      panes.forEach((p, k) => { p.style.display = k === i ? '' : 'none'; });
      [...tabs.children].forEach((b, k) => b.classList.toggle('active', k === i));
    });
    tabs.appendChild(btn);
  });

  if (wb.SheetNames.length < 2) tabs.style.display = 'none';
  return {
    node: root,
    title: spec.file || '',
    note: `${wb.SheetNames.length} sheet${wb.SheetNames.length > 1 ? 's' : ''}`
  };
}

// ---- PPTX (text + images, no layout) -------------------------------------

async function rxRenderPptx(bytes, spec) {
  const { readZip } = await import(rxLibUrl('libs/hwpx/zip.js'));
  const zip = readZip(bytes);

  const slidePaths = zip.names()
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => {
      const n = (s) => parseInt(s.match(/slide(\d+)\.xml/)[1], 10);
      return n(a) - n(b);
    });

  const root = document.createElement('div');
  root.className = 'rx-doc rx-doc-pptx';

  for (let i = 0; i < slidePaths.length; i++) {
    const xml = await zip.readText(slidePaths[i]);
    const card = document.createElement('section');
    card.className = 'rx-slide';

    const num = document.createElement('div');
    num.className = 'rx-slide-num';
    num.textContent = 'Slide ' + (i + 1);
    card.appendChild(num);

    // <a:p> paragraphs made of <a:t> text runs
    for (const para of xml.split(/<a:p[\s>]/).slice(1)) {
      const texts = [...para.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)].map((m) => m[1]);
      if (!texts.length) continue;
      const line = texts.join('')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
      if (!line.trim()) continue;
      const p = document.createElement('p');
      p.textContent = line;
      card.appendChild(p);
    }
    root.appendChild(card);
  }

  if (!slidePaths.length) {
    root.appendChild(rxDocNote('슬라이드를 찾지 못했습니다 (pptx 구조가 예상과 다릅니다).'));
  }
  return {
    node: root,
    title: spec.file || '',
    note: `${slidePaths.length} slides · 텍스트만 (레이아웃 미지원)`
  };
}

function rxDocNote(msg) {
  const p = document.createElement('p');
  p.className = 'rx-doc-note';
  p.textContent = msg;
  return p;
}

// ---- Jupyter notebook ----------------------------------------------------

async function rxRenderNotebook(text, spec) {
  const nb = JSON.parse(text);
  const root = document.createElement('div');
  root.className = 'rx-doc rx-nb';
  const lang =
    (nb.metadata && nb.metadata.language_info && nb.metadata.language_info.name) || 'python';
  const cells = nb.cells || [];
  const mdNodes = [];

  for (const cell of cells) {
    const src = Array.isArray(cell.source) ? cell.source.join('') : (cell.source || '');
    const wrap = document.createElement('div');
    wrap.className = 'rx-nb-cell rx-nb-' + cell.cell_type;

    if (cell.cell_type === 'markdown') {
      const md = await rxRenderMarkdown(src, { file: '' });
      md.node.classList.add('rx-nb-md');
      wrap.appendChild(md.node);
      mdNodes.push(md.node);
    } else if (cell.cell_type === 'code') {
      const head = document.createElement('div');
      head.className = 'rx-nb-prompt';
      head.textContent = 'In [' + (cell.execution_count == null ? ' ' : cell.execution_count) + ']:';
      wrap.appendChild(head);

      const pre = document.createElement('pre');
      pre.className = 'rx-nb-code';
      const code = document.createElement('code');
      code.textContent = src;
      if (hljs.getLanguage(lang)) {
        code.className = 'language-' + lang;
        hljs.highlightElement(code);
      } else {
        code.className = 'hljs';
      }
      pre.appendChild(code);
      wrap.appendChild(pre);

      for (const out of cell.outputs || []) wrap.appendChild(rxNbOutput(out));
    } else {
      const pre = document.createElement('pre');
      pre.className = 'rx-nb-code';
      pre.textContent = src;
      wrap.appendChild(pre);
    }
    root.appendChild(wrap);
  }

  // markdown cells may contain mermaid/wavedrom — rendered by the caller after
  // attach, via rxRenderDiagrams(root)
  const title =
    (root.querySelector('.rx-nb-md h1') || {}).textContent || spec.file || '';
  const codeCount = cells.filter((c) => c.cell_type === 'code').length;
  return {
    node: root,
    title: title.trim(),
    note: `${cells.length} cells (${codeCount} code) · ${lang}`,
    mdNodes
  };
}

function rxNbOutput(out) {
  const box = document.createElement('div');
  box.className = 'rx-nb-out';
  const data = out.data || {};
  const join = (v) => (Array.isArray(v) ? v.join('') : v || '');

  if (out.output_type === 'stream') {
    const pre = document.createElement('pre');
    pre.className = 'rx-nb-stream' + (out.name === 'stderr' ? ' rx-nb-stderr' : '');
    pre.textContent = join(out.text);
    box.appendChild(pre);
  } else if (out.output_type === 'error') {
    const pre = document.createElement('pre');
    pre.className = 'rx-nb-stream rx-nb-stderr';
    // tracebacks carry ANSI colour codes
    const raw = (out.traceback || []).join('\n');
    if (typeof rxHasAnsi === 'function' && rxHasAnsi(raw)) {
      pre.classList.add('rx-log');
      for (const seg of rxParseAnsi(raw)) {
        if (seg.cls) {
          const s = document.createElement('span');
          s.className = seg.cls;
          s.textContent = seg.text;
          pre.appendChild(s);
        } else pre.appendChild(document.createTextNode(seg.text));
      }
    } else {
      pre.textContent = raw || (out.ename + ': ' + out.evalue);
    }
    box.appendChild(pre);
  } else if (data['image/png'] || data['image/jpeg'] || data['image/gif']) {
    const mime = data['image/png'] ? 'image/png' : data['image/jpeg'] ? 'image/jpeg' : 'image/gif';
    const img = document.createElement('img');
    img.className = 'rx-nb-img';
    img.src = 'data:' + mime + ';base64,' + join(data[mime]).replace(/\s+/g, '');
    box.appendChild(img);
  } else if (data['image/svg+xml']) {
    const holder = document.createElement('div');
    holder.innerHTML = DOMPurify.sanitize(join(data['image/svg+xml']), {
      USE_PROFILES: { svg: true, svgFilters: true }
    });
    box.appendChild(holder);
  } else if (data['text/html']) {
    const holder = document.createElement('div');
    holder.className = 'rx-nb-html';
    holder.innerHTML = DOMPurify.sanitize(join(data['text/html']));
    const tbl = holder.querySelector('table');
    if (tbl) tbl.classList.add('rx-table');
    box.appendChild(holder);
  } else if (data['text/plain']) {
    const pre = document.createElement('pre');
    pre.className = 'rx-nb-stream';
    pre.textContent = join(data['text/plain']);
    box.appendChild(pre);
  }
  return box;
}

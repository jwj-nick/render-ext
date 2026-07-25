// render-ext media/data renderers — image, SVG, PDF, CSV/TSV table, ANSI log.
// Each returns { node, title, note } like the other renderers; no body writes.
'use strict';

// ---- pure helpers (unit-tested in tests/harness.js) ---------------------

// RFC4180-ish CSV/TSV parser: honours quoted fields, "" escapes, and
// newlines inside quotes. Returns an array of row arrays.
function rxParseDelimited(text, delim) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let i = 0;
  if (text.charCodeAt(0) === 0xfeff) i = 1; // strip BOM

  for (; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === delim) { row.push(field); field = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// Guess the delimiter from the first non-empty line (comma / tab / semicolon).
function rxGuessDelim(text, ext) {
  if (ext === 'tsv') return '\t';
  const line = (text.split('\n').find((l) => l.trim()) || '');
  const counts = [[',', 0], ['\t', 0], [';', 0], ['|', 0]];
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted) for (const c of counts) if (ch === c[0]) c[1]++;
  }
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ',';
}

// ANSI SGR -> segments [{text, cls}]. Handles colors 30-37/90-97, bg 40-47/
// 100-107, bold/dim/italic/underline, and reset. Other CSI sequences are dropped.
function rxParseAnsi(text) {
  const out = [];
  const state = { fg: null, bg: null, bold: false, dim: false, italic: false, underline: false };
  const re = /\x1b\[([0-9;]*)m|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b\[[0-9;]*[A-Za-z]/g;
  let last = 0;
  let m;

  const cls = () => {
    const c = [];
    if (state.fg !== null) c.push('rx-fg' + state.fg);
    if (state.bg !== null) c.push('rx-bg' + state.bg);
    if (state.bold) c.push('rx-b');
    if (state.dim) c.push('rx-dim');
    if (state.italic) c.push('rx-i');
    if (state.underline) c.push('rx-u');
    return c.join(' ');
  };
  const push = (t) => { if (t) out.push({ text: t, cls: cls() }); };

  while ((m = re.exec(text))) {
    push(text.slice(last, m.index));
    last = re.lastIndex;
    if (m[1] === undefined) continue; // non-SGR escape: swallow
    const codes = m[1] === '' ? [0] : m[1].split(';').map((n) => parseInt(n, 10) || 0);
    for (let k = 0; k < codes.length; k++) {
      const n = codes[k];
      if (n === 0) { state.fg = state.bg = null; state.bold = state.dim = state.italic = state.underline = false; }
      else if (n === 1) state.bold = true;
      else if (n === 2) state.dim = true;
      else if (n === 3) state.italic = true;
      else if (n === 4) state.underline = true;
      else if (n === 22) state.bold = state.dim = false;
      else if (n === 23) state.italic = false;
      else if (n === 24) state.underline = false;
      else if (n >= 30 && n <= 37) state.fg = n - 30;
      else if (n === 39) state.fg = null;
      else if (n >= 40 && n <= 47) state.bg = n - 40;
      else if (n === 49) state.bg = null;
      else if (n >= 90 && n <= 97) state.fg = n - 90 + 8;
      else if (n >= 100 && n <= 107) state.bg = n - 100 + 8;
      else if ((n === 38 || n === 48) && codes[k + 1] === 5) {
        const idx = codes[k + 2];
        if (n === 38) state.fg = idx < 16 ? idx : null; else state.bg = idx < 16 ? idx : null;
        k += 2;
      } else if ((n === 38 || n === 48) && codes[k + 1] === 2) k += 4; // truecolor: ignore
    }
  }
  push(text.slice(last));
  return out;
}

function rxHasAnsi(text) {
  return /\x1b\[[0-9;]*m/.test(text);
}

// ---- renderers -----------------------------------------------------------

function rxRenderImage(dataUrl, spec) {
  const root = document.createElement('div');
  root.className = 'rx-media';
  const img = document.createElement('img');
  img.className = 'rx-media-img';
  img.src = dataUrl;
  img.alt = spec.file || '';
  root.appendChild(img);

  const meta = document.createElement('div');
  meta.className = 'rx-media-meta';
  img.addEventListener('load', () => {
    meta.textContent = `${img.naturalWidth} × ${img.naturalHeight}`;
  });
  img.addEventListener('error', () => {
    meta.textContent = '이미지를 표시할 수 없습니다.';
  });
  root.appendChild(meta);

  // click to toggle 1:1 / fit
  img.addEventListener('click', () => img.classList.toggle('rx-media-full'));
  return { node: root, title: spec.file || '', note: '클릭: 원본 크기 전환' };
}

function rxRenderSvg(text, spec) {
  const root = document.createElement('div');
  root.className = 'rx-media';
  const holder = document.createElement('div');
  holder.className = 'rx-media-svg';
  // SVG can carry scripts and event handlers — sanitize before inlining.
  holder.innerHTML = DOMPurify.sanitize(text, { USE_PROFILES: { svg: true, svgFilters: true } });
  root.appendChild(holder);
  return { node: root, title: spec.file || '', note: '' };
}

function rxRenderPdf(dataUrl, spec) {
  const root = document.createElement('div');
  root.className = 'rx-pdf-wrap';
  const emb = document.createElement('embed');
  emb.className = 'rx-pdf';
  emb.type = 'application/pdf';
  emb.src = dataUrl;
  root.appendChild(emb);
  return { node: root, title: spec.file || '', note: 'Chrome PDF 뷰어' };
}

function rxRenderTable(text, spec) {
  const MAX_ROWS = 5000;
  const delim = rxGuessDelim(text, rxExtOf(spec.file || ''));
  const rows = rxParseDelimited(text, delim);
  const truncated = rows.length > MAX_ROWS;
  const body = rows.slice(0, MAX_ROWS);

  const root = document.createElement('div');
  root.className = 'rx-table-wrap';

  const table = document.createElement('table');
  table.className = 'rx-table';
  const cols = Math.max(...body.map((r) => r.length), 0);

  if (body.length) {
    const thead = document.createElement('thead');
    const htr = document.createElement('tr');
    const corner = document.createElement('th');
    corner.className = 'rx-table-rownum';
    htr.appendChild(corner);
    for (let c = 0; c < cols; c++) {
      const th = document.createElement('th');
      th.textContent = body[0][c] != null ? body[0][c] : '';
      htr.appendChild(th);
    }
    thead.appendChild(htr);
    table.appendChild(thead);
  }

  const tbody = document.createElement('tbody');
  for (let r = 1; r < body.length; r++) {
    const tr = document.createElement('tr');
    const num = document.createElement('td');
    num.className = 'rx-table-rownum';
    num.textContent = r;
    tr.appendChild(num);
    for (let c = 0; c < cols; c++) {
      const td = document.createElement('td');
      const v = body[r][c] != null ? body[r][c] : '';
      td.textContent = v;
      if (v !== '' && !isNaN(v)) td.className = 'rx-num';
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  root.appendChild(table);

  const delimName = delim === '\t' ? 'TAB' : delim;
  const note =
    `${body.length ? body.length - 1 : 0} rows × ${cols} cols · sep "${delimName}"` +
    (truncated ? ` · 처음 ${MAX_ROWS}행만 표시` : '');
  return { node: root, title: spec.file || '', note };
}

function rxRenderLog(text, spec) {
  const MAX = 2 * 1024 * 1024;
  let note = '';
  let src = text;
  if (src.length > MAX) {
    src = src.slice(0, MAX);
    note = 'large file — 앞 2MB만 표시';
  }

  const root = document.createElement('div');
  root.className = 'rx-log-wrap';
  const pre = document.createElement('pre');
  pre.className = 'rx-log';

  if (rxHasAnsi(src)) {
    for (const seg of rxParseAnsi(src)) {
      if (seg.cls) {
        const s = document.createElement('span');
        s.className = seg.cls;
        s.textContent = seg.text;
        pre.appendChild(s);
      } else {
        pre.appendChild(document.createTextNode(seg.text));
      }
    }
    note = note ? note + ' · ANSI' : 'ANSI 컬러';
  } else {
    pre.textContent = src;
  }

  root.appendChild(pre);
  const lines = src.split('\n').length;
  return { node: root, title: spec.file || '', note, lines };
}

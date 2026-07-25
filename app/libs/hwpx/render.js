// Section XML → HTML renderer (layout-approximate).
// Runtime-agnostic: produces an HTML string, no DOM required.
// All document text is entity-escaped and style tokens are sanitized
// (colors via cssColor, numbers via Number) before reaching the output.

import { buildXmlTree, childrenLocal, firstChildLocal, findDescendantLocal, localName, isElement } from './xml-tree.js';
import { encodeEntities } from './xml.js';
import { cssColor } from './header.js';

const HWPUNIT_PER_PX = 75; // 7200 units/inch ÷ 96 px/inch

export const BASE_CSS = `
.hwpx-page {
  background: #fff; color: #000; box-sizing: border-box;
  margin: 16px auto; box-shadow: 0 1px 8px rgba(0,0,0,.3);
  font-family: '함초롬바탕', 'Batang', 'Malgun Gothic', serif;
  font-size: 10pt; line-height: 1.6;
}
.hwpx-page::after { content: ""; display: block; clear: both; }
.hwpx-page p { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; min-height: 1em; }
.hwpx-page table { border-collapse: collapse; max-width: 100%; }
.hwpx-page td { padding: 1px 4px; vertical-align: middle; }
.hwpx-page img { max-width: 100%; }
`;

/**
 * @param {string} sectionXml
 * @param {{
 *   header?: ReturnType<import('./header.js').parseHeader>,
 *   resolveBinData?: (binaryItemIDRef: string) => string|null,
 *   page?: boolean,  wrap output in a page box sized from hp:pagePr
 *   editable?: boolean,  tag paragraphs/text runs with data-hxp/data-hxt
 *                        source paths for in-place editing (see edit-node.js)
 * }} [opts]
 * @returns {string} HTML
 */
export function renderSection(sectionXml, opts = {}) {
  const root = buildXmlTree(sectionXml);
  const sec = root.children.find(isElement) ?? root;

  const pagePr = findDescendantLocal(sec, 'pagePr');
  const margin = pagePr ? firstChildLocal(pagePr, 'margin') : null;
  const pageW = pagePr ? px(pagePr.attrs.width) : 0;
  const contentW = pageW
    ? round1(pageW - px(margin?.attrs.left) - px(margin?.attrs.right))
    : 0;

  const ctx = {
    header: opts.header ?? null,
    resolveBinData: opts.resolveBinData ?? (() => null),
    contentW, // available column width in px (0 = unknown) — used by float heuristic
    editable: opts.editable === true,
  };
  const body = sec.children.filter(isElement).map((n) => renderBlock(n, ctx)).join('');

  if (opts.page === false) return body;

  let style = '';
  if (pagePr) {
    if (pageW) style += `width:${pageW}px;`;
    if (margin) {
      const top = round1(px(margin.attrs.top) + px(margin.attrs.header));
      const bottom = round1(px(margin.attrs.bottom) + px(margin.attrs.footer));
      style += `padding:${top}px ${px(margin.attrs.right)}px ${bottom}px ${px(margin.attrs.left)}px;`;
    }
  }
  return `<div class="hwpx-page" style="${style}">${body}</div>`;
}

/**
 * Placement CSS for anchored objects (tables, pictures).
 * treatAsChar="1" → inline flow (no extra CSS).
 * textWrap="SQUARE" → float left/right; side picked by comparing the anchor
 * offset to the column midpoint (approximation — HWP positions absolutely).
 * Other wraps (TOP_AND_BOTTOM, …) → block.
 */
function placementCss(node, objWidthPx, ctx) {
  const pos = firstChildLocal(node, 'pos');
  if (!pos || pos.attrs.treatAsChar !== '0') return '';
  if (node.attrs.textWrap === 'SQUARE') {
    const offset = px(pos.attrs.horzOffset);
    const mid = ctx.contentW ? ctx.contentW / 2 : 300;
    const side = offset + objWidthPx / 2 > mid ? 'right' : 'left';
    return `float:${side};margin:4px ${side === 'right' ? 0 : 8}px 4px ${side === 'right' ? 8 : 0}px;`;
  }
  return 'display:block;';
}

function renderBlock(node, ctx) {
  return localName(node.name) === 'p' ? renderParagraph(node, ctx) : '';
}

function renderParagraph(p, ctx) {
  let inner = '';
  for (const child of p.children) {
    if (isElement(child) && localName(child.name) === 'run') inner += renderRun(child, ctx);
  }
  const style = paraStyle(p, ctx);
  const hx = ctx.editable ? ` data-hxp="${p.path.join('.')}"` : '';
  return `<p${hx}${style ? ` style="${style}"` : ''}>${inner}</p>`;
}

function renderRun(run, ctx) {
  let inner = '';
  for (const child of run.children) {
    if (!isElement(child)) continue;
    switch (localName(child.name)) {
      case 't':
        inner += ctx.editable
          ? `<span data-hxt="${child.path.join('.')}">${renderText(child)}</span>`
          : renderText(child);
        break;
      case 'tbl':
        inner += renderTable(child, ctx);
        break;
      case 'pic':
        inner += renderPic(child, ctx);
        break;
      case 'secPr':
      case 'ctrl': // field/bookmark controls; headers/footers live here too
        break;
      default: {
        // drawing objects (rect, container, textart, …): render any nested
        // paragraph content so no text is lost, drop the geometry
        const sub = findDescendantLocal(child, 'subList');
        if (sub) inner += childrenLocal(sub, 'p').map((n) => renderParagraph(n, ctx)).join('');
        break;
      }
    }
  }
  const style = charStyle(run.attrs.charPrIDRef, ctx);
  return style ? `<span style="${style}">${inner}</span>` : inner;
}

function renderText(t) {
  let out = '';
  for (const child of t.children) {
    if (child.name === '#text') out += encodeEntities(child.text);
    else if (localName(child.name) === 'tab') out += '\t';
    else if (localName(child.name) === 'lineBreak') out += '<br>';
    // markpen / field marker wrappers: keep their text
    else out += encodeEntities(textOf(child));
  }
  return out;
}

function textOf(node) {
  let out = '';
  for (const c of node.children) {
    if (c.name === '#text') out += c.text;
    else out += textOf(c);
  }
  return out;
}

function renderTable(tbl, ctx) {
  const sz = firstChildLocal(tbl, 'sz');
  const w = sz ? px(sz.attrs.width) : 0;
  let style = w ? `width:${w}px;` : '';
  style += placementCss(tbl, w, ctx);
  let html = `<table${style ? ` style="${style}"` : ''}>`;
  for (const tr of childrenLocal(tbl, 'tr')) {
    html += '<tr>';
    for (const tc of childrenLocal(tr, 'tc')) {
      const span = firstChildLocal(tc, 'cellSpan');
      const cellSz = firstChildLocal(tc, 'cellSz');
      let attrs = '';
      if (span) {
        if (Number(span.attrs.colSpan) > 1) attrs += ` colspan="${Number(span.attrs.colSpan)}"`;
        if (Number(span.attrs.rowSpan) > 1) attrs += ` rowspan="${Number(span.attrs.rowSpan)}"`;
      }
      let style = borderCss(tc.attrs.borderFillIDRef, ctx);
      if (cellSz) {
        const cw = px(cellSz.attrs.width);
        const ch = px(cellSz.attrs.height);
        if (cw) style += `width:${cw}px;`;
        if (ch) style += `height:${ch}px;`;
      }
      const sub = firstChildLocal(tc, 'subList');
      const vert = { TOP: 'top', CENTER: 'middle', BOTTOM: 'bottom' }[sub?.attrs.vertAlign];
      if (vert && vert !== 'middle') style += `vertical-align:${vert};`;
      const content = sub ? childrenLocal(sub, 'p').map((n) => renderParagraph(n, ctx)).join('') : '';
      html += `<td${attrs}${style ? ` style="${style}"` : ''}>${content}</td>`;
    }
    html += '</tr>';
  }
  return html + '</table>';
}

function renderPic(pic, ctx) {
  const img = findDescendantLocal(pic, 'img');
  const src = img ? ctx.resolveBinData(img.attrs.binaryItemIDRef) : null;
  if (!src) return '';
  const sz = firstChildLocal(pic, 'sz');
  let style = '';
  let w = 0;
  if (sz) {
    w = px(sz.attrs.width);
    const h = px(sz.attrs.height);
    if (w) style += `width:${w}px;`;
    if (h) style += `height:${h}px;`;
  }
  style += placementCss(pic, w, ctx);
  return `<img src="${encodeEntities(src)}"${style ? ` style="${style}"` : ''} alt="">`;
}

// ---- style resolution ------------------------------------------------

const ALIGN = {
  JUSTIFY: 'justify', LEFT: 'left', CENTER: 'center', RIGHT: 'right',
  DISTRIBUTE: 'justify', DISTRIBUTE_SPACE: 'justify',
};

function paraStyle(p, ctx) {
  const h = ctx.header;
  if (!h) return '';
  const styleDef = h.styles.get(p.attrs.styleIDRef);
  const pr = h.paraPrs.get(p.attrs.paraPrIDRef ?? styleDef?.paraPrIDRef);
  if (!pr) return '';
  let css = '';
  const align = ALIGN[pr.align];
  if (align && align !== 'justify') css += `text-align:${align};`;
  if (pr.indent > 0) css += `text-indent:${pxNum(pr.indent)}px;`;
  if (pr.left > 0) css += `margin-left:${pxNum(pr.left)}px;`;
  if (pr.right > 0) css += `margin-right:${pxNum(pr.right)}px;`;
  if (pr.prev > 0) css += `margin-top:${pxNum(pr.prev)}px;`;
  if (pr.next > 0) css += `margin-bottom:${pxNum(pr.next)}px;`;
  if (pr.lineSpacing?.type === 'PERCENT' && pr.lineSpacing.value > 0) {
    css += `line-height:${pr.lineSpacing.value / 100};`;
  }
  return css;
}

function charStyle(charPrIDRef, ctx) {
  const h = ctx.header;
  const pr = h?.charPrs.get(charPrIDRef);
  if (!pr) return '';
  let css = '';
  if (pr.sizePt) css += `font-size:${pr.sizePt}pt;`;
  if (pr.color && pr.color !== '#000000') css += `color:${pr.color};`;
  if (pr.bold) css += 'font-weight:700;';
  if (pr.italic) css += 'font-style:italic;';
  const deco = [pr.underline && 'underline', pr.strikeout && 'line-through'].filter(Boolean);
  if (deco.length) css += `text-decoration:${deco.join(' ')};`;
  const face = h.fonts.get('HANGUL')?.get(pr.fontIds?.hangul);
  if (face) css += `font-family:'${face.replace(/['"<>;{}]/g, '')}';`;
  return css;
}

function borderCss(borderFillIDRef, ctx) {
  const bf = ctx.header?.borderFills.get(borderFillIDRef);
  if (!bf) return 'border:1px solid #999;'; // visible fallback without header info
  let css = '';
  for (const side of ['left', 'right', 'top', 'bottom']) {
    const b = bf[side];
    css += b ? `border-${side}:${b.width} ${lineStyle(b.type)} ${b.color};` : '';
  }
  if (bf.fill) css += `background-color:${bf.fill};`;
  return css;
}

function lineStyle(type) {
  if (type.startsWith('DASH')) return 'dashed';
  if (type.startsWith('DOT')) return 'dotted';
  if (type.startsWith('DOUBLE')) return 'double';
  return 'solid';
}

function px(value) {
  return pxNum(Number(value) || 0);
}

function pxNum(hwpunit) {
  return round1(hwpunit / HWPUNIT_PER_PX);
}

function round1(v) {
  return Math.round(v * 10) / 10;
}

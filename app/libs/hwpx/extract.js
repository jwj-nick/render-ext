// Plain-text extraction from a HWPX section XML string.
// Hierarchy: <hp:p> (paragraph) → <hp:run> → <hp:t> (text).
// Table cells nest their own <hp:p> inside <hp:tbl>/<hp:tr>/<hp:tc>/<hp:subList>;
// a paragraph stack flattens them in document order.

import { scanXml } from './xml.js';

const PARA_NS = /xmlns:([A-Za-z_][\w.-]*)="http:\/\/www\.hancom\.co\.kr\/hwpml\/[^"]*\/paragraph"/;

// Hancom's official guidance: namespace URIs can vary between document
// versions, so resolve the paragraph prefix from the root element instead
// of hardcoding "hp".
export function detectParagraphPrefix(xml) {
  const m = xml.match(PARA_NS);
  return m ? m[1] : 'hp';
}

/** @returns {string[]} paragraph texts in document order (table cells flattened) */
export function extractParagraphs(sectionXml) {
  const prefix = detectParagraphPrefix(sectionXml);
  const P = `${prefix}:p`;
  const T = `${prefix}:t`;
  const TAB = `${prefix}:tab`;
  const LINEBREAK = `${prefix}:lineBreak`;

  const paras = [];
  const open = []; // stack of indexes into paras (table cells nest paragraphs)
  let tDepth = 0;

  const append = (s) => {
    if (open.length) paras[open[open.length - 1]] += s;
  };

  scanXml(sectionXml, {
    onOpen(name, _rawAttrs, selfClosing) {
      if (name === P) {
        paras.push('');
        if (!selfClosing) open.push(paras.length - 1);
      } else if (name === T) {
        if (!selfClosing) tDepth++;
      } else if (name === TAB) {
        append('\t');
      } else if (name === LINEBREAK) {
        append('\n');
      }
    },
    onClose(name) {
      if (name === P) open.pop();
      else if (name === T && tDepth > 0) tDepth--;
    },
    onText(text) {
      if (tDepth > 0) append(text);
    },
  });

  return paras;
}

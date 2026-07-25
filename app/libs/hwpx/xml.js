// Minimal SAX-style XML scanner — zero dependencies.
// Built for machine-generated HWPX XML; not a general validating parser.
// Note: for self-closing tags onOpen fires with selfClosing=true and
// onClose is NOT called — handlers that track depth must check the flag.

/**
 * @param {string} xml
 * @param {{
 *   onOpen?: (name: string, rawAttrs: string, selfClosing: boolean, span?: {start: number, end: number}) => void,
 *   onClose?: (name: string, span?: {start: number, end: number}) => void,
 *   onText?: (text: string) => void,
 * }} handlers
 * span = source offsets of the tag itself: start = '<', end = index after '>'.
 */
export function scanXml(xml, handlers = {}) {
  const { onOpen, onClose, onText } = handlers;
  const n = xml.length;
  let i = 0;
  while (i < n) {
    const lt = xml.indexOf('<', i);
    if (lt < 0) {
      if (onText && i < n) emitText(xml.slice(i));
      break;
    }
    if (lt > i && onText) emitText(xml.slice(i, lt));
    if (xml.startsWith('<!--', lt)) {
      const end = xml.indexOf('-->', lt + 4);
      i = end < 0 ? n : end + 3;
    } else if (xml.startsWith('<![CDATA[', lt)) {
      const end = xml.indexOf(']]>', lt + 9);
      if (onText) onText(xml.slice(lt + 9, end < 0 ? n : end));
      i = end < 0 ? n : end + 3;
    } else if (xml[lt + 1] === '?') {
      const end = xml.indexOf('?>', lt + 2);
      i = end < 0 ? n : end + 2;
    } else if (xml[lt + 1] === '!') {
      const end = xml.indexOf('>', lt + 2);
      i = end < 0 ? n : end + 1;
    } else {
      const gt = findTagEnd(xml, lt + 1);
      if (gt < 0) break;
      let inner = xml.slice(lt + 1, gt);
      i = gt + 1;
      if (inner[0] === '/') {
        if (onClose) onClose(inner.slice(1).trim(), { start: lt, end: i });
      } else {
        let selfClosing = false;
        if (inner.endsWith('/')) {
          selfClosing = true;
          inner = inner.slice(0, -1);
        }
        const sp = inner.search(/\s/);
        const name = sp < 0 ? inner : inner.slice(0, sp);
        const rawAttrs = sp < 0 ? '' : inner.slice(sp + 1);
        if (onOpen) onOpen(name, rawAttrs, selfClosing, { start: lt, end: i });
      }
    }
  }

  function emitText(s) {
    const t = decodeEntities(s);
    if (t) onText(t);
  }
}

/** Find '>' terminating a tag, ignoring '>' inside quoted attribute values. */
function findTagEnd(xml, from) {
  let quote = '';
  for (let j = from; j < xml.length; j++) {
    const c = xml[j];
    if (quote) {
      if (c === quote) quote = '';
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === '>') {
      return j;
    }
  }
  return -1;
}

/** Parse the rawAttrs string from onOpen into an object. */
export function parseAttrs(raw) {
  const out = {};
  if (!raw) return out;
  const re = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m;
  while ((m = re.exec(raw))) out[m[1]] = decodeEntities(m[2] ?? m[3]);
  return out;
}

const NAMED_ENTITIES = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

export function decodeEntities(s) {
  if (!s.includes('&')) return s;
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (all, ent) => {
    if (ent[0] === '#') {
      const code = ent[1] === 'x' || ent[1] === 'X'
        ? parseInt(ent.slice(2), 16)
        : parseInt(ent.slice(1), 10);
      return Number.isNaN(code) ? all : String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[ent] ?? all;
  });
}

export function encodeEntities(s) {
  return s.replace(/[<>&"']/g, (c) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;',
  }[c]));
}

// Small XML tree builder on top of scanXml — for documents we need to
// navigate structurally (header.xml styles, section rendering).
// Helpers match by LOCAL name (after the namespace prefix) so parsing is
// immune to prefix variation across document versions.

import { scanXml, parseAttrs } from './xml.js';

/**
 * Nodes carry source offsets for precise string-splice editing:
 *   openStart/openEnd   — the open tag's span
 *   contentStart/contentEnd — inner content span (null when self-closing)
 *   closeEnd            — index after the close tag (== openEnd when self-closing)
 * and `path` — element-index path from #root (e.g. [0, 3, 1]).
 *
 * @returns {{name:string, attrs:Object, children:Array, text?:string}} synthetic #root node
 */
export function buildXmlTree(xml) {
  const root = { name: '#root', attrs: {}, children: [], path: [], elemCount: 0 };
  const stack = [root];
  scanXml(xml, {
    onOpen(name, rawAttrs, selfClosing, span) {
      const parent = stack[stack.length - 1];
      const node = {
        name,
        attrs: parseAttrs(rawAttrs),
        rawAttrs,
        children: [],
        path: [...parent.path, parent.elemCount++],
        elemCount: 0,
        selfClosing,
        openStart: span.start,
        openEnd: span.end,
        contentStart: selfClosing ? null : span.end,
        contentEnd: selfClosing ? null : null,
        closeEnd: selfClosing ? span.end : null,
      };
      parent.children.push(node);
      if (!selfClosing) stack.push(node);
    },
    onClose(_name, span) {
      if (stack.length > 1) {
        const node = stack.pop();
        node.contentEnd = span.start;
        node.closeEnd = span.end;
      }
    },
    onText(text) {
      stack[stack.length - 1].children.push({ name: '#text', attrs: {}, children: [], text });
    },
  });
  return root;
}

/** Follow an element-index path (as produced in node.path) from the #root. */
export function findByPath(root, path) {
  let node = root;
  for (const idx of path) {
    node = node.children.filter(isElement)[idx];
    if (!node) return null;
  }
  return node;
}

export function localName(name) {
  return name.slice(name.indexOf(':') + 1);
}

export function isElement(node) {
  return node.name !== '#text';
}

/** Direct children whose local name matches. */
export function childrenLocal(node, local) {
  return node.children.filter((c) => isElement(c) && localName(c.name) === local);
}

export function firstChildLocal(node, local) {
  return node.children.find((c) => isElement(c) && localName(c.name) === local) ?? null;
}

/** Depth-first search of the whole subtree (excluding the node itself). */
export function findDescendantLocal(node, local) {
  for (const c of node.children) {
    if (!isElement(c)) continue;
    if (localName(c.name) === local) return c;
    const hit = findDescendantLocal(c, local);
    if (hit) return hit;
  }
  return null;
}

export function* walk(node) {
  for (const c of node.children) {
    yield c;
    if (isElement(c)) yield* walk(c);
  }
}

/** Concatenated text of all #text descendants. */
export function textContent(node) {
  let out = '';
  for (const n of walk(node)) if (n.name === '#text') out += n.text;
  return out;
}

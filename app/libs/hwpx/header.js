// header.xml parser — resolves the style reference tables (refList) that
// section XML points into via charPrIDRef / paraPrIDRef / borderFillIDRef /
// styleIDRef.
//
// Units: charPr height = 1/100 pt. Margins/spacing = HWPUNIT (1/7200 inch).

import { buildXmlTree, childrenLocal, firstChildLocal, findDescendantLocal, localName, isElement, walk } from './xml-tree.js';

/**
 * @returns {{
 *   fonts: Map<string, Map<string, string>>,   lang → (font id → face name)
 *   charPrs: Map<string, Object>,
 *   paraPrs: Map<string, Object>,
 *   borderFills: Map<string, Object>,
 *   styles: Map<string, Object>,
 * }}
 */
export function parseHeader(headerXml) {
  const root = buildXmlTree(headerXml);
  const header = {
    fonts: new Map(),
    charPrs: new Map(),
    paraPrs: new Map(),
    borderFills: new Map(),
    styles: new Map(),
  };

  for (const node of walk(root)) {
    if (!isElement(node)) continue;
    switch (localName(node.name)) {
      case 'fontface': {
        const lang = node.attrs.lang ?? '';
        const byId = header.fonts.get(lang) ?? new Map();
        for (const font of childrenLocal(node, 'font')) {
          byId.set(font.attrs.id, font.attrs.face);
        }
        header.fonts.set(lang, byId);
        break;
      }
      case 'charPr':
        header.charPrs.set(node.attrs.id, parseCharPr(node));
        break;
      case 'paraPr':
        header.paraPrs.set(node.attrs.id, parseParaPr(node));
        break;
      case 'borderFill':
        header.borderFills.set(node.attrs.id, parseBorderFill(node));
        break;
      case 'style':
        header.styles.set(node.attrs.id, {
          name: node.attrs.name,
          paraPrIDRef: node.attrs.paraPrIDRef,
          charPrIDRef: node.attrs.charPrIDRef,
        });
        break;
    }
  }
  return header;
}

function parseCharPr(node) {
  const underline = firstChildLocal(node, 'underline');
  const strikeout = firstChildLocal(node, 'strikeout');
  const fontRef = firstChildLocal(node, 'fontRef');
  return {
    sizePt: node.attrs.height ? Number(node.attrs.height) / 100 : null,
    color: cssColor(node.attrs.textColor),
    bold: firstChildLocal(node, 'bold') !== null,
    italic: firstChildLocal(node, 'italic') !== null,
    underline: underline ? underline.attrs.type !== 'NONE' : false,
    strikeout: strikeout ? (strikeout.attrs.shape ?? 'NONE') !== 'NONE' : false,
    fontIds: fontRef ? { ...fontRef.attrs } : null,
  };
}

function parseParaPr(node) {
  const align = firstChildLocal(node, 'align');
  // margin/lineSpacing may sit inside an hp:switch — prefer the hp:default
  // branch, fall back to anywhere in the subtree.
  const scope = findDescendantLocal(node, 'default') ?? node;
  const margin = findDescendantLocal(scope, 'margin') ?? findDescendantLocal(node, 'margin');
  const lineSpacing = findDescendantLocal(scope, 'lineSpacing') ?? findDescendantLocal(node, 'lineSpacing');

  const hwpunit = (name) => {
    const el = margin ? firstChildLocal(margin, name) : null;
    return el ? Number(el.attrs.value) || 0 : 0;
  };

  return {
    align: align?.attrs.horizontal ?? 'JUSTIFY',
    indent: hwpunit('intent'), // sic: attribute is spelled "intent" in OWPML
    left: hwpunit('left'),
    right: hwpunit('right'),
    prev: hwpunit('prev'),
    next: hwpunit('next'),
    lineSpacing: lineSpacing
      ? { type: lineSpacing.attrs.type, value: Number(lineSpacing.attrs.value) || 0 }
      : null,
    borderFillIDRef: firstChildLocal(node, 'border')?.attrs.borderFillIDRef ?? null,
  };
}

function parseBorderFill(node) {
  const side = (name) => {
    const el = firstChildLocal(node, name);
    if (!el || el.attrs.type === 'NONE') return null;
    return {
      type: el.attrs.type,
      width: (el.attrs.width ?? '0.1 mm').replace(' ', ''),
      color: cssColor(el.attrs.color) ?? '#000000',
    };
  };
  const winBrush = findDescendantLocal(node, 'winBrush');
  return {
    left: side('leftBorder'),
    right: side('rightBorder'),
    top: side('topBorder'),
    bottom: side('bottomBorder'),
    fill: cssColor(winBrush?.attrs.faceColor),
  };
}

/** Accept only safe color tokens (guards style-attribute injection). */
export function cssColor(value) {
  if (!value || value === 'none') return null;
  return /^#[0-9A-Fa-f]{3,8}$/.test(value) ? value : null;
}

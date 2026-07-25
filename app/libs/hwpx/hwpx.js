// HWPX document model — open the OCF container, read the OPF package
// (Contents/content.hpf), expose metadata / sections / text extraction.

import { readZip } from './zip.js';
import { scanXml, parseAttrs } from './xml.js';
import { extractParagraphs } from './extract.js';

export const HWPX_MIMETYPE = 'application/hwp+zip';
const PACKAGE_MEDIA_TYPE = 'application/hwpml-package+xml';

/** @param {Uint8Array|ArrayBuffer} input */
export async function openHwpx(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  // OLE compound file magic = legacy binary .hwp (v5) — a different format
  if (bytes.length >= 4 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) {
    throw new Error('구형 바이너리 .hwp 형식입니다 (HWPX 아님). 한글에서 .hwpx로 다시 저장한 뒤 열어주세요.');
  }
  const doc = new HwpxDocument(readZip(bytes));
  await doc._load();
  return doc;
}

export class HwpxDocument {
  constructor(zip) {
    this.zip = zip;
    this.mimetype = null;
    this.packagePath = 'Contents/content.hpf';
    this.metadata = {};
    this.manifest = []; // {id, href, mediaType}
    this.spine = []; // idrefs in reading order
    this.sectionPaths = [];
    this.warnings = [];
  }

  async _load() {
    if (this.zip.has('mimetype')) {
      this.mimetype = (await this.zip.readText('mimetype')).trim();
      if (this.mimetype !== HWPX_MIMETYPE) {
        this.warnings.push(`unexpected mimetype: "${this.mimetype}"`);
      }
    } else {
      this.warnings.push('no mimetype entry');
    }

    if (this.zip.has('META-INF/container.xml')) {
      const rootfile = findPackageRootfile(await this.zip.readText('META-INF/container.xml'));
      if (rootfile) this.packagePath = rootfile;
    } else {
      this.warnings.push('no META-INF/container.xml — assuming Contents/content.hpf');
    }

    if (!this.zip.has(this.packagePath)) {
      throw new Error(`hwpx: package file "${this.packagePath}" not found`);
    }
    const pkg = parsePackage(await this.zip.readText(this.packagePath));
    this.metadata = pkg.metadata;
    this.manifest = pkg.manifest;
    this.spine = pkg.spine;
    this.sectionPaths = resolveSectionPaths(pkg, this.zip);
    if (this.sectionPaths.length === 0) this.warnings.push('no section files found');
  }

  get title() {
    return this.metadata.title ?? '';
  }

  entryNames() {
    return this.zip.names();
  }

  async readEntry(name) {
    return this.zip.read(name);
  }

  async sectionXml(index) {
    return this.zip.readText(this.sectionPaths[index]);
  }

  /** @returns {Promise<string[][]>} paragraphs per section, document order */
  async sectionParagraphs() {
    const out = [];
    for (let i = 0; i < this.sectionPaths.length; i++) {
      out.push(extractParagraphs(await this.sectionXml(i)));
    }
    return out;
  }

  /** @returns {Promise<string[]>} all paragraphs across sections */
  async paragraphs() {
    return (await this.sectionParagraphs()).flat();
  }

  /** @returns {Promise<string>} full plain text */
  async text() {
    return (await this.paragraphs()).join('\n');
  }

  binDataNames() {
    return this.zip.names().filter((n) => n.startsWith('BinData/'));
  }

  manifestItem(id) {
    return this.manifest.find((m) => m.id === id) ?? null;
  }

  /** Resolve a content.hpf href to an existing zip entry path. */
  resolveHref(href) {
    if (this.zip.has(href)) return href;
    const inContents = 'Contents/' + href;
    return this.zip.has(inContents) ? inContents : href;
  }

  headerPath() {
    const item = this.manifest.find((m) => /header\.xml$/i.test(m.href ?? ''));
    if (item) return this.resolveHref(item.href);
    return this.zip.has('Contents/header.xml') ? 'Contents/header.xml' : null;
  }

  /** @returns {Promise<string|null>} raw header.xml (styles/refList) */
  async headerXml() {
    const path = this.headerPath();
    return path && this.zip.has(path) ? this.zip.readText(path) : null;
  }

  /** @returns {Promise<Uint8Array|null>} embedded preview image if present */
  async previewImage() {
    return this.zip.has('Preview/PrvImage.png') ? this.zip.read('Preview/PrvImage.png') : null;
  }

  /** @returns {Promise<string|null>} embedded preview text if present */
  async previewText() {
    if (!this.zip.has('Preview/PrvText.txt')) return null;
    return decodeTextAuto(await this.zip.read('Preview/PrvText.txt'));
  }
}

function findPackageRootfile(containerXml) {
  let found = null;
  scanXml(containerXml, {
    onOpen(name, rawAttrs) {
      if (found || !name.endsWith(':rootfile')) return;
      const attrs = parseAttrs(rawAttrs);
      if (attrs['media-type'] === PACKAGE_MEDIA_TYPE) found = attrs['full-path'];
    },
  });
  return found;
}

function parsePackage(hpfXml) {
  const metadata = {};
  const manifest = [];
  const spine = [];
  let field = null;

  scanXml(hpfXml, {
    onOpen(name, rawAttrs, selfClosing) {
      const local = name.slice(name.indexOf(':') + 1);
      if (local === 'title') {
        field = 'title';
      } else if (local === 'language') {
        field = 'language';
      } else if (local === 'meta') {
        field = 'meta:' + (parseAttrs(rawAttrs).name ?? '');
      } else if (local === 'item') {
        const a = parseAttrs(rawAttrs);
        manifest.push({ id: a.id, href: a.href, mediaType: a['media-type'] });
      } else if (local === 'itemref') {
        spine.push(parseAttrs(rawAttrs).idref);
      }
      if (selfClosing) field = null;
    },
    onClose() {
      field = null;
    },
    onText(text) {
      if (!field || !text.trim()) return;
      if (field.startsWith('meta:')) {
        const key = field.slice(5);
        if (key) metadata[key] = (metadata[key] ?? '') + text;
      } else {
        metadata[field] = (metadata[field] ?? '') + text;
      }
    },
  });

  return { metadata, manifest, spine };
}

function resolveSectionPaths(pkg, zip) {
  const isSection = (href) => /section\d+\.xml$/i.test(href ?? '');
  const byId = new Map(pkg.manifest.map((m) => [m.id, m]));
  const ordered = [];
  for (const idref of pkg.spine) {
    const item = byId.get(idref);
    if (item && isSection(item.href)) ordered.push(item.href);
  }
  if (ordered.length === 0) {
    for (const item of pkg.manifest) if (isSection(item.href)) ordered.push(item.href);
  }
  // hrefs in content.hpf are zip-root-relative in real files; fall back to
  // package-dir-relative if the direct path is missing.
  return ordered.map((href) => {
    if (zip.has(href)) return href;
    const inContents = 'Contents/' + href;
    if (zip.has(inContents)) return inContents;
    return href;
  });
}

/** Decode text bytes with BOM sniffing (UTF-8 / UTF-16LE / UTF-16BE). */
export function decodeTextAuto(bytes) {
  if (bytes.length >= 2) {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
    if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  }
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3));
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('utf-16le').decode(bytes);
  }
}

// Minimal ZIP reader — zero dependencies.
// Works in browser and Node >=18 (uses DecompressionStream for deflate).
// Scope: single-disk, no zip64, no encryption — sufficient for HWPX files.

const EOCD_SIG = 0x06054b50; // End of central directory
const CEN_SIG = 0x02014b50; // Central directory file header
const LOC_SIG = 0x04034b50; // Local file header

export class ZipReader {
  constructor(bytes, entries) {
    this.bytes = bytes;
    this.entries = entries;
  }

  names() {
    return [...this.entries.keys()];
  }

  has(name) {
    return this.entries.has(name);
  }

  info(name) {
    return this.entries.get(name);
  }

  /** @returns {Promise<Uint8Array>} decompressed entry data */
  async read(name) {
    const e = this.entries.get(name);
    if (!e) throw new Error(`zip: no entry "${name}"`);
    const view = new DataView(this.bytes.buffer, this.bytes.byteOffset, this.bytes.byteLength);
    if (view.getUint32(e.locOffset, true) !== LOC_SIG) {
      throw new Error(`zip: bad local header for "${name}"`);
    }
    const nameLen = view.getUint16(e.locOffset + 26, true);
    const extraLen = view.getUint16(e.locOffset + 28, true);
    const start = e.locOffset + 30 + nameLen + extraLen;
    const data = this.bytes.subarray(start, start + e.compSize);
    if (e.method === 0) return data.slice();
    if (e.method === 8) return inflateRaw(data);
    throw new Error(`zip: unsupported compression method ${e.method} for "${name}"`);
  }

  async readText(name) {
    return new TextDecoder('utf-8').decode(await this.read(name));
  }
}

/** @param {Uint8Array|ArrayBuffer} input */
export function readZip(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEocd(view);
  const count = view.getUint16(eocd + 10, true);
  const cenOffset = view.getUint32(eocd + 16, true);
  const utf8 = new TextDecoder('utf-8');
  const entries = new Map();
  let p = cenOffset;
  for (let k = 0; k < count; k++) {
    if (view.getUint32(p, true) !== CEN_SIG) throw new Error('zip: corrupt central directory');
    const method = view.getUint16(p + 10, true);
    const compSize = view.getUint32(p + 20, true);
    const rawSize = view.getUint32(p + 24, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const locOffset = view.getUint32(p + 42, true);
    if (compSize === 0xffffffff || rawSize === 0xffffffff || locOffset === 0xffffffff) {
      throw new Error('zip: zip64 not supported');
    }
    const name = utf8.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    entries.set(name, { name, method, compSize, rawSize, locOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return new ZipReader(bytes, entries);
}

function findEocd(view) {
  const min = Math.max(0, view.byteLength - 22 - 0xffff);
  for (let i = view.byteLength - 22; i >= min; i--) {
    if (view.getUint32(i, true) === EOCD_SIG) return i;
  }
  throw new Error('zip: end of central directory not found (not a zip file?)');
}

async function inflateRaw(data) {
  const ds = new DecompressionStream('deflate-raw');
  const resp = new Response(new Blob([data]).stream().pipeThrough(ds));
  return new Uint8Array(await resp.arrayBuffer());
}

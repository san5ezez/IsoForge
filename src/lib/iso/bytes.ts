export function bytesPart(data: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(data.byteLength);
  new Uint8Array(copy).set(data);
  return copy;
}

export function blobOf(data: Uint8Array, type?: string): Blob {
  return new Blob([bytesPart(data)], type ? { type } : undefined);
}

export function dvOf(b: Uint8Array): DataView {
  return new DataView(b.buffer, b.byteOffset, b.byteLength);
}

export function put16both(b: Uint8Array, o: number, v: number): void {
  const dv = dvOf(b);
  dv.setUint16(o, v & 0xffff, true);
  dv.setUint16(o + 2, v & 0xffff, false);
}

export function put32both(b: Uint8Array, o: number, v: number): void {
  const dv = dvOf(b);
  dv.setUint32(o, v >>> 0, true);
  dv.setUint32(o + 4, v >>> 0, false);
}

export function read16(b: Uint8Array, o: number, le = true): number {
  return dvOf(b).getUint16(o, le);
}

export function read32(b: Uint8Array, o: number, le = true): number {
  return dvOf(b).getUint32(o, le);
}

export function padAscii(s: string, n: number, fill = 0x20): Uint8Array {
  const out = new Uint8Array(n);
  out.fill(fill);
  const clean = s.replace(/[^\x20-\x7e]/g, "");
  for (let i = 0; i < Math.min(n, clean.length); i++) out[i] = clean.charCodeAt(i);
  return out;
}

export function padAChars(s: string, n: number): Uint8Array {
  const upper = s.toUpperCase().replace(/[^A-Z0-9_ ]/g, " ").replace(/\s+/g, " ").trim();
  return padAscii(upper || "ARCA", n, 0x20);
}

export function encodeUcs2be(s: string): Uint8Array {
  const chars = Array.from(s);
  const out = new Uint8Array(chars.length * 2);
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]!.codePointAt(0)!;
    const v = c > 0xffff ? 0x3f : c;
    out[i * 2] = (v >> 8) & 0xff;
    out[i * 2 + 1] = v & 0xff;
  }
  return out;
}

export function decodeUcs2be(b: Uint8Array, o: number, len: number): string {
  let s = "";
  const n = len - (len % 2);
  for (let i = 0; i < n; i += 2) {
    s += String.fromCharCode((b[o + i]! << 8) | b[o + i + 1]!);
  }
  return s.replace(/\u0000+$/g, "").replace(/\s+$/g, "");
}

export function padUcs2(s: string, nBytes: number): Uint8Array {
  const out = new Uint8Array(nBytes);
  for (let i = 0; i + 1 < nBytes; i += 2) {
    out[i] = 0x00;
    out[i + 1] = 0x20;
  }
  const enc = encodeUcs2be(Array.from(s).slice(0, nBytes / 2).join(""));
  out.set(enc, 0);
  return out;
}

export function date17(ms: number): Uint8Array {
  const d = new Date(ms);
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  const text =
    p(d.getUTCFullYear(), 4) +
    p(d.getUTCMonth() + 1) +
    p(d.getUTCDate()) +
    p(d.getUTCHours()) +
    p(d.getUTCMinutes()) +
    p(d.getUTCSeconds()) +
    "00";
  const out = new Uint8Array(17);
  for (let i = 0; i < 16; i++) out[i] = text.charCodeAt(i);
  out[16] = 0;
  return out;
}

export function writeDirDate(b: Uint8Array, o: number, ms: number): void {
  const d = new Date(ms);
  b[o] = Math.max(0, Math.min(255, d.getUTCFullYear() - 1900));
  b[o + 1] = d.getUTCMonth() + 1;
  b[o + 2] = d.getUTCDate();
  b[o + 3] = d.getUTCHours();
  b[o + 4] = d.getUTCMinutes();
  b[o + 5] = d.getUTCSeconds();
  b[o + 6] = 0;
}

export function readDirDate(b: Uint8Array, o: number): number {
  const year = 1900 + b[o]!;
  const month = b[o + 1] || 1;
  const day = b[o + 2] || 1;
  return Date.UTC(year, month - 1, day, b[o + 3] || 0, b[o + 4] || 0, b[o + 5] || 0);
}

export const SECTOR = 2048;

export function sectorsFor(bytes: number): number {
  if (bytes <= 0) return 0;
  return Math.ceil(bytes / SECTOR);
}

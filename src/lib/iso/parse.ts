import { blobOf, decodeUcs2be, read32, readDirDate, SECTOR } from "./bytes";
import { emulationFromCode } from "./boot";
import { udfTagOk } from "./udf";
import type { FsKind, MemNode, ParsedBoot, ParsedIso } from "./types";

function isCd001(data: Uint8Array, sector: number): boolean {
  const o = sector * SECTOR;
  if (o + 6 >= data.length) return false;
  return data[o + 1] === 0x43 && data[o + 2] === 0x44 && data[o + 3] === 0x30 && data[o + 4] === 0x30 && data[o + 5] === 0x31;
}

function readRoot(data: Uint8Array, sector: number): { extent: number; size: number } {
  const o = sector * SECTOR + 156;
  return { extent: read32(data, o + 2, true), size: read32(data, o + 10, true) };
}

type Pending = MemNode & { cont: boolean; parts: Blob[] };

function readTree(
  data: Uint8Array,
  whole: Blob,
  extent: number,
  size: number,
  joliet: boolean,
  bootExtent: number,
): { nodes: MemNode[]; bootHit: boolean } {
  const bytes = data.subarray(extent * SECTOR, extent * SECTOR + size);
  const out: MemNode[] = [];
  let bootHit = false;
  let pending: (Pending & { key: string }) | null = null;
  const flush = () => {
    if (!pending) return;
    const { cont: _c, parts, key: _k, ...node } = pending;
    if (!node.children) {
      node.blob = new Blob(parts);
      node.size = parts.reduce((s, p) => s + p.size, 0);
    }
    out.push(node);
    pending = null;
  };
  let p = 0;
  while (p < bytes.length) {
    if (bytes[p] === 0) {
      p = Math.min(bytes.length, Math.ceil((p + 1) / SECTOR) * SECTOR);
      continue;
    }
    const len = bytes[p]!;
    if (len < 34 || p + len > bytes.length) break;
    const ext = read32(bytes, p + 2, true);
    const sz = read32(bytes, p + 10, true);
    const flags = bytes[p + 25]!;
    const nameLen = bytes[p + 32]!;
    const nameBytes = bytes.subarray(p + 33, p + 33 + nameLen);
    const isDir = (flags & 2) !== 0;
    const hidden = (flags & 1) !== 0;
    const cont = (flags & 0x80) !== 0;
    const dot = nameLen === 1 && (nameBytes[0] === 0 || nameBytes[0] === 1);
    if (!dot) {
      let name = joliet
        ? decodeUcs2be(nameBytes, 0, nameBytes.length)
        : new TextDecoder().decode(nameBytes).replace(/;1$/, "");
      if (!name) name = "UNNAMED";
      const mtime = readDirDate(bytes, p + 18);
      if (pending && pending.key === name && pending.cont) {
        if (!isDir) pending.parts.push(whole.slice(ext * SECTOR, ext * SECTOR + sz));
        pending.cont = cont;
        if (!cont) flush();
      } else {
        flush();
        if (isDir) {
          const nested = readTree(data, whole, ext, sz, joliet, bootExtent);
          if (nested.bootHit) bootHit = true;
          out.push({ name, mtime, hidden, children: nested.nodes });
        } else {
          const node: Pending & { key: string } = {
            name,
            mtime,
            hidden,
            key: name,
            cont,
            parts: [whole.slice(ext * SECTOR, ext * SECTOR + sz)],
            size: sz,
          };
          if (ext === bootExtent) {
            node.boot = true;
            bootHit = true;
          }
          pending = node;
          if (!cont) flush();
        }
      }
    }
    p += len;
  }
  flush();
  return { nodes: out, bootHit };
}

function volumeLabel(data: Uint8Array, sector: number, joliet: boolean): string {
  const o = sector * SECTOR + 40;
  if (joliet) return decodeUcs2be(data, o, 32).trim() || "VOLUME";
  return new TextDecoder()
    .decode(data.subarray(o, o + 32))
    .replace(/\s+$/g, "")
    .trim() || "VOLUME";
}

function readBoot(data: Uint8Array): ParsedBoot | null {
  for (let s = 17; s <= 32; s++) {
    if (!isCd001(data, s)) continue;
    const o = s * SECTOR;
    if (data[o] !== 0) continue;
    const id = new TextDecoder().decode(data.subarray(o + 7, o + 30));
    if (!id.startsWith("EL TORITO")) continue;
    const cat = read32(data, o + 71, true);
    const c = cat * SECTOR;
    if (c + 64 > data.length || data[c] !== 1 || data[c + 30] !== 0x55 || data[c + 31] !== 0xaa) continue;
    const entry = c + 32;
    if (data[entry] !== 0x88 && data[entry] !== 0x00) continue;
    const emulation = emulationFromCode(data[entry + 1] ?? 0);
    const sectorCount512 = new DataView(data.buffer, data.byteOffset, data.byteLength).getUint16(entry + 6, true);
    const extent = new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(entry + 8, true);
    return { emulation, sectorCount512, extent, platform: data[c + 1] ?? 0 };
  }
  return null;
}

export function parseIso(data: Uint8Array): ParsedIso {
  if (!isCd001(data, 16) || data[16 * SECTOR] !== 1) {
    throw new Error("Это не образ ISO 9660: в секторе 16 нет дескриптора CD001.");
  }
  let jolietSector = -1;
  for (let s = 17; s <= 32; s++) {
    if (!isCd001(data, s) || data[s * SECTOR] !== 2) continue;
    const e0 = data[s * SECTOR + 88];
    const e1 = data[s * SECTOR + 89];
    const e2 = data[s * SECTOR + 90];
    if (e0 === 0x25 && e1 === 0x2f && (e2 === 0x40 || e2 === 0x43 || e2 === 0x45)) {
      jolietSector = s;
      break;
    }
  }
  const udf =
    data.length >= 257 * SECTOR &&
    data[256 * SECTOR] === 2 &&
    data[256 * SECTOR + 1] === 0 &&
    udfTagOk(data.subarray(256 * SECTOR, 257 * SECTOR));
  const filesystem: FsKind = udf ? "udf" : jolietSector >= 0 ? "joliet" : "iso9660";
  const desc = jolietSector >= 0 ? jolietSector : 16;
  const boot = readBoot(data);
  const rootRec = readRoot(data, desc);
  const whole = blobOf(data);
  const walked = readTree(data, whole, rootRec.extent, rootRec.size, jolietSector >= 0, boot?.extent ?? -1);
  const children = walked.nodes;
  if (boot && !walked.bootHit) {
    const len = Math.max(512, boot.sectorCount512 * 512);
    const blob = whole.slice(boot.extent * SECTOR, Math.min(whole.size, boot.extent * SECTOR + len));
    children.unshift({
      name: "eltorito.bin",
      mtime: Date.UTC(2026, 10, 9),
      hidden: false,
      boot: true,
      size: blob.size,
      blob,
    });
  }
  const label = volumeLabel(data, jolietSector >= 0 ? jolietSector : 16, jolietSector >= 0);
  const publisher = new TextDecoder()
    .decode(data.subarray(16 * SECTOR + 318, 16 * SECTOR + 318 + 128))
    .replace(/\s+$/g, "")
    .trim();
  return {
    volumeId: label,
    filesystem,
    publisher,
    boot,
    root: {
      name: label,
      mtime: readDirDate(data, 16 * SECTOR + 156 + 18),
      hidden: false,
      children,
    },
  };
}

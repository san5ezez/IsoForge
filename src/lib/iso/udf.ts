import { SECTOR } from "./bytes";

export type UdfNode = {
  name: string;
  isDir: boolean;
  hidden: boolean;
  mtime: number;
  dataSector: number;
  size: number;
  children: UdfNode[];
  feSector?: number;
  fidSector?: number;
  fidBytes?: number;
  feBytes?: number;
  uniqueId?: number;
};

type Planned = {
  nodes: UdfNode[];
  mainVds: number;
  reserveVds: number;
  lvid: number;
  fsd: number;
  avdpLast: number;
  totalSectors: number;
  fileCount: number;
  dirCount: number;
};

function crc16(data: Uint8Array): number {
  let crc = 0;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]! << 8;
    for (let b = 0; b < 8; b++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc & 0xffff;
}

function finishTag(sector: Uint8Array, id: number, location: number, descLen: number): void {
  const dv = new DataView(sector.buffer, sector.byteOffset, sector.byteLength);
  dv.setUint16(0, id, true);
  dv.setUint16(2, 2, true);
  dv.setUint16(6, 1, true);
  const bodyLen = Math.max(0, descLen - 16);
  const body = sector.subarray(16, 16 + bodyLen);
  dv.setUint16(8, crc16(body), true);
  dv.setUint16(10, bodyLen, true);
  dv.setUint32(12, location >>> 0, true);
  let sum = 0;
  for (let i = 0; i < 16; i++) if (i !== 4) sum = (sum + sector[i]!) & 0xff;
  sector[4] = sum;
}

function regid(id: string, suffix?: number[]): Uint8Array {
  const b = new Uint8Array(32);
  const bytes = new TextEncoder().encode(id).slice(0, 23);
  b.set(bytes, 1);
  if (suffix) {
    for (let i = 0; i < Math.min(8, suffix.length); i++) b[24 + i] = suffix[i]!;
  }
  return b;
}

function charspec(): Uint8Array {
  const b = new Uint8Array(64);
  const info = new TextEncoder().encode("OSTA Compressed Unicode");
  b.set(info, 1);
  return b;
}

function dstring(s: string, size: number): Uint8Array {
  const out = new Uint8Array(size);
  const chars = Array.from(s);
  const ascii = chars.every((c) => c.charCodeAt(0) < 128);
  if (ascii) {
    const n = Math.min(chars.length, size - 2);
    out[0] = 8;
    for (let i = 0; i < n; i++) out[1 + i] = chars[i]!.charCodeAt(0);
    out[size - 1] = n + 1;
  } else {
    const n = Math.min(chars.length, Math.floor((size - 2) / 2));
    out[0] = 16;
    for (let i = 0; i < n; i++) {
      const c = chars[i]!.codePointAt(0)!;
      const v = c > 0xffff ? 0x3f : c;
      out[1 + i * 2] = (v >> 8) & 0xff;
      out[2 + i * 2] = v & 0xff;
    }
    out[size - 1] = 1 + n * 2;
  }
  return out;
}

function timestamp(ms: number): Uint8Array {
  const b = new Uint8Array(12);
  const dv = new DataView(b.buffer);
  dv.setUint16(0, 0x1000, true);
  const d = new Date(ms);
  dv.setUint16(2, d.getUTCFullYear(), true);
  b[4] = d.getUTCMonth() + 1;
  b[5] = d.getUTCDate();
  b[6] = d.getUTCHours();
  b[7] = d.getUTCMinutes();
  b[8] = d.getUTCSeconds();
  return b;
}

function putLongAd(dv: DataView, o: number, length: number, location: number): void {
  dv.setUint32(o, length >>> 0, true);
  dv.setUint32(o + 4, location >>> 0, true);
  dv.setUint16(o + 8, 0, true);
}

function putU64(dv: DataView, o: number, n: number): void {
  const lo = n >>> 0;
  const hi = Math.floor(n / 2 ** 32) >>> 0;
  dv.setUint32(o, lo, true);
  dv.setUint32(o + 4, hi, true);
}

function encodeIdent(name: string): Uint8Array {
  const chars = Array.from(name);
  if (chars.every((c) => (c.codePointAt(0) ?? 0) < 128)) {
    const b = new Uint8Array(1 + chars.length);
    b[0] = 8;
    for (let i = 0; i < chars.length; i++) b[1 + i] = chars[i]!.charCodeAt(0);
    return b;
  }
  const b = new Uint8Array(1 + chars.length * 2);
  b[0] = 16;
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]!.codePointAt(0)!;
    const v = c > 0xffff ? 0x3f : c;
    b[1 + i * 2] = (v >> 8) & 0xff;
    b[2 + i * 2] = v & 0xff;
  }
  return b;
}

function flatten(root: UdfNode): UdfNode[] {
  const out: UdfNode[] = [];
  const walk = (n: UdfNode) => {
    out.push(n);
    if (n.isDir) for (const c of n.children) walk(c);
  };
  walk(root);
  return out;
}

function fidLength(identLen: number): number {
  let len = 38 + identLen;
  const pad = (4 - (len % 4)) % 4;
  return len + pad;
}

function dirFidBytes(node: UdfNode, parent: UdfNode): { bytes: number; sectors: number } {
  let bytes = fidLength(0);
  for (const c of node.children) bytes += fidLength(encodeIdent(c.name).length);
  const sectors = Math.max(1, Math.ceil(bytes / SECTOR));
  return { bytes, sectors };
}

export function allocateUdf(root: UdfNode, take: (n: number) => number): Planned {
  const all = flatten(root);
  let uid = 16;
  for (const n of all) n.uniqueId = uid++;

  const mainVds = take(16);
  const reserveVds = take(16);
  const lvid = take(1);
  const fsd = take(1);

  const assign = (node: UdfNode, _parent: UdfNode | null) => {
    if (node.isDir) {
      for (const c of node.children) assign(c, node);
      const info = dirFidBytes(node, node);
      node.fidBytes = info.bytes;
      node.fidSector = take(info.sectors);
    }
    const extents = node.isDir ? 1 : node.size > 0 ? Math.max(1, Math.ceil(node.size / 0x3ffff800)) : 0;
    node.feBytes = 176 + extents * 8;
    node.feSector = take(1);
  };
  assign(root, null);

  const avdpLast = take(1);
  const totalSectors = avdpLast + 1;
  let fileCount = 0;
  let dirCount = 0;
  for (const n of all) {
    if (n.isDir) dirCount++;
    else fileCount++;
  }
  return { nodes: all, mainVds, reserveVds, lvid, fsd, avdpLast, totalSectors, fileCount, dirCount };
}

function writeFid(
  sector: Uint8Array,
  offset: number,
  sectorNum: number,
  opts: { name: string; hidden: boolean; isDir: boolean; parent: boolean; feSector: number; feBytes: number },
): number {
  const ident = opts.parent ? new Uint8Array(0) : encodeIdent(opts.name);
  const len = fidLength(ident.length);
  const slice = sector.subarray(offset, offset + len);
  const dv = new DataView(sector.buffer, sector.byteOffset, sector.byteLength);
  dv.setUint16(offset + 16, 1, true);
  let ch = 0;
  if (opts.hidden) ch |= 0x01;
  if (opts.isDir || opts.parent) ch |= 0x02;
  if (opts.parent) ch |= 0x08;
  sector[offset + 18] = ch;
  sector[offset + 19] = ident.length;
  putLongAd(dv, offset + 20, opts.feBytes, opts.feSector);
  dv.setUint16(offset + 36, 0, true);
  if (ident.length) sector.set(ident, offset + 38);
  finishTag(slice, 257, sectorNum, len);
  return len;
}

function writeDirectory(node: UdfNode, parent: UdfNode): Uint8Array[] {
  const sectors = Math.max(1, Math.ceil((node.fidBytes ?? 0) / SECTOR));
  const pages: Uint8Array[] = [];
  for (let i = 0; i < sectors; i++) pages.push(new Uint8Array(SECTOR));
  let page = 0;
  let pos = 0;
  const emit = (opts: Parameters<typeof writeFid>[3]) => {
    const ident = opts.parent ? new Uint8Array(0) : encodeIdent(opts.name);
    const len = fidLength(ident.length);
    if (pos + len > SECTOR) {
      page++;
      pos = 0;
    }
    pos += writeFid(pages[page]!, pos, (node.fidSector ?? 0) + page, opts);
  };
  emit({
    name: "",
    hidden: false,
    isDir: true,
    parent: true,
    feSector: parent.feSector ?? 0,
    feBytes: parent.feBytes ?? 176,
  });
  const kids = [...node.children].sort((a, b) => a.name.localeCompare(b.name, "ru"));
  for (const c of kids) {
    emit({
      name: c.name,
      hidden: c.hidden,
      isDir: c.isDir,
      parent: false,
      feSector: c.feSector ?? 0,
      feBytes: c.feBytes ?? 176,
    });
  }
  return pages;
}

function writeFileEntry(node: UdfNode, parentFe: number): Uint8Array {
  const sector = new Uint8Array(SECTOR);
  const dv = new DataView(sector.buffer);
  const fe = node.feSector ?? 0;
  // ICB tag at 16
  dv.setUint32(16, 0, true);
  dv.setUint16(20, 4, true);
  dv.setUint16(22, 0, true);
  dv.setUint16(24, 1, true);
  sector[27] = node.isDir ? 4 : 5;
  dv.setUint32(28, parentFe >>> 0, true);
  dv.setUint16(32, 0, true);
  dv.setUint16(34, 0, true); // flags: short ADs
  dv.setUint32(36, 0xffffffff, true);
  dv.setUint32(40, 0xffffffff, true);
  dv.setUint32(44, 0x00007fff, true);
  dv.setUint16(48, 1, true);
  const infoLen = node.isDir ? node.fidBytes ?? 0 : node.size;
  putU64(dv, 56, infoLen);
  const blocks = node.isDir
    ? Math.max(1, Math.ceil((node.fidBytes ?? 0) / SECTOR))
    : node.size > 0
      ? Math.ceil(node.size / SECTOR)
      : 0;
  putU64(dv, 64, blocks);
  const ts = timestamp(node.mtime);
  sector.set(ts, 72);
  sector.set(ts, 84);
  sector.set(ts, 96);
  dv.setUint32(108, 1, true);
  sector.set(regid("*Arca"), 128);
  putU64(dv, 160, node.uniqueId ?? 16);
  dv.setUint32(168, 0, true);
  if (node.isDir) {
    const adLen = 8;
    dv.setUint32(172, adLen, true);
    const recorded = Math.max(1, Math.ceil((node.fidBytes ?? 0) / SECTOR)) * SECTOR;
    dv.setUint32(176, recorded >>> 0, true);
    dv.setUint32(180, node.fidSector ?? 0, true);
  } else if (node.size > 0) {
    const maxExt = 0x3ffff800;
    const ads: { len: number; loc: number }[] = [];
    let left = node.size;
    let loc = node.dataSector;
    while (left > 0) {
      const len = Math.min(maxExt, left);
      const stored = Math.ceil(len / SECTOR) * SECTOR;
      ads.push({ len: stored, loc });
      const sectors = stored / SECTOR;
      loc += sectors;
      left -= len;
    }
    dv.setUint32(172, ads.length * 8, true);
    ads.forEach((ad, i) => {
      dv.setUint32(176 + i * 8, ad.len >>> 0, true);
      dv.setUint32(180 + i * 8, ad.loc >>> 0, true);
    });
  } else {
    dv.setUint32(172, 0, true);
  }
  finishTag(sector, 261, fe, node.feBytes ?? 176);
  return sector;
}

function writeVds(plan: Planned, volumeId: string, which: "main" | "reserve"): Uint8Array[] {
  const base = which === "main" ? plan.mainVds : plan.reserveVds;
  const pages: Uint8Array[] = [];
  for (let i = 0; i < 16; i++) pages.push(new Uint8Array(SECTOR));
  const now = Date.UTC(2026, 10, 9, 1, 0, 0);

  const pvd = pages[0]!;
  const pdv = new DataView(pvd.buffer);
  pdv.setUint32(16, 1, true);
  pdv.setUint32(20, 0, true);
  pvd.set(dstring(volumeId, 32), 24);
  pdv.setUint16(56, 1, true);
  pdv.setUint16(58, 1, true);
  pdv.setUint16(60, 3, true);
  pdv.setUint16(62, 3, true);
  pdv.setUint32(64, 1, true);
  pdv.setUint32(68, 1, true);
  pvd.set(dstring(volumeId, 128), 72);
  pvd.set(charspec(), 200);
  pvd.set(charspec(), 264);
  pvd.set(regid("*Arca"), 344);
  pvd.set(timestamp(now), 376);
  pvd.set(regid("*Arca"), 388);
  finishTag(pvd, 1, base, 512);

  const impl = pages[1]!;
  const idv = new DataView(impl.buffer);
  idv.setUint32(16, 2, true);
  impl.set(regid("*UDF LV Info"), 20);
  // LV info starts at 52? Implementation use volume descriptor:
  // 0 tag, 16 sequence, 20 impl id (32) ends 52, then LVICharset 64, logical volume id 128...
  impl.set(charspec(), 52);
  impl.set(dstring(volumeId, 128), 116);
  impl.set(regid("*Arca"), 116 + 128 + 36 * 3);
  finishTag(impl, 4, base + 1, 512);

  const part = pages[2]!;
  const pp = new DataView(part.buffer);
  pp.setUint32(16, 3, true);
  pp.setUint16(20, 1, true);
  pp.setUint16(22, 0, true);
  part.set(regid("+NSR02"), 24);
  pp.setUint32(184, 1, true);
  pp.setUint32(188, 0, true);
  pp.setUint32(192, plan.totalSectors >>> 0, true);
  part.set(regid("*Arca"), 196);
  finishTag(part, 5, base + 2, 512);

  const lvd = pages[3]!;
  const lv = new DataView(lvd.buffer);
  lv.setUint32(16, 4, true);
  lvd.set(charspec(), 20);
  lvd.set(dstring(volumeId, 128), 84);
  lv.setUint32(212, SECTOR, true);
  const suffix = [0x02, 0x01, 0, 0, 0, 0, 0, 0];
  lvd.set(regid("*OSTA UDF Compliant", suffix), 216);
  const root = plan.nodes[0]!;
  putLongAd(lv, 248, root.feBytes ?? 176, root.feSector ?? 0);
  // Wait: FSD long_ad should point to FSD, not root. Root is inside FSD.
  // Overwrite: location of FSD, length 512.
  putLongAd(lv, 248, 512, plan.fsd);
  lv.setUint32(264, 6, true);
  lv.setUint32(268, 1, true);
  lvd.set(regid("*Arca"), 272);
  // integrity sequence extent at offset 432
  lv.setUint32(432, SECTOR, true);
  lv.setUint32(436, plan.lvid >>> 0, true);
  lvd[440] = 1;
  lvd[441] = 6;
  lv.setUint16(442, 1, true);
  lv.setUint16(444, 0, true);
  finishTag(lvd, 6, base + 3, 446);

  const unalloc = pages[4]!;
  const uv = new DataView(unalloc.buffer);
  uv.setUint32(16, 5, true);
  uv.setUint32(20, 0, true);
  finishTag(unalloc, 7, base + 4, 24);

  const term = pages[5]!;
  finishTag(term, 8, base + 5, 16);

  return pages;
}

function writeLvid(plan: Planned, volumeStamp: number): Uint8Array {
  const b = new Uint8Array(SECTOR);
  const dv = new DataView(b.buffer);
  b.set(timestamp(volumeStamp), 16);
  dv.setUint32(28, 2, true); // closed
  // next extent zero
  putU64(dv, 40, (plan.dirCount + plan.fileCount + 16) >>> 0);
  dv.setUint32(72, 1, true); // num partitions? layout: contents use is 32 bytes (40..72)
  // 40 uniqueID 8 + 24 reserved = 72. Then numOfPartitions at 72.
  dv.setUint32(72, 1, true);
  dv.setUint32(76, 46, true); // length of imp use
  dv.setUint32(80, 0, true); // free space
  dv.setUint32(84, plan.totalSectors >>> 0, true);
  b.set(regid("*Arca"), 88);
  dv.setUint32(120, plan.fileCount >>> 0, true);
  dv.setUint32(124, plan.dirCount >>> 0, true);
  dv.setUint16(128, 0x0102, true);
  dv.setUint16(130, 0x0102, true);
  dv.setUint16(132, 0x0102, true);
  finishTag(b, 9, plan.lvid, 134);
  return b;
}

function writeFsd(plan: Planned, volumeId: string, stamp: number): Uint8Array {
  const b = new Uint8Array(SECTOR);
  const dv = new DataView(b.buffer);
  b.set(timestamp(stamp), 16);
  dv.setUint16(28, 3, true);
  dv.setUint16(30, 3, true);
  dv.setUint32(32, 1, true);
  dv.setUint32(36, 1, true);
  dv.setUint32(40, 1, true);
  dv.setUint32(44, 0, true);
  b.set(charspec(), 48);
  b.set(dstring(volumeId, 128), 112);
  b.set(charspec(), 240);
  b.set(dstring(volumeId, 32), 304);
  const root = plan.nodes[0]!;
  putLongAd(dv, 400, root.feBytes ?? 176, root.feSector ?? 0);
  b.set(regid("*OSTA UDF Compliant", [0x02, 0x01, 0, 0, 0, 0, 0, 0]), 416);
  finishTag(b, 256, plan.fsd, 512);
  return b;
}

function writeAvdp(location: number, main: number, reserve: number): Uint8Array {
  const b = new Uint8Array(SECTOR);
  const dv = new DataView(b.buffer);
  dv.setUint32(16, 16 * SECTOR, true);
  dv.setUint32(20, main >>> 0, true);
  dv.setUint32(24, 16 * SECTOR, true);
  dv.setUint32(28, reserve >>> 0, true);
  finishTag(b, 2, location, 512);
  return b;
}

export type UdfPiece = { sector: number; data: Uint8Array };

/** Metadata pieces. Sector 256 is the anchor and must stay free of other data. */
export function emitUdf(root: UdfNode, plan: Planned, volumeId: string, stamp: number): UdfPiece[] {
  const pieces: UdfPiece[] = [];
  const main = writeVds(plan, volumeId, "main");
  const reserve = writeVds(plan, volumeId, "reserve");
  main.forEach((data, i) => pieces.push({ sector: plan.mainVds + i, data }));
  reserve.forEach((data, i) => pieces.push({ sector: plan.reserveVds + i, data }));
  pieces.push({ sector: plan.lvid, data: writeLvid(plan, stamp) });
  pieces.push({ sector: plan.fsd, data: writeFsd(plan, volumeId, stamp) });

  const byName = new Map<UdfNode, UdfNode>();
  const linkParent = (node: UdfNode, parent: UdfNode) => {
    byName.set(node, parent);
    if (node.isDir) for (const c of node.children) linkParent(c, node);
  };
  linkParent(root, root);

  for (const node of plan.nodes) {
    const parent = byName.get(node) ?? root;
    pieces.push({
      sector: node.feSector ?? 0,
      data: writeFileEntry(node, parent.feSector ?? node.feSector ?? 0),
    });
    if (node.isDir && node.fidSector != null) {
      const pages = writeDirectory(node, parent);
      pages.forEach((data, i) => pieces.push({ sector: node.fidSector! + i, data }));
    }
  }

  const avdp256 = writeAvdp(256, plan.mainVds, plan.reserveVds);
  const avdpEnd = writeAvdp(plan.avdpLast, plan.mainVds, plan.reserveVds);
  pieces.push({ sector: 256, data: avdp256 });
  if (plan.avdpLast !== 256) pieces.push({ sector: plan.avdpLast, data: avdpEnd });
  return pieces;
}

export function udfTagOk(sector: Uint8Array): boolean {
  if (sector.length < 16) return false;
  let sum = 0;
  for (let i = 0; i < 16; i++) if (i !== 4) sum = (sum + sector[i]!) & 0xff;
  return sum === sector[4];
}

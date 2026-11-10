import { bytesPart, date17, encodeUcs2be, padAChars, padAscii, padUcs2, put16both, put32both, SECTOR, writeDirDate } from "./bytes";
import { emulationCode } from "./boot";
import { iso9660Name, longName } from "./names";
import type { BuildInput, BuildResult, MemNode } from "./types";
import { allocateUdf, emitUdf, type UdfNode } from "./udf";

type BNode = {
  src: MemNode;
  isDir: boolean;
  isoName: string;
  jolietName: string;
  udfName: string;
  mangled: boolean;
  children: BNode[];
  isoExtent: number;
  jolietExtent: number;
  dataExtent: number;
  dataSectors: number;
  dirNumber: number;
  parentNumber: number;
  isoDirSectors: number;
  jolietDirSectors: number;
};

type Piece = { sector: number; data: BlobPart; length: number };

function recLen(nameLen: number): number {
  const n = 33 + nameLen;
  return n + (n & 1);
}

function dirPayload(names: Uint8Array[]): { bytes: number; sectors: number } {
  let pos = recLen(1) + recLen(1);
  for (const name of names) {
    const n = recLen(name.length);
    if (pos % SECTOR + n > SECTOR) pos = Math.ceil((pos + 1) / SECTOR) * SECTOR;
    pos += n;
  }
  const sectors = Math.max(1, Math.ceil(pos / SECTOR));
  return { bytes: pos, sectors };
}

function writeRec(
  target: Uint8Array,
  o: number,
  extent: number,
  size: number,
  mtime: number,
  flags: number,
  name: Uint8Array,
): number {
  const len = recLen(name.length);
  const dv = new DataView(target.buffer, target.byteOffset, target.byteLength);
  target[o] = len;
  dv.setUint32(o + 2, extent >>> 0, true);
  dv.setUint32(o + 6, extent >>> 0, false);
  dv.setUint32(o + 10, size >>> 0, true);
  dv.setUint32(o + 14, size >>> 0, false);
  writeDirDate(target, o + 18, mtime);
  target[o + 25] = flags;
  dv.setUint16(o + 28, 1, true);
  dv.setUint16(o + 30, 1, false);
  target[o + 32] = name.length;
  target.set(name, o + 33);
  return len;
}

function renderDir(
  selfExtent: number,
  parentExtent: number,
  selfSize: number,
  parentSize: number,
  mtime: number,
  entries: { extent: number; size: number; mtime: number; flags: number; name: Uint8Array }[],
): Uint8Array {
  const names = entries.map((e) => e.name);
  const { sectors } = dirPayload(names);
  const out = new Uint8Array(sectors * SECTOR);
  let pos = 0;
  const put = (extent: number, size: number, mt: number, flags: number, name: Uint8Array) => {
    const n = recLen(name.length);
    if (pos % SECTOR + n > SECTOR) pos = Math.ceil(pos / SECTOR) * SECTOR;
    pos += writeRec(out, pos, extent, size, mt, flags, name);
  };
  put(selfExtent, selfSize, mtime, 2, new Uint8Array([0]));
  put(parentExtent, parentSize, mtime, 2, new Uint8Array([1]));
  for (const e of entries) put(e.extent, e.size, e.mtime, e.flags, e.name);
  return out;
}

function pathTable(dirs: BNode[], joliet: boolean): { le: Uint8Array; be: Uint8Array } {
  const chunksLe: Uint8Array[] = [];
  const chunksBe: Uint8Array[] = [];
  for (const dir of dirs) {
    const name =
      dir.dirNumber === 1
        ? new Uint8Array([0])
        : joliet
          ? encodeUcs2be(dir.jolietName)
          : new TextEncoder().encode(dir.isoName);
    const len = 8 + name.length + (name.length & 1);
    const le = new Uint8Array(len);
    const be = new Uint8Array(len);
    le[0] = name.length;
    be[0] = name.length;
    const extent = joliet ? dir.jolietExtent : dir.isoExtent;
    new DataView(le.buffer).setUint32(2, extent >>> 0, true);
    new DataView(be.buffer).setUint32(2, extent >>> 0, false);
    new DataView(le.buffer).setUint16(6, dir.parentNumber, true);
    new DataView(be.buffer).setUint16(6, dir.parentNumber, false);
    le.set(name, 8);
    be.set(name, 8);
    chunksLe.push(le);
    chunksBe.push(be);
  }
  const join = (parts: Uint8Array[]) => {
    const n = parts.reduce((s, p) => s + p.length, 0);
    const out = new Uint8Array(n);
    let o = 0;
    for (const p of parts) {
      out.set(p, o);
      o += p.length;
    }
    return out;
  };
  return { le: join(chunksLe), be: join(chunksBe) };
}

function orderDirs(root: BNode): BNode[] {
  root.dirNumber = 1;
  root.parentNumber = 1;
  const list: BNode[] = [root];
  for (let i = 0; i < list.length; i++) {
    const parent = list[i]!;
    const kids = parent.children
      .filter((c) => c.isDir)
      .sort((a, b) => (a.isoName < b.isoName ? -1 : a.isoName > b.isoName ? 1 : 0));
    for (const kid of kids) {
      kid.parentNumber = parent.dirNumber;
      kid.dirNumber = list.length + 1;
      list.push(kid);
    }
  }
  return list;
}

function toUdf(node: BNode): UdfNode {
  return {
    name: node.udfName,
    isDir: node.isDir,
    hidden: !!node.src.hidden,
    mtime: node.src.mtime,
    dataSector: node.dataExtent,
    size: node.isDir ? 0 : node.src.size || node.src.blob?.size || 0,
    children: node.isDir ? node.children.map(toUdf) : [],
  };
}

function bootCatalog(extent: number, size: number, emulation: number): Uint8Array {
  const b = new Uint8Array(SECTOR);
  const dv = new DataView(b.buffer);
  b[0] = 0x01;
  b[1] = 0x00;
  const id = "ARCA EL TORITO";
  for (let i = 0; i < id.length; i++) b[4 + i] = id.charCodeAt(i);
  b[30] = 0x55;
  b[31] = 0xaa;
  let sum = 0;
  for (let i = 0; i < 16; i++) {
    if (i === 14) continue;
    sum = (sum + dv.getUint16(i * 2, true)) & 0xffff;
  }
  dv.setUint16(28, (0x10000 - sum) & 0xffff, true);
  b[32] = 0x88;
  b[33] = emulation;
  dv.setUint16(32 + 2, 0, true);
  b[32 + 4] = 0;
  const sectors512 = Math.max(1, Math.ceil(size / 512));
  dv.setUint16(32 + 6, sectors512, true);
  dv.setUint32(32 + 8, extent >>> 0, true);
  return b;
}

export function buildIso(input: BuildInput): BuildResult {
  const warnings: string[] = [];
  const useJoliet = input.filesystem !== "iso9660";
  const useUdf = input.filesystem === "udf";
  const jolietMax = useUdf ? 64 : 64;
  const udfMax = 255;

  const usedIso = new Set<string>();
  const usedJoliet = new Set<string>();
  const usedUdf = new Set<string>();

  const convert = (src: MemNode, isRoot: boolean): BNode => {
    const isDir = !!src.children && src.blob == null && !src.boot && src.size == null ? true : Array.isArray(src.children);
    const dir = Array.isArray(src.children);
    if (isRoot) {
      const node: BNode = {
        src,
        isDir: true,
        isoName: "",
        jolietName: "",
        udfName: "",
        mangled: false,
        children: (src.children ?? []).map((c) => convert(c, false)),
        isoExtent: 0,
        jolietExtent: 0,
        dataExtent: 0,
        dataSectors: 0,
        dirNumber: 1,
        parentNumber: 1,
        isoDirSectors: 1,
        jolietDirSectors: 1,
      };
      return node;
    }
    const iso = iso9660Name(src.name, dir, usedIso);
    const jol = longName(src.name, jolietMax, usedJoliet);
    const udf = longName(src.name, udfMax, usedUdf);
    if (!useJoliet && iso.mangled) warnings.push(`${src.name} → ${iso.stored.replace(/;1$/, "")} (ISO 9660, только 8.3)`);
    else if (useJoliet && jol.mangled) warnings.push(`${src.name} → ${jol.stored} (имя укорочено для Joliet, 64 символа)`);
    if (useUdf && udf.mangled) warnings.push(`${src.name} → ${udf.stored} (UDF, 255 символов)`);
    return {
      src,
      isDir: dir,
      isoName: dir ? iso.stored : iso.stored,
      jolietName: jol.stored,
      udfName: udf.stored,
      mangled: iso.mangled || jol.mangled,
      children: dir ? (src.children ?? []).map((c) => convert(c, false)) : [],
      isoExtent: 0,
      jolietExtent: 0,
      dataExtent: 0,
      dataSectors: 0,
      dirNumber: 0,
      parentNumber: 0,
      isoDirSectors: 1,
      jolietDirSectors: 1,
    };
  };

  const root = convert(input.root, true);
  const dirs = orderDirs(root);

  for (const dir of dirs) {
    const isoSorted = [...dir.children].sort((a, b) => (a.isoName < b.isoName ? -1 : a.isoName > b.isoName ? 1 : 0));
    const jolSorted = [...dir.children].sort((a, b) =>
      a.jolietName < b.jolietName ? -1 : a.jolietName > b.jolietName ? 1 : 0,
    );
    dir.isoDirSectors = dirPayload(childNamesFrom(isoSorted, false)).sectors;
    dir.jolietDirSectors = dirPayload(childNamesFrom(jolSorted, true)).sectors;
  }

  const isoPathLen = pathTableByteLength(dirs, false);
  const jolietPathLen = useJoliet ? pathTableByteLength(dirs, true) : 0;

  let cursor = 16;
  const take = (n: number): number => {
    if (n <= 0) return cursor;
    if (useUdf) {
      if (cursor === 256) cursor = 257;
      if (cursor < 256 && cursor + n > 256) cursor = 257;
    }
    const s = cursor;
    cursor += n;
    return s;
  };

  const pvdSector = take(1);
  if (pvdSector !== 16) throw new Error("PVD must occupy sector 16");
  const bootNode = findBoot(root);
  const bootRec = bootNode ? take(1) : -1;
  const svdSector = useJoliet ? take(1) : -1;
  const termSector = take(1);
  const catSector = bootNode ? take(1) : -1;
  const isoL = take(Math.max(1, Math.ceil(isoPathLen / SECTOR)));
  const isoM = take(Math.max(1, Math.ceil(isoPathLen / SECTOR)));
  const jolL = useJoliet ? take(Math.max(1, Math.ceil(jolietPathLen / SECTOR))) : -1;
  const jolM = useJoliet ? take(Math.max(1, Math.ceil(jolietPathLen / SECTOR))) : -1;

  for (const dir of dirs) dir.isoExtent = take(dir.isoDirSectors);
  if (useJoliet) for (const dir of dirs) dir.jolietExtent = take(dir.jolietDirSectors);

  const files: BNode[] = [];
  const walkFiles = (n: BNode) => {
    if (!n.isDir) files.push(n);
    for (const c of n.children) walkFiles(c);
  };
  walkFiles(root);
  for (const file of files) {
    const size = file.src.size ?? file.src.blob?.size ?? 0;
    file.dataSectors = size > 0 ? Math.ceil(size / SECTOR) : 0;
    file.dataExtent = file.dataSectors ? take(file.dataSectors) : 0;
  }

  let udfPlan: ReturnType<typeof allocateUdf> | null = null;
  let udfRoot: UdfNode | null = null;
  if (useUdf) {
    udfRoot = toUdf(root);
    udfRoot.name = input.volumeId || "ARCA";
    udfPlan = allocateUdf(udfRoot, take);
    if (udfPlan.avdpLast < 256) udfPlan.totalSectors = 257;
    else udfPlan.totalSectors = Math.max(udfPlan.totalSectors, udfPlan.avdpLast + 1);
  }

  const totalSectors = useUdf && udfPlan ? udfPlan.totalSectors : cursor;
  const stamp = input.root.mtime || Date.UTC(2026, 10, 9);

  const pieces: Piece[] = [];
  const add = (sector: number, data: Blob | Uint8Array, length: number) => {
    if (length <= 0) return;
    pieces.push({ sector, data: data instanceof Uint8Array ? bytesPart(data) : data, length });
  };

  const dirEntries = (node: BNode, joliet: boolean) => {
    const list = [...node.children].sort((a, b) => {
      const an = joliet ? a.jolietName : a.isoName;
      const bn = joliet ? b.jolietName : b.isoName;
      return an < bn ? -1 : an > bn ? 1 : 0;
    });
    return list.map((c) => {
      const size = c.isDir
        ? (joliet ? c.jolietDirSectors : c.isoDirSectors) * SECTOR
        : (c.src.size ?? c.src.blob?.size ?? 0);
      const flags = (c.isDir ? 2 : 0) | (c.src.hidden ? 1 : 0);
      const name = joliet ? encodeUcs2be(c.jolietName) : new TextEncoder().encode(c.isoName);
      const extent = c.isDir ? (joliet ? c.jolietExtent : c.isoExtent) : c.dataExtent;
      return { extent, size: size >>> 0, mtime: c.src.mtime, flags, name, node: c, fullSize: size };
    });
  };

  const writeTreeDirs = (joliet: boolean) => {
    for (const dir of dirs) {
      const parent = dirs.find((d) => d.dirNumber === dir.parentNumber) ?? dir;
      const selfSize = (joliet ? dir.jolietDirSectors : dir.isoDirSectors) * SECTOR;
      const parentSize = (joliet ? parent.jolietDirSectors : parent.isoDirSectors) * SECTOR;
      const entries = dirEntries(dir, joliet).flatMap((e) => {
        if (e.node.isDir || e.fullSize <= 0xffffffff) {
          return [{ extent: e.extent, size: e.fullSize >>> 0, mtime: e.mtime, flags: e.flags, name: e.name }];
        }
        const max = 0xfffff800;
        const out: { extent: number; size: number; mtime: number; flags: number; name: Uint8Array }[] = [];
        let left = e.fullSize;
        let extent = e.extent;
        while (left > 0) {
          const chunk = Math.min(max, left);
          const last = left - chunk <= 0;
          out.push({
            extent,
            size: chunk,
            mtime: e.mtime,
            flags: e.flags | (last ? 0 : 0x80),
            name: e.name,
          });
          extent += Math.ceil(chunk / SECTOR);
          left -= chunk;
        }
        return out;
      });
      const bytes = renderDir(
        joliet ? dir.jolietExtent : dir.isoExtent,
        joliet ? parent.jolietExtent : parent.isoExtent,
        selfSize,
        parentSize,
        dir.src.mtime || stamp,
        entries,
      );
      const reserved = (joliet ? dir.jolietDirSectors : dir.isoDirSectors) * SECTOR;
      if (bytes.length !== reserved) {
        throw new Error("Размер каталога ISO не сошёлся при сборке.");
      }
      add(joliet ? dir.jolietExtent : dir.isoExtent, bytes, bytes.length);
    }
  };

  const isoPath = pathTable(dirs, false);
  const jolietPath = useJoliet ? pathTable(dirs, true) : null;

  const pvd = new Uint8Array(SECTOR);
  writeVpd(pvd, 1, input, totalSectors, isoPath.le.length, isoL, isoM, root, false, stamp);
  add(pvdSector, pvd, SECTOR);
  if (bootNode && bootRec >= 0) {
    const br = new Uint8Array(SECTOR);
    br[0] = 0;
    br.set(new TextEncoder().encode("CD001"), 1);
    br[6] = 1;
    const sys = "EL TORITO SPECIFICATION";
    for (let i = 0; i < sys.length; i++) br[7 + i] = sys.charCodeAt(i);
    new DataView(br.buffer).setUint32(71, catSector >>> 0, true);
    add(bootRec, br, SECTOR);
  }
  if (useJoliet && svdSector >= 0) {
    const svd = new Uint8Array(SECTOR);
    writeVpd(svd, 2, input, totalSectors, jolietPath!.le.length, jolL, jolM, root, true, stamp);
    svd.set([0x25, 0x2f, 0x45], 88);
    add(svdSector, svd, SECTOR);
  }
  const term = new Uint8Array(SECTOR);
  term[0] = 0xff;
  term.set(new TextEncoder().encode("CD001"), 1);
  term[6] = 1;
  add(termSector, term, SECTOR);
  if (bootNode && catSector >= 0) {
    const size = bootNode.src.size ?? bootNode.src.blob?.size ?? 512;
    add(catSector, bootCatalog(bootNode.dataExtent, size, emulationCode(input.bootEmulation)), SECTOR);
  }

  const padSector = (bytes: Uint8Array) => {
    if (bytes.length % SECTOR === 0) return bytes;
    const out = new Uint8Array(Math.ceil(bytes.length / SECTOR) * SECTOR);
    out.set(bytes);
    return out;
  };
  const leP = padSector(isoPath.le);
  const beP = padSector(isoPath.be);
  add(isoL, leP, leP.length);
  add(isoM, beP, beP.length);
  if (jolietPath && jolL >= 0 && jolM >= 0) {
    const jle = padSector(jolietPath.le);
    const jbe = padSector(jolietPath.be);
    add(jolL, jle, jle.length);
    add(jolM, jbe, jbe.length);
  }

  writeTreeDirs(false);
  if (useJoliet) writeTreeDirs(true);

  for (const file of files) {
    const size = file.src.size ?? file.src.blob?.size ?? 0;
    if (!size || !file.src.blob) continue;
    const pad = (SECTOR - (size % SECTOR)) % SECTOR;
    const data = pad ? new Blob([file.src.blob, bytesPart(new Uint8Array(pad))]) : file.src.blob;
    add(file.dataExtent, data, file.dataSectors * SECTOR);
  }

  if (useUdf && udfPlan && udfRoot) {
    // Refresh data sectors after allocation (toUdf copied them already).
    const sync = (b: BNode, u: UdfNode) => {
      u.dataSector = b.dataExtent;
      u.size = b.isDir ? 0 : b.src.size || b.src.blob?.size || 0;
      b.children.forEach((c, i) => sync(c, u.children[i]!));
    };
    sync(root, udfRoot);
    const udfPieces = emitUdf(udfRoot, udfPlan, (input.volumeId || "ARCA").slice(0, 30), stamp);
    for (const p of udfPieces) add(p.sector, p.data, p.data.length);
  }

  pieces.sort((a, b) => a.sector - b.sector);
  const parts: BlobPart[] = [];
  let at = 0;
  for (const p of pieces) {
    const pos = p.sector * SECTOR;
    if (pos < at) throw new Error(`Перекрытие секторов при сборке ISO (сектор ${p.sector}).`);
    if (pos > at) parts.push(bytesPart(new Uint8Array(pos - at)));
    parts.push(p.data);
    at = pos + p.length;
  }
  const end = totalSectors * SECTOR;
  if (at < end) parts.push(bytesPart(new Uint8Array(end - at)));
  const blob = new Blob(parts, { type: "application/x-iso9660-image" });
  return { blob, bytes: end, warnings };
}

function childNamesFrom(children: BNode[], joliet: boolean): Uint8Array[] {
  const names: Uint8Array[] = [];
  for (const c of children) {
    const name = joliet ? encodeUcs2be(c.jolietName) : new TextEncoder().encode(c.isoName);
    const size = c.isDir ? 0 : (c.src.size ?? c.src.blob?.size ?? 0);
    const n = c.isDir || size <= 0xffffffff ? 1 : Math.ceil(size / 0xfffff800);
    for (let i = 0; i < Math.max(1, n); i++) names.push(name);
  }
  return names;
}

function pathTableByteLength(dirs: BNode[], joliet: boolean): number {
  let n = 0;
  for (const dir of dirs) {
    const nameLen =
      dir.dirNumber === 1 ? 1 : joliet ? encodeUcs2be(dir.jolietName).length : new TextEncoder().encode(dir.isoName).length;
    n += 8 + nameLen + (nameLen & 1);
  }
  return n;
}

function findBoot(node: BNode): BNode | null {
  if (node.src.boot && !node.isDir) return node;
  for (const c of node.children) {
    const hit = findBoot(c);
    if (hit) return hit;
  }
  return null;
}

function writeVpd(
  b: Uint8Array,
  type: number,
  input: BuildInput,
  totalSectors: number,
  pathSize: number,
  lpath: number,
  mpath: number,
  root: BNode,
  joliet: boolean,
  stamp: number,
): void {
  b[0] = type;
  b.set(new TextEncoder().encode("CD001"), 1);
  b[6] = 1;
  b.set(padAChars("ARCA", 32), 8);
  if (joliet) b.set(padUcs2(input.volumeId || "ARCA", 32), 40);
  else b.set(padAChars(input.volumeId || "ARCA", 32), 40);
  put32both(b, 80, totalSectors);
  put16both(b, 120, 1);
  put16both(b, 124, 1);
  put16both(b, 128, SECTOR);
  put32both(b, 132, pathSize);
  new DataView(b.buffer).setUint32(140, lpath >>> 0, true);
  new DataView(b.buffer).setUint32(148, mpath >>> 0, false);
  const rootSize = (joliet ? root.jolietDirSectors : root.isoDirSectors) * SECTOR;
  const rootExtent = joliet ? root.jolietExtent : root.isoExtent;
  writeRec(b, 156, rootExtent, rootSize, root.src.mtime || stamp, 2, new Uint8Array([0]));
  const label = input.volumeId || "ARCA";
  b.set(joliet ? padUcs2(label, 128) : padAscii(label.toUpperCase(), 128), 190);
  b.set(padAscii(input.publisher || "ARCA", 128), 318);
  b.set(padAscii(input.preparer || "ARCA", 128), 446);
  b.set(padAscii(input.application || "ARCA", 128), 574);
  b.set(date17(stamp), 813);
  b.set(date17(stamp), 830);
  b[881] = 1;
}

import { deflate, inflate } from "pako";
import { SECTOR } from "./bytes";

const MAGIC = [0x49, 0x73, 0x5a, 0x21]; // IsZ!
const BLOCK = 32 * SECTOR;

/**
 * UltraISO ISZ (ezbsystems spec): 48-byte packed header, chunk pointers,
 * zlib blocks. ptr_len is 4: 24-bit length + flag in the high byte.
 * Flags: 0x00 zeros, 0x40 stored, 0x80 zlib. Password and split archives are rejected.
 */
export function writeIsz(iso: Uint8Array): Uint8Array {
  const sect = SECTOR;
  const pad = (sect - (iso.length % sect)) % sect;
  const padded = pad ? concat([iso, new Uint8Array(pad)]) : iso;
  const totalSectors = padded.length / sect;
  const nblocks = Math.ceil(padded.length / BLOCK) || 1;
  const ptrLen = 4;
  const ptrBytes = new Uint8Array(nblocks * ptrLen);
  const chunks: Uint8Array<ArrayBufferLike>[] = [];
  for (let i = 0; i < nblocks; i++) {
    const slice = padded.subarray(i * BLOCK, Math.min(padded.length, (i + 1) * BLOCK));
    let allZero = true;
    for (let k = 0; k < slice.length; k++) {
      if (slice[k] !== 0) {
        allZero = false;
        break;
      }
    }
    let flag = 0x00;
    let payload: Uint8Array<ArrayBufferLike> = new Uint8Array(0);
    if (!allZero) {
      const z = deflate(slice);
      if (z.length < slice.length) {
        flag = 0x80;
        payload = z;
      } else {
        flag = 0x40;
        payload = slice;
      }
    }
    const len = payload.length;
    const o = i * ptrLen;
    ptrBytes[o] = len & 0xff;
    ptrBytes[o + 1] = (len >> 8) & 0xff;
    ptrBytes[o + 2] = (len >> 16) & 0xff;
    ptrBytes[o + 3] = flag;
    chunks.push(payload);
  }

  const header = new Uint8Array(48);
  const dv = new DataView(header.buffer);
  header.set(MAGIC);
  header[4] = 48;
  header[5] = 1;
  dv.setUint32(6, 0x41524341, true);
  dv.setUint16(10, sect, true);
  dv.setUint32(12, totalSectors, true);
  header[16] = 0;
  dv.setBigUint64(17, 0n, true);
  dv.setUint32(25, nblocks, true);
  dv.setUint32(29, BLOCK, true);
  header[33] = ptrLen;
  header[34] = 0;
  const ptrOffs = 48;
  const dataOffs = ptrOffs + ptrBytes.length;
  dv.setUint32(35, ptrOffs, true);
  dv.setUint32(39, 0, true);
  dv.setUint32(43, dataOffs, true);
  return concat([header, ptrBytes, ...chunks]);
}

export function readIsz(data: Uint8Array): Uint8Array {
  if (data.length < 48 || data[0] !== MAGIC[0] || data[1] !== MAGIC[1] || data[2] !== MAGIC[2] || data[3] !== MAGIC[3]) {
    throw new Error("Файл не похож на ISZ (нет подписи IsZ!).");
  }
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const headerSize = data[4] || 48;
  const ver = data[5];
  if (ver !== 1) throw new Error(`Версия ISZ ${ver} не поддерживается.`);
  const sect = dv.getUint16(10, true) || SECTOR;
  const totalSectors = dv.getUint32(12, true);
  const password = data[16];
  if (password !== 0) throw new Error("ISZ защищён паролем. Снимите пароль и откройте снова.");
  const nblocks = dv.getUint32(25, true);
  const blockSize = dv.getUint32(29, true);
  const ptrLen = data[33] ?? data[headerSize > 33 ? 33 : 33];
  const ptrLenSafe = data[33]!;
  const segOffs = dv.getUint32(39, true);
  const ptrOffs = dv.getUint32(35, true);
  const dataOffs = dv.getUint32(43, true);
  if (segOffs !== 0) throw new Error("Составной ISZ из нескольких частей не поддерживается.");
  if (ptrLenSafe < 2 || ptrLenSafe > 8) throw new Error("Повреждена таблица блоков ISZ.");
  if (!blockSize || !nblocks) throw new Error("Пустой заголовок ISZ.");

  const totalSize = totalSectors * sect;
  const out = new Uint8Array(totalSize);
  let dataCursor = dataOffs || headerSize + nblocks * ptrLenSafe;
  const table = ptrOffs || headerSize;
  for (let i = 0; i < nblocks; i++) {
    let value = 0n;
    const base = table + i * ptrLenSafe;
    for (let k = 0; k < ptrLenSafe; k++) {
      value |= BigInt(data[base + k] ?? 0) << BigInt(8 * k);
    }
    const shift = BigInt(8 * (ptrLenSafe - 1));
    const flag = Number((value >> shift) & 0xffn);
    const len = Number(value & ((1n << shift) - 1n));
    const offset = i * blockSize;
    const need = Math.min(blockSize, totalSize - offset);
    if (need <= 0) break;
    if (flag === 0x00) {
      // zeros already
    } else if (flag === 0x40) {
      out.set(data.subarray(dataCursor, dataCursor + len).subarray(0, need), offset);
      dataCursor += len;
    } else if (flag === 0x80) {
      const raw = inflate(data.subarray(dataCursor, dataCursor + len));
      out.set(raw.subarray(0, need), offset);
      dataCursor += len;
    } else if (flag === 0xc0) {
      throw new Error("ISZ сжат bzip2. Сожмите образ методом zlib.");
    } else {
      throw new Error(`Неизвестный тип блока ISZ: ${flag.toString(16)}`);
    }
  }
  return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const n = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

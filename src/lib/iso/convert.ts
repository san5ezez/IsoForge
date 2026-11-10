import { SECTOR } from "./bytes";

const SYNC = [0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x00];

export type ConvertInfo = {
  detected: string;
  iso: Uint8Array;
};

function findMarker(data: Uint8Array, marker: number[]): number {
  outer: for (let i = 0; i + marker.length <= data.length; i++) {
    for (let j = 0; j < marker.length; j++) if (data[i + j] !== marker[j]) continue outer;
    return i;
  }
  return -1;
}

export function looksLikeIso(data: Uint8Array): boolean {
  if (data.length < 17 * SECTOR) return false;
  const o = 16 * SECTOR;
  return data[o] === 1 && data[o + 1] === 0x43 && data[o + 2] === 0x44 && data[o + 3] === 0x30 && data[o + 4] === 0x30 && data[o + 5] === 0x31;
}

function findCd001(data: Uint8Array): number {
  const step = data.length > 8_000_000 ? SECTOR : 1;
  for (let i = 0; i + 6 < data.length; i += step) {
    if (
      (data[i] === 1 || data[i] === 2 || data[i] === 0) &&
      data[i + 1] === 0x43 &&
      data[i + 2] === 0x44 &&
      data[i + 3] === 0x30 &&
      data[i + 4] === 0x30 &&
      data[i + 5] === 0x31 &&
      (i % SECTOR === 0 || step === 1)
    ) {
      if (i % SECTOR !== 0) continue;
      return i;
    }
  }
  return -1;
}

function mode1To2048(data: Uint8Array): Uint8Array {
  const count = Math.floor(data.length / 2352);
  const out = new Uint8Array(count * SECTOR);
  for (let i = 0; i < count; i++) {
    out.set(data.subarray(i * 2352 + 16, i * 2352 + 16 + SECTOR), i * SECTOR);
  }
  return out;
}

function hasSync(data: Uint8Array): boolean {
  if (data.length < 2352) return false;
  for (let i = 0; i < SYNC.length; i++) if (data[i] !== SYNC[i]) return false;
  return data.length % 2352 === 0;
}

/**
 * Bring NRG, MDF, IMG, BIN/2352 or a raw ISO to a 2048-byte-sector image.
 * NRG/MDF are located by the CD001 descriptor; BIN strips the 16-byte header and ECC.
 */
export function convertToIso(data: Uint8Array, filename = ""): ConvertInfo {
  const lower = filename.toLowerCase();
  if (looksLikeIso(data)) {
    return { detected: lower.endsWith(".img") ? "IMG (сырой ISO)" : "ISO 9660", iso: data };
  }
  if (hasSync(data)) {
    const iso = mode1To2048(data);
    if (!looksLikeIso(iso) && findCd001(iso) < 0) {
      throw new Error("BIN/IMG 2352 не содержит том ISO 9660.");
    }
    const cd = findCd001(iso);
    const sliced = cd >= 16 * SECTOR ? iso.subarray(cd - 16 * SECTOR) : iso;
    return { detected: "Mode1 / 2352 (BIN, IMG)", iso: sliced };
  }

  const tail = data.length >= 8 ? String.fromCharCode(...data.subarray(data.length - 8)) : "";
  const nrg = tail.includes("NERO") || tail.includes("NER5") || lower.endsWith(".nrg");
  const cd = findCd001(data);
  if (cd >= 16 * SECTOR) {
    const iso = data.subarray(cd - 16 * SECTOR);
    let detected = "Образ с заголовком";
    if (nrg || lower.endsWith(".nrg")) detected = "NRG (Nero)";
    else if (lower.endsWith(".mdf")) detected = "MDF (Alcohol)";
    else if (lower.endsWith(".img")) detected = "IMG";
    else if (lower.endsWith(".bin")) detected = "BIN";
    return { detected, iso };
  }
  if (findMarker(data, [0x49, 0x73, 0x5a, 0x21]) === 0) {
    throw new Error("Это ISZ. Откройте его напрямую — Арка распакует контейнер.");
  }
  throw new Error("В файле нет тома ISO 9660 (метка CD001).");
}

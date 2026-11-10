import { blobOf, SECTOR } from "./bytes";
import { makeBootSector } from "./boot";
import { buildIso } from "./build";
import { crc32, md5 } from "./checksum";
import { convertToIso } from "./convert";
import { readIsz, writeIsz } from "./isz";
import { parseIso } from "./parse";
import type { MemNode } from "./types";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function body(node: MemNode | undefined): Promise<string> {
  assert(node?.blob, "нет файла");
  return new TextDecoder().decode(await node.blob.arrayBuffer());
}

function find(nodes: MemNode[] | undefined, name: string): MemNode | undefined {
  return nodes?.find((n) => n.name === name);
}

function walkBoot(nodes: MemNode[] | undefined): MemNode | undefined {
  for (const n of nodes ?? []) {
    if (n.boot) return n;
    const hit = walkBoot(n.children);
    if (hit) return hit;
  }
  return undefined;
}

export async function run(): Promise<void> {
  assert(md5(new TextEncoder().encode("abc")) === "900150983cd24fb0d6963f7d28e17f72", "md5");
  assert(crc32(new TextEncoder().encode("123456789")) === 0xcbf43926, "crc32");

  const boot = makeBootSector("ARCA BOOT OK");
  const hello = new TextEncoder().encode("hello joliet");
  const note = new TextEncoder().encode("Привет");
  const tree: MemNode = {
    name: "ARCA_DEMO",
    mtime: Date.UTC(2026, 10, 9),
    hidden: false,
    children: [
      {
        name: "readme.txt",
        mtime: Date.UTC(2026, 10, 9),
        hidden: false,
        size: hello.length,
        blob: new Blob([hello]),
      },
      {
        name: "Документы",
        mtime: Date.UTC(2026, 10, 9),
        hidden: false,
        children: [
          {
            name: "Привет.txt",
            mtime: Date.UTC(2026, 10, 9),
            hidden: true,
            size: note.length,
            blob: new Blob([note]),
          },
        ],
      },
      {
        name: "boot",
        mtime: Date.UTC(2026, 10, 9),
        hidden: false,
        children: [
          {
            name: "etfsboot.bin",
            mtime: Date.UTC(2026, 10, 9),
            hidden: false,
            boot: true,
            size: boot.length,
            blob: blobOf(boot),
          },
        ],
      },
    ],
  };

  const built = buildIso({
    filesystem: "joliet",
    volumeId: "ARCA_DEMO",
    publisher: "ARCA",
    preparer: "ARCA",
    application: "ARCA",
    bootEmulation: "none",
    root: tree,
  });
  const raw = new Uint8Array(await built.blob.arrayBuffer());
  assert(raw.length === built.bytes, `длина ${raw.length} != ${built.bytes}`);
  assert(raw[16 * SECTOR] === 1, "PVD");
  const parsed = parseIso(raw);
  assert(parsed.filesystem === "joliet", `fs ${parsed.filesystem}`);
  assert(parsed.volumeId.startsWith("ARCA_DEMO"), `label ${parsed.volumeId}`);
  assert((await body(find(parsed.root.children, "readme.txt"))) === "hello joliet", "readme");
  const docs = find(parsed.root.children, "Документы");
  assert(docs?.children, "папка Документы");
  const hi = find(docs.children, "Привет.txt");
  assert(hi?.hidden, "скрытый файл");
  assert((await body(hi)) === "Привет", "unicode body");
  assert(parsed.boot, "el torito");
  const bootNode = walkBoot(parsed.root.children);
  assert(bootNode, "boot file");
  const bootBytes = new Uint8Array(await bootNode.blob!.arrayBuffer());
  assert(bootBytes[510] === 0x55 && bootBytes[511] === 0xaa, "сигнатура 55AA");

  const udfBuilt = buildIso({
    filesystem: "udf",
    volumeId: "ARCA_UDF",
    publisher: "ARCA",
    preparer: "ARCA",
    application: "ARCA",
    bootEmulation: "none",
    root: tree,
  });
  const udfRaw = new Uint8Array(await udfBuilt.blob.arrayBuffer());
  const udfParsed = parseIso(udfRaw);
  assert(udfParsed.filesystem === "udf", `udf detect ${udfParsed.filesystem}`);
  assert((await body(find(udfParsed.root.children, "readme.txt"))) === "hello joliet", "udf/joliet readme");

  const packed = writeIsz(raw);
  const unpacked = readIsz(packed);
  assert(unpacked.length === raw.length, "isz length");
  for (let i = 0; i < raw.length; i++) {
    if (unpacked[i] !== raw[i]) throw new Error(`ISZ расходится на байте ${i}`);
  }

  const sectors = raw.length / SECTOR;
  const bin = new Uint8Array(sectors * 2352);
  for (let i = 0; i < sectors; i++) {
    bin[i * 2352] = 0x00;
    for (let s = 1; s < 11; s++) bin[i * 2352 + s] = 0xff;
    bin[i * 2352 + 11] = 0x00;
    bin[i * 2352 + 15] = 0x01;
    bin.set(raw.subarray(i * SECTOR, (i + 1) * SECTOR), i * 2352 + 16);
  }
  const conv = convertToIso(bin, "demo.bin");
  assert(conv.detected.includes("2352"), conv.detected);
  assert(conv.iso[16 * SECTOR] === 1, "bin->iso pvd");

  const prefix = 2 * SECTOR;
  const nrg = new Uint8Array(prefix + raw.length + 8);
  nrg.set(raw, prefix);
  nrg.set(new TextEncoder().encode("NER5"), nrg.length - 4);
  const nrgIso = convertToIso(nrg, "demo.nrg");
  assert(nrgIso.detected.includes("NRG"), nrgIso.detected);
  assert(nrgIso.iso[16 * SECTOR + 1] === 0x43, "nrg cd001");

  const isoOnly = buildIso({
    filesystem: "iso9660",
    volumeId: "PLAIN",
    publisher: "",
    preparer: "",
    application: "",
    bootEmulation: "none",
    root: {
      name: "PLAIN",
      mtime: Date.UTC(2026, 10, 9),
      hidden: false,
      children: [
        {
          name: "Привет.txt",
          mtime: Date.UTC(2026, 10, 9),
          hidden: false,
          size: note.length,
          blob: new Blob([note]),
        },
      ],
    },
  });
  assert(isoOnly.warnings.length > 0, "8.3 warning");
  const plain = parseIso(new Uint8Array(await isoOnly.blob.arrayBuffer()));
  assert(plain.filesystem === "iso9660", "plain fs");
  assert(plain.root.children?.length === 1, "one file");
  assert((await body(plain.root.children?.[0])) === "Привет", "8.3 body");
}

run().then(
  () => {
    console.log("arca iso selftest ok");
  },
  (err) => {
    console.error(err);
    process.exit(1);
  },
);

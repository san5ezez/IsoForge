import type { BootEmulation } from "./types";

/** 512-byte BIOS boot sector. Prints a message and halts. El Torito load segment 0x07C0. */
export function makeBootSector(message = "ARCA BOOT OK"): Uint8Array {
  const sector = new Uint8Array(512);
  const code = [
    0x31, 0xc0, // xor ax, ax
    0x8e, 0xd8, // mov ds, ax
    0x8e, 0xc0, // mov es, ax
    0x8e, 0xd0, // mov ss, ax
    0xbc, 0x00, 0x7c, // mov sp, 7C00h
    0xfb, // sti
    0xbe, 0x20, 0x7c, // mov si, 7C20h
    0xb4, 0x0e, // mov ah, 0Eh
    0xac, // lodsb
    0x84, 0xc0, // test al, al
    0x74, 0x04, // jz hang
    0xcd, 0x10, // int 10h
    0xeb, 0xf7, // jmp loop
    0xf4, // hlt
    0xeb, 0xfd, // jmp hang
  ];
  sector.set(code, 0);
  const msg = new TextEncoder().encode(message.replace(/[^\x20-\x7e]/g, " ").slice(0, 30));
  sector.set(msg, 0x20);
  sector[0x20 + msg.length] = 0;
  sector[510] = 0x55;
  sector[511] = 0xaa;
  return sector;
}

export function emulationCode(kind: BootEmulation): number {
  switch (kind) {
    case "floppy120":
      return 1;
    case "floppy144":
      return 2;
    case "floppy288":
      return 3;
    case "hdd":
      return 4;
    default:
      return 0;
  }
}

export function emulationFromCode(code: number): BootEmulation {
  switch (code) {
    case 1:
      return "floppy120";
    case 2:
      return "floppy144";
    case 3:
      return "floppy288";
    case 4:
      return "hdd";
    default:
      return "none";
  }
}

export const EMULATION_LABEL: Record<BootEmulation, string> = {
  none: "Без эмуляции",
  floppy120: "Дискета 1.2 МБ",
  floppy144: "Дискета 1.44 МБ",
  floppy288: "Дискета 2.88 МБ",
  hdd: "Жёсткий диск",
};

export type FsKind = "iso9660" | "joliet" | "udf";

export type BootEmulation = "none" | "floppy120" | "floppy144" | "floppy288" | "hdd";

export type MemNode = {
  name: string;
  mtime: number;
  hidden: boolean;
  system?: boolean;
  archive?: boolean;
  readonly?: boolean;
  children?: MemNode[];
  size?: number;
  blob?: Blob;
  boot?: boolean;
};

export type BuildInput = {
  filesystem: FsKind;
  volumeId: string;
  publisher: string;
  preparer: string;
  application: string;
  root: MemNode;
  bootEmulation: BootEmulation;
};

export type BuildResult = {
  blob: Blob;
  bytes: number;
  warnings: string[];
};

export type ParsedBoot = {
  emulation: BootEmulation;
  sectorCount512: number;
  extent: number;
  platform: number;
};

export type ParsedIso = {
  volumeId: string;
  filesystem: FsKind;
  publisher: string;
  boot: ParsedBoot | null;
  root: MemNode;
};

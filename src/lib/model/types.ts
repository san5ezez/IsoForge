import type { BootEmulation, FsKind } from "@/lib/iso/types";
import type { MediaId } from "@/lib/format";

export type NodeId = string;
export type Pane = "image" | "pc";

export type Attrs = {
  hidden: boolean;
  system: boolean;
  archive: boolean;
  readonly: boolean;
};

export type DriveKind = "fixed" | "removable" | "optical" | "virtual";

export type FsNode = {
  id: NodeId;
  parentId: NodeId | null;
  name: string;
  kind: "dir" | "file" | "drive";
  driveKind?: DriveKind;
  capacity?: number;
  size: number;
  attrs: Attrs;
  mtime: number;
  blob?: Blob;
  boot?: boolean;
};

export type ProjectMeta = {
  volumeId: string;
  publisher: string;
  preparer: string;
  application: string;
  filesystem: FsKind;
  bootable: boolean;
  bootNodeId: string | null;
  bootEmulation: BootEmulation;
  fileName: string;
  dirty: boolean;
};

export type AppOptions = {
  driveLetter: string;
  autoMount: boolean;
  associations: Record<"iso" | "isz" | "nrg" | "mdf" | "img" | "bin", boolean>;
  contextMenu: boolean;
};

export type DialogState =
  | null
  | { type: "properties" }
  | { type: "new-folder" }
  | { type: "rename" }
  | { type: "attrs" }
  | { type: "write" }
  | { type: "burn" }
  | { type: "boot-load" }
  | { type: "checksum"; name: string; size: number; md5: string; sha1: string; sha256: string; crc: string }
  | { type: "convert" }
  | { type: "isz" }
  | { type: "options" }
  | { type: "from-disc" }
  | { type: "about" }
  | { type: "save-as" }
  | { type: "text"; title: string; body: string }
  | { type: "confirm"; title: string; body: string; ok: string; pending: "new" | "open" }
  | { type: "warnings"; lines: string[] }
  | { type: "progress"; title: string; detail: string };

export const IMAGE_ROOT = "img-root";
export const PC_ROOT = "pc-root";

export const DEFAULT_ATTRS: Attrs = {
  hidden: false,
  system: false,
  archive: true,
  readonly: false,
};

export type { BootEmulation, FsKind, MediaId };

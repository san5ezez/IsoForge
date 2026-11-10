import { create } from "zustand";
import { downloadBlob, mediaById, type MediaId } from "@/lib/format";
import { blobOf } from "@/lib/iso/bytes";
import { makeBootSector } from "@/lib/iso/boot";
import { buildIso } from "@/lib/iso/build";
import { crc32, hex32, md5, sha } from "@/lib/iso/checksum";
import { convertToIso } from "@/lib/iso/convert";
import { readIsz, writeIsz } from "@/lib/iso/isz";
import { parseIso } from "@/lib/iso/parse";
import type { BootEmulation, FsKind, MemNode } from "@/lib/iso/types";
import { createSeed } from "./seed";
import { childrenOf, descendantIds, isProtected, isUnder, payloadBytes, uniqueName } from "./tree";
import {
  DEFAULT_ATTRS,
  IMAGE_ROOT,
  PC_ROOT,
  type AppOptions,
  type Attrs,
  type DialogState,
  type FsNode,
  type Pane,
  type ProjectMeta,
} from "./types";

const STAMP = Date.UTC(2026, 10, 9, 1, 0, 0);

export type DragPayload = { from: Pane; ids: string[] };

type Studio = {
  nodes: Record<string, FsNode>;
  project: ProjectMeta;
  media: MediaId;
  options: AppOptions;
  active: Pane;
  imageDir: string;
  pcDir: string;
  imageSelection: string[];
  pcSelection: string[];
  dialog: DialogState;
  notice: string | null;
  touched: boolean;
  dragging: DragPayload | null;
  pendingFile: File | null;
  hydrated: boolean;
  setActive: (pane: Pane) => void;
  select: (pane: Pane, id: string, mode: "set" | "toggle" | "range") => void;
  openDir: (pane: Pane, id: string) => void;
  setDialog: (dialog: DialogState) => void;
  notify: (text: string) => void;
  newFolder: (name: string) => void;
  rename: (name: string) => void;
  removeSelected: () => void;
  applyAttrs: (attrs: Attrs) => void;
  setProjectPatch: (patch: Partial<ProjectMeta>) => void;
  setMedia: (id: MediaId) => void;
  setOptions: (patch: Partial<AppOptions>) => void;
  setAssociation: (key: keyof AppOptions["associations"], value: boolean) => void;
  addExternal: (files: FileList | File[], pane: Pane) => void;
  drop: (to: Pane, dirId: string) => void;
  setDragging: (payload: DragPayload | null) => void;
  requestNew: () => void;
  requestOpen: (file: File) => void;
  confirmPending: () => void;
  save: (fileName?: string) => Promise<void>;
  extract: () => void;
  downloadSelected: () => void;
  mount: () => void;
  unmount: () => void;
  burnTo: (driveId: string | "new") => Promise<void>;
  writeTo: (driveId: string | "new", alsoDownload: boolean) => Promise<void>;
  imageFromDrive: (driveId: string) => void;
  compressIsz: () => Promise<void>;
  convertAndOpen: (file: File, open: boolean) => Promise<void>;
  checksumSelected: () => Promise<void>;
  loadBootFrom: (pane: Pane) => void;
  extractBoot: () => void;
  makeBoot: () => void;
  markHydrated: (snapshot: Partial<Pick<Studio, "nodes" | "project" | "media" | "options" | "imageDir" | "pcDir">> | null) => void;
};

function textBlob(text: string): { blob: Blob; size: number } {
  const data = new TextEncoder().encode(text);
  return { blob: new Blob([data]), size: data.length };
}

function freshProject(patch?: Partial<ProjectMeta>): ProjectMeta {
  return {
    volumeId: "NEW_VOL",
    publisher: "ARCA",
    preparer: "ARCA",
    application: "ARCA",
    filesystem: "joliet",
    bootable: false,
    bootNodeId: null,
    bootEmulation: "none",
    fileName: "NEW_VOL.iso",
    dirty: false,
    ...patch,
  };
}

function fileNode(id: string, parentId: string, file: File, name: string): FsNode {
  return {
    id,
    parentId,
    name,
    kind: "file",
    size: file.size,
    attrs: { ...DEFAULT_ATTRS },
    mtime: file.lastModified || STAMP,
    blob: file,
  };
}

function dirNode(id: string, parentId: string, name: string): FsNode {
  return {
    id,
    parentId,
    name,
    kind: "dir",
    size: 0,
    attrs: { ...DEFAULT_ATTRS },
    mtime: STAMP,
  };
}

function clearImage(nodes: Record<string, FsNode>): Record<string, FsNode> {
  const next: Record<string, FsNode> = {};
  for (const [id, node] of Object.entries(nodes)) {
    if (id === IMAGE_ROOT || !isUnder(nodes, id, IMAGE_ROOT)) next[id] = node;
  }
  next[IMAGE_ROOT] = { ...nodes[IMAGE_ROOT]!, name: "NEW_VOL", boot: false };
  return next;
}

function replaceImage(nodes: Record<string, FsNode>, root: MemNode): Record<string, FsNode> {
  const next: Record<string, FsNode> = {};
  for (const [id, node] of Object.entries(nodes)) {
    if (id !== IMAGE_ROOT && isUnder(nodes, id, IMAGE_ROOT)) continue;
    next[id] = node;
  }
  const rootNode: FsNode = {
    ...nodes[IMAGE_ROOT]!,
    name: root.name || "VOLUME",
    mtime: root.mtime || STAMP,
    boot: false,
  };
  next[IMAGE_ROOT] = rootNode;
  let bootId: string | null = null;
  const walk = (mem: MemNode, parentId: string) => {
    for (const child of mem.children ?? []) {
      const id = crypto.randomUUID();
      const isDir = Array.isArray(child.children);
      const node: FsNode = {
        id,
        parentId,
        name: child.name,
        kind: isDir ? "dir" : "file",
        size: isDir ? 0 : child.size || child.blob?.size || 0,
        attrs: {
          hidden: !!child.hidden,
          system: !!child.system,
          archive: child.archive !== false,
          readonly: !!child.readonly,
        },
        mtime: child.mtime || STAMP,
        blob: child.blob,
        boot: !!child.boot,
      };
      next[id] = node;
      if (child.boot) bootId = id;
      if (isDir) walk(child, id);
    }
  };
  walk(root, IMAGE_ROOT);
  return next;
}

function findBootId(nodes: Record<string, FsNode>): string | null {
  return Object.values(nodes).find((node) => node.boot && isUnder(nodes, node.id, IMAGE_ROOT))?.id ?? null;
}

async function consumeAttrFile(root: MemNode): Promise<MemNode> {
  const file = root.children?.find((child) => child.name.toUpperCase() === "ARCA_ATTR.TXT");
  if (!file?.blob) return root;
  const text = await file.blob.text();
  const map = new Map<string, Partial<MemNode>>();
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const [path, flags = ""] = line.split("\t");
    if (!path) continue;
    map.set(path, {
      hidden: flags.includes("h"),
      system: flags.includes("s"),
      archive: flags.includes("a"),
      readonly: flags.includes("r"),
    });
  }
  const apply = (node: MemNode, path: string) => {
    const hit = map.get(path);
    if (hit && path) Object.assign(node, hit);
    node.children?.forEach((child) => apply(child, `${path}/${child.name}`));
  };
  apply(root, "");
  return { ...root, children: root.children?.filter((child) => child !== file) };
}

function toMem(nodes: Record<string, FsNode>, id: string, bootId: string | null): MemNode {
  const node = nodes[id]!;
  if (node.kind === "file") {
    return {
      name: node.name,
      mtime: node.mtime,
      hidden: node.attrs.hidden,
      system: node.attrs.system,
      archive: node.attrs.archive,
      readonly: node.attrs.readonly,
      size: node.size,
      blob: node.blob ?? new Blob([]),
      boot: node.id === bootId,
    };
  }
  return {
    name: node.name,
    mtime: node.mtime,
    hidden: node.attrs.hidden,
    children: childrenOf(nodes, id)
      .filter((child) => child.kind !== "drive")
      .map((child) => toMem(nodes, child.id, bootId)),
  };
}

function withSidecar(nodes: Record<string, FsNode>, bootId: string | null): MemNode {
  const mem = toMem(nodes, IMAGE_ROOT, bootId);
  const lines: string[] = ["# arca attrs v1"];
  const walk = (node: MemNode, path: string) => {
    if (path) {
      const odd = node.system || node.readonly || node.archive === false;
      if (odd) {
        const flags = `${node.hidden ? "h" : ""}${node.system ? "s" : ""}${node.archive !== false ? "a" : ""}${node.readonly ? "r" : ""}`;
        lines.push(`${path}\t${flags}`);
      }
    }
    node.children?.forEach((child) => walk(child, `${path}/${child.name}`));
  };
  walk(mem, "");
  if (lines.length > 1) {
    const { blob, size } = textBlob(lines.join("\r\n"));
    mem.children = mem.children ?? [];
    mem.children.push({
      name: "ARCA_ATTR.TXT",
      mtime: STAMP,
      hidden: true,
      size,
      blob,
    });
  }
  return mem;
}

function cloneInto(
  nodes: Record<string, FsNode>,
  id: string,
  parentId: string,
  target: Record<string, FsNode>,
): string {
  const src = nodes[id]!;
  const nid = crypto.randomUUID();
  const name = uniqueName(target, parentId, src.name);
  target[nid] = {
    ...src,
    id: nid,
    parentId,
    name,
    attrs: { ...src.attrs },
    boot: false,
    kind: src.kind === "drive" ? "dir" : src.kind,
    driveKind: undefined,
  };
  if (src.kind !== "file") {
    for (const child of childrenOf(nodes, id)) cloneInto(nodes, child.id, nid, target);
  }
  return nid;
}

function selectionOf(state: Studio, pane: Pane): string[] {
  return pane === "image" ? state.imageSelection : state.pcSelection;
}

function dirOf(state: Studio, pane: Pane): string {
  return pane === "image" ? state.imageDir : state.pcDir;
}

let noticeTimer: ReturnType<typeof setTimeout> | undefined;

export const useStudio = create<Studio>((set, get) => ({
  nodes: createSeed(),
  project: {
    volumeId: "ARCA_DEMO",
    publisher: "ARCA",
    preparer: "ARCA",
    application: "Арка",
    filesystem: "joliet",
    bootable: true,
    bootNodeId: "img-boot",
    bootEmulation: "none",
    fileName: "ARCA_DEMO.iso",
    dirty: false,
  },
  media: "dvd47",
  options: {
    driveLetter: "Z",
    autoMount: false,
    associations: { iso: true, isz: true, nrg: true, mdf: true, img: true, bin: true },
    contextMenu: true,
  },
  active: "image",
  imageDir: IMAGE_ROOT,
  pcDir: "c-docs",
  imageSelection: ["img-readme"],
  pcSelection: [],
  dialog: null,
  notice: null,
  touched: false,
  dragging: null,
  pendingFile: null,
  hydrated: false,

  setActive: (active) => set({ active }),
  setDialog: (dialog) => set({ dialog }),
  setDragging: (dragging) => set({ dragging }),
  notify: (text) => {
    if (noticeTimer) clearTimeout(noticeTimer);
    set({ notice: text });
    noticeTimer = setTimeout(() => set({ notice: null }), 4200);
  },
  setMedia: (media) => {
    const state = get();
    const used = payloadBytes(state.nodes, IMAGE_ROOT);
    const cap = mediaById(media).bytes;
    set({ media, touched: true });
    if (used > cap) {
      get().notify(`Образ не влезет на ${mediaById(media).label}. Уберите файлы или выберите диск больше.`);
    }
  },
  setOptions: (patch) => set({ options: { ...get().options, ...patch }, touched: true }),
  setAssociation: (key, value) => {
    const options = get().options;
    set({
      touched: true,
      options: { ...options, associations: { ...options.associations, [key]: value } },
    });
  },
  setProjectPatch: (patch) => {
    const project = { ...get().project, ...patch, dirty: true };
    const nodes = { ...get().nodes };
    if (patch.volumeId && nodes[IMAGE_ROOT]) {
      nodes[IMAGE_ROOT] = { ...nodes[IMAGE_ROOT], name: patch.volumeId };
    }
    set({ project, nodes, touched: true });
  },

  select: (pane, id, mode) => {
    const state = get();
    const current = selectionOf(state, pane);
    const folder = dirOf(state, pane);
    let next = [id];
    if (mode === "toggle") {
      next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
    } else if (mode === "range" && current.length) {
      const order = childrenOf(state.nodes, folder).map((node) => node.id);
      const anchor = current[current.length - 1]!;
      const a = order.indexOf(anchor);
      const b = order.indexOf(id);
      if (a >= 0 && b >= 0) {
        const [from, to] = a < b ? [a, b] : [b, a];
        next = order.slice(from, to + 1);
      }
    }
    set(pane === "image" ? { imageSelection: next, active: pane } : { pcSelection: next, active: pane });
  },

  openDir: (pane, id) => {
    const node = get().nodes[id];
    if (!node || node.kind === "file") return;
    set(
      pane === "image"
        ? { imageDir: id, imageSelection: [], active: "image" }
        : { pcDir: id, pcSelection: [], active: "pc" },
    );
  },

  newFolder: (name) => {
    const state = get();
    const pane = state.active;
    const parentId = dirOf(state, pane);
    if (pane === "pc" && isProtected(state.nodes, parentId)) {
      get().notify("Этот диск только для чтения.");
      return;
    }
    const trimmed = name.trim();
    if (!trimmed || /[\\/]/.test(trimmed)) {
      get().notify("Имя папки не должно быть пустым и не может содержать \\ или /.");
      return;
    }
    const id = crypto.randomUUID();
    const nodes = { ...state.nodes, [id]: dirNode(id, parentId, uniqueName(state.nodes, parentId, trimmed)) };
    set({
      nodes,
      dialog: null,
      touched: true,
      project: { ...state.project, dirty: pane === "image" ? true : state.project.dirty },
    });
  },

  rename: (name) => {
    const state = get();
    const pane = state.active;
    const id = selectionOf(state, pane)[0];
    const node = id ? state.nodes[id] : undefined;
    if (!node || node.kind === "drive" || !node.parentId) return;
    if (pane === "pc" && isProtected(state.nodes, node.id)) {
      get().notify("Этот диск только для чтения.");
      return;
    }
    const trimmed = name.trim();
    if (!trimmed || /[\\/]/.test(trimmed)) {
      get().notify("Некорректное имя.");
      return;
    }
    const nextName = uniqueName(state.nodes, node.parentId, trimmed, node.id);
    const nodes = { ...state.nodes, [id!]: { ...node, name: nextName } };
    if (id === IMAGE_ROOT) {
      set({
        nodes,
        dialog: null,
        touched: true,
        project: { ...state.project, volumeId: nextName, dirty: true },
      });
      return;
    }
    set({
      nodes,
      dialog: null,
      touched: true,
      project: { ...state.project, dirty: pane === "image" ? true : state.project.dirty },
    });
  },

  removeSelected: () => {
    const state = get();
    const pane = state.active;
    const ids = selectionOf(state, pane).filter((id) => {
      const node = state.nodes[id];
      return node && node.kind !== "drive" && node.parentId && id !== IMAGE_ROOT && id !== PC_ROOT;
    });
    if (!ids.length) return;
    if (pane === "pc" && ids.some((id) => isProtected(state.nodes, id))) {
      get().notify("Нельзя удалять файлы с компакт-диска или смонтированного образа.");
      return;
    }
    const nodes = { ...state.nodes };
    for (const id of ids) {
      for (const child of descendantIds(nodes, id)) delete nodes[child];
      delete nodes[id];
    }
    let bootNodeId = state.project.bootNodeId;
    if (bootNodeId && !nodes[bootNodeId]) bootNodeId = null;
    set({
      nodes,
      touched: true,
      imageSelection: pane === "image" ? [] : state.imageSelection,
      pcSelection: pane === "pc" ? [] : state.pcSelection,
      project: {
        ...state.project,
        bootNodeId,
        bootable: !!bootNodeId && state.project.bootable,
        dirty: pane === "image" ? true : state.project.dirty,
      },
    });
  },

  applyAttrs: (attrs) => {
    const state = get();
    const pane = state.active;
    const id = selectionOf(state, pane)[0];
    const node = id ? state.nodes[id] : undefined;
    if (!node || node.kind === "drive") return;
    if (pane === "pc" && isProtected(state.nodes, node.id)) {
      get().notify("Этот диск только для чтения.");
      return;
    }
    const nodes = { ...state.nodes, [node.id]: { ...node, attrs } };
    set({
      nodes,
      dialog: null,
      touched: true,
      project: { ...state.project, dirty: pane === "image" ? true : state.project.dirty },
    });
  },

  addExternal: (list, pane) => {
    const files = [...list];
    if (!files.length) return;
    const state = get();
    const parentId = dirOf(state, pane);
    if (pane === "pc" && isProtected(state.nodes, parentId)) {
      get().notify("Этот диск только для чтения. Выберите папку на C:, D: или USB.");
      return;
    }
    const before = payloadBytes(state.nodes, IMAGE_ROOT);
    const nodes = { ...state.nodes };
    const ensureDir = (root: string, relative: string) => {
      let cursor = root;
      if (!relative) return cursor;
      for (const part of relative.split("/").filter(Boolean)) {
        const existing = childrenOf(nodes, cursor).find(
          (child) => child.kind !== "file" && child.name.toLocaleLowerCase("ru") === part.toLocaleLowerCase("ru"),
        );
        if (existing) {
          cursor = existing.id;
          continue;
        }
        const id = crypto.randomUUID();
        nodes[id] = dirNode(id, cursor, part);
        cursor = id;
      }
      return cursor;
    };
    for (const file of files) {
      const relative = file.webkitRelativePath || "";
      const parts = relative.split("/").filter(Boolean);
      const folder = parts.length > 1 ? parts.slice(0, -1).join("/") : "";
      const parent = ensureDir(parentId, folder);
      const id = crypto.randomUUID();
      nodes[id] = fileNode(id, parent, file, uniqueName(nodes, parent, file.name));
    }
    const dirty = pane === "image" ? true : state.project.dirty;
    set({ nodes, touched: true, project: { ...state.project, dirty }, active: pane });
    if (pane === "image") {
      const after = payloadBytes(nodes, IMAGE_ROOT);
      const cap = mediaById(state.media).bytes;
      if (after > cap && before <= cap) {
        get().notify(`Образ больше не помещается на ${mediaById(state.media).label}.`);
      } else get().notify(`В образ добавлено файлов: ${files.length}.`);
    } else get().notify(`Импортировано файлов: ${files.length}.`);
  },

  drop: (to, dirId) => {
    const state = get();
    const drag = state.dragging;
    set({ dragging: null });
    if (!drag || !drag.ids.length) return;
    const target = state.nodes[dirId];
    if (!target || target.kind === "file") return;
    if (to === "pc" && isProtected(state.nodes, dirId)) {
      get().notify("Папка назначения только для чтения.");
      return;
    }
    const ids = drag.ids.filter((id) => {
      const node = state.nodes[id];
      if (!node || node.kind === "drive" || !node.parentId) return false;
      if (id === dirId || isUnder(state.nodes, dirId, id)) return false;
      return true;
    });
    if (!ids.length) return;
    const sameTree = (drag.from === "image") === (to === "image");
    const nodes = { ...state.nodes };
    if (sameTree && !(drag.from === "pc" && ids.some((id) => isProtected(state.nodes, id)))) {
      for (const id of ids) {
        const node = nodes[id]!;
        if (node.parentId === dirId) continue;
        nodes[id] = { ...node, parentId: dirId, name: uniqueName(nodes, dirId, node.name, id) };
      }
    } else {
      for (const id of ids) cloneInto(state.nodes, id, dirId, nodes);
    }
    const dirty = to === "image" || drag.from === "image" ? true : state.project.dirty;
    set({ nodes, touched: true, project: { ...state.project, dirty } });
    const used = payloadBytes(nodes, IMAGE_ROOT);
    if (to === "image" && used > mediaById(state.media).bytes) {
      get().notify(`Образ не влезет на ${mediaById(state.media).label}. Шкала заполнения стала красной.`);
    }
  },

  requestNew: () => {
    if (get().project.dirty) {
      set({
        pendingFile: null,
        dialog: {
          type: "confirm",
          title: "Создать новый образ?",
          body: "Текущий образ не сохранён. Несохранённые файлы внутри него пропадут из проекта.",
          ok: "Создать пустой",
          pending: "new",
        },
      });
      return;
    }
    set({ pendingFile: null, dialog: null });
    get().confirmPending();
  },

  requestOpen: (file) => {
    if (get().project.dirty) {
      set({
        pendingFile: file,
        dialog: {
          type: "confirm",
          title: "Открыть другой образ?",
          body: "Текущий проект будет заменён содержимым выбранного файла.",
          ok: "Открыть",
          pending: "open",
        },
      });
      return;
    }
    set({ pendingFile: file });
    void get().confirmPending();
  },

  confirmPending: () => {
    const state = get();
    const kind = state.dialog?.type === "confirm" ? state.dialog.pending : state.pendingFile ? "open" : "new";
    if (kind === "open" && state.pendingFile) {
      const file = state.pendingFile;
      set({ dialog: { type: "progress", title: "Открытие", detail: file.name }, pendingFile: null });
      void openContainer(file);
      return;
    }
    const nodes = clearImage(state.nodes);
    nodes[IMAGE_ROOT] = { ...nodes[IMAGE_ROOT]!, name: "NEW_VOL" };
    set({
      nodes,
      imageDir: IMAGE_ROOT,
      imageSelection: [],
      dialog: null,
      pendingFile: null,
      touched: true,
      project: freshProject({ dirty: false }),
    });
  },

  save: async (fileName) => {
    const state = get();
    const name = (fileName || state.project.fileName || "image.iso").replace(/[\\/]/g, "");
    set({ dialog: { type: "progress", title: "Сборка ISO", detail: name } });
    await waitFrame();
    try {
      const built = buildIso({
        filesystem: state.project.filesystem,
        volumeId: state.project.volumeId,
        publisher: state.project.publisher,
        preparer: state.project.preparer,
        application: state.project.application,
        bootEmulation: state.project.bootable ? state.project.bootEmulation : "none",
        root: withSidecar(state.nodes, state.project.bootable ? state.project.bootNodeId : null),
      });
      downloadBlob(built.blob, name.endsWith(".iso") ? name : `${name}.iso`);
      set({
        touched: true,
        project: { ...get().project, fileName: name.endsWith(".iso") ? name : `${name}.iso`, dirty: false },
        dialog: built.warnings.length ? { type: "warnings", lines: built.warnings } : null,
      });
      if (!built.warnings.length) get().notify(`Образ сохранён: ${formatQuiet(built.bytes)}.`);
    } catch (error) {
      set({
        dialog: {
          type: "text",
          title: "Не удалось собрать образ",
          body: error instanceof Error ? error.message : "Неизвестная ошибка сборки.",
        },
      });
    }
  },

  extract: () => {
    const state = get();
    const ids = state.imageSelection.filter((id) => state.nodes[id] && id !== IMAGE_ROOT);
    if (!ids.length) {
      get().notify("Выберите файлы в образе, которые нужно извлечь.");
      return;
    }
    if (isProtected(state.nodes, state.pcDir)) {
      get().notify("Выберите папку на C:, D: или USB — туда можно извлечь файлы.");
      return;
    }
    const nodes = { ...state.nodes };
    for (const id of ids) cloneInto(state.nodes, id, state.pcDir, nodes);
    set({ nodes, touched: true, active: "pc" });
    get().notify("Файлы извлечены в выбранную папку компьютера. «Скачать» сохранит их на ваш диск.");
  },

  downloadSelected: () => {
    const state = get();
    const pane = state.active;
    const ids = selectionOf(state, pane).filter((id) => state.nodes[id]?.kind === "file" && state.nodes[id]?.blob);
    if (!ids.length) {
      get().notify("Выберите файл, который нужно скачать.");
      return;
    }
    for (const id of ids) {
      const node = state.nodes[id]!;
      downloadBlob(node.blob!, node.name);
    }
  },

  mount: () => {
    const state = get();
    const letter = state.options.driveLetter || "Z";
    const id = "drv-virtual";
    const nodes = { ...state.nodes };
    for (const child of descendantIds(nodes, id)) delete nodes[child];
    nodes[id] = {
      id,
      parentId: PC_ROOT,
      name: `${letter}: ISODrive`,
      kind: "drive",
      driveKind: "virtual",
      capacity: payloadBytes(state.nodes, IMAGE_ROOT),
      size: 0,
      attrs: { ...DEFAULT_ATTRS },
      mtime: STAMP,
    };
    for (const child of childrenOf(state.nodes, IMAGE_ROOT)) cloneInto(state.nodes, child.id, id, nodes);
    set({ nodes, pcDir: id, active: "pc", touched: true });
    get().notify(`Образ смонтирован как ${letter}:. Диск только для чтения.`);
  },

  unmount: () => {
    const nodes = { ...get().nodes };
    if (!nodes["drv-virtual"]) {
      get().notify("Виртуальный привод пуст.");
      return;
    }
    for (const child of descendantIds(nodes, "drv-virtual")) delete nodes[child];
    delete nodes["drv-virtual"];
    const pcDir = get().pcDir === "drv-virtual" || !nodes[get().pcDir] ? "drv-c" : get().pcDir;
    set({ nodes, pcDir, touched: true });
    get().notify("Виртуальный привод размонтирован.");
  },

  burnTo: async (driveId) => {
    const state = get();
    set({ dialog: { type: "progress", title: "Запись", detail: "Сборка образа и запись на виртуальный привод" } });
    await waitFrame();
    try {
      const built = buildIso(inputFrom(state));
      const nodes = { ...state.nodes };
      const id = driveId === "new" ? "drv-burned" : driveId;
      for (const child of descendantIds(nodes, id)) delete nodes[child];
      const prev = nodes[id];
      nodes[id] = {
        id,
        parentId: PC_ROOT,
        name: prev?.name ?? "G: DVD-R",
        kind: "drive",
        driveKind: "optical",
        capacity: mediaById(state.media).bytes,
        size: 0,
        attrs: { ...DEFAULT_ATTRS },
        mtime: STAMP,
      };
      for (const child of childrenOf(state.nodes, IMAGE_ROOT)) cloneInto(state.nodes, child.id, id, nodes);
      downloadBlob(built.blob, state.project.fileName || "image.iso");
      set({
        nodes,
        dialog: null,
        pcDir: id,
        touched: true,
        project: { ...state.project, dirty: false },
      });
      get().notify("Запись завершена. ISO также скачан — его можно прожечь штатной программой Windows.");
    } catch (error) {
      set({
        dialog: {
          type: "text",
          title: "Запись прервана",
          body: error instanceof Error ? error.message : "Ошибка записи.",
        },
      });
    }
  },

  writeTo: async (driveId, alsoDownload) => {
    const state = get();
    set({ dialog: { type: "progress", title: "Запись на USB", detail: "Подготовка образа жёсткого диска" } });
    await waitFrame();
    try {
      const built = buildIso(inputFrom(state));
      const nodes = { ...state.nodes };
      const id = driveId === "new" ? crypto.randomUUID() : driveId;
      for (const child of descendantIds(nodes, id)) delete nodes[child];
      nodes[id] = {
        id,
        parentId: PC_ROOT,
        name: driveId === "new" ? "H: USB-HDD" : (nodes[id]?.name ?? "USB"),
        kind: "drive",
        driveKind: "removable",
        capacity: 32 * 1024 ** 3,
        size: 0,
        attrs: { ...DEFAULT_ATTRS },
        mtime: STAMP,
      };
      for (const child of childrenOf(state.nodes, IMAGE_ROOT)) cloneInto(state.nodes, child.id, id, nodes);
      if (alsoDownload) downloadBlob(built.blob, state.project.fileName || "image.iso");
      set({ nodes, dialog: null, pcDir: id, active: "pc", touched: true });
      get().notify(
        alsoDownload
          ? "Образ записан на виртуальный USB и скачан. В Windows его пишут на флешку как есть."
          : "Образ записан на виртуальный USB. Откройте его в нижнем окне.",
      );
    } catch (error) {
      set({
        dialog: {
          type: "text",
          title: "Не удалось записать",
          body: error instanceof Error ? error.message : "Ошибка записи.",
        },
      });
    }
  },

  imageFromDrive: (driveId) => {
    const state = get();
    const drive = state.nodes[driveId];
    if (!drive || drive.kind !== "drive") return;
    const nodes = clearImage(state.nodes);
    nodes[IMAGE_ROOT] = { ...nodes[IMAGE_ROOT]!, name: drive.name.replace(/[:\\]/g, "").slice(0, 16) || "DISC" };
    for (const child of childrenOf(state.nodes, driveId)) cloneInto(state.nodes, child.id, IMAGE_ROOT, nodes);
    const volumeId = nodes[IMAGE_ROOT]!.name.toUpperCase().replace(/[^A-Z0-9_]/g, "").slice(0, 16) || "DISC";
    nodes[IMAGE_ROOT] = { ...nodes[IMAGE_ROOT]!, name: volumeId };
    set({
      nodes,
      imageDir: IMAGE_ROOT,
      imageSelection: [],
      active: "image",
      dialog: null,
      touched: true,
      project: freshProject({ volumeId, fileName: `${volumeId}.iso`, dirty: true, filesystem: "joliet" }),
    });
    get().notify(`Новый образ собран с диска ${drive.name}.`);
  },

  compressIsz: async () => {
    const state = get();
    set({ dialog: { type: "progress", title: "Сжатие ISZ", detail: "zlib, блоки по 64 КБ" } });
    await waitFrame();
    try {
      const built = buildIso(inputFrom(state));
      const raw = new Uint8Array(await built.blob.arrayBuffer());
      const packed = writeIsz(raw);
      const base = (state.project.fileName || "image.iso").replace(/\.iso$/i, "");
      downloadBlob(blobOf(packed), `${base}.isz`);
      set({ dialog: null });
      get().notify(`ISZ готов: ${formatQuiet(packed.length)} вместо ${formatQuiet(raw.length)}.`);
    } catch (error) {
      set({
        dialog: {
          type: "text",
          title: "Сжатие не удалось",
          body: error instanceof Error ? error.message : "Ошибка ISZ.",
        },
      });
    }
  },

  convertAndOpen: async (file, open) => {
    set({ dialog: { type: "progress", title: "Конвертация", detail: file.name } });
    await waitFrame();
    try {
      const raw = new Uint8Array(await file.arrayBuffer());
      const converted = file.name.toLowerCase().endsWith(".isz")
        ? { iso: readIsz(raw), detected: "ISZ" }
        : convertToIso(raw, file.name);
      const outName = file.name.replace(/\.[^.]+$/, "") + ".iso";
      downloadBlob(blobOf(converted.iso), outName);
      if (open) {
        const parsed = await consumeAttrFile(parseIso(converted.iso).root);
        const parsedAll = parseIso(converted.iso);
        const nodes = replaceImage(get().nodes, parsed);
        const bootNodeId = findBootId(nodes);
        set({
          nodes,
          imageDir: IMAGE_ROOT,
          imageSelection: [],
          dialog: null,
          touched: true,
          project: freshProject({
            volumeId: parsedAll.volumeId.slice(0, 32) || "VOLUME",
            filesystem: parsedAll.filesystem,
            publisher: parsedAll.publisher || "ARCA",
            bootable: !!parsedAll.boot,
            bootNodeId,
            bootEmulation: parsedAll.boot?.emulation ?? "none",
            fileName: outName,
            dirty: false,
          }),
        });
        if (get().options.autoMount) get().mount();
        get().notify(`Открыт ${converted.detected}: ${parsedAll.volumeId}.`);
      } else {
        set({ dialog: null });
        get().notify(`${converted.detected} преобразован в ISO и скачан.`);
      }
    } catch (error) {
      set({
        dialog: {
          type: "text",
          title: "Конвертация не удалась",
          body: error instanceof Error ? error.message : "Формат не распознан.",
        },
      });
    }
  },

  checksumSelected: async () => {
    const state = get();
    const pane = state.active;
    const id = selectionOf(state, pane).find((item) => state.nodes[item]?.kind === "file");
    const node = id ? state.nodes[id] : undefined;
    if (!node?.blob) {
      get().notify("Выберите файл, а не папку.");
      return;
    }
    set({ dialog: { type: "progress", title: "Контрольные суммы", detail: node.name } });
    const bytes = new Uint8Array(await node.blob.arrayBuffer());
    const [sha1, sha256] = await Promise.all([sha(bytes, "SHA-1"), sha(bytes, "SHA-256")]);
    set({
      dialog: {
        type: "checksum",
        name: node.name,
        size: node.size,
        md5: md5(bytes),
        sha1,
        sha256,
        crc: hex32(crc32(bytes)),
      },
    });
  },

  loadBootFrom: (pane) => {
    const state = get();
    const id = selectionOf(state, pane).find((item) => state.nodes[item]?.kind === "file");
    const node = id ? state.nodes[id] : undefined;
    if (!node?.blob) {
      get().notify("Выберите файл, который станет загрузочным сектором.");
      return;
    }
    const nodes = { ...state.nodes };
    for (const item of Object.values(nodes)) {
      if (item.boot) nodes[item.id] = { ...item, boot: false };
    }
    let bootNodeId = node.id;
    if (pane === "pc" || !isUnder(nodes, node.id, IMAGE_ROOT)) {
      let bootDir = childrenOf(nodes, IMAGE_ROOT).find((child) => child.kind === "dir" && child.name.toLowerCase() === "boot");
      if (!bootDir) {
        const dirId = crypto.randomUUID();
        nodes[dirId] = dirNode(dirId, IMAGE_ROOT, "boot");
        bootDir = nodes[dirId];
      }
      bootNodeId = cloneInto(nodes, node.id, bootDir.id, nodes);
    }
    nodes[bootNodeId] = { ...nodes[bootNodeId]!, boot: true };
    set({
      nodes,
      dialog: null,
      touched: true,
      project: { ...state.project, bootable: true, bootNodeId, dirty: true },
    });
    get().notify("Загрузочный файл вшит. Образ помечен как El Torito.");
  },

  extractBoot: () => {
    const state = get();
    const id = state.project.bootNodeId;
    const node = id ? state.nodes[id] : undefined;
    if (!node?.blob) {
      get().notify("В образе нет загрузочного файла. Сначала загрузите его.");
      return;
    }
    if (!isProtected(state.nodes, state.pcDir)) {
      const nodes = { ...state.nodes };
      cloneInto(state.nodes, node.id, state.pcDir, nodes);
      set({ nodes, touched: true });
    }
    downloadBlob(node.blob, node.name);
    get().notify("Загрузочный файл извлечён и скачан.");
  },

  makeBoot: () => {
    const sector = makeBootSector("ARCA BOOT OK");
    const state = get();
    const nodes = { ...state.nodes };
    let bootDir = childrenOf(nodes, IMAGE_ROOT).find((child) => child.kind === "dir" && child.name.toLowerCase() === "boot");
    if (!bootDir) {
      const dirId = crypto.randomUUID();
      nodes[dirId] = dirNode(dirId, IMAGE_ROOT, "boot");
      bootDir = nodes[dirId]!;
    }
    const id = crypto.randomUUID();
    nodes[id] = {
      id,
      parentId: bootDir.id,
      name: uniqueName(nodes, bootDir.id, "etfsboot.bin"),
      kind: "file",
      size: sector.length,
      attrs: { ...DEFAULT_ATTRS, system: true },
      mtime: STAMP,
      blob: blobOf(sector),
      boot: true,
    };
    for (const item of Object.values(nodes)) {
      if (item.boot && item.id !== id) nodes[item.id] = { ...item, boot: false };
    }
    set({
      nodes,
      touched: true,
      project: { ...state.project, bootable: true, bootNodeId: id, bootEmulation: "none", dirty: true },
    });
    get().notify("Создан загрузочный сектор BIOS и подключён как El Torito без эмуляции.");
  },

  markHydrated: (snapshot) => {
    if (get().touched || !snapshot) {
      set({ hydrated: true });
      return;
    }
    set({ ...snapshot, hydrated: true, touched: false });
  },
}));

function inputFrom(state: Studio) {
  return {
    filesystem: state.project.filesystem,
    volumeId: state.project.volumeId,
    publisher: state.project.publisher,
    preparer: state.project.preparer,
    application: state.project.application,
    bootEmulation: (state.project.bootable ? state.project.bootEmulation : "none") as BootEmulation,
    root: withSidecar(state.nodes, state.project.bootable ? state.project.bootNodeId : null),
  };
}

function formatQuiet(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} МБ`;
  return `${(bytes / 1024 ** 3).toFixed(2)} ГБ`;
}

function waitFrame(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 40));
}

async function openContainer(file: File): Promise<void> {
  try {
    const raw = new Uint8Array(await file.arrayBuffer());
    const lower = file.name.toLowerCase();
    const converted = lower.endsWith(".isz") ? { iso: readIsz(raw), detected: "ISZ" } : convertToIso(raw, file.name);
    const parsed = parseIso(converted.iso);
    const root = await consumeAttrFile(parsed.root);
    const nodes = replaceImage(useStudio.getState().nodes, { ...root, name: parsed.volumeId || root.name });
    const bootNodeId = findBootId(nodes);
    if (nodes[IMAGE_ROOT]) nodes[IMAGE_ROOT] = { ...nodes[IMAGE_ROOT], name: parsed.volumeId || root.name };
    useStudio.setState({
      nodes,
      imageDir: IMAGE_ROOT,
      imageSelection: [],
      dialog: null,
      touched: true,
      active: "image",
      project: freshProject({
        volumeId: (parsed.volumeId || "VOLUME").slice(0, 32),
        filesystem: parsed.filesystem as FsKind,
        publisher: parsed.publisher || "ARCA",
        bootable: !!parsed.boot,
        bootNodeId,
        bootEmulation: parsed.boot?.emulation ?? "none",
        fileName: file.name.toLowerCase().endsWith(".iso") ? file.name : file.name.replace(/\.[^.]+$/, "") + ".iso",
        dirty: false,
      }),
    });
    if (useStudio.getState().options.autoMount) useStudio.getState().mount();
    useStudio.getState().notify(`Открыт ${converted.detected}. Файловая система: ${labelFs(parsed.filesystem)}.`);
  } catch (error) {
    useStudio.setState({
      dialog: {
        type: "text",
        title: "Не удалось открыть",
        body: error instanceof Error ? error.message : "Файл не является образом диска.",
      },
    });
  }
}

function labelFs(kind: FsKind): string {
  if (kind === "udf") return "UDF";
  if (kind === "joliet") return "Joliet";
  return "ISO 9660";
}

export function currentDir(pane: Pane): string {
  const state = useStudio.getState();
  return pane === "image" ? state.imageDir : state.pcDir;
}

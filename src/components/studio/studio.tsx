import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Disc,
  FilePlus,
  FolderOpen,
  FolderPlus,
  FolderUp,
  Hash,
  HardDrive,
  Menu,
  Save,
  Shield,
  Trash2,
  Usb,
} from "lucide-react";
import { MEDIA, formatBytes, mediaById } from "@/lib/format";
import { loadStudio, scheduleSave } from "@/lib/model/persist";
import { useStudio } from "@/lib/model/store";
import { countEntries, pathOf, payloadBytes } from "@/lib/model/tree";
import { IMAGE_ROOT, type FsKind, type MediaId } from "@/lib/model/types";
import { Workspace } from "./workspace";
import { StudioDialogs } from "./dialogs";

const FS_LABEL: Record<FsKind, string> = {
  iso9660: "ISO 9660",
  joliet: "Joliet",
  udf: "UDF",
};

type Command = { label: string; hint?: string; run: () => void };

export function Studio() {
  const openRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const project = useStudio((s) => s.project);
  const notice = useStudio((s) => s.notice);
  const associations = useStudio((s) => s.options.associations);
  const accept = Object.entries(associations)
    .filter(([, on]) => on)
    .map(([key]) => `.${key}`);
  if (!accept.includes(".iso")) accept.unshift(".iso");
  if (!accept.includes(".cue")) accept.push(".cue");

  useEffect(() => {
    folderRef.current?.setAttribute("webkitdirectory", "");
    folderRef.current?.setAttribute("directory", "");
  }, []);

  useEffect(() => {
    let live = true;
    void loadStudio().then((snapshot) => {
      if (!live) return;
      useStudio.getState().markHydrated(
        snapshot
          ? {
              nodes: snapshot.nodes,
              project: snapshot.project,
              media: snapshot.media,
              options: snapshot.options,
              imageDir: snapshot.imageDir,
              pcDir: snapshot.pcDir,
            }
          : null,
      );
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    return useStudio.subscribe((state, prev) => {
      if (!state.hydrated || !state.touched) return;
      if (
        state.nodes === prev.nodes &&
        state.project === prev.project &&
        state.media === prev.media &&
        state.options === prev.options &&
        state.imageDir === prev.imageDir &&
        state.pcDir === prev.pcDir
      ) {
        return;
      }
      scheduleSave({
        project: state.project,
        media: state.media,
        options: state.options,
        imageDir: state.imageDir,
        pcDir: state.pcDir,
        nodes: Object.values(state.nodes),
      });
    });
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT");
      if (typing) return;
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === "s") {
        event.preventDefault();
        void useStudio.getState().save();
      } else if ((event.ctrlKey || event.metaKey) && key === "n") {
        event.preventDefault();
        useStudio.getState().requestNew();
      } else if (event.key === "F2") {
        event.preventDefault();
        useStudio.getState().setDialog({ type: "rename" });
      } else if (event.key === "Delete") {
        useStudio.getState().removeSelected();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const addIntoImage = () => {
    const state = useStudio.getState();
    if (!state.pcSelection.length) {
      state.notify("Выделите файлы в нижнем окне — они поедут в образ.");
      return;
    }
    state.setDragging({ from: "pc", ids: state.pcSelection });
    state.drop("image", state.imageDir);
  };

  const groups: { id: string; label: string; items: Command[] }[] = [
    {
      id: "file",
      label: "Файл",
      items: [
        { label: "Создать", hint: "Ctrl+N", run: () => useStudio.getState().requestNew() },
        { label: "Открыть…", run: () => openRef.current?.click() },
        { label: "Сохранить", hint: "Ctrl+S", run: () => void useStudio.getState().save() },
        { label: "Сохранить как…", run: () => useStudio.getState().setDialog({ type: "save-as" }) },
        { label: "Свойства…", run: () => useStudio.getState().setDialog({ type: "properties" }) },
      ],
    },
    {
      id: "action",
      label: "Действие",
      items: [
        { label: "Добавить файлы…", run: () => filesRef.current?.click() },
        { label: "Добавить папку…", run: () => folderRef.current?.click() },
        { label: "Новая папка", run: () => useStudio.getState().setDialog({ type: "new-folder" }) },
        { label: "Переименовать", hint: "F2", run: () => useStudio.getState().setDialog({ type: "rename" }) },
        { label: "Удалить", hint: "Del", run: () => useStudio.getState().removeSelected() },
        { label: "Атрибуты…", run: () => useStudio.getState().setDialog({ type: "attrs" }) },
        { label: "Добавить выделенное в образ", run: addIntoImage },
        { label: "Извлечь на компьютер", run: () => useStudio.getState().extract() },
        { label: "Скачать выделенное", run: () => useStudio.getState().downloadSelected() },
      ],
    },
    {
      id: "boot",
      label: "Самозагрузка",
      items: [
        { label: "Записать образ жёсткого диска…", run: () => useStudio.getState().setDialog({ type: "write" }) },
        { label: "Записать CD/DVD…", run: () => useStudio.getState().setDialog({ type: "burn" }) },
        { label: "Загрузить загрузочный файл…", run: () => useStudio.getState().setDialog({ type: "boot-load" }) },
        { label: "Извлечь загрузочный файл", run: () => useStudio.getState().extractBoot() },
        { label: "Создать загрузочный сектор", run: () => useStudio.getState().makeBoot() },
      ],
    },
    {
      id: "tools",
      label: "Инструменты",
      items: [
        { label: "Монтировать ISODrive", run: () => useStudio.getState().mount() },
        { label: "Размонтировать", run: () => useStudio.getState().unmount() },
        { label: "Создать образ с диска…", run: () => useStudio.getState().setDialog({ type: "from-disc" }) },
        { label: "Конвертировать…", run: () => useStudio.getState().setDialog({ type: "convert" }) },
        { label: "Сжать в ISZ…", run: () => useStudio.getState().setDialog({ type: "isz" }) },
        { label: "Контрольные суммы", run: () => void useStudio.getState().checksumSelected() },
      ],
    },
    {
      id: "options",
      label: "Опции",
      items: [
        { label: "Настройки…", run: () => useStudio.getState().setDialog({ type: "options" }) },
        { label: "О программе", run: () => useStudio.getState().setDialog({ type: "about" }) },
      ],
    },
  ];

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-bg font-sans text-fg">
      <MenuBar groups={groups} fileName={project.fileName} dirty={project.dirty} filesystem={project.filesystem} bootable={project.bootable} />
      <Toolbar
        onNew={() => useStudio.getState().requestNew()}
        onOpen={() => openRef.current?.click()}
        onSave={() => void useStudio.getState().save()}
        onAdd={() => filesRef.current?.click()}
        onFolder={() => folderRef.current?.click()}
        onMkdir={() => useStudio.getState().setDialog({ type: "new-folder" })}
        onExtract={() => useStudio.getState().extract()}
        onDelete={() => useStudio.getState().removeSelected()}
        onWrite={() => useStudio.getState().setDialog({ type: "write" })}
        onBoot={() => useStudio.getState().setDialog({ type: "boot-load" })}
        onMount={() => useStudio.getState().mount()}
        onHash={() => void useStudio.getState().checksumSelected()}
        onProps={() => useStudio.getState().setDialog({ type: "properties" })}
      />
      <Workspace />
      <StatusBar />
      {notice && (
        <p className="pointer-events-none fixed bottom-16 left-1/2 z-20 max-w-lg -translate-x-1/2 border border-line bg-raised px-3 py-2 text-center text-sm text-pretty shadow-lg">
          {notice}
        </p>
      )}
      <StudioDialogs />
      <input
        ref={openRef}
        type="file"
        className="hidden"
        accept={accept.join(",")}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) useStudio.getState().requestOpen(file);
        }}
      />
      <input
        ref={filesRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          const list = event.target.files;
          event.target.value = "";
          if (list?.length) useStudio.getState().addExternal(list, useStudio.getState().active);
        }}
      />
      <input
        ref={folderRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          const list = event.target.files;
          event.target.value = "";
          if (list?.length) useStudio.getState().addExternal(list, useStudio.getState().active);
        }}
      />
    </div>
  );
}

function Mark() {
  return (
    <svg viewBox="0 0 24 24" className="size-6 text-accent" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="12" cy="12" r="4.2" fill="none" stroke="var(--color-fg)" strokeWidth="1.1" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
    </svg>
  );
}

function MenuBar({
  groups,
  fileName,
  dirty,
  filesystem,
  bootable,
}: {
  groups: { id: string; label: string; items: Command[] }[];
  fileName: string;
  dirty: boolean;
  filesystem: FsKind;
  bootable: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(null);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <header className="relative z-30 flex h-12 shrink-0 items-center gap-1 border-b border-line bg-bg px-2" onPointerDown={(event) => event.stopPropagation()}>
      <div className="flex items-center gap-2 pr-1">
        <Mark />
        <span className="text-sm font-semibold tracking-wide">Арка</span>
      </div>
      <nav className="hidden items-center md:flex" aria-label="Главное меню">
        {groups.map((group) => (
          <div key={group.id} className="relative">
            <button
              type="button"
              className={`h-9 px-2.5 text-sm ${open === group.id ? "bg-raised text-fg" : "text-muted hover:text-fg"}`}
              aria-expanded={open === group.id}
              onClick={() => setOpen((value) => (value === group.id ? null : group.id))}
            >
              {group.label}
            </button>
            {open === group.id && <MenuList items={group.items} onPick={() => setOpen(null)} />}
          </div>
        ))}
      </nav>
      <button type="button" className="grid size-11 place-items-center text-fg md:hidden" aria-label="Меню" onClick={() => setOpen((value) => (value === "all" ? null : "all"))}>
        <Menu className="size-5" />
      </button>
      <p className="ml-auto flex min-w-0 items-center gap-2 pr-1 text-xs">
        <span className="hidden text-muted lg:inline">{FS_LABEL[filesystem]}</span>
        {bootable && <span className="text-accent">BOOT</span>}
        <span className="max-w-40 truncate font-mono text-fg">{fileName}</span>
        {dirty && <span className="text-accent">●</span>}
      </p>
      {open === "all" && (
        <div className="absolute inset-x-0 top-12 max-h-[70dvh] overflow-auto border-b border-line bg-surface p-2 md:hidden">
          {groups.map((group) => (
            <div key={group.id} className="mb-2">
              <p className="px-2 py-1 text-xs font-medium tracking-wide text-muted uppercase">{group.label}</p>
              {group.items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="flex h-11 w-full items-center justify-between px-2 text-left text-sm hover:bg-raised"
                  onClick={() => {
                    setOpen(null);
                    item.run();
                  }}
                >
                  {item.label}
                  {item.hint && <span className="font-mono text-xs text-muted">{item.hint}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </header>
  );
}

function MenuList({ items, onPick }: { items: Command[]; onPick: () => void }) {
  return (
    <div role="menu" className="absolute top-9 left-0 z-40 min-w-64 border border-line bg-raised py-1 shadow-lg">
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          className="flex h-9 w-full items-center justify-between gap-4 px-3 text-left text-sm hover:bg-accent/20"
          onClick={() => {
            onPick();
            item.run();
          }}
        >
          <span>{item.label}</span>
          {item.hint && <span className="font-mono text-xs text-muted">{item.hint}</span>}
        </button>
      ))}
    </div>
  );
}

function Tool({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" title={label} onClick={onClick} className="flex h-11 shrink-0 items-center gap-1.5 px-2 text-xs text-fg hover:bg-raised">
      {children}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function Toolbar(props: {
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onAdd: () => void;
  onFolder: () => void;
  onMkdir: () => void;
  onExtract: () => void;
  onDelete: () => void;
  onWrite: () => void;
  onBoot: () => void;
  onMount: () => void;
  onHash: () => void;
  onProps: () => void;
}) {
  const icon = "size-4 text-accent";
  return (
    <div className="flex h-12 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-line bg-surface px-1">
      <Tool label="Создать" onClick={props.onNew}>
        <FilePlus className={icon} />
      </Tool>
      <Tool label="Открыть" onClick={props.onOpen}>
        <FolderOpen className={icon} />
      </Tool>
      <Tool label="Сохранить" onClick={props.onSave}>
        <Save className={icon} />
      </Tool>
      <span className="mx-1 h-6 w-px shrink-0 bg-line" />
      <Tool label="Добавить" onClick={props.onAdd}>
        <FolderUp className={icon} />
      </Tool>
      <Tool label="Папка" onClick={props.onFolder}>
        <HardDrive className={icon} />
      </Tool>
      <Tool label="Новая" onClick={props.onMkdir}>
        <FolderPlus className={icon} />
      </Tool>
      <Tool label="Извлечь" onClick={props.onExtract}>
        <Disc className={icon} />
      </Tool>
      <Tool label="Удалить" onClick={props.onDelete}>
        <Trash2 className={icon} />
      </Tool>
      <span className="mx-1 h-6 w-px shrink-0 bg-line" />
      <Tool label="На USB" onClick={props.onWrite}>
        <Usb className={icon} />
      </Tool>
      <Tool label="Загрузка" onClick={props.onBoot}>
        <Shield className={icon} />
      </Tool>
      <Tool label="Монтировать" onClick={props.onMount}>
        <Disc className={icon} />
      </Tool>
      <Tool label="Суммы" onClick={props.onHash}>
        <Hash className={icon} />
      </Tool>
      <Tool label="Свойства" onClick={props.onProps}>
        <span className="font-mono text-xs text-accent">FS</span>
      </Tool>
    </div>
  );
}

function StatusBar() {
  const nodes = useStudio((s) => s.nodes);
  const active = useStudio((s) => s.active);
  const imageDir = useStudio((s) => s.imageDir);
  const pcDir = useStudio((s) => s.pcDir);
  const media = useStudio((s) => s.media);
  const setMedia = useStudio((s) => s.setMedia);
  const dir = active === "image" ? imageDir : pcDir;
  const folder = nodes[dir];
  const path = folder ? pathOf(nodes, dir) : "\\";
  const count = folder ? countEntries(nodes, dir) : 0;
  const used = payloadBytes(nodes, IMAGE_ROOT);
  const cap = mediaById(media).bytes;
  const over = used > cap;
  const pct = cap > 0 ? Math.min(100, (used / cap) * 100) : 0;
  return (
    <footer className="flex h-14 shrink-0 items-center gap-2 border-t border-line bg-raised px-2 md:h-12 md:gap-3 md:px-3">
      <p className="min-w-0 flex-1 truncate font-mono text-xs">
        <span className="text-fg">{path}</span>
        <span className="text-muted"> · {count}</span>
      </p>
      <div className="w-28 shrink-0 md:w-52" title={`${formatBytes(used)} из ${formatBytes(cap)}`}>
        <div className="h-2 overflow-hidden bg-inset">
          <div className={`h-full ${over ? "bg-danger" : "bg-ok"}`} style={{ width: `${pct}%` }} />
        </div>
        <p className={`mt-0.5 truncate text-right font-mono text-xs ${over ? "text-danger" : "text-muted"}`}>
          {over ? "не влезет · " : ""}
          {formatBytes(used)}
        </p>
      </div>
      <label className="sr-only" htmlFor="media">
        Целевой носитель
      </label>
      <select
        id="media"
        className="h-9 max-w-36 shrink-0 border border-line bg-inset px-2 text-xs text-fg"
        value={media}
        onChange={(event) => setMedia(event.target.value as MediaId)}
      >
        {MEDIA.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
    </footer>
  );
}

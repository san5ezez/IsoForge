import { useState } from "react";
import { ChevronDown, ChevronRight, Disc, File, Folder, HardDrive, Usb } from "lucide-react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { formatBytes, formatWhen } from "@/lib/format";
import { useStudio, type DragPayload } from "@/lib/model/store";
import { childrenOf, isUnder } from "@/lib/model/tree";
import { IMAGE_ROOT, PC_ROOT, type FsNode, type Pane } from "@/lib/model/types";

function glyph(node: FsNode) {
  const className = "size-4 shrink-0 text-accent";
  if (node.kind === "drive") {
    if (node.driveKind === "removable") return <Usb className={className} />;
    if (node.driveKind === "optical") return <Disc className={className} />;
    return <HardDrive className={className} />;
  }
  if (node.kind !== "file") return <Folder className={className} />;
  return <File className="size-4 shrink-0 text-muted" />;
}

function flags(node: FsNode) {
  const items = [
    ["H", node.attrs.hidden],
    ["S", node.attrs.system],
    ["A", node.attrs.archive],
    ["R", node.attrs.readonly],
  ] as const;
  return (
    <span className="font-mono text-xs tracking-wide">
      {items.map(([letter, on]) => (
        <span key={letter} className={on ? "text-fg" : "text-line"}>
          {letter}
        </span>
      ))}
    </span>
  );
}

export function Workspace() {
  return (
    <div className="min-h-0 flex-1">
      <div className="hidden h-full md:block">
        <Group orientation="vertical" className="h-full">
          <Panel defaultSize="52%" minSize="22%" className="min-h-0">
            <Group orientation="horizontal" className="h-full">
              <Panel defaultSize="30%" minSize="16%" className="min-h-0">
                <Tree pane="image" />
              </Panel>
              <Separator className="w-1.5 bg-line transition-colors hover:bg-accent" />
              <Panel minSize="24%" className="min-h-0">
                <Listing pane="image" />
              </Panel>
            </Group>
          </Panel>
          <Separator className="h-1.5 bg-line transition-colors hover:bg-accent" />
          <Panel minSize="22%" className="min-h-0">
            <Group orientation="horizontal" className="h-full">
              <Panel defaultSize="30%" minSize="16%" className="min-h-0">
                <Tree pane="pc" />
              </Panel>
              <Separator className="w-1.5 bg-line transition-colors hover:bg-accent" />
              <Panel minSize="24%" className="min-h-0">
                <Listing pane="pc" />
              </Panel>
            </Group>
          </Panel>
        </Group>
      </div>
      <MobileWorkspace />
    </div>
  );
}

function MobileWorkspace() {
  const active = useStudio((s) => s.active);
  const setActive = useStudio((s) => s.setActive);
  return (
    <div className="flex h-full min-h-0 flex-col md:hidden">
      <div className="grid grid-cols-2 border-b border-line">
        <button
          className={`h-11 text-sm font-medium ${active === "image" ? "bg-accent text-on-accent" : "bg-surface text-muted"}`}
          onClick={() => setActive("image")}
        >
          Образ
        </button>
        <button
          className={`h-11 text-sm font-medium ${active === "pc" ? "bg-accent text-on-accent" : "bg-surface text-muted"}`}
          onClick={() => setActive("pc")}
        >
          Компьютер
        </button>
      </div>
      <div className="grid min-h-0 flex-1 grid-rows-2">
        <Tree pane={active} />
        <Listing pane={active} />
      </div>
    </div>
  );
}

function Tree({ pane }: { pane: Pane }) {
  const nodes = useStudio((s) => s.nodes);
  const current = useStudio((s) => (pane === "image" ? s.imageDir : s.pcDir));
  const openDir = useStudio((s) => s.openDir);
  const setActive = useStudio((s) => s.setActive);
  const drop = useStudio((s) => s.drop);
  const root = pane === "image" ? IMAGE_ROOT : PC_ROOT;
  const [open, setOpen] = useState<Record<string, boolean>>({
    [IMAGE_ROOT]: true,
    [PC_ROOT]: true,
    "drv-c": true,
    "c-users": true,
    "img-docs": true,
    "img-bootdir": true,
  });
  const [over, setOver] = useState<string | null>(null);

  const renderNode = (id: string, depth: number) => {
    const node = nodes[id];
    if (!node) return null;
    const kids = childrenOf(nodes, id).filter((child) => child.kind !== "file");
    const expanded = open[id] ?? isUnder(nodes, current, id);
    return (
      <div key={id}>
        <button
          className={`flex min-h-11 w-full items-center gap-1 pr-2 text-left text-sm md:min-h-8 ${
            current === id ? "bg-accent/20 text-fg" : "text-fg hover:bg-raised"
          } ${over === id ? "outline outline-1 outline-accent" : ""}`}
          style={{ paddingLeft: `${8 + depth * 14}px` }}
          onClick={() => {
            setActive(pane);
            openDir(pane, id);
            if (kids.length) setOpen((state) => ({ ...state, [id]: !expanded }));
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setOver(id);
          }}
          onDragLeave={() => setOver((value) => (value === id ? null : value))}
          onDrop={(event) => {
            event.preventDefault();
            setOver(null);
            drop(pane, id);
          }}
        >
          {kids.length ? (
            expanded ? <ChevronDown className="size-3.5 text-muted" /> : <ChevronRight className="size-3.5 text-muted" />
          ) : (
            <span className="inline-block size-3.5" />
          )}
          {glyph(node)}
          <span className="truncate">{node.name}</span>
        </button>
        {expanded && kids.map((child) => renderNode(child.id, depth + 1))}
      </div>
    );
  };

  return (
    <section className="flex h-full min-h-0 flex-col bg-inset" onMouseDown={() => setActive(pane)}>
      <header className="flex h-9 shrink-0 items-center border-b border-line bg-raised px-3 text-xs font-medium tracking-wide text-muted uppercase">
        {pane === "image" ? "Дерево образа" : "Дерево компьютера"}
      </header>
      <div className="min-h-0 flex-1 overflow-auto py-1">{renderNode(root, 0)}</div>
    </section>
  );
}

function Listing({ pane }: { pane: Pane }) {
  const nodes = useStudio((s) => s.nodes);
  const dir = useStudio((s) => (pane === "image" ? s.imageDir : s.pcDir));
  const selection = useStudio((s) => (pane === "image" ? s.imageSelection : s.pcSelection));
  const select = useStudio((s) => s.select);
  const openDir = useStudio((s) => s.openDir);
  const setActive = useStudio((s) => s.setActive);
  const setDragging = useStudio((s) => s.setDragging);
  const drop = useStudio((s) => s.drop);
  const addExternal = useStudio((s) => s.addExternal);
  const extract = useStudio((s) => s.extract);
  const setDialog = useStudio((s) => s.setDialog);
  const downloadSelected = useStudio((s) => s.downloadSelected);
  const allowMenu = useStudio((s) => s.options.contextMenu);
  const [over, setOver] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const rows = childrenOf(nodes, dir);
  const folder = nodes[dir];

  const onDragStart = (node: FsNode) => (event: React.DragEvent) => {
    if (node.kind === "drive") {
      event.preventDefault();
      return;
    }
    const ids = selection.includes(node.id) ? selection : [node.id];
    const payload: DragPayload = { from: pane, ids };
    setDragging(payload);
    event.dataTransfer.setData("application/x-arca", JSON.stringify(payload));
    event.dataTransfer.effectAllowed = "copyMove";
    if (!selection.includes(node.id)) select(pane, node.id, "set");
  };

  return (
    <section
      className={`flex h-full min-h-0 flex-col bg-inset ${over ? "outline outline-1 outline-accent" : ""}`}
      onMouseDown={() => {
        setActive(pane);
        setMenu(null);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        if (event.dataTransfer.files?.length) {
          addExternal(event.dataTransfer.files, pane);
          return;
        }
        drop(pane, dir);
      }}
    >
      <header className="flex h-9 shrink-0 items-center gap-2 border-b border-line bg-raised px-3">
        <span className="truncate text-xs font-medium text-muted">
          {pane === "image" ? "Содержимое образа" : "Локальные файлы"}
        </span>
        <span className="truncate font-mono text-xs text-fg">{folder?.name}</span>
      </header>
      <div className="grid grid-cols-[1fr_5.5rem_8.5rem_3.2rem] gap-2 border-b border-line px-2 py-1 text-xs text-muted max-md:grid-cols-[1fr_5rem]">
        <span>Имя</span>
        <span className="text-right">Размер</span>
        <span className="max-md:hidden">Изменён</span>
        <span className="max-md:hidden">Атр.</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {rows.length === 0 && (
          <p className="px-3 py-6 text-sm text-pretty text-muted">
            {pane === "image"
              ? "Образ пуст. Перетащите файлы из нижнего окна или нажмите «Добавить»."
              : "Папка пуста. Импортируйте файлы с вашего компьютера кнопкой на панели."}
          </p>
        )}
        {rows.map((node) => {
          const selected = selection.includes(node.id);
          return (
            <button
              key={node.id}
              draggable={node.kind !== "drive"}
              onDragStart={onDragStart(node)}
              onDragEnd={() => setDragging(null)}
              onClick={(event) => {
                const mode = event.shiftKey ? "range" : event.metaKey || event.ctrlKey ? "toggle" : "set";
                select(pane, node.id, mode);
              }}
              onDoubleClick={() => {
                if (node.kind !== "file") openDir(pane, node.id);
                else if (pane === "pc") {
                  select("pc", node.id, "set");
                  const drag: DragPayload = { from: "pc", ids: [node.id] };
                  setDragging(drag);
                  drop("image", useStudio.getState().imageDir);
                } else void showText(node);
              }}
              onContextMenu={(event) => {
                if (!allowMenu) return;
                event.preventDefault();
                if (!selection.includes(node.id)) select(pane, node.id, "set");
                setMenu({ x: event.clientX, y: event.clientY, id: node.id });
              }}
              className={`grid w-full grid-cols-[1fr_5.5rem_8.5rem_3.2rem] items-center gap-2 px-2 text-left text-sm max-md:grid-cols-[1fr_5rem] ${
                selected ? "bg-accent/25 text-fg" : "hover:bg-raised"
              } ${node.attrs.hidden ? "opacity-55" : ""} min-h-11 md:min-h-8`}
            >
              <span className="flex min-w-0 items-center gap-2">
                {glyph(node)}
                <span className="truncate">{node.name}</span>
                {node.boot && <span className="shrink-0 text-xs font-medium text-accent">BOOT</span>}
              </span>
              <span className="text-right font-mono text-xs tabular-nums text-muted">
                {node.kind === "file" ? formatBytes(node.size) : node.capacity ? formatBytes(node.capacity) : ""}
              </span>
              <span className="truncate font-mono text-xs text-muted max-md:hidden">{formatWhen(node.mtime)}</span>
              <span className="max-md:hidden">{node.kind === "file" ? flags(node) : null}</span>
            </button>
          );
        })}
      </div>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          pane={pane}
          onClose={() => setMenu(null)}
          onOpen={() => {
            const node = nodes[menu.id];
            if (node && node.kind !== "file") openDir(pane, node.id);
            else if (node) void showText(node);
          }}
          onExtract={() => extract()}
          onDownload={() => downloadSelected()}
          onRename={() => setDialog({ type: "rename" })}
          onAttrs={() => setDialog({ type: "attrs" })}
          onDelete={() => useStudio.getState().removeSelected()}
          onChecksum={() => void useStudio.getState().checksumSelected()}
        />
      )}
    </section>
  );
}

async function showText(node: FsNode) {
  if (!node.blob || node.size > 200_000) {
    void useStudio.getState().checksumSelected();
    return;
  }
  const text = await node.blob.text();
  const printable = /^[\s\S]*$/.test(text) && !text.includes("\u0000");
  if (!printable) {
    void useStudio.getState().checksumSelected();
    return;
  }
  useStudio.getState().setDialog({ type: "text", title: node.name, body: text.slice(0, 8000) });
}

function ContextMenu({
  x,
  y,
  pane,
  onClose,
  onOpen,
  onExtract,
  onDownload,
  onRename,
  onAttrs,
  onDelete,
  onChecksum,
}: {
  x: number;
  y: number;
  pane: Pane;
  onClose: () => void;
  onOpen: () => void;
  onExtract: () => void;
  onDownload: () => void;
  onRename: () => void;
  onAttrs: () => void;
  onDelete: () => void;
  onChecksum: () => void;
}) {
  const addToImage = () => {
    const state = useStudio.getState();
    state.setDragging({ from: "pc", ids: state.pcSelection });
    state.drop("image", state.imageDir);
  };
  const items: { label: string; run: () => void }[] = [
    { label: "Открыть", run: onOpen },
    pane === "image"
      ? { label: "Извлечь на компьютер", run: onExtract }
      : { label: "Добавить в образ", run: addToImage },
    { label: "Скачать", run: onDownload },
    { label: "Переименовать", run: onRename },
    { label: "Атрибуты", run: onAttrs },
    { label: "Контрольная сумма", run: onChecksum },
    { label: "Удалить", run: onDelete },
  ];
  return (
    <>
      <button className="fixed inset-0 z-30 cursor-default" aria-label="Закрыть меню" onClick={onClose} />
      <div
        role="menu"
        className="fixed z-40 min-w-52 border border-line bg-raised py-1 shadow-lg"
        style={{ left: Math.min(x, window.innerWidth - 220), top: Math.min(y, window.innerHeight - 280) }}
      >
        {items.map((item) => (
          <button
            key={item.label}
            role="menuitem"
            className="block h-11 w-full px-3 text-left text-sm hover:bg-accent/20 md:h-9"
            onClick={() => {
              onClose();
              item.run();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </>
  );
}

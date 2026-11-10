import type { FsNode, NodeId } from "./types";

export function childrenOf(nodes: Record<NodeId, FsNode>, id: NodeId): FsNode[] {
  const list = Object.values(nodes).filter((node) => node.parentId === id);
  list.sort((a, b) => {
    const rank = (node: FsNode) => (node.kind === "file" ? 1 : 0);
    const byKind = rank(a) - rank(b);
    if (byKind) return byKind;
    return a.name.localeCompare(b.name, "ru", { sensitivity: "base" });
  });
  return list;
}

export function pathOf(nodes: Record<NodeId, FsNode>, id: NodeId): string {
  const parts: string[] = [];
  let cursor: FsNode | undefined = nodes[id];
  while (cursor?.parentId) {
    parts.push(cursor.name);
    cursor = nodes[cursor.parentId];
  }
  return `\\${parts.reverse().join("\\")}` || "\\";
}

export function ancestorDrive(nodes: Record<NodeId, FsNode>, id: NodeId): FsNode | null {
  let cursor: FsNode | undefined = nodes[id];
  while (cursor) {
    if (cursor.kind === "drive") return cursor;
    cursor = cursor.parentId ? nodes[cursor.parentId] : undefined;
  }
  return null;
}

export function isProtected(nodes: Record<NodeId, FsNode>, id: NodeId): boolean {
  const drive = ancestorDrive(nodes, id);
  return !!drive && (drive.driveKind === "optical" || drive.driveKind === "virtual");
}

export function descendantIds(nodes: Record<NodeId, FsNode>, id: NodeId): NodeId[] {
  const out: NodeId[] = [];
  const walk = (current: NodeId) => {
    for (const child of childrenOf(nodes, current)) {
      out.push(child.id);
      walk(child.id);
    }
  };
  walk(id);
  return out;
}

export function isUnder(nodes: Record<NodeId, FsNode>, id: NodeId, ancestor: NodeId): boolean {
  let cursor: FsNode | undefined = nodes[id];
  while (cursor) {
    if (cursor.id === ancestor) return true;
    cursor = cursor.parentId ? nodes[cursor.parentId] : undefined;
  }
  return false;
}

export function payloadBytes(nodes: Record<NodeId, FsNode>, rootId: NodeId): number {
  let total = 0;
  let files = 0;
  const walk = (id: NodeId) => {
    for (const child of childrenOf(nodes, id)) {
      if (child.kind === "file") {
        total += child.size;
        files += 1;
      } else walk(child.id);
    }
  };
  walk(rootId);
  const overhead = 256 * 1024 + files * 2048;
  return total + (files || childrenOf(nodes, rootId).length ? overhead : 0);
}

export function uniqueName(nodes: Record<NodeId, FsNode>, parentId: NodeId, name: string, ignore?: NodeId): string {
  const taken = new Set(
    childrenOf(nodes, parentId)
      .filter((node) => node.id !== ignore)
      .map((node) => node.name.toLocaleLowerCase("ru")),
  );
  if (!taken.has(name.toLocaleLowerCase("ru"))) return name;
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let n = 2;
  let next = `${stem} (${n})${ext}`;
  while (taken.has(next.toLocaleLowerCase("ru"))) {
    n += 1;
    next = `${stem} (${n})${ext}`;
  }
  return next;
}

export function countEntries(nodes: Record<NodeId, FsNode>, id: NodeId): number {
  return childrenOf(nodes, id).length;
}

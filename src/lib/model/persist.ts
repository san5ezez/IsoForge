import type { MediaId } from "@/lib/format";
import type { AppOptions, FsNode, ProjectMeta } from "./types";

const DB_NAME = "arca-studio";

type Snapshot = {
  project: ProjectMeta;
  media: MediaId;
  options: AppOptions;
  imageDir: string;
  pcDir: string;
  nodes: FsNode[];
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
      if (!db.objectStoreNames.contains("blobs")) db.createObjectStore("blobs");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function bare(node: FsNode): FsNode {
  const copy = { ...node };
  delete copy.blob;
  return copy;
}

export async function loadStudio(): Promise<Pick<
  Snapshot,
  "project" | "media" | "options" | "imageDir" | "pcDir"
> & { nodes: Record<string, FsNode> } | null> {
  if (typeof indexedDB === "undefined") return null;
  try {
    const db = await openDb();
    const saved = await new Promise<Snapshot | undefined>((resolve, reject) => {
      const tx = db.transaction("kv", "readonly");
      const req = tx.objectStore("kv").get("state");
      req.onsuccess = () => resolve(req.result as Snapshot | undefined);
      req.onerror = () => reject(req.error);
    });
    if (!saved?.nodes?.length) {
      db.close();
      return null;
    }
    const nodes: Record<string, FsNode> = {};
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("blobs", "readonly");
      const store = tx.objectStore("blobs");
      let pending = saved.nodes.length;
      if (!pending) {
        resolve();
        return;
      }
      for (const node of saved.nodes) {
        const req = store.get(node.id);
        req.onsuccess = () => {
          const blob = req.result as Blob | undefined;
          nodes[node.id] = blob ? { ...node, blob, size: node.size || blob.size } : { ...node };
          pending -= 1;
          if (pending === 0) resolve();
        };
        req.onerror = () => reject(req.error);
      }
    });
    db.close();
    return { ...saved, nodes };
  } catch {
    return null;
  }
}

let timer: ReturnType<typeof setTimeout> | undefined;

export function scheduleSave(snapshot: Snapshot): void {
  if (typeof indexedDB === "undefined") return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    void saveNow(snapshot);
  }, 350);
}

async function saveNow(snapshot: Snapshot): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["kv", "blobs"], "readwrite");
      tx.objectStore("kv").put(
        { ...snapshot, nodes: snapshot.nodes.map(bare) },
        "state",
      );
      const blobs = tx.objectStore("blobs");
      blobs.clear();
      for (const node of snapshot.nodes) {
        if (node.blob) blobs.put(node.blob, node.id);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // The project can still be saved as an ISO if the browser storage is full.
  }
}

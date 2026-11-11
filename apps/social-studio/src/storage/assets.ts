import { sha256Hex } from '../projectFile/projectFile';

const HEAD_TAIL = 4 * 1024 * 1024;

/** Asset-ID für Videos: SHA-256 über die ersten und letzten 4 MB plus Grösse (8 Byte), damit 500-MB-Dateien nicht ganz gelesen werden. */
export async function videoAssetId(blob: Blob): Promise<string> {
  const size = new Uint8Array(8);
  new DataView(size.buffer).setBigUint64(0, BigInt(blob.size));
  const head = new Uint8Array(await blob.slice(0, HEAD_TAIL).arrayBuffer());
  const tail = new Uint8Array(await blob.slice(Math.max(HEAD_TAIL, blob.size - HEAD_TAIL)).arrayBuffer());
  const all = new Uint8Array(head.length + tail.length + 8);
  all.set(head, 0);
  all.set(tail, head.length);
  all.set(size, head.length + tail.length);
  return sha256Hex(all);
}

export class StorageFullError extends Error {
  constructor() {
    super('Speicher voll. Sichere ältere Projekte als Datei und lösche sie hier.');
    this.name = 'StorageFullError';
  }
}

export interface AssetStore {
  /** `id` nur für Videos (Kopf/Ende-Hash, `videoAssetId`); sonst SHA-256 über den ganzen Blob. */
  put(blob: Blob, id?: string): Promise<string>;
  get(id: string): Promise<Blob>;
  delete(id: string): Promise<void>;
  list(): Promise<{ id: string; lastModified: number }[]>;
}

export function toStorageError(e: unknown): unknown {
  return e instanceof Error && e.name === 'QuotaExceededError' ? new StorageFullError() : e;
}

export function memoryAssetStore(clock: () => number = () => Date.now()): AssetStore {
  const m = new Map<string, { blob: Blob; lastModified: number }>();
  return {
    async put(blob, given) {
      const id = given ?? (await sha256Hex(blob));
      m.set(id, { blob: m.get(id)?.blob ?? blob, lastModified: clock() });
      return id;
    },
    async get(id) {
      const e = m.get(id);
      if (!e) throw new Error(`Asset ${id} nicht gefunden`);
      return e.blob;
    },
    async delete(id) {
      m.delete(id);
    },
    async list() {
      return [...m].map(([id, e]) => ({ id, lastModified: e.lastModified }));
    },
  };
}

/** Dateiname = SHA-256-Hex im OPFS-Ordner `social-studio-assets`. Echtes OPFS nur per e2e testbar. */
export function opfsAssetStore(): AssetStore {
  const dir = async () => (await navigator.storage.getDirectory()).getDirectoryHandle('social-studio-assets', { create: true });
  return {
    async put(blob, given) {
      const id = given ?? (await sha256Hex(blob));
      const d = await dir();
      let valid = false;
      try {
        valid = (await (await d.getFileHandle(id)).getFile()).size === blob.size;
      } catch (e) {
        if ((e as Error).name !== 'NotFoundError') throw e;
      }
      // Immer (neu) schreiben: frischt lastModified auf, das schützt vor GC.
      let w: FileSystemWritableFileStream | undefined;
      try {
        w = await (await d.getFileHandle(id, { create: true })).createWritable();
        await w.write(blob);
        await w.close();
      } catch (e) {
        await w?.abort().catch(() => {});
        // Teildatei nicht stehen lassen, gültige Datei behalten (auch eine, die inzwischen ein paralleles `put` geschrieben hat)
        const nowValid = valid || (await d.getFileHandle(id).then((h) => h.getFile()).then((f) => f.size === blob.size, () => false));
        if (!nowValid) await d.removeEntry(id).catch(() => {});
        throw toStorageError(e);
      }
      return id;
    },
    async get(id) {
      try {
        return await (await (await dir()).getFileHandle(id)).getFile();
      } catch (e) {
        if ((e as Error).name === 'NotFoundError') throw new Error(`Asset ${id} nicht gefunden`);
        throw e;
      }
    },
    async delete(id) {
      await (await dir()).removeEntry(id).catch((e) => {
        if (e.name !== 'NotFoundError') throw e;
      });
    },
    async list() {
      const out: { id: string; lastModified: number }[] = [];
      for await (const [name, h] of (await dir()).entries()) {
        // Swap-/Temp-Dateien ignorieren
        if (h.kind === 'file' && /^[0-9a-f]{64}$/.test(name)) {
          out.push({ id: name, lastModified: (await (h as FileSystemFileHandle).getFile()).lastModified });
        }
      }
      return out;
    },
  };
}

import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { project } from '../model/fixtures';
import type { Project } from '../model/types';
import { sha256Hex } from '../projectFile/projectFile';
import { StorageFullError, memoryAssetStore, opfsAssetStore, toStorageError, videoAssetId } from './assets';
import { deleteProject, listProjects, loadProject, saveProject } from './db';
import { GC_MIN_AGE_MS, collectGarbage } from './gc';

const meta = { mime: 'image/png', width: 1, height: 1, name: 'a.png' };
const withAssets = (id: string, updatedAt: number, hashes: string[]): Project => ({
  ...project(1),
  id,
  updatedAt,
  assets: Object.fromEntries(hashes.map((h) => [h, meta])),
});
const blob = (s: string) => new Blob([s]);

beforeEach(async () => {
  await Dexie.delete('social-studio');
});

describe('Projekte', () => {
  it('listProjects sortiert nach updatedAt absteigend', async () => {
    await saveProject(withAssets('a', 1, []));
    await saveProject(withAssets('b', 3, []));
    await saveProject(withAssets('c', 2, []));
    expect((await listProjects()).map((p) => p.id)).toEqual(['b', 'c', 'a']);
    expect((await listProjects())[0]).toEqual({ id: 'b', name: 'p', formatId: 'post', updatedAt: 3 });
  });

  it('save/load/delete', async () => {
    const p = withAssets('a', 1, []);
    await saveProject(p);
    expect(await loadProject('a')).toEqual(p);
    await deleteProject('a');
    expect(await loadProject('a')).toBeUndefined();
  });
});

describe('Assets', () => {
  it('put ist idempotent und liefert den Hash', async () => {
    const store = memoryAssetStore();
    const id = await store.put(blob('x'));
    expect(id).toBe(await sha256Hex(blob('x')));
    expect(await store.put(blob('x'))).toBe(id);
    expect((await store.list()).map((a) => a.id)).toEqual([id]);
    expect(await (await store.get(id)).text()).toBe('x');
  });

  it('put mit vorgegebener ID speichert unter dieser ID', async () => {
    const store = memoryAssetStore();
    expect(await store.put(blob('v'), 'f'.repeat(64))).toBe('f'.repeat(64));
    expect(await (await store.get('f'.repeat(64))).text()).toBe('v');
  });

  it('get auf fehlendes Asset wirft', async () => {
    await expect(memoryAssetStore().get('nope')).rejects.toThrow(/nope/);
  });

  it('QuotaExceededError wird zu StorageFullError', () => {
    const q = new DOMException('full', 'QuotaExceededError');
    expect(toStorageError(q)).toBeInstanceOf(StorageFullError);
    expect((toStorageError(q) as Error).message).toBe(
      'Speicher voll. Sichere ältere Projekte als Datei und lösche sie hier.',
    );
    const other = new Error('x');
    expect(toStorageError(other)).toBe(other);
  });
});

describe('collectGarbage', () => {
  const T = 10_000_000;
  const old = () => T - GC_MIN_AGE_MS - 1;

  it('behält Assets, die noch ein Projekt nutzt', async () => {
    const store = memoryAssetStore(old);
    const h1 = await store.put(blob('1'));
    const h2 = await store.put(blob('2'));
    await saveProject(withAssets('A', 1, [h1]));
    await saveProject(withAssets('B', 2, [h1, h2]));
    expect(await collectGarbage(store, T)).toBe(0);
    await deleteProject('B');
    expect(await collectGarbage(store, T)).toBe(1);
    expect((await store.list()).map((a) => a.id)).toEqual([h1]);
  });

  it('verschont frische Waisen, löscht alte', async () => {
    let t = old();
    const store = memoryAssetStore(() => t);
    const oldId = await store.put(blob('old'));
    t = T;
    const freshId = await store.put(blob('fresh'));
    expect(await collectGarbage(store, T)).toBe(1);
    expect((await store.list()).map((a) => a.id)).toEqual([freshId]);
    expect(oldId).not.toBe(freshId);
  });

  it('put auf bestehende ID frischt den Zeitstempel auf', async () => {
    let t = old();
    const store = memoryAssetStore(() => t);
    await store.put(blob('x'));
    t = T;
    await store.put(blob('x'));
    expect(await collectGarbage(store, T)).toBe(0);
  });
});

describe('videoAssetId', () => {
  const mk = (n: number, tail = 0) => {
    const b = new Uint8Array(n).map((_, i) => (i * 7) % 251);
    if (n) b[n - 1] = tail;
    return new Blob([b]);
  };
  const size = 10 * 1024 * 1024;
  it('gleich für gleiche Datei, verschieden bei geändertem Ende oder Grösse', async () => {
    const a = await videoAssetId(mk(size, 1));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await videoAssetId(mk(size, 1))).toBe(a);
    expect(await videoAssetId(mk(size, 2))).not.toBe(a);
    expect(await videoAssetId(mk(size + 1, 1))).not.toBe(a);
  });
});

describe('collectGarbage und Undo', () => {
  const T = 10_000_000;
  const old = () => T - GC_MIN_AGE_MS - 1;

  it('Maske, die nur Undo/Redo noch braucht (`keep`), überlebt die Schonfrist, ohne den Schutz nicht', async () => {
    const store = memoryAssetStore(old);
    const kept = await store.put(blob('maske alt'));
    const lost = await store.put(blob('maske verwaist'));
    await saveProject(withAssets('A', 1, []), [kept]);
    expect(await collectGarbage(store, T)).toBe(1);
    expect((await store.list()).map((a) => a.id)).toEqual([kept]);
    await saveProject(withAssets('A', 2, [])); // Speichern ohne Schutz (Editor verlassen): jetzt frei
    expect(await collectGarbage(store, T)).toBe(1);
    expect(lost).not.toBe(kept);
  });
});

describe('OPFS-Namensraum', () => {
  // Fake-OPFS: Ordner sind Maps von Dateiname auf Datei, mehr braucht opfsAssetStore nicht.
  const root = new Map<string, Map<string, File>>();
  let writes = 0;
  const dirHandle = (files: Map<string, File>) => ({
    getFileHandle: async (name: string, opts?: { create?: boolean }) => {
      if (!files.has(name)) {
        if (!opts?.create) throw new DOMException('fehlt', 'NotFoundError');
        files.set(name, new File([], name));
      }
      return {
        kind: 'file',
        getFile: async () => files.get(name)!,
        createWritable: async () => {
          writes++;
          return { write: async (b: Blob) => void files.set(name, new File([b], name, { lastModified: Date.now() })), close: async () => {}, abort: async () => {} };
        },
      };
    },
    removeEntry: async (name: string) => void files.delete(name),
    entries: async function* () {
      for (const [name, f] of files) yield [name, { kind: 'file', getFile: async () => f }];
    },
  });
  beforeEach(() => {
    root.clear();
    writes = 0;
    vi.stubGlobal('navigator', {
      storage: {
        getDirectory: async () => ({
          getDirectoryHandle: async (name: string) => {
            if (!root.has(name)) root.set(name, new Map());
            return dirHandle(root.get(name)!);
          },
        }),
      },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('Aufräumen löscht nur im eigenen Ordner, nichts in «news-banner»', async () => {
    const hash = (c: string) => c.repeat(64);
    const oldFile = () => new File(['x'], 'x', { lastModified: 0 });
    root.set('social-studio-assets', new Map([[hash('a'), oldFile()]]));
    root.set('news-banner', new Map([[hash('b'), oldFile()]]));
    expect(await collectGarbage(opfsAssetStore(), GC_MIN_AGE_MS + 1)).toBe(1);
    expect([...root.get('social-studio-assets')!.keys()]).toEqual([]);
    expect([...root.get('news-banner')!.keys()]).toEqual([hash('b')]);
  });

  it('put schreibt dieselbe Datei nur einmal und schützt sie trotzdem vor der Bereinigung', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(1_000_000);
      const store = opfsAssetStore();
      await store.put(blob('video'));
      vi.setSystemTime(1_000_000 + 9 * 60_000);
      await store.put(blob('video'));
      expect(writes).toBe(1);
      expect(await collectGarbage(store, 1_000_000 + 11 * 60_000)).toBe(0);
      expect(await collectGarbage(store, 1_000_000 + 20 * 60_000)).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('Datei gleicher ID, aber anderer Grösse wird neu geschrieben', async () => {
    const store = opfsAssetStore();
    const id = await store.put(blob('video'));
    root.get('social-studio-assets')!.set(id, new File(['vi'], id));
    await store.put(blob('video'));
    expect(writes).toBe(2);
    expect((await store.get(id)).size).toBe(5);
  });
});

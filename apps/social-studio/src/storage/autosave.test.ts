import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { project } from '../model/fixtures';
import { memoryAssetStore } from './assets';
import { GC_MIN_AGE_MS, collectGarbage } from './gc';
import { apply, load, undo } from '../store/document';
import { useUi } from '../store/ui';
import { startAutosave } from './autosave';
import * as dbModule from './db';
import { db, loadProject } from './db';

let stop: () => void;
let target: EventTarget;

beforeEach(async () => {
  await db.projects.clear();
  useUi.getState().setNotice(null);
  load({ ...project(1), id: 'auto', name: 'Start' });
  target = new EventTarget();
  stop = startAutosave(target);
});
afterEach(() => {
  stop();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('startAutosave', () => {
  it('speichert nach 500 ms einmal', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const spy = vi.spyOn(dbModule, 'saveProject');
    apply((d) => { d.name = 'a'; });
    apply((d) => { d.name = 'b'; });
    vi.advanceTimersByTime(499);
    expect(spy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(spy).toHaveBeenCalledTimes(1);
    await spy.mock.results[0]!.value;
    expect((await loadProject('auto'))?.name).toBe('b');
  });

  it('speichert bei pagehide sofort und synchron angestossen', async () => {
    const spy = vi.spyOn(dbModule, 'saveProject');
    apply((d) => { d.name = 'p'; });
    target.dispatchEvent(new Event('pagehide'));
    expect(spy).toHaveBeenCalledTimes(1);
    await spy.mock.results[0]!.value;
    expect((await loadProject('auto'))?.name).toBe('p');
  });

  it('visibilitychange ohne document (Node) speichert nicht, ohne Änderung nichts', () => {
    const spy = vi.spyOn(dbModule, 'saveProject');
    target.dispatchEvent(new Event('visibilitychange'));
    target.dispatchEvent(new Event('pagehide'));
    expect(spy).not.toHaveBeenCalled();
  });

  it('Fehler beim Speichern zeigt Hinweis und versucht es bei der nächsten Änderung neu', async () => {
    const spy = vi.spyOn(dbModule, 'saveProject').mockRejectedValueOnce(new Error('voll'));
    apply((d) => { d.name = 'x'; });
    target.dispatchEvent(new Event('pagehide'));
    await vi.waitFor(() => expect(useUi.getState().notice?.kind).toBe('error'));
    expect(useUi.getState().notice?.text).toBe('Speichern hat nicht geklappt. Sichere dein Projekt als Datei.');
    apply((d) => { d.name = 'y'; });
    target.dispatchEvent(new Event('pagehide'));
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('Abmelden stoppt das Speichern', () => {
    const spy = vi.spyOn(dbModule, 'saveProject');
    stop();
    apply((d) => { d.name = 'z'; });
    target.dispatchEvent(new Event('pagehide'));
    expect(spy).not.toHaveBeenCalled();
  });

  it('visibilitychange hidden speichert sofort', () => {
    vi.stubGlobal('document', { visibilityState: 'hidden' });
    const spy = vi.spyOn(dbModule, 'saveProject');
    apply((d) => { d.name = 'v'; });
    target.dispatchEvent(new Event('visibilitychange'));
    expect(spy).toHaveBeenCalledTimes(1);
    vi.stubGlobal('document', { visibilityState: 'visible' });
    apply((d) => { d.name = 'v2'; });
    target.dispatchEvent(new Event('visibilitychange'));
    expect(spy).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('pagehide-Flush bricht den Timer ab', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const spy = vi.spyOn(dbModule, 'saveProject');
    apply((d) => { d.name = 't'; });
    target.dispatchEvent(new Event('pagehide'));
    vi.advanceTimersByTime(1000);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('Abmelden räumt einen wartenden Timer ab', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const spy = vi.spyOn(dbModule, 'saveProject');
    apply((d) => { d.name = 'w'; });
    stop();
    vi.advanceTimersByTime(1000);
    expect(spy).not.toHaveBeenCalled();
  });

  it('Projekt null wird nie gespeichert', () => {
    const spy = vi.spyOn(dbModule, 'saveProject');
    load(null);
    target.dispatchEvent(new Event('pagehide'));
    expect(spy).not.toHaveBeenCalled();
  });

  it('erfolgreiches Speichern räumt den Speicherfehler-Hinweis ab, fremde Hinweise nicht', async () => {
    vi.spyOn(dbModule, 'saveProject').mockRejectedValueOnce(new Error('voll'));
    apply((d) => { d.name = 'x'; });
    target.dispatchEvent(new Event('pagehide'));
    await vi.waitFor(() => expect(useUi.getState().notice?.kind).toBe('error'));
    apply((d) => { d.name = 'y'; });
    target.dispatchEvent(new Event('pagehide'));
    await vi.waitFor(() => expect(useUi.getState().notice).toBeNull());
    useUi.getState().setNotice({ kind: 'info', text: 'anderes' });
    apply((d) => { d.name = 'z'; });
    target.dispatchEvent(new Event('pagehide'));
    await new Promise((r) => setTimeout(r, 50));
    expect(useUi.getState().notice?.text).toBe('anderes');
  });
});

describe('Autosave schützt Masken der History', () => {
  const [M1, M2] = ['1'.repeat(64), '2'.repeat(64)];
  const setMask = (m: string) => apply((d) => {
    d.elements.f = { id: 'f', type: 'photo', name: 'f', x: 0, y: 0, width: 1, height: 1, rotation: 0, opacity: 1, visible: true, locked: false, props: { mask: m } };
    d.order = ['f'];
  });

  it('keep enthält alte Masken (Undo) und neuere (Redo), nicht mehr nach dem Verlassen', async () => {
    const spy = vi.spyOn(dbModule, 'saveProject');
    setMask(M1);
    setMask(M2);
    undo();
    target.dispatchEvent(new Event('pagehide'));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(new Set(spy.mock.calls[0]![1])).toEqual(new Set([M2]));
    await spy.mock.results[0]!.value;
    load(null);
  });
});

describe('Autosave: Speicher wächst nicht mit jedem Strich', () => {
  const ids = ['1', '2', '3', '4'].map((c) => c.repeat(64));
  const A = 'a'.repeat(64);
  const meta = { mime: 'image/png', width: 2, height: 2, name: 'm' };
  const photo = (mask: string) => apply((d) => {
    d.assets[mask] = meta;
    d.assets[A] = meta;
    d.elements.f = { id: 'f', type: 'photo', name: 'f', x: 0, y: 0, width: 1, height: 1, rotation: 0, opacity: 1, visible: true, locked: false, props: { assetId: A, mask } };
    d.order = ['f'];
  });
  const flush = async () => {
    const spy = vi.spyOn(dbModule, 'saveProject');
    target.dispatchEvent(new Event('pagehide'));
    await spy.mock.results.at(-1)!.value;
    spy.mockRestore();
  };

  it('gespeichert wird nur Referenziertes; was Undo erreicht, steht in keep; nach Neuladen räumt die GC den Rest', async () => {
    const T = 10_000_000;
    const store = memoryAssetStore(() => T - GC_MIN_AGE_MS - 1);
    for (const id of [...ids, A]) await store.put(new Blob([id]), id);
    for (const id of ids.slice(0, 3)) photo(id); // drei Striche
    await flush();
    const row = await db.projects.get('auto');
    expect(Object.keys(row!.data.assets).sort()).toEqual([A, ids[2]].sort()); // Masken 1, 2 sind nur History
    expect(new Set(row!.keep)).toEqual(new Set([ids[0], ids[1]]));
    expect(await collectGarbage(store, T)).toBe(1); // nur Maske 4 ist unerreichbar
    expect((await store.list()).map((a) => a.id)).not.toContain(ids[3]);
    expect((await store.list()).map((a) => a.id)).toContain(ids[0]); // Undo braucht sie

    // Neuladen: History leer, nächste Änderung speichert ohne keep
    load((await loadProject('auto'))!);
    apply((d) => { d.name = 'nach Neuladen'; });
    await flush();
    expect((await db.projects.get('auto'))!.keep).toBeUndefined();
    await collectGarbage(store, T);
    expect((await store.list()).map((a) => a.id)).toEqual([A, ids[2]].sort());
  });
});

describe('Autosave: gelöschtes Foto bleibt für Undo geschützt', () => {
  it('Bild eines gelöschten Fotos steht in keep, nicht in assets', async () => {
    const A = 'a'.repeat(64);
    apply((d) => {
      d.assets[A] = { mime: 'image/jpeg', width: 1, height: 1, name: 'a' };
      d.elements.f = { id: 'f', type: 'photo', name: 'f', x: 0, y: 0, width: 1, height: 1, rotation: 0, opacity: 1, visible: true, locked: false, props: { assetId: A } };
      d.order = ['f'];
    });
    apply((d) => { delete d.elements.f; d.order = []; });
    const spy = vi.spyOn(dbModule, 'saveProject');
    target.dispatchEvent(new Event('pagehide'));
    await spy.mock.results[0]!.value;
    expect(spy.mock.calls[0]![0].assets).toEqual({});
    expect(spy.mock.calls[0]![1]).toEqual([A]);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiNetworkError } from '../../../ai/segmentClient';
import { maskFromAlpha } from '../../../ai/toMask';
import { aiTools } from '../../../core/registries';
import type { AiTool } from '../../../core/types';
import { el, project } from '../../../model/fixtures';
import { newMask } from '../../../model/mask';
import { memoryAssetStore } from '../../../storage/assets';
import { saveMask } from '../../../storage/maskAsset';
import { load, undo, useDoc } from '../../../store/document';
import { useUi } from '../../../store/ui';

const store = memoryAssetStore();
vi.mock('../../../storage/assets', async (orig) => ({ ...(await orig<object>()), opfsAssetStore: () => store }));

const { AI_DROPPED, saveStroke, setMaskFromAi } = await import('./maskOps');
const { AI_FAILED, AI_NETWORK, NO_SUBJECT, cancelRemoveBackground, removeBackground } = await import('./cutoutOps');
const ID = 'a'.repeat(64);
const photo = () => useDoc.getState().project!.elements.p!.props as { mask?: string };
const mk = (v: number) => {
  const m = newMask(4, 4);
  m.data.fill(v);
  return m;
};

beforeEach(() => {
  useUi.getState().setNotice(null);
  useUi.getState().setAi(undefined);
  load({
    ...project(1),
    assets: { [ID]: { mime: 'image/png', width: 400, height: 400, name: 'x.png' } },
    elements: { p: el({ id: 'p', type: 'photo', props: { assetId: ID, crop: { x: 0, y: 0, scale: 1 } } }) },
    order: ['p'],
  });
});

describe('setMaskFromAi', () => {
  it('schreibt Maske und Asset-Eintrag, ein Undo nimmt beides zurück', async () => {
    await setMaskFromAi('p', mk(7), undefined);
    const mid = photo().mask!;
    expect(useDoc.getState().project!.assets[mid]).toMatchObject({ width: 4, height: 4 });
    expect((await store.list()).some((a) => a.id === mid)).toBe(true);
    undo();
    expect(photo().mask).toBeUndefined();
    expect(useDoc.getState().project!.assets[mid]).toBeUndefined();
  });

  it('verwirft bei geänderter Maske: Meldung, Dokument unverändert', async () => {
    const other = await saveMask(store, mk(9));
    useDoc.setState((s) => ({ project: { ...s.project!, elements: { p: { ...s.project!.elements.p!, props: { ...photo(), mask: other } } as never } } }));
    const before = useDoc.getState().project;
    await setMaskFromAi('p', mk(7), undefined);
    expect(useDoc.getState().project).toBe(before);
    expect(useUi.getState().notice?.text).toBe(AI_DROPPED);
  });

  it('verwirft bei gelöschtem Foto', async () => {
    const run = setMaskFromAi('p', mk(7), undefined);
    useDoc.setState((s) => ({ project: { ...s.project!, elements: {}, order: [] } }));
    await run;
    expect(useDoc.getState().project!.elements).toEqual({});
    expect(useUi.getState().notice?.text).toBe(AI_DROPPED);
  });

  it('läuft nach einem ausstehenden Strich in der Kette: erst der Strich, dann wird das KI-Ergebnis verworfen', async () => {
    let done!: (id: string) => void;
    const saving = new Promise<string>((r) => (done = r));
    const stroke = saveStroke('p', { mask: mk(1), maskId: undefined }, saving);
    const ai = setMaskFromAi('p', mk(2), undefined);
    await new Promise((r) => setTimeout(r, 50));
    expect(photo().mask).toBeUndefined(); // ohne Kette hätte das KI-Ergebnis schon geschrieben
    done(await saveMask(store, mk(1)));
    await Promise.all([stroke, ai]);
    expect(photo().mask).toBe(await saveMask(store, mk(1))); // Strich gewinnt, nicht überschrieben
    expect(useUi.getState().notice?.text).toBe(AI_DROPPED);
  });
});

/** Werkzeug, dessen Lauf der Test von aussen beendet; Abbrechen verwirft wie der echte Client. */
type Opts = Parameters<AiTool['run']>[1];
type Result = Awaited<ReturnType<AiTool['run']>>;
let pending: { resolve(a: Result): void; reject(e: unknown): void; opts: Opts; image: Blob } | undefined;
const run = vi.fn<AiTool['run']>(
  (image, opts) =>
    new Promise<Result>((resolve, reject) => {
      pending = { resolve, reject, opts, image };
      opts.signal.addEventListener('abort', () => reject(new DOMException('abgebrochen', 'AbortError')));
    }),
);
aiTools.register({ id: 'freistellen', name: 'Test', run });
const PHOTO = new Blob(['foto'], { type: 'image/png' });
await store.put(PHOTO, ID);
/** 4 × 4, Mitte (2 × 2) sichtbar, Rand leer: Motiv gefunden. */
const ring = (): Result => ({ width: 4, height: 4, alpha: Uint8ClampedArray.from({ length: 16 }, (_, i) => ([5, 6, 9, 10].includes(i) ? 255 : 0)) });
const started = async () => {
  await vi.waitFor(() => expect(pending).toBeDefined());
  return pending!;
};
const history = () => useDoc.temporal.getState().pastStates.length;
const setProps = (props: object) =>
  useDoc.setState((s) => ({ project: { ...s.project!, elements: { p: { ...s.project!.elements.p!, props: { ...photo(), ...props } } as never } } }));

describe('removeBackground', () => {
  beforeEach(() => {
    pending = undefined;
    run.mockClear();
  });

  it('Erfolg: Originalfoto ans Werkzeug, Maske in Maskengrösse des Fotos, ein Undo-Schritt, danach kein Lauf mehr', async () => {
    const h0 = history();
    const done = removeBackground('p');
    expect(useUi.getState().ai).toEqual({ id: 'p', phase: 'download', fraction: 0 });
    const p = await started();
    expect(p.image).toBe(PHOTO);
    p.resolve(ring());
    await done;
    // gleiche Bytes, gleiche Id: die Maske ist das Alpha, einmal auf die Maskengrösse des Fotos (400 × 400) gebracht
    const want = maskFromAlpha(ring(), { width: 400, height: 400 });
    expect([want.data[200 * 400 + 200], want.data[0]]).toEqual([255, 0]);
    expect(photo().mask).toBe(await saveMask(store, want));
    expect(useDoc.getState().project!.assets[photo().mask!]).toMatchObject({ width: 400, height: 400 });
    expect(history()).toBe(h0 + 1);
    expect(useUi.getState().ai).toBeUndefined();
    expect(useUi.getState().notice).toBeNull();
  });

  it('Fortschritt: Phase und Prozent im UI-Store, geschrieben nur wenn sich das Prozent oder die Phase ändert', async () => {
    const done = removeBackground('p');
    const p = await started();
    let writes = 0;
    const off = useUi.subscribe((s, prev) => void (s.ai !== prev.ai && writes++));
    p.opts.onProgress({ phase: 'download', fraction: 0.001 }); // noch 0 %
    p.opts.onProgress({ phase: 'download', fraction: 0.5 });
    p.opts.onProgress({ phase: 'download', fraction: 0.502 }); // noch 50 %
    expect(useUi.getState().ai).toEqual({ id: 'p', phase: 'download', fraction: 0.5 });
    p.opts.onProgress({ phase: 'run', fraction: 0 });
    expect(useUi.getState().ai).toMatchObject({ phase: 'run' });
    expect(writes).toBe(2);
    off();
    p.resolve(ring());
    await done;
    expect(useUi.getState().ai).toBeUndefined();
  });

  it('kein Motiv: Meldung, Maske und History unverändert', async () => {
    const h0 = history();
    const done = removeBackground('p');
    (await started()).resolve({ width: 4, height: 4, alpha: new Uint8ClampedArray(16) });
    await done;
    expect(useUi.getState().notice).toEqual({ kind: 'info', text: NO_SUBJECT });
    expect(NO_SUBJECT).toMatch(/^Kein Motiv gefunden/);
    expect(photo().mask).toBeUndefined();
    expect(history()).toBe(h0);
    expect(useUi.getState().ai).toBeUndefined();
  });

  it('Netzfehler: Meldung mit Hinweis auf den Modell-Host, Lauf zurückgesetzt, nächster Klick versucht es neu', async () => {
    const done = removeBackground('p');
    (await started()).reject(new AiNetworkError('Failed to fetch'));
    await done;
    expect(useUi.getState().notice).toEqual({ kind: 'error', text: AI_NETWORK });
    expect(AI_NETWORK).toContain('huggingface.co und hf.co');
    expect(useUi.getState().ai).toBeUndefined();
    pending = undefined;
    const again = removeBackground('p');
    (await started()).resolve(ring());
    await again;
    expect(photo().mask).toBeDefined();
  });

  it('anderer Fehler: allgemeine Meldung, Maske unverändert', async () => {
    vi.spyOn(console, 'error').mockImplementationOnce(() => {});
    const done = removeBackground('p');
    (await started()).reject(new Error('onnx kaputt'));
    await done;
    expect(useUi.getState().notice).toEqual({ kind: 'error', text: AI_FAILED });
    expect(photo().mask).toBeUndefined();
    expect(useUi.getState().ai).toBeUndefined();
  });

  it('zweiter Aufruf während eines Laufs (gleiches oder anderes Foto) tut nichts', async () => {
    const done = removeBackground('p');
    const p = await started();
    await removeBackground('p');
    await removeBackground('q');
    expect(run).toHaveBeenCalledTimes(1);
    expect(useUi.getState().ai?.id).toBe('p');
    p.resolve(ring());
    await done;
  });

  it('Abbrechen: Lauf zurückgesetzt, keine Meldung, Foto unberührt', async () => {
    const h0 = history();
    const done = removeBackground('p');
    await started();
    cancelRemoveBackground();
    await done;
    expect(useUi.getState().ai).toBeUndefined();
    expect(useUi.getState().notice).toBeNull();
    expect(photo().mask).toBeUndefined();
    expect(history()).toBe(h0);
  });

  it('Foto während des Laufs gelöscht: Lauf sofort abgebrochen, ohne Meldung, ein anderes Foto kann gleich freigestellt werden', async () => {
    const done = removeBackground('p');
    const p = await started();
    const q = { ...useDoc.getState().project!.elements.p!, id: 'q' };
    useDoc.setState((s) => ({ project: { ...s.project!, elements: { q } as never, order: ['q'] } }));
    expect(p.opts.signal.aborted).toBe(true); // ohne Abbruch bliebe der Lauf hängen, bis das Werkzeug fertig ist
    await done;
    expect(useUi.getState().ai).toBeUndefined();
    expect(useUi.getState().notice).toBeNull();
    pending = undefined;
    const next = removeBackground('q');
    (await started()).resolve(ring());
    await next;
    expect((useDoc.getState().project!.elements.q!.props as { mask?: string }).mask).toBeDefined();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('anderes Projekt geöffnet: Lauf abgebrochen, nichts geschrieben', async () => {
    const done = removeBackground('p');
    const p = await started();
    load({ ...useDoc.getState().project!, id: 'anderes' });
    expect(p.opts.signal.aborted).toBe(true);
    await done;
    expect(photo().mask).toBeUndefined();
    expect(useUi.getState().ai).toBeUndefined();
  });

  it('Maske während des Laufs geändert: Ergebnis verworfen, die neue Maske bleibt', async () => {
    const done = removeBackground('p');
    const p = await started();
    const other = await saveMask(store, mk(9));
    setProps({ mask: other });
    p.resolve(ring());
    await done;
    expect(photo().mask).toBe(other);
    expect(useUi.getState().notice?.text).toBe(AI_DROPPED);
  });

  it('Foto während des Laufs ersetzt (ohne Maske): Lauf abgebrochen, nichts aufs neue Bild gelegt', async () => {
    const done = removeBackground('p');
    const p = await started();
    setProps({ assetId: 'b'.repeat(64) });
    expect(p.opts.signal.aborted).toBe(true);
    await done;
    expect(photo().mask).toBeUndefined();
    expect(useUi.getState().ai).toBeUndefined();
  });

  it('Maske geändert und leeres Ergebnis: verworfen meldet «nicht übernommen», nie «Kein Motiv»', async () => {
    const done = removeBackground('p');
    const p = await started();
    setProps({ mask: await saveMask(store, mk(9)) });
    p.resolve({ width: 4, height: 4, alpha: new Uint8ClampedArray(16) });
    await done;
    expect(useUi.getState().notice?.text).toBe(AI_DROPPED);
  });

  it('am Video kein Lauf', async () => {
    setProps({ video: { start: 0, end: 1, duration: 1 } });
    await removeBackground('p');
    expect(run).not.toHaveBeenCalled();
    expect(useUi.getState().ai).toBeUndefined();
  });
});

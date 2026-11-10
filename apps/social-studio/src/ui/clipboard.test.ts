import { beforeEach, describe, expect, it, vi } from 'vitest';
import { elementTypes } from '../core/registries';
import type { ElementType } from '../core/types';
import { referencedAssetIds, withReferencedAssets } from '../model/elements';
import { el, project } from '../model/fixtures';
import { apply, load, undo, useDoc } from '../store/document';
import { useUi } from '../store/ui';
import { copySelection, cutSelection, pasteClipboard } from './clipboard';

const photo = () => el({ id: 'p1', type: 'foto', props: { assetId: 'h1' } });
const meta = { mime: 'image/jpeg', width: 10, height: 10, name: 'f.jpg' };
const els = () => Object.values(useDoc.getState().project!.elements);

/** Minimales ClipboardEvent: nur was clipboardData braucht. */
function evt(text: string, files: File[] = []) {
  const data = new Map<string, string>();
  const e = { clipboardData: { getData: (t: string) => (t === 'text/plain' ? text : ''), setData: (t: string, v: string) => void data.set(t, v), files }, preventDefault() { this.prevented = true; }, prevented: false };
  return { e: e as unknown as ClipboardEvent, data, raw: e };
}

beforeEach(() => {
  const p = project(2, [el({ id: 'a', x: 10 }), photo()]);
  p.assets.h1 = meta;
  load(p);
  useUi.setState({ notice: null, selectedIds: [], selectedId: null, currentSlide: 0 });
});

describe('clipboard actions', () => {
  it('copySelection ohne Auswahl: false', () => {
    expect(copySelection()).toBe(false);
  });

  it('Kopieren schreibt den Marker, Einfügen mit dem Marker fügt ein, fremder Text nicht', () => {
    useUi.getState().setSelectedIds(['a']);
    const c = evt('');
    expect(copySelection(c.e)).toBe(true);
    const marker = c.data.get('text/plain')!;
    expect(marker).toMatch(/^bbzb-social-studio:\d+$/);
    pasteClipboard(evt('Hallo').e);
    expect(els()).toHaveLength(2);
    pasteClipboard(evt(marker).e);
    expect(els()).toHaveLength(3);
    pasteClipboard(); // Menü: ohne Ereignis aus dem internen Speicher
    expect(els()).toHaveLength(4);
    expect(useUi.getState().selectedIds).toHaveLength(1);
  });

  it('wiederholtes Einfügen versetzt um 40, neues Kopieren setzt zurück', () => {
    useUi.getState().setSelectedIds(['a']);
    copySelection();
    pasteClipboard();
    pasteClipboard();
    const xs = els().filter((e) => e.id !== 'a' && e.id !== 'p1').map((e) => e.x);
    expect(xs).toEqual([10, 50]);
    useUi.getState().setSelectedIds(['a']); // nach dem Einfügen sind die Kopien gewählt
    copySelection();
    pasteClipboard();
    expect(els().at(-1)!.x).toBe(10);
  });

  it('Ausschneiden und Einfügen: Foto bleibt referenzierbar, auch nach dem Speichern-Beschnitt', () => {
    useUi.getState().setSelectedIds(['p1']);
    expect(cutSelection()).toBe(true);
    const p = useDoc.getState().project!;
    expect(p.elements.p1).toBeUndefined();
    expect(p.assets.h1).toEqual(meta); // Store prunt nie
    // «Zurück zur Startseite» speichert withReferencedAssets(p): das Asset-Meta fällt dort weg
    load(withReferencedAssets(p));
    expect(useDoc.getState().project!.assets.h1).toBeUndefined();
    pasteClipboard();
    const after = useDoc.getState().project!;
    expect(referencedAssetIds(after).has('h1')).toBe(true);
    expect(after.assets.h1).toEqual(meta);
    expect(referencedAssetIds(withReferencedAssets(after)).has('h1')).toBe(true);
  });

  it('Ausschneiden ist ein Undo-Schritt, gesperrte Elemente bleiben', () => {
    apply((d) => void (d.elements.a!.locked = true));
    useUi.getState().setSelectedIds(['a', 'p1']);
    cutSelection();
    expect(els().map((e) => e.id)).toEqual(['a']);
    undo();
    expect(els()).toHaveLength(2);
  });

  it('Bilddatei im Ereignis hat Vorrang; unbekannte Datei gibt die Meldung', () => {
    const f = new File(['x'], 'x.png', { type: 'image/png' });
    const r = evt('', [f]);
    pasteClipboard(r.e);
    expect(useUi.getState().notice).toEqual({ kind: 'info', text: 'Diese Datei kann ich nicht verwenden. Erlaubt sind Fotos.' });
    expect(r.raw.prevented).toBe(true);
    let got: File | undefined;
    elementTypes.register({ id: 'fake', acceptsFile: () => true, fromFile: async (file: File) => void (got = file) } as unknown as ElementType);
    pasteClipboard(evt('', [f]).e);
    expect(got).toBe(f);
  });
});

describe('clipboard Nachbesserungen', () => {
  const rtfEvt = (types: string[], files: File[]) => {
    const e = evt('', files);
    (e.raw.clipboardData as unknown as { types: string[] }).types = types;
    return e;
  };

  it('Office: Bild neben text/rtf wird ignoriert, ohne rtf entsteht ein Foto', () => {
    const f = new File(['x'], 'image.png', { type: 'image/png' });
    let got = 0;
    const spy = vi.spyOn(elementTypes, 'all').mockReturnValue([{ acceptsFile: () => true, fromFile: async () => void got++ }] as unknown as ElementType[]);
    const office = rtfEvt(['text/plain', 'text/rtf', 'Files'], [f]);
    pasteClipboard(office.e);
    expect(got).toBe(0);
    expect(useUi.getState().notice).toBeNull();
    pasteClipboard(rtfEvt(['Files'], [f]).e);
    expect(got).toBe(1);
    spy.mockRestore();
  });

  it('anderes Projekt geöffnet: Einfügen tut nichts', () => {
    useUi.getState().setSelectedIds(['a']);
    copySelection();
    const other = project(1, [el({ id: 'z' })]);
    other.id = 'anderes';
    load(other);
    pasteClipboard();
    expect(els().map((e) => e.id)).toEqual(['z']);
  });

  it('Ausschneiden mit nur gesperrter Auswahl: nichts kopiert, nichts entfernt', () => {
    apply((d) => void (d.elements.a!.locked = true));
    useUi.getState().setSelectedIds(['a']);
    expect(cutSelection()).toBe(false);
    expect(els()).toHaveLength(2);
  });
});

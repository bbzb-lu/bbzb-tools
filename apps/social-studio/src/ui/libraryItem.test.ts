import { beforeEach, describe, expect, it } from 'vitest';
import { elementTypes } from '../core/registries';
import { addElement, DUPLICATE_OFFSET } from '../model/elements';
import { createProject } from '../model/slides';
import { apply, load, useDoc } from '../store/document';
import { useUi } from '../store/ui';
import { insertLibraryItem, LIBRARY_MIME, readLibraryItem, type LibraryItem } from './libraryItem';

const dt = (json: string) => ({ types: [LIBRARY_MIME], getData: () => json }) as unknown as DataTransfer;
const inserted: string[] = [];
const places: ({ x: number; y: number } | undefined)[] = [];
if (!elementTypes.has('fake')) {
  elementTypes.register({
    id: 'fake',
    variants: [{ id: 'ok', label: 'Ok' }],
    insertVariant: async (v: string, _c: unknown, at?: (() => { x: number; y: number } | undefined) | { x: number; y: number }) => void (inserted.push(v), places.push(typeof at === 'function' ? at() : at)),
  } as never);
}

// Wie die echten Typen: wartet (Schrift, Bild laden) und legt erst danach ab; `at` erst dann auflösen.
if (!elementTypes.has('slow')) {
  elementTypes.register({
    id: 'slow',
    variants: [{ id: 'ok', label: 'Ok' }],
    insertVariant: async (_v: string, _c: unknown, at?: unknown) => {
      await new Promise((r) => setTimeout(r, 5));
      const c = (typeof at === 'function' ? at() : at) ?? { x: 500, y: 400 };
      apply((d) => addElement(d, { id: `s${d.order.length}`, type: 'x', name: 'x', x: c.x - 50, y: c.y - 20, width: 100, height: 40, rotation: 0, opacity: 1, visible: true, locked: false, props: {} }));
    },
  } as never);
}

beforeEach(() => {
  inserted.length = 0;
  places.length = 0;
  load(createProject({ name: 'T', format: { id: 'f', label: 'F', width: 1000, height: 800 } as never }));
  useUi.setState({ notice: null });
});

describe('libraryItem: Ziehdaten sind nicht vertrauenswürdig', () => {
  it('fremde Nutzlast wird beim Lesen verworfen', () => {
    for (const bad of ['null', '"x"', '{}', '{"kind":"variant","type":1}', '{"kind":"asset"}', 'kein json']) {
      expect(readLibraryItem(dt(bad))).toBeNull();
    }
  });

  it('unbekannte Variante, Typ oder Markenbild: Meldung statt Fehler', async () => {
    const foreign: LibraryItem[] = [
      { kind: 'variant', type: 'fake', variant: 'gibt-es-nicht' },
      { kind: 'variant', type: 'gibt-es-nicht', variant: 'ok' },
      { kind: 'asset', id: 'gibt-es-nicht' },
    ];
    for (const item of foreign) {
      useUi.setState({ notice: null });
      await expect(insertLibraryItem(item)).resolves.toBeUndefined();
      expect(useUi.getState().notice).toMatchObject({ kind: 'error' });
    }
    expect(inserted).toEqual([]);
  });

  it('bekannte Variante wird eingefügt', async () => {
    await insertLibraryItem({ kind: 'variant', type: 'fake', variant: 'ok' });
    expect(inserted).toEqual(['ok']);
  });
});

describe('libraryItem: Versatz bei wiederholtem Klick', () => {
  const item: LibraryItem = { kind: 'variant', type: 'fake', variant: 'ok' };
  const fill = (cx: number, cy: number) =>
    apply((d) => addElement(d, { id: `e${d.order.length}`, type: 'x', name: 'x', x: cx - 50, y: cy - 20, width: 100, height: 40, rotation: 0, opacity: 1, visible: true, locked: false, props: {} }));

  it('ohne `at` weicht jeder Klick um den Duplizier-Versatz aus, solange die Stelle belegt ist; mit `at` exakt', async () => {
    await insertLibraryItem(item);
    expect(places[0]).toBeUndefined(); // Stelle frei: Typ setzt mittig
    fill(500, 400);
    await insertLibraryItem(item);
    expect(places[1]).toEqual({ x: 500 + DUPLICATE_OFFSET, y: 400 + DUPLICATE_OFFSET });
    fill(500 + DUPLICATE_OFFSET, 400 + DUPLICATE_OFFSET);
    await insertLibraryItem(item);
    expect(places[2]).toEqual({ x: 500 + 2 * DUPLICATE_OFFSET, y: 400 + 2 * DUPLICATE_OFFSET });
    await insertLibraryItem(item, { x: 500, y: 400 });
    expect(places[3]).toEqual({ x: 500, y: 400 });
  });
});

describe('libraryItem: zwei Klicks ohne Warten dazwischen', () => {
  it('der freie Platz wird erst beim Einfügen bestimmt: zweites Element 40 px versetzt', async () => {
    const item: LibraryItem = { kind: 'variant', type: 'slow', variant: 'ok' };
    await Promise.all([insertLibraryItem(item), insertLibraryItem(item)]);
    const [a, b] = Object.values(useDoc.getState().project!.elements);
    expect([b!.x - a!.x, b!.y - a!.y]).toEqual([DUPLICATE_OFFSET, DUPLICATE_OFFSET]);
  });
});

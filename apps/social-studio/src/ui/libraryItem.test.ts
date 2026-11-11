import { beforeEach, describe, expect, it } from 'vitest';
import { elementTypes } from '../core/registries';
import { useUi } from '../store/ui';
import { insertLibraryItem, LIBRARY_MIME, readLibraryItem, type LibraryItem } from './libraryItem';

const dt = (json: string) => ({ types: [LIBRARY_MIME], getData: () => json }) as unknown as DataTransfer;
const inserted: string[] = [];
if (!elementTypes.has('fake')) {
  elementTypes.register({
    id: 'fake',
    variants: [{ id: 'ok', label: 'Ok' }],
    insertVariant: async (v: string) => void inserted.push(v),
  } as never);
}

beforeEach(() => {
  inserted.length = 0;
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

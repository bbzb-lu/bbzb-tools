import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '../model/types';
import { doodleAsset, doodleCategories, isDoodleId, searchDoodles, type DoodlePack } from './doodles';

const d = (c: string, t: string) => ({ c, w: 150, h: 120, p: ['M1 1h2'], t });
const pack: DoodlePack = {
  'arrows-arrow-down': d('arrows', 'arrows arrow down'),
  'arrows-down-curve': d('arrows', 'arrows down curve'),
  'food-apple': d('food', 'food apple'),
  'logos-apple': d('logos', 'logos apple'),
  'logos-pineapple-mark': d('logos', 'logos pineapple mark'),
  'misc-fruit': d('misc', 'misc apple fruit'),
  'misc-evil': { c: 'misc', w: 1, h: 1, p: ['M0 0"/><script>'], t: '' },
};

describe('doodleAsset', () => {
  it('baut eine Data-URL mit gefülltem SVG in der eigenen viewBox', () => {
    const a = doodleAsset('food-apple', { ...pack, 'food-apple': { ...d('food', ''), p: ['M5 7C1 2 3 4 5 6Z', 'M9 13h1'] } })!;
    expect(a).toMatchObject({ id: 'doodle-food-apple', name: 'food-apple', category: 'icon', defaultColor: 'akzent', file: 'doodles/food-apple' });
    expect(a.url.startsWith('data:image/svg+xml,')).toBe(true);
    const svg = decodeURIComponent(a.url.slice('data:image/svg+xml,'.length));
    expect(svg).toContain('viewBox="0 0 150 120"');
    expect(svg).toContain('fill="black"');
    expect(svg).toContain('d="M5 7C1 2 3 4 5 6Z"');
    expect(svg).toContain('d="M9 13h1"');
  });

  it('undefined bei unbekannten, ungültigen Namen und ungültigen Pfaden', () => {
    for (const n of ['../x', 'A B', 'gibtesnicht', '', 'Food-apple', 'toString']) expect(doodleAsset(n, pack), n).toBeUndefined();
    expect(doodleAsset('misc-evil', pack)).toBeUndefined();
  });
});

describe('searchDoodles', () => {
  it('Rangfolge: exakter Name, Anfang, Name enthält, Stichwort; Name ohne und mit Kategorie', () => {
    expect(searchDoodles(pack, 'apple').names).toEqual(['food-apple', 'logos-apple', 'logos-pineapple-mark', 'misc-fruit']);
    expect(searchDoodles(pack, 'logos apple').names[0]).toBe('logos-apple');
    expect(searchDoodles(pack, 'down').names).toEqual(['arrows-down-curve', 'arrows-arrow-down']);
  });
  it('Kategorie filtert, leere Anfrage zeigt die ganze Kategorie', () => {
    expect(searchDoodles(pack, 'apple', 'logos').names).toEqual(['logos-apple', 'logos-pineapple-mark']);
    expect(searchDoodles(pack, '  ', 'arrows')).toEqual({ names: ['arrows-arrow-down', 'arrows-down-curve'], total: 2 });
  });
  it('Limit kürzt die Liste, total zählt alle Treffer; Gross-/Kleinschreibung egal', () => {
    expect(searchDoodles(pack, 'APPLE ', undefined, 2)).toEqual({ names: ['food-apple', 'logos-apple'], total: 4 });
    expect(searchDoodles(pack, '').total).toBe(7);
  });
});

describe('doodleCategories und isDoodleId', () => {
  it('Kategorien sortiert und eindeutig', () => {
    expect(doodleCategories(pack)).toEqual(['arrows', 'food', 'logos', 'misc']);
  });
  it('prüft Präfix und Namen', () => {
    expect(isDoodleId('doodle-food-apple')).toBe(true);
    expect(isDoodleId('tabler-home')).toBe(false);
    expect(isDoodleId('doodle-')).toBe(false);
    expect(isDoodleId('doodle-A b')).toBe(false);
  });
});

const OK = { default: { 'food-apple': d('food', 'food apple'), 'misc-fruit': d('misc', 'fruit') } };
const fresh = async (fail: boolean) => {
  vi.resetModules();
  vi.doMock('../../brand/doodles/doodles.json', () => {
    if (fail) throw new Error('offline');
    return OK;
  });
  return { m: await import('./doodles'), reg: await import('../core/registries') };
};
const projectWith = (...brandIds: string[]) =>
  ({ elements: Object.fromEntries(brandIds.map((brandId, i) => [`e${i}`, { props: { brandId } }])) }) as unknown as Project;

describe('ensureDoodlesFor', () => {
  beforeEach(() => vi.resetModules());

  it('trägt nur benötigte Doodles ins Paket «doodles» ein, einmal', async () => {
    const { m, reg } = await fresh(false);
    await m.ensureDoodlesFor(projectWith('doodle-food-apple', 'tabler-home', 'doodle-food-apple', 'doodle-gibtesnicht'));
    await m.ensureDoodlesFor(projectWith('doodle-food-apple'));
    expect(m.doodlesLoaded()).toBe(true);
    expect(reg.assetPacks.get(m.DOODLE_PACK).assets.map((a) => a.id)).toEqual(['doodle-food-apple']);
  });

  it('ohne Doodle-Id wird nie geladen', async () => {
    const { m, reg } = await fresh(true);
    await expect(m.ensureDoodlesFor(projectWith('tabler-home', 'scribble-05'))).resolves.toBeUndefined();
    expect(m.doodlesFailed()).toBe(false);
    expect(reg.assetPacks.has(m.DOODLE_PACK)).toBe(false);
  });

  it('Ladefehler: wirft, doodlesFailed() wird wahr; der nächste Versuch lädt neu', async () => {
    const { m, reg } = await fresh(true);
    expect(m.doodlesFailed()).toBe(false);
    await expect(m.ensureDoodlesFor(projectWith('doodle-food-apple'))).rejects.toThrow();
    expect(m.doodlesFailed()).toBe(true);
    expect(m.doodlesLoaded()).toBe(false);
    expect(reg.assetPacks.has(m.DOODLE_PACK)).toBe(false);
    vi.doMock('../../brand/doodles/doodles.json', () => OK);
    await m.ensureDoodlesFor(projectWith('doodle-food-apple'));
    expect(m.doodlesFailed()).toBe(false);
    expect(reg.assetPacks.get(m.DOODLE_PACK).assets.map((a) => a.id)).toEqual(['doodle-food-apple']);
  });
});

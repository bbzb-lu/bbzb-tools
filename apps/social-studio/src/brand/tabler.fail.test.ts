import { beforeEach, describe, expect, it, vi } from 'vitest';

const fresh = async (fail: boolean) => {
  vi.resetModules();
  vi.doMock('../../brand/tabler/outline.json', () => {
    if (fail) throw new Error('offline');
    return { default: { home: { p: ['M1 1h2'], t: 'home' } } };
  });
  return { t: await import('./tabler'), reg: await import('../core/registries') };
};

describe('Laden der Tabler-Datei schlägt fehl', () => {
  beforeEach(() => vi.resetModules());

  it('ensureTabler wirft, tablerFailed() wird wahr, Paket bleibt leer', async () => {
    const { t, reg } = await fresh(true);
    expect(t.tablerLoaded()).toBe(false);
    expect(t.tablerFailed()).toBe(false);
    await expect(t.ensureTabler(['tabler-home'])).rejects.toThrow();
    expect(t.tablerFailed()).toBe(true);
    expect(t.tablerLoaded()).toBe(false);
    expect(reg.assetPacks.has(t.TABLER_PACK)).toBe(false);
  });

  it('ohne Tabler-Id wird nie geladen', async () => {
    const { t } = await fresh(true);
    await expect(t.ensureTabler(['icon-bike'])).resolves.toBeUndefined();
    expect(t.tablerFailed()).toBe(false);
  });

  it('ein späterer Aufruf versucht es neu und setzt den Fehler zurück', async () => {
    const { t, reg } = await fresh(true);
    await expect(t.ensureTabler(['tabler-home'])).rejects.toThrow();
    vi.doMock('../../brand/tabler/outline.json', () => ({ default: { home: { p: ['M1 1h2'], t: 'home' } } }));
    await t.ensureTabler(['tabler-home']);
    expect(t.tablerFailed()).toBe(false);
    expect(t.tablerLoaded()).toBe(true);
    expect(reg.assetPacks.get(t.TABLER_PACK).assets.map((a) => a.id)).toEqual(['tabler-home']);
  });
});

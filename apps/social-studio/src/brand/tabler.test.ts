import { describe, expect, it } from 'vitest';
import { isTablerId, searchTabler, tablerAsset, type TablerPack } from './tabler';

const pack: TablerPack = {
  home: { p: ['M5 12l-2 0l9 -9'], t: 'home house main' },
  'home-2': { p: ['M1 1h2'], t: 'home alt' },
  'smart-home': { p: ['M1 1h2'], t: 'smart building' },
  camera: { p: ['M5 7h1a2 2 0 0 0 2 -2', 'M9 13a3 3 0 1 0 6 0'], t: 'photo picture home' },
  arrow: { p: ['M12 5l0 14'], t: 'direction' },
  evil: { p: ['M0 0"/><script>'], t: '' },
};

describe('tablerAsset', () => {
  it('baut eine Data-URL mit SVG, Strichlinien und den Pfaden', () => {
    const a = tablerAsset('camera', pack)!;
    expect(a).toMatchObject({ id: 'tabler-camera', name: 'camera', category: 'icon', defaultColor: 'akzent', file: 'tabler/camera' });
    expect(a.url.startsWith('data:image/svg+xml,')).toBe(true);
    const svg = decodeURIComponent(a.url.slice('data:image/svg+xml,'.length));
    expect(svg).toContain('viewBox="0 0 24 24"');
    expect(svg).toContain('fill="none"');
    expect(svg).toContain('stroke-width="2"');
    expect(svg).toContain('stroke-linecap="round"');
    expect(svg).toContain('stroke-linejoin="round"');
    expect(svg).toContain('d="M5 7h1a2 2 0 0 0 2 -2"');
    expect(svg).toContain('d="M9 13a3 3 0 1 0 6 0"');
  });

  it('undefined bei unbekannten, ungültigen Namen und ungültigen Pfaden', () => {
    for (const n of ['../x', 'A B', 'gibtesnicht', '', 'Home']) expect(tablerAsset(n, pack), n).toBeUndefined();
    expect(tablerAsset('evil', pack)).toBeUndefined();
  });
});

describe('searchTabler', () => {
  it('Rangfolge: exakt, Anfang, Name enthält, Stichwort', () => {
    expect(searchTabler(pack, 'home')).toEqual(['home', 'home-2', 'smart-home', 'camera']);
  });
  it('mehrere Wörter, Gross-/Kleinschreibung und Randleerzeichen egal', () => {
    expect(searchTabler(pack, '  PHOTO Picture ')).toEqual(['camera']);
    expect(searchTabler(pack, 'smart  home')).toEqual(['smart-home']);
  });
  it('leere Anfrage gibt nichts, Limit wird eingehalten', () => {
    expect(searchTabler(pack, '   ')).toEqual([]);
    expect(searchTabler(pack, 'home', 2)).toEqual(['home', 'home-2']);
  });
});

describe('isTablerId', () => {
  it('prüft Präfix und Namen', () => {
    expect(isTablerId('tabler-home')).toBe(true);
    expect(isTablerId('icon-bike')).toBe(false);
    expect(isTablerId('tabler-')).toBe(false);
    expect(isTablerId('tabler-A b')).toBe(false);
  });
});

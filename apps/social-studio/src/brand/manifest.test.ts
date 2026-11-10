import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { loadBrandAssets } from './manifest';

const entry = { id: 'a', file: 'scribbles/a.png', name: 'A', category: 'scribble', defaultColor: 'orange' };
const urls = { 'scribbles/a.png': '/a.png', 'icons/b.svg': '/b.svg' };
const raw = (assets: unknown[]) => JSON.stringify({ version: 1, assets });

describe('loadBrandAssets', () => {
  it('lädt ein gültiges Manifest', () => {
    const r = loadBrandAssets(raw([entry]), urls);
    expect(r.errors).toEqual([]);
    expect(r.assets).toEqual([{ ...entry, url: '/a.png' }]);
  });

  it('kaputtes JSON: keine Assets, eine Meldung, kein Absturz', () => {
    const r = loadBrandAssets('{ nope', urls);
    expect(r.assets).toEqual([]);
    expect(r.errors[0]).toMatch(/kaputt/);
    expect(loadBrandAssets('{}', urls).errors[0]).toMatch(/kaputt/);
  });

  it('ungültiger Eintrag (Hex statt Token) wird gemeldet, die übrigen bleiben', () => {
    const bad = { ...entry, id: 'x', defaultColor: '#FF4E00' };
    const r = loadBrandAssets(raw([bad, entry]), urls);
    expect(r.assets.map((a) => a.id)).toEqual(['a']);
    expect(r.errors).toHaveLength(1);
  });

  it('fehlende Datei: Meldung mit Name, übrige Assets bleiben', () => {
    const gone = { ...entry, id: 'g', file: 'scribbles/weg.png', name: 'Weg' };
    const r = loadBrandAssets(raw([gone, entry]), urls);
    expect(r.assets.map((a) => a.id)).toEqual(['a']);
    expect(r.errors[0]).toMatch(/«Weg»/);
  });

  it('doppelte ID wird gemeldet', () => {
    const r = loadBrandAssets(raw([entry, entry]), urls);
    expect(r.assets).toHaveLength(1);
    expect(r.errors).toHaveLength(1);
  });
});

describe('brand/manifest.json', () => {
  const dir = join(__dirname, '../../brand');
  const files: Record<string, string> = {};
  for (const sub of ['scribbles', 'icons', 'textures']) {
    for (const f of readdirSync(join(dir, sub))) files[`${sub}/${f}`] = `/${sub}/${f}`;
  }
  const r = loadBrandAssets(readFileSync(join(dir, 'manifest.json'), 'utf8'), files);

  it('ist gültig und alle Dateien sind da', () => {
    expect(r.errors).toEqual([]);
    expect(r.assets.filter((a) => a.category === 'scribble')).toHaveLength(18);
    expect(r.assets.some((a) => a.file === 'icons/map-pin.svg')).toBe(true);
  });

  it('Markenicons: 5 Stück, Ids unverändert, Tabler-Dateien', () => {
    const icons = r.assets.filter((a) => a.file.startsWith('icons/'));
    expect(icons.map((a) => a.id).sort()).toEqual(['icon-bike', 'icon-map-pin', 'icon-mountain', 'icon-tree-pine', 'icon-waves']);
    for (const f of readdirSync(join(dir, 'icons')).filter((n) => n.endsWith('.svg'))) expect(readFileSync(join(dir, 'icons', f), 'utf8'), f).toContain('icon-tabler');
  });

  it('Scribbles: längste Seite höchstens 2048 px, Hintergrund transparent', () => {
    for (const f of readdirSync(join(dir, 'scribbles')).filter((n) => n.endsWith('.png'))) {
      const png = PNG.sync.read(readFileSync(join(dir, 'scribbles', f)));
      expect(Math.max(png.width, png.height), f).toBeLessThanOrEqual(2048);
      expect(png.data[3], f).toBe(0);
    }
  });

  it('enthält nie das App-Logo', () => {
    expect(r.assets.some((a) => /logo/i.test(a.file))).toBe(false);
  });
});

describe('Architektur', () => {
  it('kein Asset-Pfad im Code ausser im Manifest', () => {
    const hits: string[] = [];
    const walk = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(n) && !/\.test\./.test(n) && /Scribble_\d|map-pin\.svg|film-grain|tree-pine|(scribbles|icons|textures)\/[\w-]+\.(png|svg|jpg)/.test(readFileSync(p, 'utf8'))) hits.push(p);
      }
    };
    walk(join(__dirname, '..'));
    expect(hits).toEqual([]);
  });
});

describe('brand/manifest.json (Phase 2.5)', () => {
  it('Scribbles und Icons starten in «akzent», nie in einer festen Farbe', () => {
    const { assets } = JSON.parse(readFileSync(join(__dirname, '../../brand/manifest.json'), 'utf8')) as { assets: { category: string; defaultColor?: string }[] };
    const tinted = assets.filter((a) => a.category !== 'textur');
    expect(tinted.length).toBeGreaterThan(0);
    expect(tinted.every((a) => a.defaultColor === 'akzent')).toBe(true);
    expect(loadBrandAssets(raw([{ ...entry, defaultColor: 'akzent' }]), urls).errors).toEqual([]);
  });
});

import { afterEach, expect, it, vi } from 'vitest';
import { brandFaces, fontsMissingText, loadBrandFonts } from './fonts';

it('nennt eine oder mehrere fehlende Schriften', () => {
  expect(fontsMissingText(['A'])).toBe('Schrift «A» fehlt.');
  expect(fontsMissingText(['A', 'B'])).toBe('Schriften «A», «B» fehlen.');
});

it('Oberflächen-Schriften blockieren den Export nie, Export-Schriften schon', async () => {
  const { faces } = await import('./fonts');
  const { uiFonts } = await import('./ui/theme');
  const exportLabels = faces.map((f) => f.label);
  for (const f of uiFonts) expect(exportLabels).not.toContain(f.label);
  expect(exportLabels).toEqual(expect.arrayContaining(['Segoe UI Black', 'Braveold Light']));
});

afterEach(() => vi.unstubAllGlobals());

it('ohne Braveold-Datei (leeres Glob-Ergebnis) meldet die Schriftladung Braveold als fehlend', async () => {
  // FontFace gibt es in Node nicht: jede Schrift mit Adresse lädt hier.
  vi.stubGlobal('FontFace', class { load = async () => this; });
  vi.stubGlobal('document', { fonts: { add: () => {} } });
  expect(await loadBrandFonts(brandFaces({}))).toEqual({ missing: ['Braveold Light'] });
});

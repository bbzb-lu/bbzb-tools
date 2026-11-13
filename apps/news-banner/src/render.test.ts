import { describe, expect, it } from 'vitest';
import { gradientColor } from './render';
import { contentBox, hasTransparentPixels } from './icons/raster';

describe('gradientColor', () => {
  it('trifft die Stützpunkte der PSD', () => {
    expect(gradientColor('dark', 0)).toEqual([84, 120, 181]);
    expect(gradientColor('dark', 540)).toEqual([50, 88, 159]);
    expect(gradientColor('light', 1079)).toEqual([129, 155, 200]);
  });
  it('interpoliert dazwischen', () => {
    expect(gradientColor('dark', 150)).toEqual([75, 112, 175]);
  });
  it('klemmt ausserhalb', () => {
    expect(gradientColor('light', -5)).toEqual([255, 255, 255]);
    expect(gradientColor('dark', 2000)).toEqual([16, 56, 136]);
  });
});

describe('hasTransparentPixels', () => {
  const px = (n: number, f: (x: number, y: number) => number) => {
    const d = new Uint8ClampedArray(n * n * 4);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) d[(y * n + x) * 4 + 3] = f(x, y);
    return d;
  };
  it('volles Rechteck: nein', () => expect(hasTransparentPixels(px(20, () => 255))).toBe(false));
  it('Kreis auf leerem Grund: ja', () => expect(hasTransparentPixels(px(20, (x, y) => ((x - 10) ** 2 + (y - 10) ** 2 < 64 ? 255 : 0)))).toBe(true));
  it('einzelne durchsichtige Pixel unter 1 %: nein', () => expect(hasTransparentPixels(px(20, (x, y) => (x + y === 0 ? 0 : 255)))).toBe(false));
});

describe('contentBox', () => {
  const grid = (n: number, on: (x: number, y: number) => boolean) => {
    const d = new Uint8ClampedArray(n * n * 4);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) d[(y * n + x) * 4 + 3] = on(x, y) ? 255 : 0;
    return d;
  };
  it('Rahmen um den Inhalt, Ränder eingeschlossen', () => expect(contentBox(grid(20, (x, y) => x >= 3 && x <= 8 && y >= 5 && y <= 12), 20, 20)).toEqual({ x0: 3, y0: 5, x1: 8, y1: 12 }));
  it('leer: null', () => expect(contentBox(grid(10, () => false), 10, 10)).toBeNull());
});

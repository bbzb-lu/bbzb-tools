import { describe, expect, it } from 'vitest';
import { hasTransparentEdge, outlineAlpha } from './outline';

/** RGBA-Pixel ohne Canvas (Vitest läuft in Node): `alpha(x, y)` je Pixel, Farbe egal. */
function pixels(width: number, height: number, alpha: (x: number, y: number) => number) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data[(y * width + x) * 4 + 3] = alpha(x, y);
  return { width, height, data };
}
const W = 6;

describe('hasTransparentEdge', () => {
  it('Mittel der vier Randreihen unter 250: durchsichtiger Rand', () => {
    expect(hasTransparentEdge(pixels(10, 10, () => 255))).toBe(false);
    expect(hasTransparentEdge(pixels(10, 10, () => 0))).toBe(true);
    // Mitte durchsichtig, Rand deckend: Rechteck
    expect(hasTransparentEdge(pixels(10, 10, (x, y) => (x > 2 && x < 7 && y > 2 && y < 7 ? 0 : 255)))).toBe(false);
    // eine Randspalte leer (9 von 36 Randpixeln): Mittel weit unter 250
    expect(hasTransparentEdge(pixels(10, 10, (x) => (x === 0 ? 0 : 255)))).toBe(true);
    expect(hasTransparentEdge(pixels(1, 1, () => 255))).toBe(false);
  });
});

describe('outlineAlpha', () => {
  it('opakes 10 × 10 Bild: 10 + 2·w breit, alle Pixel deckend (Rechteck mit scharfen Ecken)', () => {
    const a = outlineAlpha(pixels(10, 10, () => 255), W);
    expect(a.length).toBe((10 + 2 * W) ** 2);
    expect(a.every((v) => v === 255)).toBe(true);
  });

  it('Kreis in der Mitte, Rand durchsichtig: runde Erweiterung um w, weiter aussen leer', () => {
    const S = 60, R = 14, c = (S - 1) / 2;
    const a = outlineAlpha(pixels(S, S, (x, y) => (Math.hypot(x - c, y - c) <= R ? 255 : 0)), W);
    const P = S + 2 * W;
    expect(a.length).toBe(P * P);
    let filled = 0, empty = 0;
    for (let y = 0; y < P; y++) {
      for (let x = 0; x < P; x++) {
        const out = Math.hypot(x - W - c, y - W - c) - R; // Abstand ausserhalb der Form
        const v = a[y * P + x]!;
        if (out < W - 0.5) {
          expect(v, `${x}/${y} (${out.toFixed(2)})`).toBeGreaterThanOrEqual(128);
          filled++;
        } else if (out > W + 1) {
          expect(v, `${x}/${y} (${out.toFixed(2)})`).toBe(0);
          empty++;
        }
      }
    }
    expect(filled).toBeGreaterThan(1000);
    expect(empty).toBeGreaterThan(1000);
    // Ecken der Ausgabe bleiben leer: keine Rechteck-Erweiterung
    expect(a[0]).toBe(0);
  });

  it('Kreis mit Aussparung: die Kontur folgt auch dem Loch, nur bis w hinein', () => {
    const S = 80, c = (S - 1) / 2;
    const ring = (x: number, y: number) => (Math.hypot(x - c, y - c) <= 30 && Math.hypot(x - c, y - c) > 18 ? 255 : 0);
    const a = outlineAlpha(pixels(S, S, ring), W);
    const P = S + 2 * W;
    const at = (x: number, y: number) => a[(y + W) * P + x + W]!;
    expect(at(Math.round(c), Math.round(c))).toBe(0); // Mitte des Lochs (18 - w = 12 px vom Rand) bleibt frei
    expect(at(Math.round(c) + 15, Math.round(c))).toBe(255); // 3 px ins Loch hinein: Kontur
  });

  it('1 × 1 und komplett durchsichtig: keine Exception (Rechteck bzw. leer)', () => {
    expect(outlineAlpha(pixels(1, 1, () => 255), W).every((v) => v === 255)).toBe(true);
    const none = outlineAlpha(pixels(1, 1, () => 0), W);
    expect(none.length).toBe((1 + 2 * W) ** 2);
    expect(none.every((v) => v === 0)).toBe(true);
    expect(outlineAlpha(pixels(40, 30, () => 0), W).every((v) => v === 0)).toBe(true);
  });

  it('halbtransparente Kanten zählen als Inhalt erst ab halber Deckkraft, bleiben aber gedeckt', () => {
    const a = outlineAlpha(pixels(20, 20, (x, y) => (x === 10 && y === 10 ? 100 : 0)), W);
    const P = 20 + 2 * W;
    expect(a[(10 + W) * P + 10 + W]).toBe(100); // eigene Deckkraft bleibt, keine Erweiterung
    expect(a[(10 + W) * P + 10 + W + 2]).toBe(0);
  });
});

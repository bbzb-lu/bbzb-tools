import { describe, expect, it } from 'vitest';
import { newMask, type Mask } from '../model/mask';
import { alphaFromModel, hasSubject, maskFromAlpha } from './toMask';

describe('maskFromAlpha', () => {
  it('2:1 Eingabe bleibt 2:1, linke Hälfte sichtbar, rechte nicht', () => {
    const alpha = new Uint8ClampedArray([255, 255, 0, 0, 255, 255, 0, 0]); // 4 x 2
    const m = maskFromAlpha({ width: 4, height: 2, alpha }, { width: 8, height: 4 });
    expect([m.width, m.height, m.data.length]).toEqual([8, 4, 32]);
    expect(m.data[0]).toBe(255);
    expect(m.data[8 * 3 + 7]).toBe(0);
    expect(m.data[8 * 3 + 1]).toBe(255);
    expect(m.data[6]).toBe(0);
    expect(m.data[3]).toBeGreaterThan(0); // Übergang ist weich, nicht hart
    expect(m.data[3]).toBeLessThan(255);
  });

  it('gleiche Grösse gibt die Werte unverändert zurück', () => {
    const alpha = new Uint8ClampedArray([0, 100, 200, 255]);
    expect([...maskFromAlpha({ width: 2, height: 2, alpha }, { width: 2, height: 2 }).data]).toEqual([0, 100, 200, 255]);
  });
});

describe('hasSubject', () => {
  const filled = (v: number, share: number): Mask => {
    const m = newMask(10, 10);
    m.data.fill(0).fill(v, 0, Math.round(100 * share));
    return m;
  };
  it('leer: nein, voll: nein, Mitte gefüllt: ja', () => {
    expect(hasSubject(filled(255, 0))).toBe(false);
    expect(hasSubject(newMask(10, 10))).toBe(false);
    expect(hasSubject(filled(255, 0.4))).toBe(true);
  });
  it('Grenzen sind eingeschlossen: genau minCover und maxCover zählen als Motiv', () => {
    expect(hasSubject(filled(255, 0.01))).toBe(false);
    expect(hasSubject(filled(255, 0.02))).toBe(true);
    expect(hasSubject(filled(255, 0.98))).toBe(true);
    expect(hasSubject(filled(255, 0.99))).toBe(false);
  });
});

describe('alphaFromModel', () => {
  // Quadratische Modellausgabe (4 x 4, Foto gequetscht): nur die linke Spalte ist Motiv, Rohwerte nicht in 0..1
  const out = Float32Array.from({ length: 16 }, (_, i) => (i % 4 === 0 ? 3 : -1));

  it('min-max normalisiert und quadratisch; auf eine 3:1-Maske gestreckt liegt die Kante bei einem Viertel der Breite', () => {
    const a = alphaFromModel(out, 4);
    expect([a.width, a.height, a.alpha[0], a.alpha[1]]).toEqual([4, 4, 255, 0]);
    // Gestreckt (nicht zugeschnitten oder mit Rand): Motiv links bis x = 75 von 300, über die ganze Höhe
    const m = maskFromAlpha(a, { width: 300, height: 100 });
    expect([m.data[30], m.data[99 * 300 + 30], m.data[120], m.data[99 * 300 + 299]]).toEqual([255, 255, 0, 0]);
  });

  it('flache Ausgabe (kein Motiv) gibt 0 statt NaN', () => {
    expect([...alphaFromModel(new Float32Array(16).fill(0.7), 4).alpha]).toEqual(new Array(16).fill(0));
  });
});

import { describe, expect, it } from 'vitest';
import { clampCrop, coverCrop, insertFrame, resizeCrop } from './crop';

describe('crop', () => {
  it('coverCrop füllt Querformat-Rahmen mit Hochformat-Bild', () => {
    expect(coverCrop({ width: 2160, height: 1350 }, { width: 3000, height: 4000 })).toEqual({
      x: 0,
      y: -(4000 * 0.72 - 1350) / 2,
      scale: 0.72,
    });
  });
  it('coverCrop zentriert horizontal bei breitem Bild', () => {
    expect(coverCrop({ width: 100, height: 100 }, { width: 200, height: 100 })).toEqual({ x: -50, y: 0, scale: 1 });
  });
  it('clampCrop verhindert Lücken und Unterskalierung', () => {
    const c = clampCrop({ width: 100, height: 100 }, { width: 200, height: 100 }, { x: 50, y: -10, scale: 0.5 });
    expect(c).toEqual({ x: 0, y: 0, scale: 1 });
  });
  it('clampCrop begrenzt nach links/unten', () => {
    const c = clampCrop({ width: 100, height: 100 }, { width: 200, height: 100 }, { x: -500, y: 0, scale: 1 });
    expect(c).toEqual({ x: -100, y: 0, scale: 1 });
  });
  it('clampCrop lässt gültigen Ausschnitt unverändert', () => {
    const crop = { x: -30, y: -20, scale: 2 };
    expect(clampCrop({ width: 100, height: 100 }, { width: 100, height: 100 }, crop)).toEqual(crop);
  });
});

describe('resizeCrop', () => {
  const img = { width: 4000, height: 3000 };
  it('proportional: Inhalt skaliert mit, Ausschnitt bleibt gleich', () => {
    const crop = { x: -300, y: -200, scale: 0.6 }; // manuell verschoben und gezoomt
    const r = resizeCrop({ width: 1000, height: 800 }, { width: 1500, height: 1200 }, img, crop);
    expect(r).toEqual({ x: -450, y: -300, scale: 0.9 });
  });
  it('proportional verkleinern unter Deckend-Grenze: wird gedeckt gehalten', () => {
    const r = resizeCrop({ width: 1000, height: 750 }, { width: 500, height: 375 }, img, coverCrop({ width: 1000, height: 750 }, img));
    expect(r.scale).toBeCloseTo(0.125);
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo(0);
  });
  it('frei: zentriert, Zoom bleibt', () => {
    const r = resizeCrop({ width: 1000, height: 800 }, { width: 1600, height: 800 }, img, { x: -300, y: -200, scale: 0.6 });
    expect(r.scale).toBeCloseTo(0.6);
    expect(r.x).toBeCloseTo((1600 - 4000 * 0.6) / 2);
    expect(r.y).toBeCloseTo((800 - 3000 * 0.6) / 2);
  });
  it('frei: zu klein wird auf deckend vergrössert und zentriert', () => {
    const r = resizeCrop({ width: 1000, height: 800 }, { width: 3000, height: 800 }, img, { x: 0, y: 0, scale: 0.3 });
    expect(r.scale).toBeCloseTo(0.75);
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo((800 - 2250) / 2);
  });
  it('Toleranz: Rundung bis 1e-3 zählt als proportional', () => {
    const crop = { x: -300, y: -200, scale: 0.6 };
    const prev = { width: 1000, height: 800 };
    // sx = 1.5, sy = 1.5009: innerhalb der Toleranz, Inhalt skaliert mit sx
    expect(resizeCrop(prev, { width: 1500, height: 1200.72 }, img, crop)).toEqual({ x: -450, y: -300, scale: 0.9 });
    // sx = 1.5, sy = 1.502: ausserhalb, freies Verhalten
    const next = { width: 1500, height: 1201.6 };
    expect(resizeCrop(prev, next, img, crop).x).toBeCloseTo((1500 - 4000 * 0.6) / 2);
  });
});

describe('insertFrame', () => {
  it('Querformat in Story füllt die Breite, vertikal zentriert', () => {
    expect(insertFrame({ x: 1080, y: 0, width: 1080, height: 1920 }, { width: 3000, height: 2000 })).toEqual({ x: 1080, y: 600, width: 1080, height: 720 });
  });
  it('Hochformat 3:4 im Post wird ganz sichtbar eingepasst', () => {
    expect(insertFrame({ x: 0, y: 0, width: 1080, height: 1350 }, { width: 3000, height: 4000 })).toEqual({ x: 33.75, y: 0, width: 1012.5, height: 1350 });
  });
  it('genau 4:5 füllt die Post-Slide', () => {
    expect(insertFrame({ x: 0, y: 0, width: 1080, height: 1350 }, { width: 800, height: 1000 })).toEqual({ x: 0, y: 0, width: 1080, height: 1350 });
  });
});

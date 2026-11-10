import { describe, expect, it } from 'vitest';
import { el, project } from './fixtures';
import { maskIdsOf, canvasToMask, invertMask, maskScale, maskSize, newMask, paintStroke, softenMask, strokeBounds, type Mask } from './mask';
import { referencedAssetIds, withReferencedAssets } from './elements';

const at = (m: Mask, x: number, y: number) => m.data[y * m.width + x]!;
const hide = { radius: 5, hardness: 1, mode: 'hide' } as const;

describe('Maske', () => {
  it('leere Maske: alles sichtbar', () => {
    const m = newMask(8, 4);
    expect(m.data).toHaveLength(32);
    expect(m.data.every((v) => v === 255)).toBe(true);
  });

  it('maskSize: lange Seite höchstens maxSize, Seitenverhältnis bleibt', () => {
    expect(maskSize({ width: 4096, height: 2048 })).toEqual({ width: 2048, height: 1024 });
    expect(maskSize({ width: 1000, height: 600 })).toEqual({ width: 1000, height: 600 });
    expect(maskSize({ width: 100, height: 4096 })).toEqual({ width: 50, height: 2048 });
  });

  it('harter Strich ändert nur Punkte im Radius', () => {
    const m = newMask(40, 40);
    paintStroke(m, [{ x: 20, y: 20 }], hide);
    for (let y = 0; y < 40; y++)
      for (let x = 0; x < 40; x++) {
        const d = Math.hypot(x + 0.5 - 20, y + 0.5 - 20);
        expect(at(m, x, y)).toBe(d <= 5 ? 0 : 255);
      }
  });

  it('weicher Strich fällt zum Rand ab: Mitte ganz weg, Rand fast sichtbar, ausserhalb unberührt', () => {
    const m = newMask(60, 60);
    paintStroke(m, [{ x: 30, y: 30 }], { radius: 20, hardness: 0, mode: 'hide' });
    expect(at(m, 30, 30)).toBeLessThan(15);
    expect(at(m, 40, 30)).toBeGreaterThan(at(m, 35, 30));
    expect(at(m, 35, 30)).toBeGreaterThan(at(m, 31, 30));
    expect(at(m, 50, 30)).toBe(255);
    expect(at(m, 30, 55)).toBe(255);
  });

  it('Einblenden stellt wieder her', () => {
    const m = newMask(40, 40);
    paintStroke(m, [{ x: 20, y: 20 }], hide);
    paintStroke(m, [{ x: 20, y: 20 }], { ...hide, mode: 'show' });
    expect(m.data.every((v) => v === 255)).toBe(true);
  });

  it('Strich mit Weg: Linie ist lückenlos, Überlappung summiert sich nicht auf', () => {
    const m = newMask(100, 20);
    paintStroke(m, [{ x: 10, y: 10 }, { x: 90, y: 10 }], { radius: 4, hardness: 0.5, mode: 'hide' });
    for (let x = 10; x <= 90; x++) expect(at(m, x, 10)).toBeLessThanOrEqual(at(m, 10, 10) + 1);
    expect(at(m, 50, 10)).toBe(at(m, 10, 10));
  });

  it('Umkehren zweimal ergibt das Ausgangsbild', () => {
    const m = newMask(40, 40);
    paintStroke(m, [{ x: 20, y: 20 }], { radius: 9, hardness: 0.3, mode: 'hide' });
    const before = Uint8ClampedArray.from(m.data);
    invertMask(m);
    expect(at(m, 20, 20)).toBe(255);
    expect(at(m, 0, 0)).toBe(0);
    invertMask(m);
    expect([...m.data]).toEqual([...before]);
  });

  it('weich zeichnen ändert Kanten, nicht Flächen', () => {
    const m = newMask(40, 40);
    paintStroke(m, [{ x: 20, y: 20 }], { radius: 8, hardness: 1, mode: 'hide' });
    const before = Uint8ClampedArray.from(m.data);
    softenMask(m, 3);
    expect(at(m, 20, 20)).toBe(0); // Fläche
    expect(at(m, 2, 2)).toBe(255);
    const edge = Array.from({ length: 40 }, (_, x) => at(m, x, 20)).filter((v, x) => v !== before[20 * 40 + x]);
    expect(edge.length).toBeGreaterThan(0);
    expect(edge.every((v) => v > 0 && v < 255)).toBe(true);
  });

  it('Strich am und über den Bildrand wird geklemmt, kein Fehler', () => {
    const m = newMask(20, 20);
    paintStroke(m, [{ x: -50, y: -50 }, { x: 0, y: 0 }, { x: 70, y: 10 }], { radius: 6, hardness: 1, mode: 'hide' });
    expect(at(m, 0, 0)).toBe(0);
    expect(at(m, 19, 2)).toBe(0);
    expect(at(m, 19, 19)).toBe(255);
    paintStroke(m, [{ x: 500, y: 500 }], hide); // ganz ausserhalb
    expect(at(m, 19, 19)).toBe(255);
    expect(m.data).toHaveLength(400);
  });
});

describe('Bereich eines Strichs (nur dieser wird neu gezeichnet)', () => {
  it('enthält jedes geänderte Pixel, ist am Rand begrenzt', () => {
    const m = newMask(60, 40);
    const pts = [{ x: -3, y: 10 }, { x: 25, y: 38 }];
    paintStroke(m, pts, { radius: 7, hardness: 0.3, mode: 'hide' });
    const r = strokeBounds(m, pts, 7)!;
    expect(r.x).toBe(0);
    expect(r.y + r.height).toBe(40);
    for (let y = 0; y < 40; y++)
      for (let x = 0; x < 60; x++)
        if (at(m, x, y) !== 255) expect(x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height, `${x},${y}`).toBe(true);
  });
  it('ganz ausserhalb der Maske: null', () => {
    expect(strokeBounds(newMask(20, 20), [{ x: -30, y: 5 }, { x: -12, y: 50 }], 5)).toBeNull();
    expect(strokeBounds(newMask(20, 20), [{ x: 24, y: 5 }], 5)).not.toBeNull();
  });
});

describe('Strich auf den sichtbaren Ausschnitt begrenzt (clip)', () => {
  const clip = { x: 10.4, y: 5, width: 20.2, height: 20 }; // Pixel 10 bis 30 (angeschnittene Randpixel zählen mit)
  const inClip = (x: number, y: number) => x >= 10 && x < 31 && y >= 5 && y < 25;
  it('Strich aus dem Ausschnitt hinaus und grosser Pinsel am Rand: draussen nichts, drinnen bis an den Rand aus', () => {
    const m = newMask(50, 40);
    const pts = [{ x: 20, y: 15 }, { x: 45, y: 15 }, { x: 45, y: 38 }];
    paintStroke(m, pts, { radius: 12, hardness: 1, mode: 'hide', clip });
    for (let y = 0; y < 40; y++) for (let x = 0; x < 50; x++) if (!inClip(x, y)) expect(at(m, x, y), `${x},${y}`).toBe(255);
    expect([at(m, 30, 15), at(m, 30, 24), at(m, 20, 5)]).toEqual([0, 0, 0]);
    const r = strokeBounds(m, pts, 12, clip)!;
    expect(r.x >= 10 && r.y >= 5 && r.x + r.width <= 31 && r.y + r.height <= 25, JSON.stringify(r)).toBe(true);
  });
  it('Stempel mit Mitte ausserhalb erreicht die Pixel drinnen; ganz daneben: nichts, Bereich null', () => {
    const m = newMask(50, 40);
    paintStroke(m, [{ x: 33, y: 15 }], { radius: 5, hardness: 1, mode: 'hide', clip });
    expect([at(m, 30, 15), at(m, 31, 15)]).toEqual([0, 255]);
    expect(strokeBounds(m, [{ x: 45, y: 15 }], 5, clip)).toBeNull();
  });
});

describe('Leinwandpunkt in Maskenpunkt', () => {
  const img = { width: 400, height: 200 };
  const mask = { width: 200, height: 100 }; // halbe Auflösung
  const area = { x: 0, y: 0, width: 100, height: 100 };
  const box = (o = {}) => ({ x: 1000, y: 50, width: 100, height: 100, rotation: 0, ...o });
  const NO = { x: false, y: false };
  const X = { x: true, y: false };
  const near = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    expect(a.x).toBeCloseTo(b.x, 6);
    expect(a.y).toBeCloseTo(b.y, 6);
  };

  it('ohne Ausschnitt, Spiegeln, Drehung: Box-Ecke = Bildpunkt des Ausschnitts', () => {
    // crop scale 1: Bild zeigt (0,0)..(100,100) des Bildes (Bild 400 px), Maske halb so gross
    const p = canvasToMask(box(), area, { x: 0, y: 0, scale: 1 }, NO, img, mask, { x: 1040, y: 70 });
    near(p, { x: 20, y: 10 });
  });

  it('Ausschnitt: crop.x/y verschiebt, scale vergrössert', () => {
    const c = { x: -100, y: -20, scale: 2 };
    // Box-lokal (40,20): Bildpunkt ((40+100)/2, (20+20)/2) = (70,20) → Maske (35,10)
    near(canvasToMask(box(), area, c, NO, img, mask, { x: 1040, y: 70 }), { x: 35, y: 10 });
  });

  it('Spiegeln: lokale x-Achse läuft von rechts', () => {
    const c = { x: 0, y: 0, scale: 1 };
    near(canvasToMask(box(), area, c, X, img, mask, { x: 1040, y: 70 }), { x: 30, y: 10 });
  });

  it('Senkrecht spiegeln: lokale y-Achse läuft von unten', () => {
    const c = { x: 0, y: 0, scale: 1 };
    // lokal (40, 20) → gespiegelt (40, 80) → Maske (20, 40)
    near(canvasToMask(box(), area, c, { x: false, y: true }, img, mask, { x: 1040, y: 70 }), { x: 20, y: 40 });
    near(canvasToMask(box(), area, c, { x: true, y: true }, img, mask, { x: 1040, y: 70 }), { x: 30, y: 40 });
  });

  it('Drehung um die linke obere Ecke (x, y)', () => {
    const c = { x: 0, y: 0, scale: 1 };
    // 90° im Uhrzeigersinn: lokaler Punkt (40, 20) liegt bei (x - 20, y + 40)
    near(canvasToMask(box({ rotation: 90 }), area, c, NO, img, mask, { x: 980, y: 90 }), { x: 20, y: 10 });
  });

  it('unproportionale Box mit Innenrahmen (area versetzt)', () => {
    const a = { x: 24, y: 24, width: 252, height: 52 };
    const c = { x: -10, y: -4, scale: 0.5 };
    // lokal (74, 44) → area (50, 20) → Bildpunkt ((50+10)/0.5, (20+4)/0.5) = (120, 48) → Maske (60, 24)
    near(canvasToMask(box({ width: 300, height: 100 }), a, c, NO, img, mask, { x: 1074, y: 94 }), { x: 60, y: 24 });
  });

  it('Spur, gedreht + gespiegelt, trifft denselben Bildpunkt wie die Vorwärtsrechnung', () => {
    const b = box({ rotation: 30, width: 160, height: 80 });
    const c = { x: -20, y: -5, scale: 1.5 };
    const a = { x: 0, y: 0, width: 160, height: 80 };
    const ip = { x: 123, y: 61 }; // Bildpunkt in Asset-Pixeln
    const lx = c.x + ip.x * c.scale; // gespiegelt: area.width - ...
    const local = { x: 160 - lx, y: c.y + ip.y * c.scale };
    const r = (30 * Math.PI) / 180;
    const pt = { x: b.x + Math.cos(r) * local.x - Math.sin(r) * local.y, y: b.y + Math.sin(r) * local.x + Math.cos(r) * local.y };
    near(canvasToMask(b, a, c, X, img, mask, pt), { x: ip.x / 2, y: ip.y / 2 });
  });

  it('maskScale: Maskenpixel je Leinwandeinheit', () => {
    expect(maskScale(img, mask, { x: 0, y: 0, scale: 2 })).toBeCloseTo(0.25);
  });
});

describe('Maske im Projekt', () => {
  const M = 'b'.repeat(64);
  const A = 'a'.repeat(64);
  const meta = { mime: 'image/png', width: 10, height: 10, name: 'x' };
  const p = () => ({
    ...project(1, [el({ id: 'f', type: 'photo', props: { assetId: A, mask: M, crop: { x: 0, y: 0, scale: 1 } } })]),
    assets: { [A]: meta, [M]: meta, ['c'.repeat(64)]: meta },
  });

  it('maskIdsOf liest props.mask', () => {
    expect([...maskIdsOf(p())]).toEqual([M]);
  });

  it('Maske zählt als referenziertes Asset, Verwaiste fallen weg', () => {
    expect([...referencedAssetIds(p())].sort()).toEqual([A, M]);
    expect(Object.keys(withReferencedAssets(p()).assets).sort()).toEqual([A, M]);
  });
});

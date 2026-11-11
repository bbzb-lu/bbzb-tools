import { expect, it } from 'vitest';
import { effects } from '../../core/registries';
import { registerPlugins } from '..';
import { adjustPixels, lookPixels, NEUTRAL } from './look';

const px = (...rgb: number[]) => new Uint8ClampedArray([...rgb, 255]);
const lum = (d: Uint8ClampedArray) => 0.299 * d[0]! + 0.587 * d[1]! + 0.114 * d[2]!;

it('BBZB-Look wärmt (R hoch, B runter), Helligkeit bleibt, Schwarz bleibt Schwarz', () => {
  const grey = px(128, 128, 128);
  lookPixels(grey);
  expect(grey[0]! - grey[2]!).toBeGreaterThan(10);
  expect(Math.abs(lum(grey) - 128)).toBeLessThan(1.5);
  expect(grey[3]).toBe(255);
  const black = px(0, 0, 0);
  lookPixels(black);
  expect([...black]).toEqual([0, 0, 0, 255]);
});

it('Bildregler: neutral ändert nichts; jeder Regler wirkt in die erwartete Richtung', () => {
  const run = (p: Partial<typeof NEUTRAL>, ...rgb: number[]) => {
    const d = px(...rgb);
    adjustPixels(d, { ...NEUTRAL, ...p });
    return [...d.subarray(0, 3)];
  };
  expect(run({}, 10, 100, 200)).toEqual([10, 100, 200]);
  expect(run({ brightness: 50 }, 100, 100, 100)[0]).toBeGreaterThan(120);
  expect(run({ brightness: -50 }, 100, 100, 100)[0]).toBeLessThan(80);
  expect(run({ contrast: 50 }, 200, 200, 200)[0]).toBeGreaterThan(220);
  expect(run({ contrast: 50 }, 50, 50, 50)[0]).toBeLessThan(30);
  const [r, , b] = run({ saturation: -50 }, 200, 100, 0);
  expect(r! - b!).toBeLessThan(120);
  expect(run({ saturation: 50 }, 150, 100, 50)[0]).toBeGreaterThan(160);
  const warm = run({ warmth: 50 }, 100, 100, 100);
  expect(warm[0]).toBeGreaterThan(100);
  expect(warm[2]).toBeLessThan(100);
  const cool = run({ warmth: -50 }, 100, 100, 100);
  expect(cool[2]! - cool[0]!).toBeGreaterThan(10);
});

it('Look und Regler sind Effekte; aus bzw. neutral heisst: nichts läuft', () => {
  registerPlugins();
  expect(effects.get('look').active({ on: false })).toBe(false);
  expect(effects.get('look').active({ on: true })).toBe(true);
  expect(effects.get('adjust').active(NEUTRAL)).toBe(false);
  expect(effects.get('adjust').active({ ...NEUTRAL, warmth: -1 })).toBe(true);
});

import { expect, it } from 'vitest';
import { scrimLine, scrimSteps } from './scrim';
import { scrimsOf, type PhotoProps, type Scrim } from '../elements/photo/schema';

it('Verlauf beginnt an der gewählten Kante und endet nach der Reichweite (Anteil der Kantenlänge quer dazu)', () => {
  expect(scrimLine('oben', 100, 200, 50)).toEqual([0, 0, 0, 100]);
  expect(scrimLine('unten', 100, 200, 50)).toEqual([0, 200, 0, 100]);
  expect(scrimLine('links', 100, 200, 30)).toEqual([0, 0, 30, 0]);
  expect(scrimLine('rechts', 100, 200, 100)).toEqual([100, 0, 0, 0]);
});

it('Ecken laufen diagonal von der Ecke nach [w·k, h·k] bzw. gespiegelt', () => {
  expect(scrimLine('obenLinks', 200, 100, 50)).toEqual([0, 0, 100, 50]);
  expect(scrimLine('obenRechts', 200, 100, 50)).toEqual([200, 0, 100, 50]);
  expect(scrimLine('untenLinks', 200, 100, 50)).toEqual([0, 100, 100, 50]);
  expect(scrimLine('untenRechts', 200, 100, 50)).toEqual([200, 100, 100, 50]);
});

const base: PhotoProps = { crop: { x: 0, y: 0, scale: 1 } };
const s = (side: Scrim['side']): Scrim => ({ side, strength: 'mittel' });

it('scrimsOf liest scrims, sonst das alte scrim als Liste mit einem Element, sonst leer', () => {
  expect(scrimsOf({ ...base, scrim: s('oben') })).toEqual([s('oben')]);
  expect(scrimsOf({ ...base, scrims: [s('unten'), s('links')], scrim: s('oben') })).toEqual([s('unten'), s('links')]);
  expect(scrimsOf(base)).toEqual([]);
  expect(scrimsOf({ ...base, scrims: [] })).toEqual([]);
});

it('scrimSteps: ein Schritt je Verlauf, leere Liste gibt []; gespiegelt tauschen links/rechts auch bei Ecken', () => {
  expect(scrimSteps(base)).toEqual([]);
  expect(scrimSteps({ ...base, scrim: s('unten') })).toEqual([{ side: 'unten', strength: 'mittel', reach: 56, light: false }]);
  const sides: Scrim['side'][] = ['oben', 'unten', 'links', 'rechts', 'obenLinks', 'obenRechts', 'untenLinks', 'untenRechts'];
  const flipped = scrimSteps({ ...base, flipX: true, scrims: sides.map(s) }).map((p) => p!.side);
  expect(flipped).toEqual(['oben', 'unten', 'rechts', 'links', 'obenRechts', 'obenLinks', 'untenRechts', 'untenLinks']);
});

import { expect, it } from 'vitest';
import { effects } from '../../core/registries';
import { registerPlugins } from '..';
import { toMidGrey } from './grain';

const W = 64;
/** Graue Textur: Helligkeitsverlauf von links nach rechts plus Schachbrett-Korn ±4. */
function texture(): Uint8ClampedArray {
  const d = new Uint8ClampedArray(W * W * 4);
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const v = 20 + x + ((x + y) % 2 ? 4 : -4);
      d.set([v, v, v, 255], (y * W + x) * 4);
    }
  }
  return d;
}
const at = (d: Uint8ClampedArray, x: number, y: number) => d[(y * W + x) * 4]!;

it('Textur auf Mittelgrau: grau, Mittelwert 128, feines Korn verstärkt, grober Verlauf bleibt', () => {
  const d = texture();
  toMidGrey(d, W, W, 3);
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) {
    expect([d[i + 1], d[i + 2], d[i + 3]]).toEqual([d[i], d[i], 255]);
    sum += d[i]!;
  }
  expect(sum / (W * W)).toBeCloseTo(128, 0);
  // Nachbarpixel: vorher 8 + 1 auseinander, jetzt etwa das Dreifache
  expect(Math.abs(at(d, 31, 30) - at(d, 32, 30))).toBeGreaterThan(20);
  // Verlauf über 40 Spalten bleibt etwa 40 (Mittel zweier Nachbarn hebt das Korn auf)
  const col = (x: number) => (at(d, x, 30) + at(d, x + 1, 30)) / 2;
  expect(col(52) - col(12)).toBeCloseTo(40, -1);
});

it('Korn ist als Effekt registriert; Deckkraft 0 heisst: nichts läuft', () => {
  registerPlugins();
  const grain = effects.get('grain');
  expect(grain.active({ opacity: 0 })).toBe(false);
  expect(grain.active({ opacity: 0.14 })).toBe(true);
});

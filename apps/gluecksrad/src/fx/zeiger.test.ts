import { expect, it } from 'vitest';
import { indexUnterZeiger, winkelAusMatrix } from './zeiger';

it('liest das Segment unter dem Zeiger', () => {
  expect(indexUnterZeiger(0, 4)).toBe(0);
  expect(indexUnterZeiger(-90, 4)).toBe(1); // Rad dreht links, Segment 1 kommt oben an
  expect(indexUnterZeiger(10 * 360 + 45, 4)).toBe(3);
});

it('passt zur Landeformel der App für jedes Segment', () => {
  for (let n = 1; n <= 12; n++)
    for (let i = 0; i < n; i++) {
      const d = 1234;
      const mitte = (i + 0.5) * (360 / n);
      expect(indexUnterZeiger(Math.ceil(d / 360) * 360 + 4 * 360 + 360 - mitte, n), `n=${n} i=${i}`).toBe(i);
    }
});

it('liest den Winkel aus der CSS-Matrix', () => {
  expect(winkelAusMatrix('none')).toBe(0);
  expect(Math.round(winkelAusMatrix('matrix(0, 1, -1, 0, 0, 0)'))).toBe(90);
});

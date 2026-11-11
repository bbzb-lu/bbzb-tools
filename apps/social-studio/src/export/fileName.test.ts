import { expect, it } from 'vitest';
import { safeFileName } from './fileName';

it.each([
  ['Sporttag 2026', 'Sporttag 2026'],
  ['Bühne/Luzern: «Tag»', 'Buehne-Luzern-Tag'],
  ['Café', 'Cafe'],
  ['  ...  ', 'bbzb-social'],
  ['Ärger über Öl', 'Aerger ueber Oel'],
  ['a'.repeat(59) + '/b', 'a'.repeat(59)],
])('%s → %s', (i, o) => expect(safeFileName(i)).toBe(o));

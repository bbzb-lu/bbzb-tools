import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { isoDatum, parseLinien } from './menu';

test('parseLinien liest alle vier Linien des Fixtures', () => {
  const l = parseLinien(readFileSync(new URL('./fixtures/sv-tag.txt', import.meta.url), 'utf8'));
  expect(l.length).toBeGreaterThanOrEqual(1);
  for (const x of l) { expect(x.linie).not.toBe(''); expect(x.gericht).not.toBe(''); expect(Object.keys(x.preise).length).toBeGreaterThan(0); }
});
test('parseLinien: Linie ohne Beilagen und mit nur einem Preis', () => {
  expect(parseLinien('Querbeet\nFregola Sarda\nMA  CHF 14.50\nAlternative\nDöner\nKraut | Salat\nSCHU  CHF 14.00')).toEqual([
    { linie: 'Querbeet', gericht: 'Fregola Sarda', beilagen: '', preise: { MA: '14.50' } },
    { linie: 'Alternative', gericht: 'Döner', beilagen: 'Kraut | Salat', preise: { SCHU: '14.00' } },
  ]);
});
test('parseLinien: leerer Text ergibt leere Liste', () => expect(parseLinien(' \n ')).toEqual([]));
test('isoDatum über den Jahreswechsel', () => {
  expect(isoDatum('28.12.', '2026-12-28')).toBe('2026-12-28');
  expect(isoDatum('01.01.', '2026-12-28')).toBe('2027-01-01');
  expect(isoDatum('1.1.', '2026-12-28')).toBe('2027-01-01');
});

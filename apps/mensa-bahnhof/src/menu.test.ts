import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { gueltig, isoDatum, parseLinien, pruefeWoche, wochentage, zielMontag } from './menu';
import type { Tag } from './menu';

test('parseLinien liest alle vier Linien des Fixtures', () => {
  const l = parseLinien(readFileSync(new URL('./fixtures/sv-tag.txt', import.meta.url), 'utf8'));
  expect(l).toHaveLength(4);
  expect(l[0]?.beilagen).toBe('Kräuterjus, Bratkartoffeln , Butterbohnen');
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
test('parseLinien: mehrzeilige Beilagen mit einem Leerzeichen verbunden', () => {
  expect(parseLinien('Kunterbunt\nSteak\nJus, Reis\nund Gemüse\nMA  CHF 14.50')[0]?.beilagen).toBe('Jus, Reis und Gemüse');
});
test('zielMontag: Mo bis Do laufende Woche, Fr bis So nächste', () => {
  expect(zielMontag(new Date('2026-11-23T04:00:00Z'))).toBe('2026-11-23');
  expect(zielMontag(new Date('2026-11-26T12:00:00Z'))).toBe('2026-11-23');
  expect(zielMontag(new Date('2026-11-27T17:00:00Z'))).toBe('2026-11-30');
  expect(zielMontag(new Date('2026-11-29T23:30:00Z'))).toBe('2026-11-30');
  expect(zielMontag(new Date('2026-12-26T05:00:00Z'))).toBe('2026-12-28');
  expect(zielMontag(new Date('2027-03-28T01:30:00Z'))).toBe('2027-03-29'); // Sommerzeitumstellung
});
test('wochentage über Monatsende', () => expect(wochentage('2026-11-30')).toEqual(['2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04']));
const tag = (datum: string, n = 1): Tag => ({ datum, linien: Array.from({ length: n }, () => ({ linie: 'L', gericht: 'G', beilagen: '', preise: { MA: '1.00' } })) });
test('pruefeWoche', () => {
  const ok = { montag: '2026-11-30', tage: wochentage('2026-11-30').map((d) => tag(d)) };
  expect(pruefeWoche(ok, '2026-11-30')).toBeNull();
  expect(pruefeWoche(undefined, '2026-11-30')).toMatch(/fehlt/);
  expect(pruefeWoche({ ...ok, tage: ok.tage.slice(0, 4) }, '2026-11-30')).not.toBeNull();
  expect(pruefeWoche({ ...ok, tage: ok.tage.map((t, i) => (i === 2 ? { ...t, datum: '2026-12-09' } : t)) }, '2026-11-30')).not.toBeNull();
  expect(pruefeWoche({ ...ok, tage: ok.tage.map((t) => tag(t.datum, 0)) }, '2026-11-30')).toBeNull();
  expect(pruefeWoche({ ...ok, tage: [{ datum: '2026-11-30', linien: [{ linie: 'L', gericht: '', beilagen: '', preise: {} }] }, ...ok.tage.slice(1)] }, '2026-11-30')).not.toBeNull();
  expect(pruefeWoche({ ...ok, tage: [{ datum: '2026-11-30', linien: [{ linie: 'L', gericht: 'G', beilagen: '', preise: {} }] }, ...ok.tage.slice(1)] }, '2026-11-30')).not.toBeNull(); // nur Preis fehlt
});
test('gueltig', () => {
  const w = { montag: '2026-11-30', tage: wochentage('2026-11-30').map((d) => tag(d)) };
  const datei = { geholt: '', quelle: '', wochen: [w] };
  expect(gueltig(datei, '2026-11-30')).toBe(true);
  expect(gueltig(datei, '2026-12-07')).toBe(false);
  expect(gueltig(undefined, '2026-11-30')).toBe(false);
});

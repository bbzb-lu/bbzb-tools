import { describe, expect, it } from 'vitest';
import { ansicht, preisAus, tagTitel } from './ansicht';
import { wochentage, type MenuDatei, type Tag, type Woche } from './menu';

const linie = { linie: 'Menü 1', gericht: 'Pasta', beilagen: '', labels: [], preise: { MA: '10.00' } };
const woche = (montag: string, leer: number[] = [0, 1, 2, 3, 4]): Woche => ({
  montag,
  tage: wochentage(montag).map((datum, i): Tag => ({ datum, linien: leer.includes(i) ? [] : [linie] })),
});
const datei = (...wochen: Woche[]): MenuDatei => ({ geholt: '', quelle: '', wochen });
const voll = datei(woche('2026-11-23', []), woche('2026-11-30', []));

describe('ansicht', () => {
  it('Dienstag: heute', () => {
    expect(ansicht(voll, new Date(2026, 10, 24, 10))).toMatchObject({ zustand: 'offen', start: '2026-11-24', titel: 'Heute' });
  });
  it('Samstag: nächste Woche, am Montag', () => {
    expect(ansicht(voll, new Date(2026, 10, 28, 10))).toMatchObject({
      zustand: 'offen', start: '2026-11-30', titel: 'Am Montag', woche: { montag: '2026-11-30' },
    });
  });
  it('Sonntag ohne Folgewoche: fehlt', () => {
    expect(ansicht(datei(woche('2026-11-23', [])), new Date(2026, 10, 29, 10))).toEqual({ zustand: 'fehlt' });
  });
  it('nur alte Wochen: fehlt', () => {
    expect(ansicht(voll, new Date(2026, 11, 7, 10))).toEqual({ zustand: 'fehlt' });
    expect(ansicht(undefined, new Date(2026, 10, 24, 10))).toEqual({ zustand: 'fehlt' });
  });
  it('alle Tage leer: geschlossen', () => {
    expect(ansicht(datei(woche('2026-11-23')), new Date(2026, 10, 24, 10))).toMatchObject({ zustand: 'geschlossen' });
  });
  it('leerer Mittwoch bleibt offen', () => {
    expect(ansicht(datei(woche('2026-11-23', [2])), new Date(2026, 10, 25, 10))).toMatchObject({ zustand: 'offen', start: '2026-11-25' });
  });
});

describe('preisAus', () => {
  it('Standard MA', () => {
    expect(preisAus('')).toBe('MA');
    expect(preisAus('?preis=foo')).toBe('MA');
  });
  it('Gross/Klein egal', () => {
    expect(preisAus('?preis=SCHU')).toBe('SCHU');
    expect(preisAus('?preis=schu')).toBe('SCHU');
    expect(preisAus('?preis=ext')).toBe('EXT');
  });
});

describe('tagTitel', () => {
  it('mit und ohne Wochentag', () => {
    expect(tagTitel('2026-11-24')).toBe('Dienstag 24. November');
    expect(tagTitel('2026-11-24', false)).toBe('24. November');
  });
});

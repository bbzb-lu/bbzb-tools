import { wochentage, type MenuDatei, type Preis, type Woche } from './menu';

export type Gruppe = { preis: Preis; name: string };
export const GRUPPEN: Gruppe[] = [
  { preis: 'MA', name: 'Mitarbeitende' },
  { preis: 'SCHU', name: 'Lernende' },
  { preis: 'EXT', name: 'Externe' },
];

export function preisAus(search: string): Preis {
  const p = (new URLSearchParams(search).get('preis') ?? '').toUpperCase();
  return GRUPPEN.find((g) => g.preis === p)?.preis ?? 'MA';
}

export type Ansicht =
  | { zustand: 'fehlt' }
  | { zustand: 'geschlossen'; woche: Woche }
  | { zustand: 'offen'; woche: Woche; start: string; titel: 'Heute' | 'Am Montag' };

const lokalIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// jetzt in Gerätezeit. Mo bis Fr: laufende Woche ab heute, Sa/So: nächste Woche ab Montag.
export function ansicht(datei: MenuDatei | undefined, jetzt: Date): Ansicht {
  const seitMontag = (jetzt.getDay() + 6) % 7;
  const wochenende = seitMontag >= 5;
  const montag = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate() - seitMontag + (wochenende ? 7 : 0));
  const montagIso = lokalIso(montag);
  const woche = datei?.wochen.find((w) => w.montag === montagIso);
  if (!woche) return { zustand: 'fehlt' };
  if (woche.tage.every((t) => t.linien.length === 0)) return { zustand: 'geschlossen', woche };
  return wochenende
    ? { zustand: 'offen', woche, start: wochentage(montagIso)[0], titel: 'Am Montag' }
    : { zustand: 'offen', woche, start: lokalIso(jetzt), titel: 'Heute' };
}

export function tagTitel(datum: string, wochentag = true): string {
  const [j, m, t] = datum.split('-').map(Number);
  const teile = new Intl.DateTimeFormat('de-CH', { weekday: 'long', day: 'numeric', month: 'long' }).formatToParts(new Date(j, m - 1, t));
  const wert = (typ: string) => teile.find((p) => p.type === typ)?.value;
  const rest = `${wert('day')}. ${wert('month')}`;
  return wochentag ? `${wert('weekday')} ${rest}` : rest;
}

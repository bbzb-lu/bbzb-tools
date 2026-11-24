export type Preis = 'EXT' | 'MA' | 'SCHU';
export type Linie = { linie: string; gericht: string; beilagen: string; preise: Partial<Record<Preis, string>> };
export type Tag = { datum: string; linien: Linie[] }; // datum ISO 'YYYY-MM-DD'
export type Woche = { montag: string; tage: Tag[] };
export type MenuDatei = { geholt: string; quelle: string; wochen: Woche[] };

export const QUELLE = 'https://sv-gastronomie.ch/menu/BBZB,%20Luzern/Mittagsmen%C3%BC';

const PREIS = /^(EXT|MA|SCHU)\s+CHF\s+([\d.]+)$/;

export function parseLinien(text: string): Linie[] {
  const linien: Linie[] = [];
  let kopf: string[] = [];
  let aktuell: Linie | undefined;
  for (const zeile of text.split('\n').map((z) => z.trim()).filter(Boolean)) {
    const m = PREIS.exec(zeile);
    if (m) {
      if (!aktuell) {
        aktuell = { linie: kopf[0] ?? '', gericht: kopf[1] ?? '', beilagen: kopf.slice(2).join(' '), preise: {} };
        linien.push(aktuell);
        kopf = [];
      }
      aktuell.preise[m[1] as Preis] = m[2];
    } else {
      aktuell = undefined;
      kopf.push(zeile);
    }
  }
  return linien;
}

// tagMonat 'TT.MM.' oder 'T.M.', montag ISO. Jahr des Montags, liegt das Datum >7 Tage davor: Folgejahr.
export function isoDatum(tagMonat: string, montag: string): string {
  const [t, mo] = tagMonat.split('.').map(Number);
  const jahr = Number(montag.slice(0, 4));
  const iso = (j: number) => `${j}-${String(mo).padStart(2, '0')}-${String(t).padStart(2, '0')}`;
  const tage = (Date.parse(iso(jahr)) - Date.parse(montag)) / 864e5;
  return iso(tage < -7 ? jahr + 1 : jahr);
}

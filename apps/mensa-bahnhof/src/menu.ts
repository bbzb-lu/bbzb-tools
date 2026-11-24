export type Preis = 'EXT' | 'MA' | 'SCHU';
export type Linie = { linie: string; gericht: string; beilagen: string; labels: string[]; preise: Partial<Record<Preis, string>> };
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
        aktuell = { linie: kopf[0] ?? '', gericht: kopf[1] ?? '', beilagen: kopf.slice(2).join(' '), labels: [], preise: {} };
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

// labels[i] gehört zu linien[i] (Reihenfolge der .product-wrapper = Reihenfolge der Linien), getrimmt, leere entfernt.
export function mitLabels(linien: Linie[], labels: string[][]): Linie[] {
  if (linien.length !== labels.length) throw new Error(`Labels: ${labels.length} Gerichte statt ${linien.length}`);
  return linien.map((l, i) => ({ ...l, labels: labels[i]!.map((x) => x.trim()).filter(Boolean) }));
}

// tagMonat 'TT.MM.' oder 'T.M.', montag ISO. Jahr des Montags, liegt das Datum >7 Tage davor: Folgejahr, >180 Tage danach: Vorjahr.
export function isoDatum(tagMonat: string, montag: string): string {
  const [t, mo] = tagMonat.split('.').map(Number);
  const jahr = Number(montag.slice(0, 4));
  const iso = (j: number) => `${j}-${String(mo).padStart(2, '0')}-${String(t).padStart(2, '0')}`;
  const tage = (Date.parse(iso(jahr)) - Date.parse(montag)) / 864e5;
  return iso(tage < -7 ? jahr + 1 : tage > 180 ? jahr - 1 : jahr);
}

const addTage = (iso: string, n: number) => new Date(Date.parse(iso) + n * 864e5).toISOString().slice(0, 10);

// Mo bis Do: Montag der laufenden Woche, Fr bis So: der nächste. Datum und Wochentag in Zürich.
export function zielMontag(jetzt: Date): string {
  const heute = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit' }).format(jetzt);
  const seitMontag = (new Date(heute).getUTCDay() + 6) % 7;
  return addTage(heute, seitMontag >= 4 ? 7 - seitMontag : -seitMontag);
}

export const wochentage = (montag: string): string[] => [0, 1, 2, 3, 4].map((n) => addTage(montag, n));

export function pruefeWoche(w: Woche | undefined, montag: string): string | null {
  if (!w) return `Woche ${montag} fehlt`;
  const soll = wochentage(montag);
  if (w.tage.length !== 5 || w.tage.some((t, i) => t.datum !== soll[i])) return `Woche ${montag}: falsche Anzahl oder falsche Daten`;
  for (const t of w.tage) {
    if (t.linien.some((l) => !l.gericht || Object.keys(l.preise).length === 0)) return `Woche ${montag}, ${t.datum}: Linie ohne Gericht oder Preis`;
  }
  return null;
}

export const gueltig = (datei: MenuDatei | undefined, montag: string): boolean =>
  pruefeWoche(datei?.wochen.find((w) => w.montag === montag), montag) === null;

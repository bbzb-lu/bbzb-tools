// Liste der zuletzt bearbeiteten Projekte aller Tools, für die Startseite. Bleibt im Browser (localStorage, gleiche Adresse).
export type Zuletzt = { tool: string; id: string; name: string; geaendert: number };

const KEY = 'bbzb-tools.zuletzt';
const MAX = 8;

const gueltig = (e: unknown): e is Zuletzt =>
  !!e && typeof e === 'object' && ['tool', 'id', 'name'].every((k) => typeof (e as Record<string, unknown>)[k] === 'string') && typeof (e as Zuletzt).geaendert === 'number';

/** Neuste zuerst; leer, wenn nichts da, kaputt oder der Speicher gesperrt ist. */
export function zuletzt(): Zuletzt[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter(gueltig) : [];
  } catch {
    return [];
  }
}

function schreibe(liste: Zuletzt[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(liste.slice(0, MAX)));
  } catch {
    // gesperrter Speicher: die Startseite zeigt dann einfach nichts
  }
}

/** Tools rufen das beim Speichern auf. */
export const merkeZuletzt = (e: Zuletzt): void => schreibe([e, ...zuletzt().filter((x) => x.tool !== e.tool || x.id !== e.id)]);

/** Projekt gelöscht oder nicht mehr da. */
export const vergissZuletzt = (tool: string, id: string): void => schreibe(zuletzt().filter((x) => x.tool !== tool || x.id !== id));

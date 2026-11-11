/** Beschreibung eines Embeds aus embeds/<id>/embed.json. */
export type Embed = { id: string; name: string; satz: string; datum: string; extern?: string };

const dateien = import.meta.glob<Omit<Embed, 'id'>>('../../../embeds/*/embed.json', { eager: true, import: 'default' });

/** Alle Embeds ohne `_vorlage`, neueste zuerst. */
export const liste: Embed[] = Object.entries(dateien)
  .map(([pfad, e]) => ({ id: pfad.split('/').at(-2)!, ...e }))
  .filter((e) => !e.id.startsWith('_'))
  .sort((a, b) => b.datum.localeCompare(a.datum) || a.name.localeCompare(b.name, 'de'));

export const nachName = (l: Embed[]): Embed[] => [...l].sort((a, b) => a.name.localeCompare(b.name, 'de'));

// Sudoku kopiert seinen Rennen-Code in die Zwischenablage, im iframe nur mit dieser Erlaubnis
const ERLAUBNIS: Record<string, string> = { sudoku: 'clipboard-write' };

/** Einbettungscode für den SharePoint-Webpart «Einbetten» (Feld Code, nicht Adresse). `origin` = Adresse, unter der diese Seite läuft. */
export const code = (e: Embed, origin: string): string =>
  `<iframe src="${origin}/sharepoint/${e.id}/" width="480" height="350" style="border:0;overflow:hidden" title="${e.name}"${ERLAUBNIS[e.id] ? ` allow="${ERLAUBNIS[e.id]}"` : ''}></iframe>`;

/** «10.08.2026» */
export const datum = (iso: string): string => iso.split('-').reverse().join('.');

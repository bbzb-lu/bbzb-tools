/** Beschriftung aus dem Dateipfad: ohne Ordner und `.txt`, `-` und `_` als Leerzeichen, erster Buchstabe gross. */
export function presetName(datei: string): string {
  const name = (datei.split('/').pop() ?? datei).replace(/\.txt$/, '').replace(/[-_]+/g, ' ');
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// Vorlagen sind Textdateien in apps/gluecksrad/presets/, beim Build eingelesen (kein Request zur Laufzeit)
const dateien = import.meta.glob<string>('../presets/*.txt', { query: '?raw', import: 'default', eager: true });

export const presets: { name: string; text: string }[] = Object.entries(dateien)
  .map(([pfad, text]) => ({ name: presetName(pfad), text }))
  .sort((a, b) => a.name.localeCompare(b.name, 'de'));

// Embeds (embeds/<name>/, statisch ohne Build) prüfen und nach dist/sharepoint/ kopieren.
import { cpSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/** Ordner der Embeds, ohne `_shared` und `_vorlage`. */
export const embedOrdner = (dir) => readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('_')).map((e) => e.name);

// Feste relative Verweise auf Dateien in HTML, CSS und JS; zusammengesetzte Pfade ('…/' + name) fallen weg
const DATEI = String.raw`((?:\.\.?\/)?[\w\- ./äöüÄÖÜ]+\.(?:png|otf|woff2?|svg|jpe?g|gif|css|js))`;
const VERWEIS = new RegExp(String.raw`(["'\`])${DATEI}\1|url\(${DATEI}\)`, 'g');

/** Verweise, deren Datei fehlt, als «Datei: Verweis». Prüft alle Embeds samt `_vorlage`. */
export function fehlendeVerweise(dir) {
  const fehlt = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name === '_shared') continue;
    for (const f of ['index.html', 'style.css', 'script.js']) {
      const p = join(dir, e.name, f);
      if (!existsSync(p)) continue;
      for (const [, , a, b] of readFileSync(p, 'utf8').matchAll(VERWEIS)) {
        const ref = a ?? b;
        if (!existsSync(resolve(dirname(p), ref))) fehlt.push(`${p}: ${ref}`);
      }
    }
  }
  return fehlt;
}

/** Kopiert `_shared` und alle Embeds (ohne `_vorlage`) nach `nach`. */
export function kopiereEmbeds(von, nach) {
  for (const name of ['_shared', ...embedOrdner(von)]) cpSync(join(von, name), join(nach, name), { recursive: true });
}

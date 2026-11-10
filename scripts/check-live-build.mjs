// Prüft, dass der Live-Build den Testhaken nicht enthält (der Test-Build mit `--mode test` darf nie deployt werden).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const KEY = '__bbzbTest'; // globaler Schlüssel aus apps/social-studio/src/testHook.ts

/** Dateien unter `dir`, die den Schlüssel des Testhakens enthalten. */
export function findTestHook(dir) {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => join(e.parentPath, e.name))
    .filter((f) => readFileSync(f).includes(KEY));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const hits = findTestHook('dist');
  if (hits.length) {
    console.error(`Testhaken im Build gefunden, nicht deployen:\n${hits.join('\n')}`);
    process.exit(1);
  }
  console.log('dist/ ohne Testhaken');
}

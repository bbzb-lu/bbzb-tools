// Wählt die Playwright-Projekte für einen PR: nur geänderte Tools, bei gemeinsamen Teilen alle.
// Ausgabe für GitHub Actions: `projects=<Argumente>`; leer heisst alle Projekte.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { tools } from '../apps/startseite/src/tools.ts';

/** Nur Notizen, ändern nichts am Verhalten. */
const harmless = (f) => f.endsWith('.md') || f.startsWith('docs/');

/** `null` = alle Projekte, sonst die Liste der Projektnamen. `ids` sind die Tools mit eigenem e2e-Projekt. */
export function pick(files, ids) {
  const apps = new Set();
  for (const f of files.filter((f) => !harmless(f))) {
    if (f.startsWith('embeds/')) {
      apps.add('sharepoint'); // die Embeds prüft das Projekt der Übersicht
      continue;
    }
    const m = /^apps\/([^/]+)\//.exec(f);
    // Gemeinsames (packages, Startseite, e2e, scripts, Konfiguration) trifft jedes Tool
    if (!m || m[1] === 'startseite') return null;
    apps.add(m[1]);
  }
  return ['suite', ...ids.filter((id) => apps.has(id))];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const base = process.argv[2];
  let projects = null;
  if (base) {
    const files = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], { encoding: 'utf8' }).split('\n').filter(Boolean);
    projects = pick(files, tools.map((t) => t.id).filter((id) => existsSync(`apps/${id}/e2e`)));
  }
  console.log(`projects=${projects ? projects.map((p) => `--project=${p}`).join(' ') : ''}`);
}

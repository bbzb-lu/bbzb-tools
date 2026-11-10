// Neues Tool aus apps/_vorlage: `npm run neues-tool -- <id> "<Name>"`.
import { execSync } from 'node:child_process';
import { cpSync, existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const SATZ = 'Kurz beschreiben, was das Tool erledigt.';

/** Kopiert die Vorlage nach `apps/<id>`, ersetzt die Platzhalter und trägt die Kachel in `tools.ts` ein. */
export function neuesTool(root, id, name) {
  if (!/^[a-z][a-z0-9-]*$/.test(id ?? '')) throw new Error(`Ungültige ID «${id}»: nur Kleinbuchstaben, Ziffern und -, beginnt mit einem Buchstaben.`);
  // landet in TS-Strings, JSX und HTML
  if (!name || !/^[^'"`\\<>{}\n]+$/.test(name)) throw new Error('Name fehlt oder enthält Anführungszeichen, \\, <, > oder {}.');
  const app = join(root, 'apps', id);
  const toolsTs = join(root, 'apps/startseite/src/tools.ts');
  const tools = readFileSync(toolsTs, 'utf8');
  if (existsSync(app) || tools.includes(`id: '${id}'`)) throw new Error(`Das Tool «${id}» gibt es schon.`);
  const end = tools.indexOf('\n];', tools.indexOf('export const tools'));
  if (end < 0) throw new Error('Ende der Liste `tools` in tools.ts nicht gefunden.');

  cpSync(join(root, 'apps/_vorlage'), app, { recursive: true, filter: (src) => !src.includes('node_modules') });
  renameSync(join(app, 'vorschau.png'), join(root, 'apps/startseite/public/vorschau', `${id}.png`));
  for (const e of readdirSync(app, { recursive: true, withFileTypes: true })) {
    if (!e.isFile() || !/\.(json|ts|tsx|html|md)$/.test(e.name)) continue;
    const f = join(e.parentPath, e.name);
    const text = readFileSync(f, 'utf8');
    const neu = text.replaceAll('__ID__', id).replaceAll('__NAME__', name).replace('"name": "vorlage"', `"name": "${id}"`);
    if (neu !== text) writeFileSync(f, neu);
  }
  const eintrag = `\n  {\n    id: '${id}',\n    name: '${name}',\n    satz: '${SATZ}',\n    pfad: '/${id}/',\n    vorschau: 'vorschau/${id}.png',\n    beta: true,\n  },`;
  writeFileSync(toolsTs, tools.slice(0, end) + eintrag + tools.slice(end));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [id, name] = process.argv.slice(2);
  try {
    neuesTool('.', id, name);
  } catch (e) {
    console.error(`${e.message}\nAufruf: npm run neues-tool -- <id> "<Name>"`);
    process.exit(1);
  }
  execSync('npm install', { stdio: 'inherit' }); // trägt den neuen Workspace in package-lock.json ein
  console.log(`apps/${id} angelegt. Jetzt Satz in apps/startseite/src/tools.ts und Vorschau public/vorschau/${id}.png ersetzen.`);
}

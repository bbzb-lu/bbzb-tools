// Baut die ganze Suite nach dist/: Startseite in die Wurzel, jedes Tool nach dist/<id>/.
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

// `--mode <name>` geht an jede App (z. B. `--mode test` für den Test-Build mit Testhaken, nie deployen)
const i = process.argv.indexOf('--mode');
if (i > 0 && !process.argv[i + 1]) throw new Error('--mode braucht einen Namen');
const mode = i > 0 ? ` -- --mode ${process.argv[i + 1]}` : '';
const run = (app) => execSync(`npm run build -w apps/${app}${mode}`, { stdio: 'inherit' });

rmSync('dist', { recursive: true, force: true });
run('startseite');
for (const e of readdirSync('apps', { withFileTypes: true })) {
  if (e.isDirectory() && e.name !== 'startseite' && !e.name.startsWith('_') && existsSync(join('apps', e.name, 'package.json'))) run(e.name);
}
copyFileSync('_headers', join('dist', '_headers'));

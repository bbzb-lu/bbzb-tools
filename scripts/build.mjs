// Baut die ganze Suite nach dist/: Startseite in die Wurzel, jedes Tool nach dist/<id>/.
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const run = (app) => execSync(`npm run build -w apps/${app}`, { stdio: 'inherit' });

rmSync('dist', { recursive: true, force: true });
run('startseite');
for (const e of readdirSync('apps', { withFileTypes: true })) {
  if (e.isDirectory() && e.name !== 'startseite' && !e.name.startsWith('_') && existsSync(join('apps', e.name, 'package.json'))) run(e.name);
}
copyFileSync('_headers', join('dist', '_headers'));

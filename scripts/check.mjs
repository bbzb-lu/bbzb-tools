// Lokales Gate vor jedem PR: typecheck, lint, Unit-Tests, dann e2e nur für die gegenüber main geänderten Tools.
import { execFileSync, execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { pick } from './e2e-projects.mjs';
import { tools } from '../apps/startseite/src/tools.ts';

const sh = (cmd) => execSync(cmd, { stdio: 'inherit' });
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).split('\n').filter(Boolean);

sh('npm run typecheck');
sh('npm run lint');
sh('npm test');
// auch noch nicht committete und neue Dateien zählen
const base = git('merge-base', 'origin/main', 'HEAD')[0];
const files = [...git('diff', '--name-only', base), ...git('ls-files', '--others', '--exclude-standard')];
const projects = pick(files, tools.map((t) => t.id).filter((id) => existsSync(`apps/${id}/e2e`)));
sh(`npx playwright test ${projects ? projects.map((p) => `--project=${p}`).join(' ') : ''}`);

// Holt die lizenzierte Schrift Braveold aus dem privaten Repo nach fonts-private/.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO = 'https://github.com/bbzb-lu/bbzb-tools-fonts.git';
const DIR = 'fonts-private';

export function fontsStatus(dir) {
  return existsSync(join(dir, 'Braveold-Light.otf')) ? 'ok' : 'missing';
}

function run() {
  const strict = process.argv.includes('--strict');
  const git = (args) => execFileSync('git', args, { stdio: 'inherit', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
  try {
    if (existsSync(join(DIR, '.git'))) git(['-C', DIR, 'pull', '--ff-only']);
    else git(['clone', '--depth', '1', REPO, DIR]);
  } catch {
    console.error('Keine Berechtigung für bbzb-tools-fonts. Das Social Studio läuft, exportiert aber ohne Braveold nicht.');
    process.exit(strict ? 1 : 0);
  }
  if (fontsStatus(DIR) !== 'ok') {
    console.error('Braveold-Light.otf fehlt in fonts-private/.');
    process.exit(strict ? 1 : 0);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) run();

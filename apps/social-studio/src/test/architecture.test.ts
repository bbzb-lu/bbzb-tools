import { globSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

// Vitest läuft im Hauptordner der Suite: Pfade vom App-Ordner aus auflösen.
const app = (p = '') => fileURLToPath(new URL(`../../${p}`, import.meta.url));

const files = globSync('src/**/*.{ts,tsx,css}', { cwd: app(), exclude: (f) => /\.test\.tsx?$/.test(f) });
const offenders = (test: (path: string, text: string) => boolean) =>
  files.filter((f) => test(f.replaceAll('\\', '/'), readFileSync(app(f), 'utf8')));

it('der Glob findet den Quelltext (sonst wären die Prüfungen stumm grün)', () => {
  expect(files.length).toBeGreaterThan(100);
});

it('Hex-Farben nur in tokens.ts und ui/theme.ts', () => {
  expect(offenders((p, t) => p !== 'src/tokens.ts' && p !== 'src/ui/theme.ts' && /#[0-9a-fA-F]{6}\b/.test(t))).toEqual([]);
});

it('nur main.tsx importiert aus plugins/', () => {
  expect(
    offenders((p, t) => p !== 'src/main.tsx' && !p.startsWith('src/plugins/') && /from ['"].*plugins\//.test(t)),
  ).toEqual([]);
});

it('keine Datei hat 400 Zeilen oder mehr', () => {
  expect(offenders((_, t) => t.split('\n').length >= 400)).toEqual([]);
});

it('kein «ß» und kein «–» im Quelltext', () => {
  const bad = new RegExp(`[${String.fromCharCode(0x00df, 0x2013)}]`);
  expect(offenders((_, t) => bad.test(t))).toEqual([]);
});

it('kein title-Attribut in ui, canvas, plugins (Tooltips laufen über data-tip)', () => {
  expect(offenders((p, t) => /^src\/(ui|canvas|plugins)\//.test(p) && /\btitle\s*[=:]|setAttribute\(\s*['"]title/.test(t))).toEqual([]);
});

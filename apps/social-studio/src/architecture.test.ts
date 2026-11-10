import { globSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

// Vitest läuft im Hauptordner der Suite: Pfade vom App-Ordner aus auflösen.
const app = (p = '') => fileURLToPath(new URL(`../${p}`, import.meta.url));
const src = () => globSync('src/**/*.{ts,tsx}', { cwd: app() });

it('Oberflächen-Icons kommen von Tabler: das alte Icon-Paket kommt weder in src noch in package.json vor', () => {
  const OLD_PKG = 'luc' + 'ide-react'; // getrennt, damit diese Datei sich nicht selbst findet
  const users = src().filter((f) => f.replaceAll('\\', '/') !== 'src/architecture.test.ts' && readFileSync(app(f), 'utf8').includes(OLD_PKG));
  expect(src().length).toBeGreaterThan(100); // leerer Glob wäre stumm grün
  expect(users).toEqual([]);
  expect(readFileSync(app('package.json'), 'utf8')).not.toContain(OLD_PKG);
});

it('Tabler nur als Einzelimport, nie der ganze Namensraum', () => {
  const bad = src().filter((f) => /import\s+\*\s+as\s+\w+\s+from\s+'@tabler\/icons-react'/.test(readFileSync(app(f), 'utf8')));
  expect(src().length).toBeGreaterThan(100);
  expect(bad).toEqual([]);
});

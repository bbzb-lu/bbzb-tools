// Erzeugt src/icons/tabler-outline.json aus @tabler/icons: Outline-Pfade, Stichwörter und Kategorie (dieselben Daten wie die Suche auf tabler.io).
// Aufruf nach jedem Update von @tabler/icons: npm run build:tabler -w apps/news-banner
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

// npm-Workspaces legen das Paket in den Hauptordner, darum auflösen statt 'node_modules/…' anzunehmen.
const dir = join(dirname(createRequire(import.meta.url).resolve('@tabler/icons/outline/circle.svg')), '../../');
const nodes = JSON.parse(readFileSync(dir + 'tabler-nodes-outline.json', 'utf8'));
const meta = JSON.parse(readFileSync(dir + 'icons.json', 'utf8'));

const out = {};
for (const name of Object.keys(nodes).sort()) {
  const p = nodes[name].filter(([tag, a]) => tag === 'path' && a.stroke !== 'none' && a.d !== 'M0 0h24v24H0z').map(([, a]) => a.d);
  const t = [...(meta[name]?.tags ?? []), meta[name]?.category ?? ''].join(' ').toLowerCase().trim();
  out[name] = { p, t };
}
writeFileSync('src/icons/tabler-outline.json', JSON.stringify(out));
console.log(`${Object.keys(out).length} Icons`);

// Erzeugt brand/tabler/outline.json aus dem Paket @tabler/icons (nur Outline-Pfade und Stichwörter).
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

// npm-Workspaces legen das Paket in den Hauptordner, darum auflösen statt 'node_modules/…' anzunehmen.
const dir = join(dirname(createRequire(import.meta.url).resolve('@tabler/icons/outline/circle.svg')), '../../'); // die Datei liegt unter icons/outline/
const nodes = JSON.parse(readFileSync(dir + 'tabler-nodes-outline.json', 'utf8'));
const meta = JSON.parse(readFileSync(dir + 'icons.json', 'utf8'));

const out = {};
for (const name of Object.keys(nodes).sort()) {
  const p = nodes[name]
    .filter(([tag, a]) => tag === 'path' && a.stroke !== 'none' && a.d !== 'M0 0h24v24H0z')
    .map(([, a]) => a.d);
  const t = (meta[name]?.tags ?? []).join(' ').toLowerCase();
  out[name] = { p, t };
}
writeFileSync('brand/tabler/outline.json', JSON.stringify(out));
console.log(`${Object.keys(out).length} Icons`);

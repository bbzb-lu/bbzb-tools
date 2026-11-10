// Erzeugt src/icons/lucide-meta.json: Namen aus lucide-static, Stichwörter und Kategorien von lucide.dev (dieselben Daten wie die Suche dort),
// Aliase = gleiches Icon in lucide. Läuft nur beim Entwickeln (braucht Internet), die App fragt nie nach.
// Aufruf: npm run build:lucide-meta, nach jedem Update von lucide und lucide-static (gleiche Version).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { icons } from 'lucide';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';

// npm-Workspaces legen lucide-static in den Hauptordner
const lucideStatic = dirname(createRequire(import.meta.url).resolve('lucide-static/package.json'));

const get = async (u) => {
  const r = await fetch(u);
  if (!r.ok) throw new Error(`${u}: ${r.status}`);
  return r.json();
};
const [webTags, cats] = await Promise.all([get('https://lucide.dev/api/tags'), get('https://lucide.dev/api/categories')]);
const tags = { ...JSON.parse(readFileSync(`${lucideStatic}/tags.json`, 'utf8')), ...webTags };
const names = readdirSync(`${lucideStatic}/icons`).filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4));
const pascal = (n) => n.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join('');

const groups = new Map(); // Knotenliste (gleiches Icon) -> Namen
for (const n of names) {
  const node = icons[pascal(n)];
  if (!node) throw new Error(`Kein Lucide-Export für ${n}`);
  groups.set(node, [...(groups.get(node) ?? []), n]);
}
const out = [];
for (const list of groups.values()) {
  // Hauptname: der mit Stichwörtern, sonst der alphabetisch letzte (Umbenennungen setzen die Form nach vorn: alert-circle -> circle-alert)
  const main = list.find((n) => tags[n]) ?? list.at(-1);
  const aliases = list.filter((n) => n !== main);
  const t = [...new Set(list.flatMap((n) => [...(tags[n] ?? []), ...(cats[n] ?? [])]))].join(' ');
  out.push([main, t, aliases.join(' ')]);
}
out.sort((a, b) => a[0].localeCompare(b[0]));
writeFileSync('src/icons/lucide-meta.json', JSON.stringify(out));
console.log(`${out.length} Icons, ${names.length} Namen`);

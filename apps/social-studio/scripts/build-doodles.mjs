// Erzeugt brand/doodles/doodles.json aus den Doodle-SVG von Khushmeen (Zip entpackt, Ordner `doodle icons/SVG`).
// Aufruf: node scripts/build-doodles.mjs "<Pfad>/doodle icons/SVG"
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const src = process.argv[2] ?? '/tmp/doodle icons/SVG';
const SKIP = new Set(['files']);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// 1 Nachkommastelle reicht bei viewBoxen um 150 und spart rund die Hälfte der Datei.
// Kompakte Quellen wie `1.5.5` (= 1.5 und .5) behalten ihr Trennzeichen: sonst würde «1.50.5» daraus.
const round = (d) => d.replace(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi, (n, at, all) => (/[\d.]/.test(all[at - 1] ?? '') ? ' ' : '') + String(Math.round(Number(n) * 10) / 10));

const out = {};
for (const cat of readdirSync(src, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort()) {
  if (SKIP.has(cat)) continue;
  const c = slug(cat);
  for (const file of readdirSync(join(src, cat)).filter((f) => f.endsWith('.svg')).sort()) {
    const raw = readFileSync(join(src, cat, file), 'utf8');
    const body = raw.replace(/<defs>[\s\S]*?<\/defs>/g, ''); // Clip-Rechtecke
    const other = body.match(/<(circle|rect|ellipse|line|polyline|polygon|image|text|use)\b/);
    if (other) throw new Error(`${cat}/${file}: <${other[1]}> wird nicht unterstützt`);
    const vb = raw.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
    if (!vb) throw new Error(`${cat}/${file}: viewBox fehlt`);
    const p = [...body.matchAll(/<path\b[^>]*>/g)]
      .map(([tag]) => ({ d: tag.match(/\bd="([^"]*)"/)?.[1], fill: tag.match(/\bfill="([^"]*)"/)?.[1] }))
      .filter(({ d, fill }) => d && fill === 'black')
      .map(({ d }) => round(d));
    if (p.length === 0) throw new Error(`${cat}/${file}: keine schwarzen Pfade`);
    const name = file.slice(0, -4);
    const key = `${c}-${slug(name)}`;
    if (out[key]) throw new Error(`${key} doppelt`);
    out[key] = { c, w: Number(vb[1]), h: Number(vb[2]), p, t: `${cat} ${name.replace(/[-_]+/g, ' ')}`.toLowerCase() };
  }
}
writeFileSync('brand/doodles/doodles.json', JSON.stringify(out));
console.log(`${Object.keys(out).length} Doodles`);

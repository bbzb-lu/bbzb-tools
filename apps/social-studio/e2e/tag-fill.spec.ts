import { writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { PNG } from 'pngjs';
import { PNG as Png } from 'pngjs';
import { colors, locationColors, tagBox } from '../src/tokens';
import { tagHeightOf } from '../src/plugins/elements/tag/layout';
import type { TagProps } from '../src/plugins/elements/tag/schema';
import { bbzbsocial, exportPng, view } from './fixtures';

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const is = (png: PNG, x: number, y: number, hex: string) => rgb(hex).every((v, k) => Math.abs(png.data[(y * png.width + x) * 4 + k]! - v) <= 6);
/** Pixel in Farbe `hex` im Rechteck: Anzahl und Umriss. */
function scan(png: PNG, hex: string, r: { x: number; y: number; w: number; h: number }) {
  const o = { n: 0, minX: 1e9, maxX: -1, minY: 1e9, maxY: -1 };
  for (let y = r.y; y < r.y + r.h; y++)
    for (let x = r.x; x < r.x + r.w; x++)
      if (is(png, x, y, hex)) {
        o.n++;
        o.minX = Math.min(o.minX, x);
        o.maxX = Math.max(o.maxX, x);
        o.minY = Math.min(o.minY, y);
        o.maxY = Math.max(o.maxY, y);
      }
  return o;
}

const base = { schemaVersion: 1, id: 'a', createdAt: 0, updatedAt: 0, format: { id: 'post', width: 1080, height: 1350 }, assets: {} };
// Slide-Index `i`: der Standort-Akzent gilt je Slide, darum ein Schul-Tag pro Slide
const box = (id: string, i: number, y: number, w: number, props: TagProps) =>
  ({ id, type: 'tag', name: id, x: i * 1080 + 100, y, width: w, height: tagHeightOf(props), rotation: 0, opacity: 1, visible: true, locked: false, props, slide: i });
const tags = [
  box('heimbach', 0, 100, 420, { variant: 'schul', text: 'Heimbach' }),
  box('dept', 1, 250, 520, { variant: 'schul', text: 'Bahnhof', dept: 'Zimmerleute' }),
  box('lang', 2, 450, 700, { variant: 'schul', text: 'Bahnhof', dept: 'Fahrzeugbau und Strassentransport' }),
  box('lang2', 3, 650, 560, { variant: 'schul', text: 'Weggismatt', dept: 'Elektrotechnik EP/GIN/NE' }),
  box('maler', 0, 850, 300, { variant: 'fach', text: 'Maler', color: 'Weggismatt' }),
  box('bahnhof', 0, 1150, 300, { variant: 'fach', text: 'Zimmerleute', color: 'Bahnhof' }),
  box('bm', 0, 1000, 300, { variant: 'frei', text: 'Neu', color: 'BM' }),
];
const file = bbzbsocial({
  ...base, name: 'Tags', accentMode: 'standort',
  slides: [0, 1, 2, 3].map((i) => ({ id: `s${i}`, background: 'blauschwarz' })),
  elements: Object.fromEntries(tags.map((e) => [e.id, { ...e, slide: undefined }])),
  order: tags.map((e) => e.id),
});

test('Tags: Standortfarben, Fachbereich in zwei Zeilen, nichts läuft über, Export wie Leinwand', async ({ page }) => {
  await page.goto('');
  await page.locator('input[type=file]').setInputFiles({ name: 'x.bbzbsocial', mimeType: 'application/zip', buffer: file });
  await page.getByRole('listitem').filter({ hasText: 'Tags' }).getByRole('button', { name: 'Öffnen' }).click();
  await expect(page.getByLabel('Projektname')).toHaveValue('Tags');
  await view(page);
  const pngs = await exportPng(page);
  if (process.env.SHOTS) pngs.forEach((p, i) => writeFileSync(`.superpowers/sdd/2026-10-26-phase-2-6-tags-und-standorte/screens/task-3-export-${i + 1}.png`, Png.sync.write(p!)));
  let png = pngs[0]!;

  const at = (id: string) => tags.find((t) => t.id === id)!;
  const inBox = (id: string) => ({ x: 100, y: at(id).y, w: at(id).width, h: at(id).height });
  const corners = (id: string, hex: string) => {
    const { x, y, w, h } = inBox(id);
    return [[x + 1, y + 1], [x + w - 2, y + 1], [x + 1, y + h - 2], [x + w - 2, y + h - 2]].every(([px, py]) => is(png, px!, py!, hex));
  };

  // Heimbach: neue Farbe, warmweisse Schrift
  expect(corners('heimbach', '#4C5EBD')).toBe(true);
  expect(scan(png, colors.warmweiss, inBox('heimbach')).n).toBeGreaterThan(300);

  // Fachbereich: zwei Zeilen im Polster, oben Standort, unten Fachbereich, Text zusammen mittig
  for (const id of ['dept', 'lang', 'lang2']) {
    const b = inBox(id);
    png = pngs[at(id).slide]!;
    expect(b.h).toBeGreaterThan(62);
    expect(corners(id, id === 'lang2' ? locationColors.Weggismatt.fill : locationColors.Bahnhof.fill)).toBe(true);
    const t = scan(png, colors.warmweiss, b);
    expect(t.n).toBeGreaterThan(400);
    // nichts ausserhalb der Box (Hintergrund blauschwarz) und nichts im Polster
    const around = { x: b.x - 6, y: b.y - 6, w: b.w + 12, h: b.h + 12 };
    expect(scan(png, colors.warmweiss, around).n).toBe(t.n);
    expect(t.minX).toBeGreaterThanOrEqual(b.x + tagBox.schul.paddingLeft - 2);
    expect(t.maxX).toBeLessThanOrEqual(b.x + b.w - tagBox.schul.paddingRight + 2);
    // zwei getrennte Zeilen: Lücke in der Zeilenmitte, Text mittig (Rand oben ≈ Rand unten)
    expect(Math.abs(t.minY - b.y - (b.y + b.h - 1 - t.maxY))).toBeLessThanOrEqual(8);
    const rows = Array.from({ length: b.h }, (_, i) => scan(png, colors.warmweiss, { x: b.x, y: b.y + i, w: b.w, h: 1 }).n > 0);
    expect(rows.filter((r, i) => r && !rows[i - 1]).length).toBeGreaterThanOrEqual(2);
  }

  png = pngs[0]!;
  // Fachbereich-Tag Maler (Weggismatt): orange, freier Tag mit Farbe BM
  expect(corners('maler', locationColors.Weggismatt.fill)).toBe(true);
  expect(scan(png, colors.warmweiss, inBox('maler')).n).toBeGreaterThan(200);
  expect(corners('bahnhof', locationColors.Bahnhof.fill)).toBe(true);
  expect(corners('bm', locationColors.BM.fill)).toBe(true);
  expect(scan(png, colors.warmweiss, inBox('bm')).n).toBeGreaterThan(100);

  // Leinwand = Export: Füllfarben der Konva-Knoten
  const fills = await page.evaluate(() => {
    const k = (window as unknown as { Konva: typeof import('konva').default }).Konva;
    return ['heimbach', 'dept', 'maler', 'bm'].map((id) => k.stages[0]!.findOne<import('konva').default.Group>(`#${id}`)!.findOne<import('konva').default.Rect>('Rect')!.fill());
  });
  expect(fills).toEqual([locationColors.Heimbach.fill, locationColors.Bahnhof.fill, locationColors.Weggismatt.fill, locationColors.BM.fill]);
});

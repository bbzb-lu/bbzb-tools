import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { colors, locationColors } from '../src/tokens';
import { bbzbsocial, exportPng, view } from './fixtures';

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
/** Pixel in Farbe `hex` (Toleranz 6 je Kanal) im Rechteck. */
function count(png: PNG, hex: string, r = { x: 0, y: 0, w: png.width, h: png.height }) {
  const c = rgb(hex);
  let n = 0;
  for (let y = r.y; y < r.y + r.h; y++)
    for (let x = r.x; x < r.x + r.w; x++) if (c.every((v, k) => Math.abs(png.data[(y * png.width + x) * 4 + k]! - v) <= 6)) n++;
  return n;
}
const pixel = (png: PNG, x: number, y: number) => [...png.data.subarray((y * png.width + x) * 4, (y * png.width + x) * 4 + 3)];

const base = { schemaVersion: 1, id: 'a', createdAt: 0, updatedAt: 0, format: { id: 'post', width: 1080, height: 1350 }, assets: {} };
const box = (id: string, type: string, x: number, y: number, width: number, height: number, props: object) =>
  ({ id, type, name: id, x, y, width, height, rotation: 0, opacity: 1, visible: true, locked: false, props });
const TAG = { x: 100, y: 100, w: 420, h: 62 };
const CTA = { x: 100, y: 300, w: 420, h: 75 };

/** Slide 1: Schul-Tag Heimbach, CTA und Scribble in fixem Orange; Slide 2 ohne Schul-Tag: Scribble in «akzent». */
function project(name: string, extra: object, akzent = 'akzent') {
  const els = [
    box('tag', 'tag', TAG.x, TAG.y, TAG.w, TAG.h, { variant: 'schul', text: 'Heimbach' }),
    box('cta', 'tag', CTA.x, CTA.y, CTA.w, CTA.h, { variant: 'cta', text: 'LINK IN BIO' }),
    box('fix', 'brand', 340, 700, 400, 400, { brandId: 'scribble-01', color: 'orange' }),
    box('scr', 'brand', 1080 + 340, 400, 400, 400, { brandId: 'scribble-01', color: akzent }),
  ];
  return bbzbsocial({
    ...base, name, ...extra,
    slides: [{ id: 's0', background: 'warmweiss' }, { id: 's1', background: 'warmweiss' }],
    elements: Object.fromEntries(els.map((e) => [e.id, e])),
    order: els.map((e) => e.id),
  });
}

async function open(page: Page, file: Buffer, name: string) {
  await page.goto('');
  await page.locator('input[type=file]').setInputFiles({ name: 'x.bbzbsocial', mimeType: 'application/zip', buffer: file });
  await page.getByRole('listitem').filter({ hasText: name }).getByRole('button', { name: 'Öffnen' }).click();
  await expect(page.getByLabel('Projektname')).toHaveValue(name);
  await view(page);
}

const tagFill = (page: Page, id: string) =>
  page.evaluate((id) => {
    const k = (window as unknown as { Konva: typeof import('konva').default }).Konva;
    return k.stages[0]!.findOne<import('konva').default.Group>(`#${id}`)!.findOne<import('konva').default.Rect>('Rect')!.fill() as string;
  }, id);

test('standortabhängig: Tag, CTA und Akzent-Scribble je Slide in der Standortfarbe, feste Farbe bleibt, Export wie Leinwand', async ({ page }) => {
  await open(page, project('Standort', { accentMode: 'standort', lastTagLocation: 'Bahnhof' }), 'Standort');
  const [s0, s1] = await exportPng(page);
  // Nur auf Wunsch (SHOTS=1): Export zum Anschauen ablegen
  if (process.env.SHOTS) [s0, s1].forEach((p, i) => writeFileSync(`.superpowers/sdd/2026-10-23-phase-2-5-feinschliff/screens/task-11-standort-${i + 1}.png`, PNG.sync.write(p!)));
  const heimbach = rgb(locationColors.Heimbach.fill);
  // Ränder der Boxen (Polster ohne Schrift) in Heimbach-Blau
  expect(pixel(s0!, TAG.x + 8, TAG.y + 8)).toEqual(heimbach);
  expect(pixel(s0!, CTA.x + 8, CTA.y + 8)).toEqual(heimbach);
  // Schrift auf Heimbach (#4C5EBD) warmweiss, keine blauschwarze Schrift
  const inTag = { x: TAG.x, y: TAG.y, w: TAG.w, h: TAG.h };
  expect(count(s0!, colors.warmweiss, inTag)).toBeGreaterThan(200);
  expect(count(s0!, colors.blauschwarz, inTag)).toBe(0);
  // Scribble mit fester Farbe bleibt orange
  expect(count(s0!, colors.orange)).toBeGreaterThan(5000);
  // Slide 2 ohne Schul-Tag: lastTagLocation (Bahnhof)
  expect(count(s1!, locationColors.Bahnhof.fill)).toBeGreaterThan(5000);
  expect(count(s1!, colors.orange)).toBe(0);
});

test('Standortwechsel im Schul-Tag färbt sofort um, Undo und Redo stellen die Farbe mit zurück', async ({ page }) => {
  await open(page, project('Wechsel', { accentMode: 'standort' }), 'Wechsel');
  await expect.poll(() => tagFill(page, 'cta')).toBe(locationColors.Heimbach.fill);
  await page.evaluate(() => window.__bbzbTest.patch('tag', { props: { variant: 'schul', text: 'Dagmersellen' } }));
  await expect.poll(() => tagFill(page, 'cta')).toBe(locationColors.Dagmersellen.fill);
  await page.keyboard.press('Control+z');
  await expect.poll(() => tagFill(page, 'cta')).toBe(locationColors.Heimbach.fill);
  await page.keyboard.press('Control+Shift+z');
  await expect.poll(() => tagFill(page, 'cta')).toBe(locationColors.Dagmersellen.fill);
  // Schul-Tag gelöscht: ohne lastTagLocation Orange
  await page.evaluate(() => window.__bbzbTest.select('tag'));
  await page.keyboard.press('Delete');
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.elements().length)).toBe(3);
  await expect.poll(() => tagFill(page, 'cta')).toBe(colors.orange);
});

test('Modus fix (oder fehlt): «akzent» exportiert pixelgleich wie «orange»', async ({ page }) => {
  await open(page, project('Akzent', {}), 'Akzent');
  const withAccent = await exportPng(page);
  await open(page, project('Orange', {}, 'orange'), 'Orange');
  const withOrange = await exportPng(page);
  await open(page, project('Fix', { accentMode: 'fix', lastTagLocation: 'Heimbach' }), 'Fix');
  const fix = await exportPng(page);
  for (const pngs of [withAccent, fix]) {
    expect(pngs).toHaveLength(2);
    pngs.forEach((p, i) => expect(Buffer.compare(p.data, withOrange[i]!.data)).toBe(0));
  }
  expect(pixel(withAccent[0]!, TAG.x + 8, TAG.y + 8)).toEqual(rgb(colors.orange));
});

import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { unzipSync } from 'fflate';
import { PNG } from 'pngjs';
import { colors, tagBox } from '../src/tokens';
import { elements, newProject } from './fixtures';

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const same = (png: PNG, x: number, y: number, hex: string) => rgb(hex).every((v, k) => Math.abs(png.data[(y * png.width + x) * 4 + k]! - v) <= 6);

async function exportPng(page: Page) {
  await page.getByRole('button', { name: 'Exportieren' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('PNG').check();
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'ZIP herunterladen' }).click();
  const files = unzipSync(new Uint8Array(await readFile(await (await download).path())));
  await dialog.getByRole('button', { name: 'Schliessen' }).click();
  return PNG.sync.read(Buffer.from(Object.values(files)[0]!));
}

/** Zahl der Pixel in Farbe `hex` innerhalb des Rechtecks. */
function countIn(png: PNG, hex: string, r: { x: number; y: number; w: number; h: number }) {
  let n = 0;
  for (let y = Math.floor(r.y); y < Math.ceil(r.y + r.h); y++)
    for (let x = Math.floor(r.x); x < Math.ceil(r.x + r.w); x++) if (same(png, x, y, hex)) n++;
  return n;
}

const insert = (page: Page, variant: string, at?: { x: number; y: number }) => page.evaluate(([v, a]) => window.__bbzbTest.insertTag(v as string, a as undefined), [variant, at] as const);
const props = async (page: Page, i = 0) => (await elements(page))[i]!.props as { variant: string; text: string };

test('Schul-Tag: oranges Rechteck ohne runde Ecken, Standort wechseln, Breite folgt dem Text, merkt sich den Standort fürs Layout', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await insert(page, 'schul');
  await expect.poll(() => elements(page)).toHaveLength(1);
  const [a0] = await elements(page);
  expect(a0!.height).toBe(tagBox.schul.height);
  expect(a0!.x + a0!.width / 2).toBeCloseTo(540, 0);
  expect(await props(page)).toEqual({ variant: 'schul', text: 'BBZB' });
  await page.getByLabel('Standort', { exact: true }).selectOption('Bahnhof');
  await expect.poll(async () => (await props(page)).text).toBe('Bahnhof');
  const [a] = await elements(page);
  // Breite aus Text + Polster; PSD-Beispiel «BBZB BAHNHOF» = 323 px
  expect(Math.abs(a!.width - 323)).toBeLessThanOrEqual(3);

  const png = await exportPng(page);
  const { x, y, width, height } = a!;
  const [l, t, r, b] = [Math.ceil(x) + 1, Math.ceil(y) + 1, Math.floor(x + width) - 2, Math.floor(y + height) - 2];
  // alle vier Ecken voll orange (kein cornerRadius), knapp daneben Hintergrund
  for (const [px, py] of [[l, t], [r, t], [l, b], [r, b]] as const) expect(same(png, px, py, colors.orange)).toBe(true);
  expect(same(png, l - 4, t, colors.warmweiss)).toBe(true);
  expect(same(png, l, t - 4, colors.warmweiss)).toBe(true);
  // Text warmweiss im Polster-Innenraum, links im Polster nichts
  expect(countIn(png, colors.warmweiss, { x: x + tagBox.schul.paddingLeft, y: y + 8, w: width - 72, h: height - 16 })).toBeGreaterThan(300);
  expect(countIn(png, colors.warmweiss, { x: x + 2, y: y + 2, w: tagBox.schul.paddingLeft - 6, h: height - 4 })).toBe(0);

  await page.getByLabel('Standort', { exact: true }).selectOption('Dagmersellen');
  await expect.poll(async () => (await props(page)).text).toBe('Dagmersellen');
  const [wide] = await elements(page);
  expect(wide!.width).toBeGreaterThan(a!.width + 40);
  expect(await page.evaluate(() => window.__bbzbTest.project().lastTagLocation)).toBe('Dagmersellen');

  // Standort wird fürs Projekt gemerkt (Layout-Platzhalter), ein neuer Standort-Tag startet trotzdem mit «BBZB»
  await insert(page, 'schul');
  await expect.poll(() => elements(page)).toHaveLength(2);
  expect((await props(page, 1)).text).toBe('BBZB');

  await page.keyboard.press('Control+z');
  await expect.poll(() => elements(page)).toHaveLength(1);
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await props(page)).text).toBe('Bahnhof');
});

test('Ort-Tag: blauschwarz mit orangem Pin, Freitext ändert die Breite, ein Undo-Schritt pro Eingabe', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await insert(page, 'ort');
  await expect.poll(() => elements(page)).toHaveLength(1);
  const [a] = await elements(page);
  expect(a!.height).toBe(tagBox.ort.height);

  const input = page.getByLabel('Text', { exact: true });
  await input.fill('Sempachersee Seeufer');
  await expect.poll(async () => (await props(page)).text).toBe('Sempachersee Seeufer');
  const [b] = await elements(page);
  expect(b!.width).toBeGreaterThan(a!.width + 60);

  const png = await exportPng(page);
  const { x, y, width, height } = b!;
  for (const [px, py] of [[x + 2, y + 2], [x + width - 3, y + 2], [x + 2, y + height - 3], [x + width - 3, y + height - 3]] as const)
    expect(same(png, Math.ceil(px), Math.ceil(py), colors.blauschwarz)).toBe(true);
  const i = tagBox.ort.icon;
  expect(countIn(png, colors.orange, { x: x + i.x, y: y + i.y, w: i.w, h: i.h })).toBeGreaterThan(150);
  expect(countIn(png, colors.warmweiss, { x: x + tagBox.ort.textX, y: y + 8, w: width - tagBox.ort.textX - 36, h: height - 16 })).toBeGreaterThan(300);
  // Pin bleibt in seiner Box: rechts davon bis zum Text kein Orange
  expect(countIn(png, colors.orange, { x: x + i.x + i.w + 4, y, w: tagBox.ort.textX - i.x - i.w - 8, h: height })).toBe(0);

  // sichtbare Pin-Pixel füllen die Icon-Box (höchstens 2 px je Seite, 1 px oben und unten)
  let [x0, y0, x1, y1] = [1e9, 1e9, -1, -1];
  for (let py = Math.ceil(y); py < y + height; py++)
    for (let px = Math.ceil(x); px < x + i.x + i.w + 4; px++)
      if (same(png, px, py, colors.orange)) [x0, y0, x1, y1] = [Math.min(x0, px - x), Math.min(y0, py - y), Math.max(x1, px - x + 1), Math.max(y1, py - y + 1)];
  expect(Math.abs(x0 - i.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(x1 - (i.x + i.w))).toBeLessThanOrEqual(2);
  expect(Math.abs(y0 - i.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(y1 - (i.y + i.h))).toBeLessThanOrEqual(1);

  await input.blur();
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await props(page)).text).toBe('Luzern');
});

test('CTA: orange mit Versalien, Standardtext «LINK IN BIO», Freitext', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await insert(page, 'cta', { x: 300, y: 400 });
  await expect.poll(() => elements(page)).toHaveLength(1);
  const [a] = await elements(page);
  expect(a!.height).toBe(tagBox.cta.height);
  expect([a!.x + a!.width / 2, a!.y + a!.height / 2]).toEqual([300, 400]);
  expect((await props(page)).text).toBe('LINK IN BIO');
  const png = await exportPng(page);
  expect(same(png, Math.ceil(a!.x) + 1, Math.ceil(a!.y) + 1, colors.orange)).toBe(true);
  await page.getByLabel('Text', { exact: true }).fill('bbzb.lu.ch');
  await expect.poll(async () => (await props(page)).text).toBe('bbzb.lu.ch');
  const [b] = await elements(page);
  expect(b!.width).not.toBe(a!.width);
});

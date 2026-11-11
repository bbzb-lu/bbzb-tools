import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { colors, locationColors } from '../src/tokens';
import { addSlide, elements, exportPng, newProject } from './fixtures';

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
/** Pixel in Farbe `hex` (Toleranz 6 je Kanal) im Rechteck eines Elements (Slide-Versatz abgezogen). */
function count(png: PNG, hex: string, el: { x: number; y: number; width: number; height: number }) {
  const c = rgb(hex);
  const x0 = Math.max(0, Math.floor(el.x % 1080));
  let n = 0;
  for (let y = Math.max(0, Math.floor(el.y)); y < Math.min(png.height, Math.ceil(el.y + el.height)); y++)
    for (let x = x0; x < Math.min(png.width, x0 + Math.ceil(el.width)); x++)
      if (c.every((v, k) => Math.abs(png.data[(y * png.width + x) * 4 + k]! - v) <= 6)) n++;
  return n;
}
const pixel = (png: PNG, x: number, y: number) => [...png.data.subarray((y * png.width + x) * 4, (y * png.width + x) * 4 + 3)];

const insertTag = (page: Page, variant: string, at?: { x: number; y: number }) =>
  page.evaluate(([v, a]) => window.__bbzbTest.insertTag(v as string, a as undefined), [variant, at] as const);
const insertScribble = (page: Page, at?: { x: number; y: number }) => page.evaluate((a) => window.__bbzbTest.insertBrand('scribble-01', a), at);
const last = async (page: Page) => (await elements(page)).at(-1)!;
const deselect = async (page: Page) => {
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: /^Slide \d/ })).toBeVisible();
};
/** Akzentmodus im Einstellungen-Dialog wählen, Dialog wieder schliessen. */
const accentChoice = async (page: Page, label: 'Fixe Akzentfarbe' | 'Standortabhängig') => {
  await page.getByRole('button', { name: 'Einstellungen', exact: true }).click();
  await page.getByLabel(label).check({ force: true });
  await page.keyboard.press('Escape');
};
const standort = (page: Page) => accentChoice(page, 'Standortabhängig');

/** Kontext: Post, ein Schul-Tag (Bahnhof), ein CTA und ein Scribble in «akzent», nichts gewählt. */
async function setup(page: Page) {
  await newProject(page, 'Post 4:5');
  await insertTag(page, 'schul', { x: 540, y: 160 });
  await page.getByLabel('Standort', { exact: true }).selectOption('Bahnhof'); // neuer Tag startet mit «BBZB»
  await insertTag(page, 'cta', { x: 540, y: 400 });
  await insertScribble(page, { x: 540, y: 900 });
  await expect.poll(async () => (await elements(page)).length).toBe(3);
  await deselect(page);
}

const proj = (page: Page) => page.evaluate(() => window.__bbzbTest.project());

test('Neues Projekt: Schalter auf «Fixe Akzentfarbe», Schul-Tag orange', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'Einstellungen', exact: true }).click();
  await expect(page.getByLabel('Fixe Akzentfarbe')).toBeChecked();
  await page.keyboard.press('Escape');
  expect((await proj(page)).accentMode).toBeUndefined();
  const [png] = await exportPng(page);
  const tag = (await elements(page))[0]!;
  expect(pixel(png!, Math.ceil(tag.x) + 8, Math.ceil(tag.y) + 8)).toEqual(rgb(colors.orange));
});

test('Standortabhängig: Tag, CTA und Scribble folgen dem Standort, Wechsel ist ein Undo-Schritt, zurück auf Fix ist alles orange', async ({ page }) => {
  await setup(page);
  await standort(page);
  expect((await proj(page)).accentMode).toBe('standort');
  if (process.env.SHOTS) {
    await page.setViewportSize({ width: 1280, height: 1400 });
    await page.screenshot({ path: '.superpowers/sdd/2026-10-23-phase-2-5-feinschliff/screens/task-12-slidepanel.png' });
  }
  const [tag, cta, scr] = await elements(page);
  const at = (png: PNG, e: typeof tag) => pixel(png, Math.ceil(e!.x) + 8, Math.ceil(e!.y) + 8);
  let [png] = await exportPng(page);
  expect(at(png!, tag)).toEqual(rgb(locationColors.Bahnhof.fill));
  expect(at(png!, cta)).toEqual(rgb(locationColors.Bahnhof.fill));
  expect(count(png!, locationColors.Bahnhof.fill, scr!)).toBeGreaterThan(3000);

  // Standort wechseln: alles auf der Slide in Heimbach, Tag-Schrift warmweiss
  await page.evaluate((id) => window.__bbzbTest.select(id), tag!.id);
  await page.getByLabel('Standort', { exact: true }).selectOption('Heimbach');
  await expect.poll(async () => (await proj(page)).lastTagLocation).toBe('Heimbach');
  [png] = await exportPng(page);
  const heim = locationColors.Heimbach.fill;
  expect(at(png!, tag)).toEqual(rgb(heim));
  expect(at(png!, cta)).toEqual(rgb(heim));
  expect(count(png!, heim, scr!)).toBeGreaterThan(3000);
  const tagNow = (await elements(page))[0]!;
  expect(count(png!, colors.warmweiss, tagNow)).toBeGreaterThan(200);
  expect(count(png!, colors.blauschwarz, { ...tagNow, x: tagNow.x + 4, y: tagNow.y + 4, width: tagNow.width - 8, height: tagNow.height - 8 })).toBe(0);
  if (process.env.SHOTS) writeFileSync('.superpowers/sdd/2026-10-23-phase-2-5-feinschliff/screens/task-12-golden-heimbach.png', PNG.sync.write(png!));

  // Undo: Standort, Tag-Breite und alle Farben in einem Schritt zurück
  await page.keyboard.press('Control+z');
  [png] = await exportPng(page);
  expect((await proj(page)).lastTagLocation).toBe('Bahnhof'); // wie vor dem Wechsel (setup wählt Bahnhof im Inspector)
  expect((await elements(page))[0]!.props).toMatchObject({ text: 'Bahnhof' });
  expect(at(png!, tag)).toEqual(rgb(locationColors.Bahnhof.fill));
  expect(count(png!, locationColors.Bahnhof.fill, scr!)).toBeGreaterThan(3000);
  expect(count(png!, heim, scr!)).toBe(0);

  // Zurück auf Fix: alles orange
  await deselect(page);
  await accentChoice(page, 'Fixe Akzentfarbe');
  [png] = await exportPng(page);
  expect(at(png!, tag)).toEqual(rgb(colors.orange));
  expect(at(png!, cta)).toEqual(rgb(colors.orange));
  expect(count(png!, colors.orange, scr!)).toBeGreaterThan(3000);
});

test('Zweite Slide ohne Tag nimmt den zuletzt gewählten Standort; von Hand auf Blau gestelltes Scribble bleibt blau', async ({ page }) => {
  await setup(page);
  await standort(page);
  const [tag] = await elements(page);
  await page.evaluate((id) => window.__bbzbTest.select(id), tag!.id);
  await page.getByLabel('Standort', { exact: true }).selectOption('Heimbach');
  await deselect(page);
  await addSlide(page);
  await insertScribble(page, { x: 1080 + 540, y: 700 });
  await insertScribble(page, { x: 1080 + 540, y: 1100 });
  await expect.poll(async () => (await elements(page)).length).toBe(5);
  const [a, b] = (await elements(page)).slice(3);
  // zweites Scribble von Hand auf Blau
  await page.evaluate((id) => window.__bbzbTest.select(id), b!.id);
  await page.getByRole('radio', { name: 'Blau', exact: true }).check({ force: true });
  const png = (await exportPng(page))[1]!;
  expect(count(png, locationColors.Heimbach.fill, a!)).toBeGreaterThan(3000);
  expect(count(png, colors.blau, b!)).toBeGreaterThan(3000);
  // Standortwechsel im Schul-Tag lässt das blaue Scribble blau
  await page.evaluate((id) => window.__bbzbTest.select(id), tag!.id);
  await page.getByLabel('Standort', { exact: true }).selectOption('Dagmersellen');
  const png2 = (await exportPng(page))[1]!;
  expect(count(png2, locationColors.Dagmersellen.fill, a!)).toBeGreaterThan(3000);
  expect(count(png2, colors.blau, b!)).toBeGreaterThan(3000);
});

test('Schalter nur im Dialog, ein standortabhängiges Projekt wirkt', async ({ page }) => {
  await setup(page);
  await standort(page);
  await deselect(page);
  await expect(page.getByLabel('Standortabhängig')).toBeHidden();
  const [tag] = await elements(page);
  const [png] = await exportPng(page);
  expect(pixel(png!, Math.ceil(tag!.x) + 8, Math.ceil(tag!.y) + 8)).toEqual(rgb(locationColors.Bahnhof.fill));
});

for (const mode of ['fix', 'standort'] as const) {
  test(`Neu eingefügtes Scribble: genau eine Farbkachel gewählt (${mode})`, async ({ page }) => {
    await newProject(page, 'Post 4:5');
    if (mode === 'standort') {
      await standort(page);
      await insertTag(page, 'schul');
      await page.getByLabel('Standort', { exact: true }).selectOption('Bahnhof'); // gibt dem Akzent den Standort Bahnhof
    }
    await insertScribble(page);
    await expect.poll(async () => (await last(page)).props).toMatchObject({ color: 'akzent' });
    await page.evaluate((id) => window.__bbzbTest.select(id), (await last(page)).id);
    const group = page.getByRole('group', { name: 'Farbe' });
    await expect(group.getByRole('radio')).toHaveCount(mode === 'standort' ? 5 : 4);
    await expect(group.locator('input:checked')).toHaveCount(1);
    await expect(group.getByRole('radio', { name: mode === 'standort' ? 'Akzent' : 'Orange', exact: true })).toBeChecked();
    if (process.env.SHOTS) await page.screenshot({ path: `.superpowers/sdd/2026-10-23-phase-2-5-feinschliff/screens/task-12-swatches-${mode}.png` });
    if (mode === 'standort') {
      // Tooltip und Füllung der Kachel
      const tile = group.locator('label.swatch').first(); // Akzent steht vor den Markenfarben
      await expect(tile).toHaveAttribute('data-tip', 'Akzent');
      await expect(tile).toHaveCSS('background-color', `rgb(${rgb(locationColors.Bahnhof.fill).join(', ')})`);
    }
  });
}

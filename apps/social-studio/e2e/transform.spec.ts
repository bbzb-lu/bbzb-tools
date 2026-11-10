import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { addPhoto, elements, frames, newProject, png, toScreen } from './fixtures';

type Crop = { x: number; y: number; scale: number };
const IMG = { width: 2160, height: 2700 }; // genau 4:5: füllt die Slide beim Einfügen

const canvasScale = (page: Page) =>
  page.evaluate(() => (document.querySelector('.canvas-scroll')!.clientHeight - 48) / window.__bbzbTest.project().format.height);
const photo = async (page: Page) => {
  const [el] = await elements(page);
  return { ...el!, crop: (el!.props as { crop: Crop }).crop };
};

async function drag(page: Page, x: number, y: number, dx: number, dy: number, release = true) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 5; i++) await page.mouse.move(x + (dx * i) / 5, y + (dy * i) / 5);
  if (release) await page.mouse.up();
}

/** 4:5-Foto füllt die Post-Slide, im Ausschnittmodus hineingezoomt und nach links verschoben, danach wieder ausgewählt. */
async function shiftedPhoto(page: Page) {
  await newProject(page, 'Post 4:5');
  await addPhoto(page, png(IMG.width, IMG.height));
  await expect.poll(() => elements(page)).toHaveLength(1);
  const o = await toScreen(page, 0, 0);
  await page.mouse.dblclick(o.x + 176, o.y + 276);
  for (let i = 0; i < 3; i++) await page.mouse.wheel(0, -100); // Zoom 1.33: Platz zum Verschieben
  await expect.poll(async () => (await photo(page)).crop.x).toBeLessThan(0);
  const before = (await photo(page)).crop.x;
  await drag(page, o.x + 176, o.y + 276, -60, 0);
  await expect.poll(async () => (await photo(page)).crop.x).toBeLessThan(before);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.transformerNodes())).toBe(1);
  return photo(page);
}

function expectCovered(el: { width: number; height: number; crop: Crop }) {
  expect(el.crop.x).toBeLessThanOrEqual(0);
  expect(el.crop.y).toBeLessThanOrEqual(0);
  expect(el.crop.x + IMG.width * el.crop.scale).toBeGreaterThanOrEqual(el.width - 0.001);
  expect(el.crop.y + IMG.height * el.crop.scale).toBeGreaterThanOrEqual(el.height - 0.001);
}

test('Ecke ziehen: Seitenverhältnis bleibt, Inhalt skaliert mit, ein Undo-Schritt', async ({ page }) => {
  const start = await shiftedPhoto(page);
  const scale = await canvasScale(page);
  const o = await toScreen(page, 0, 0);
  await drag(page, o.x + 1080 * scale, o.y + 1350 * scale, 100, 100);
  await expect.poll(async () => (await photo(page)).width).toBeGreaterThan(1080);
  const el = await photo(page);
  const f = el.width / 1080;
  expect(el.height / 1350).toBeCloseTo(f, 3);
  expect(el.crop.scale / start.crop.scale).toBeCloseTo(f, 3);
  expect(el.crop.x / start.crop.x).toBeCloseTo(f, 3);
  expect(el.crop.y).toBeCloseTo(start.crop.y * f, 3);
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await photo(page)).width).toBe(1080);
  expect((await photo(page)).crop).toEqual(start.crop);
});

test('Ecke mit Shift ziehen: Seitenverhältnis frei, Rahmen gedeckt', async ({ page }) => {
  await shiftedPhoto(page);
  const scale = await canvasScale(page);
  const o = await toScreen(page, 0, 0);
  await page.keyboard.down('Shift');
  await drag(page, o.x + 1080 * scale, o.y + 1350 * scale, 100, 0);
  await page.keyboard.up('Shift');
  await expect.poll(async () => (await photo(page)).width).toBeGreaterThan(1080);
  const el = await photo(page);
  expect(Math.abs(el.width / el.height - 1080 / 1350)).toBeGreaterThan(0.01);
  expectCovered(el);
});

test('Seiten-Anfasser ziehen: nur die Breite ändert sich, Rahmen gedeckt', async ({ page }) => {
  await shiftedPhoto(page);
  const scale = await canvasScale(page);
  const o = await toScreen(page, 0, 0);
  await drag(page, o.x + 1080 * scale, o.y + 675 * scale, 100, 0);
  await expect.poll(async () => (await photo(page)).width).toBeGreaterThan(1080);
  const el = await photo(page);
  expect(el.height).toBeCloseTo(1350);
  expectCovered(el);
});

test('gedrehtes Foto: Ecke ziehen bleibt proportional', async ({ page }) => {
  const start = await shiftedPhoto(page);
  const id = (await elements(page))[0]!.id;
  await page.evaluate((i) => window.__bbzbTest.patch(i, { rotation: 15 }), id);
  await expect.poll(async () => (await photo(page)).rotation).toBe(15);
  const o = await toScreen(page, 0, 0);
  // oberer linker Anfasser liegt im Drehpunkt (Element bei 0/0), nach innen ziehen
  await drag(page, o.x, o.y, 40, 60);
  await expect.poll(async () => (await photo(page)).width).toBeLessThan(1080);
  const el = await photo(page);
  const f = el.width / 1080;
  expect(el.height / 1350).toBeCloseTo(f, 3);
  expect(el.crop.scale / start.crop.scale).toBeCloseTo(f, 3);
});

test('kein Sprung beim Loslassen: Vorschau während des Ziehens = Ergebnis', async ({ page }) => {
  await shiftedPhoto(page);
  const scale = await canvasScale(page);
  const o = await toScreen(page, 0, 0);
  // Fotofläche, die vor und nach dem Ziehen sicher im Rahmen liegt
  const clip = { x: o.x + 20, y: o.y + 20, width: 1000 * scale, height: 1250 * scale };
  // Ecke nach innen: der Rahmen bleibt im sichtbaren Bereich
  await drag(page, o.x + 1080 * scale, o.y + 1350 * scale, -150, -150, false);
  await frames(page);
  const during = PNG.sync.read(await page.screenshot({ clip }));
  await page.mouse.up();
  await expect.poll(async () => (await photo(page)).width).toBeLessThan(1080);
  await frames(page);
  const after = PNG.sync.read(await page.screenshot({ clip }));
  let sum = 0;
  for (let i = 0; i < during.data.length; i++) if (i % 4 !== 3) sum += Math.abs(during.data[i]! - after.data[i]!);
  expect(sum / ((during.data.length * 3) / 4) / 255).toBeLessThanOrEqual(0.02);
});

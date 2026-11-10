import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { toScreen } from './fixtures';
import { alphaPng, openPhoto } from './photoProject';

const DARK = [15, 27, 38];
const BOX = { x: 140, y: 275, width: 800, height: 800 };
// Orange, auch kantengeglättet über dunklem Foto oder Blau (Linie auf halben Pixeln)
const orange = (d: Buffer, i: number) => d[i]! - Math.max(d[i + 1]!, d[i + 2]!) > 60;

/** Orange Pixel (Bildschirm) auf einer waagrechten Strecke von ±20 px um den Weltpunkt. */
async function orangeAcross(page: Page, x: number, y: number) {
  const c = await toScreen(page, x, y);
  const png = PNG.sync.read(await page.screenshot({ clip: { x: Math.round(c.x) - 20, y: Math.round(c.y), width: 41, height: 1 } }));
  let n = 0;
  for (let i = 0; i < png.data.length; i += 4) if (orange(png.data, i)) n++;
  return n;
}
/** Orange im 3 × 3-Fleck am Weltpunkt. */
async function orangeAt(page: Page, x: number, y: number) {
  const c = await toScreen(page, x, y);
  const png = PNG.sync.read(await page.screenshot({ clip: { x: c.x - 1, y: c.y - 1, width: 3, height: 3 } }));
  for (let i = 0; i < png.data.length; i += 4) if (orange(png.data, i)) return true;
  return false;
}

/** Zoomt mit Strg + Rad am Weltpunkt, bis der Zoom `to` erreicht, und scrollt den Punkt in die Mitte der Leinwand. */
async function zoomAt(page: Page, x: number, y: number, to: number) {
  const c = await toScreen(page, x, y);
  await page.mouse.move(c.x, c.y);
  await page.keyboard.down('Control');
  for (let i = 0; i < 60; i++) {
    const z = await page.evaluate(() => window.__bbzbTest.ui().zoom);
    if (to < 1 ? z <= to : z >= to) break;
    await page.mouse.wheel(0, to < 1 ? 200 : -200);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  }
  await page.keyboard.up('Control');
  // an der Zoomgrenze bleibt der Punkt nicht genau unter dem Zeiger: in die Mitte der Leinwand scrollen
  const p = await toScreen(page, x, y);
  const box = (await page.locator('.canvas-scroll').boundingBox())!;
  await page.locator('.canvas-scroll').evaluate((el, d) => el.scrollBy(d.x, d.y), { x: p.x - (box.x + box.width / 2), y: p.y - (box.y + box.height / 2) });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  expect(await page.evaluate(() => window.__bbzbTest.ui().zoom)).toBeCloseTo(to, 5);
}

async function openCrop(page: Page, name: string, props: Record<string, unknown> = {}) {
  // Bild 1000 × 1000 bei Massstab 1, 100 nach links und oben verschoben: ragt rundum über die Box hinaus
  await openPhoto(page, name, BOX, { crop: { x: -100, y: -100, scale: 1 }, ...props }, alphaPng(1000, 1000, DARK, () => 255), [540, 675]);
  const c = await toScreen(page, 540, 675);
  await page.mouse.click(c.x, c.y);
  await page.getByRole('button', { name: 'Ausschnitt bearbeiten' }).click();
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.ui().cropEditId)).toBe('e0');
}

test('Ausschnittmodus: dünne Linie am Rand des Ausschnitts, gleich breit bei 25 % und 800 %, weg nach dem Verlassen, nie im Export', async ({ page }) => {
  await openCrop(page, 'Linie');
  // abgedunkeltes Bild ausserhalb bleibt (Bild halbtransparent über Blau), Linie genau am linken Rand der Box
  expect(await orangeAt(page, BOX.x, 675)).toBe(true);
  expect(await orangeAt(page, BOX.x - 20, 675)).toBe(false);
  expect(await orangeAt(page, BOX.x + 20, 675)).toBe(false);
  // Export mit offenem Modus: keine Linie, am Rand das Foto
  const px = await page.evaluate(() => window.__bbzbTest.slidePixels(0, [[140 / 1080, 675 / 1350], [939 / 1080, 675 / 1350]]));
  for (const p of px) expect(p.slice(36, 39)).toEqual(DARK);

  await zoomAt(page, BOX.x, 675, 0.25);
  const small = await orangeAcross(page, BOX.x, 675);
  await zoomAt(page, BOX.x, 675, 8);
  const big = await orangeAcross(page, BOX.x, 675);
  test.info().annotations.push({ type: 'Linienbreite', description: `${small} px bei 25 %, ${big} px bei 800 %` });
  expect(small, 'Linie bei 25 %').toBeGreaterThanOrEqual(1);
  expect(small, 'dünn').toBeLessThanOrEqual(3);
  expect(Math.abs(big - small), `Breite ${small} bei 25 %, ${big} bei 800 %`).toBeLessThanOrEqual(1);

  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.ui().cropEditId)).toBeNull();
  // das Foto bleibt gewählt (orange Auswahl am selben Rand): zweites Esc hebt die Auswahl auf, dann ist kein Orange mehr da
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.selected())).toBeNull();
  expect(await orangeAcross(page, BOX.x, 675)).toBe(0);
});

test('Ausschnittlinie bei Drehung und Spiegeln: liegt am gedrehten Rand der Box', async ({ page }) => {
  await openCrop(page, 'Gedreht', { flip: true });
  await page.evaluate(() => window.__bbzbTest.patch('e0', { rotation: 30 }));
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  // Mitte der oberen Kante (lokal 400, 0) und 15 px nach innen (lokal 400, 15), gedreht um die linke obere Ecke
  const [cos, sin] = [Math.cos(Math.PI / 6), Math.sin(Math.PI / 6)];
  const at = (lx: number, ly: number) => [BOX.x + lx * cos - ly * sin, BOX.y + lx * sin + ly * cos] as const;
  expect(await orangeAt(page, ...at(400, 0))).toBe(true);
  expect(await orangeAt(page, ...at(400, 15))).toBe(false);
  expect(await orangeAt(page, ...at(400, -15))).toBe(false);
  // untere Kante (lokal 400, 800): gespiegelt bleibt der Rahmen an derselben Stelle
  expect(await orangeAt(page, ...at(400, 800))).toBe(true);
  expect(await orangeAt(page, ...at(400, 785))).toBe(false);
});

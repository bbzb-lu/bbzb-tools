import { expect, test, type Page } from '@playwright/test';
import { bbzbsocial, elements, frames, toScreen, view } from './fixtures';

const box = (id: string, x: number, y: number) => ({
  id, type: 'photo', name: id, x, y, width: 200, height: 200,
  rotation: 0, opacity: 1, visible: true, locked: false, props: { crop: { x: 0, y: 0, scale: 1 } },
});

/** Zwei Post-Slides; «m» wird gezogen, «o» ist das andere Element. */
async function open(page: Page, rotation = 0) {
  const project = {
    schemaVersion: 1, id: 'p-snap', name: 'Einrasten', format: { id: 'post', width: 1080, height: 1350 }, createdAt: 0, updatedAt: 0,
    slides: [{ id: 's1', background: 'warmweiss' }, { id: 's2', background: 'warmweiss' }],
    elements: { m: { ...box('m', 300, 300), rotation }, o: box('o', 1300, 800) },
    order: ['o', 'm'],
    assets: {},
  };
  await page.goto('');
  await page.locator('input[type=file]').setInputFiles({ name: 'x.bbzbsocial', mimeType: 'application/zip', buffer: bbzbsocial(project) });
  await page.getByRole('listitem').filter({ hasText: 'Einrasten' }).getByRole('button', { name: 'Öffnen' }).click();
  await expect(page.getByLabel('Projektname')).toHaveValue('Einrasten');
  await frames(page);
}

const m = async (page: Page) => (await elements(page)).find((e) => e.id === 'm')!;

/** Weltpunkt (wx, wy) um (dx, dy) Welt-px ziehen; vor dem Loslassen die Hilfslinien lesen. */
async function drag(page: Page, wx: number, wy: number, dx: number, dy: number, ctrl = false) {
  const { scale } = await view(page);
  const a = await toScreen(page, wx, wy);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  if (ctrl) await page.keyboard.down('Control');
  for (let i = 1; i <= 5; i++) await page.mouse.move(a.x + (dx * scale * i) / 5, a.y + (dy * scale * i) / 5);
  const guides = await page.evaluate(() => window.__bbzbTest.guides());
  await page.mouse.up();
  if (ctrl) await page.keyboard.up('Control');
  return guides;
}

test('Ziehen rastet am Rand 72 px ein, die Hilfslinie erscheint nur während der Geste', async ({ page }) => {
  await open(page);
  expect(await drag(page, 400, 400, -225, 0)).toEqual({ x: 72, y: null }); // linke Kante 75 → 72
  await expect.poll(async () => (await m(page)).x).toBeCloseTo(72, 6);
  expect((await m(page)).y).toBeCloseTo(300, 5);
  expect(await page.evaluate(() => window.__bbzbTest.guides())).toEqual({ x: null, y: null });
  expect(await page.evaluate(() => window.__bbzbTest.contentIds())).toEqual(['', '', 'o', 'm']); // Slides und Elemente, keine Hilfslinien
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await m(page)).x).toBe(300);
});

test('Ziehen rastet an der Slide-Mitte, an der Naht und am anderen Element ein', async ({ page }) => {
  await open(page);
  await drag(page, 400, 400, 143, 0); // Mitte 543 → 540
  await expect.poll(async () => (await m(page)).x).toBeCloseTo(440, 6);
  await drag(page, 500, 400, 437, 0); // rechte Kante 1077 → Naht 1080
  await expect.poll(async () => (await m(page)).x).toBeCloseTo(880, 6);
  expect(await drag(page, 950, 400, 0, 503)).toEqual({ x: 1080, y: 800 }); // obere Kante 803 → Oberkante von «o», rechts bleibt an der Naht
  await expect.poll(async () => (await m(page)).y).toBeCloseTo(800, 6);
});

test('Mit Ctrl rastet nichts ein', async ({ page }) => {
  await open(page);
  const { scale } = await view(page);
  expect(await drag(page, 400, 400, -225, 0, true)).toEqual({ x: null, y: null });
  await expect.poll(async () => Math.abs((await m(page)).x - 75)).toBeLessThan(1 / scale); // Mauspunkte sind ganze Bildschirm-px
});

test('Schwelle in Bildschirm-px: bei kleinem Zoom rastet ein grösserer Welt-Abstand ein', async ({ page }) => {
  await open(page);
  const fit = (await view(page)).scale;
  const far = 9 / fit; // 9 Bildschirm-px bei 100 %: zu weit
  await drag(page, 400, 400, -228 + far, 0);
  await expect.poll(async () => Math.abs((await m(page)).x - 72 - far)).toBeLessThan(1 / fit); // Mauspunkte sind ganze Bildschirm-px
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await m(page)).x).toBe(300);
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Verkleinern' }).click(); // 51 %: dieselben Welt-px sind 4.6 Bildschirm-px
  await frames(page);
  await drag(page, 400, 400, -228 + far, 0);
  await expect.poll(async () => (await m(page)).x).toBeCloseTo(72, 6);
});

test('Gedreht: die gedrehte Hülle rastet ein', async ({ page }) => {
  await open(page, 45); // Hülle x 158.6..441.4
  await drag(page, 300, 441, -83.6, 0); // linke Hüllenkante 75 → 72
  await expect.poll(async () => (await m(page)).x).toBeCloseTo(300 - 86.6, 1);
});

test('Skalieren an der Ecke rastet am Rand ein und behält das Seitenverhältnis', async ({ page }) => {
  await open(page);
  await page.mouse.click(...Object.values(await toScreen(page, 400, 400)) as [number, number]);
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.transformerNodes())).toBe(1);
  expect(await drag(page, 500, 500, 505, 505)).toEqual({ x: 1008, y: null }); // rechte Kante 1005 → 1008
  await expect.poll(async () => (await m(page)).width).toBeCloseTo(708, 3);
  expect((await m(page)).height).toBeCloseTo(708, 3);
});

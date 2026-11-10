import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { elements, exportPng, frames, toScreen } from './fixtures';
import { cutoutPng, openPhoto } from './photoProject';

const DARK = [15, 27, 38];
type Crop = { x: number; y: number; scale: number };
const photo = async (page: Page) => {
  const e = (await elements(page))[0]!;
  return { ...e, crop: (e.props as { crop: Crop }).crop };
};

/** Ecke unten rechts ohne Shift ziehen (proportional) und loslassen. */
async function dragCorner(page: Page, dx: number, dy: number) {
  const h = await page.evaluate(() => window.__bbzbTest.anchorScreen('bottom-right'));
  await page.mouse.move(h.x, h.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(h.x + (dx * i) / 8, h.y + (dy * i) / 8);
  await frames(page);
  await page.mouse.up();
  await frames(page);
}

/** Sichtbarer Bildausschnitt in Bildpixeln: muss beim proportionalen Skalieren gleich bleiben. */
const source = (p: { width: number; height: number; crop: Crop }) => ({
  x: -p.crop.x / p.crop.scale,
  y: -p.crop.y / p.crop.scale,
  w: p.width / p.crop.scale,
  h: p.height / p.crop.scale,
});

for (const [what, frame] of [
  ['Rahmen aussen um einen Freisteller', { frame: true, frameOutside: true }],
  ['alter Innenrahmen', { frame: true }],
  ['ohne Rahmen', {}],
] as const) {
  for (const [dir, dx, dy] of [['grösser', 160, 40], ['kleiner', -160, -40]] as const) {
    test(`Ecke proportional ${dir}, ${what}: der sichtbare Bildinhalt bleibt derselbe`, async ({ page }) => {
      const box = { x: 200, y: 300, width: 500, height: 600 };
      // Ausschnitt gezoomt und verschoben: ein falsch berechneter Zuschnitt fällt sofort auf
      const crop = { x: -150, y: -100, scale: 0.8 };
      await openPhoto(page, 'Skalieren', box, { ...frame, crop }, cutoutPng(1000, 1000, DARK), [450, 600]);
      const c = await toScreen(page, 450, 600);
      await page.mouse.click(c.x, c.y);
      await expect.poll(() => page.evaluate(() => window.__bbzbTest.transformerNodes())).toBe(1);
      await expect.poll(() => page.evaluate(() => window.__bbzbTest.pendingEffects())).toBe(0);
      const before = await photo(page);
      await dragCorner(page, dx, dy);
      await expect.poll(async () => (await photo(page)).width).not.toBe(box.width);
      const after = await photo(page);
      expect(after.width / after.height, 'Seitenverhältnis der Box').toBeCloseTo(before.width / before.height, 3);
      const [a, b] = [source(before), source(after)];
      // Innenrahmen: die Ränder bleiben 24 px, der Bildbereich wächst nicht ganz proportional; der Bildpunkt oben links bleibt
      const keys = 'frameOutside' in frame || !('frame' in frame) ? (['x', 'y', 'w', 'h'] as const) : (['x', 'y'] as const);
      for (const k of keys) expect(b[k], `Quellrechteck ${k}`).toBeCloseTo(a[k], 0);
    });
  }
}

test('Ecke proportional, gedrehter und gespiegelter Freisteller mit Rahmen aussen: derselbe Bildinhalt', async ({ page }) => {
  const box = { x: 250, y: 350, width: 500, height: 600 };
  await openPhoto(page, 'Gedreht', box, { frame: true, frameOutside: true, flipX: true, crop: { x: -150, y: -100, scale: 0.8 } }, cutoutPng(1000, 1000, DARK), [500, 650]);
  await page.evaluate(() => window.__bbzbTest.patch('e0', { rotation: 20 }));
  const c = await toScreen(page, 500, 650);
  await page.mouse.click(c.x, c.y);
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.transformerNodes())).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.pendingEffects())).toBe(0);
  const before = await photo(page);
  expect(before.rotation).toBe(20);
  await dragCorner(page, 120, 60);
  await expect.poll(async () => (await photo(page)).width).not.toBe(box.width);
  const after = await photo(page);
  expect(after.width / after.height).toBeCloseTo(before.width / before.height, 3);
  const [a, b] = [source(before), source(after)];
  for (const k of ['x', 'y', 'w', 'h'] as const) expect(b[k], `Quellrechteck ${k}`).toBeCloseTo(a[k], 0);
});

test('Mehrfachauswahl, Ecke ohne Shift: beide Freisteller mit Rahmen aussen behalten ihren Bildinhalt', async ({ page }) => {
  const box = { x: 100, y: 300, width: 400, height: 500 };
  await openPhoto(page, 'Zwei', box, { frame: true, frameOutside: true, crop: { x: -100, y: -50, scale: 0.6 } }, cutoutPng(1000, 1000, DARK), [300, 550]);
  await page.evaluate(() => window.__bbzbTest.select('e0'));
  await page.keyboard.press('Control+d');
  await expect.poll(() => elements(page)).toHaveLength(2);
  const ids = (await elements(page)).map((e) => e.id);
  await page.evaluate((ids) => {
    const t = window.__bbzbTest;
    t.patch(ids[1]!, { x: 600, y: 350, width: 300, height: 450 });
    t.selectIds(ids);
  }, ids);
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.transformerNodes())).toBe(2);
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.pendingEffects())).toBe(0);
  const before = await elements(page);
  await dragCorner(page, 120, 60);
  await expect.poll(async () => (await elements(page))[0]!.width).not.toBe(box.width);
  const after = await elements(page);
  for (const id of ids) {
    const [p, q] = [before, after].map((l) => l.find((e) => e.id === id)!).map((e) => ({ ...e, crop: (e.props as { crop: Crop }).crop }));
    expect(q!.width / q!.height, id).toBeCloseTo(p!.width / p!.height, 3);
    const [a, b] = [source(p!), source(q!)];
    for (const k of ['x', 'y', 'w', 'h'] as const) expect(b[k], `${id} Quellrechteck ${k}`).toBeCloseTo(a[k], 0);
  }
});

test('Export nach dem Verkleinern: derselbe Bildpunkt liegt an der mitskalierten Stelle, nichts abgeschnitten', async ({ page }) => {
  // Freisteller-Ring, Rotanteil = x im Bild: zeigt im Export, welcher Bildpunkt wo liegt
  const png = new PNG({ width: 1000, height: 1000 });
  for (let y = 0; y < 1000; y++)
    for (let x = 0; x < 1000; x++) {
      const r = Math.hypot(x + 0.5 - 500, y + 0.5 - 500);
      png.data.set([Math.round((x * 255) / 999), 0, 0, r <= 400 && r > 150 ? 255 : 0], (y * 1000 + x) * 4);
    }
  const box = { x: 200, y: 300, width: 500, height: 600 };
  const crop = { x: -150, y: -100, scale: 0.8 };
  await openPhoto(page, 'Export', box, { frame: true, frameOutside: true, crop }, PNG.sync.write(png), [450, 600]);
  const c = await toScreen(page, 450, 600);
  await page.mouse.click(c.x, c.y);
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.pendingEffects())).toBe(0);
  await dragCorner(page, -160, -40);
  await expect.poll(async () => (await photo(page)).width).not.toBe(box.width);
  const after = await photo(page);
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.pendingEffects())).toBe(0);
  const [slide] = await exportPng(page);
  const k = after.width / box.width;
  // Bildpunkte, die vorher sichtbar waren: links (x 220), oben (y 140), rechts (x 780) im Ring
  for (const [sx, sy] of [[220, 500], [500, 140], [780, 500]] as const) {
    const wx = Math.round(after.x + (sx * crop.scale + crop.x) * k);
    const wy = Math.round(after.y + (sy * crop.scale + crop.y) * k);
    const i = (wy * slide!.width + wx) * 4;
    expect(Math.abs(slide!.data[i]! - (sx * 255) / 999), `Bildpunkt ${sx}, ${sy} bei ${wx}, ${wy}`).toBeLessThan(12);
  }
});

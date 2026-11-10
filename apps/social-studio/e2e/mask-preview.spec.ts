import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { toScreen } from './fixtures';
import { alphaPng, openPhoto } from './photoProject';

const DARK = [15, 27, 38];
const BLAU = [0, 159, 226];
const BOX = { x: 140, y: 275, width: 800, height: 800 };
const history = (page: Page) => page.evaluate(() => window.__bbzbTest.history());
const view = (page: Page, name: 'Rote Folie' | 'Ergebnis') => page.getByRole('group', { name: 'Ansicht' }).getByRole('button', { name });

/** Farbe auf dem Bildschirm am Weltpunkt (Mitte eines 3 × 3-Flecks). */
async function screenAt(page: Page, x: number, y: number) {
  const c = await toScreen(page, x, y);
  const png = PNG.sync.read(await page.screenshot({ clip: { x: c.x - 1, y: c.y - 1, width: 3, height: 3 } }));
  const i = (png.width + 1) * 4;
  return [png.data[i]!, png.data[i + 1]!, png.data[i + 2]!];
}
const near = (got: number[], want: number[]) => got.every((v, k) => Math.abs(v - want[k]!) <= 3);
const red = (p: number[]) => p[0]! > p[1]! + 60 && p[0]! > p[2]! + 60;

async function stroke(page: Page, y: number, mid?: () => Promise<void>) {
  const [a, b] = [await toScreen(page, 300, y), await toScreen(page, 780, y)];
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, a.y, { steps: 6 });
  await mid?.();
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await page.mouse.up();
}

test('«Ergebnis» zeigt das Foto mit der Maske live, «Rote Folie» die Folie; Umschalten verliert nichts, Undo je Strich, Export gleich, Wahl bleibt in der Sitzung', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openPhoto(page, 'Ansicht', BOX, { crop: { x: 0, y: 0, scale: 0.8 } }, alphaPng(1000, 1000, DARK, () => 255), [740, 675]);
  const c = await toScreen(page, 740, 675);
  await page.mouse.click(c.x, c.y);
  await page.getByRole('button', { name: 'Maske bearbeiten' }).click();
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.veils())).toBe(1);
  await expect(view(page, 'Rote Folie')).toHaveAttribute('aria-pressed', 'true');
  await expect(view(page, 'Ergebnis')).toHaveAttribute('data-tip', /.+/);
  const h0 = await history(page);

  // Strich in «Rote Folie»: rot an der Strichstelle
  await stroke(page, 400);
  await expect.poll(() => history(page)).toBe(h0 + 1);
  await expect.poll(async () => red(await screenAt(page, 540, 400))).toBe(true);

  // Umschalten per Tastatur: keine Folie, an der Strichstelle die Slide-Farbe, daneben das Foto
  await view(page, 'Ergebnis').focus();
  await page.keyboard.press('Enter');
  await expect(view(page, 'Ergebnis')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.veils())).toBe(0);
  await expect.poll(async () => near(await screenAt(page, 540, 400), BLAU)).toBe(true);
  expect(near(await screenAt(page, 540, 600), DARK)).toBe(true);

  // Strich in «Ergebnis»: live sichtbar (vor dem Speichern), ein Undo-Schritt; Wechsel mitten im Strich verliert ihn nicht
  await stroke(page, 600, async () => {
    expect(near(await screenAt(page, 400, 600), BLAU), 'live beim Malen').toBe(true);
    await view(page, 'Rote Folie').focus();
    await page.keyboard.press('Enter');
  });
  await expect.poll(() => history(page)).toBe(h0 + 2);
  await expect.poll(async () => red(await screenAt(page, 700, 600))).toBe(true);
  expect(red(await screenAt(page, 400, 600))).toBe(true);

  // Strg + Z in «Rote Folie» nimmt genau den letzten Strich zurück
  await page.keyboard.press('Control+z');
  await expect.poll(() => history(page)).toBe(h0 + 1);
  await expect.poll(async () => red(await screenAt(page, 540, 600))).toBe(false);
  expect(red(await screenAt(page, 540, 400))).toBe(true);

  // Strg + Z in «Ergebnis» ebenso
  await view(page, 'Ergebnis').click();
  await stroke(page, 800);
  await expect.poll(() => history(page)).toBe(h0 + 2);
  await expect.poll(async () => near(await screenAt(page, 540, 800), BLAU)).toBe(true);
  await page.keyboard.press('Control+z');
  await expect.poll(() => history(page)).toBe(h0 + 1);
  await expect.poll(async () => near(await screenAt(page, 540, 800), DARK)).toBe(true);
  expect(near(await screenAt(page, 540, 400), BLAU)).toBe(true);

  // Verlassen aus «Ergebnis»: Export zeigt den Stand der Maske, die Ansicht ändert daran nichts; neues Öffnen behält «Ergebnis» (Sitzung)
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => window.__bbzbTest.ui().maskEditId)).toBeNull();
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.pendingEffects())).toBe(0);
  const px = await page.evaluate(() => window.__bbzbTest.slidePixels(0, [[540 / 1080, 400 / 1350], [540 / 1080, 600 / 1350], [540 / 1080, 800 / 1350]]));
  expect(px.map((p) => p.slice(36, 39))).toEqual([BLAU, DARK, DARK]);
  await page.getByRole('button', { name: 'Maske bearbeiten' }).click();
  await expect(view(page, 'Ergebnis')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => near(await screenAt(page, 540, 400), BLAU)).toBe(true);
  expect(await page.evaluate(() => window.__bbzbTest.veils())).toBe(0);
  expect(errors).toEqual([]);
});

test('«Ergebnis» mit Rahmen aussen: die Kontur folgt nach dem Strich der Maske wie nach dem Verlassen', async ({ page }) => {
  await openPhoto(page, 'Rahmen', BOX, { crop: { x: 0, y: 0, scale: 0.8 }, frame: true, frameOutside: true }, alphaPng(1000, 1000, DARK, () => 255), [740, 675]);
  const c = await toScreen(page, 740, 675);
  await page.mouse.click(c.x, c.y);
  await page.getByRole('button', { name: 'Maske bearbeiten' }).click();
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.veils())).toBe(1);
  await view(page, 'Ergebnis').click();
  await page.locator('.inspector').getByRole('spinbutton', { name: 'Grösse' }).fill('200');
  await page.locator('.inspector').getByRole('spinbutton', { name: 'Grösse' }).press('Enter');
  // im Rahmen links neben der Box: vor dem Strich Warmweiss
  const before = await screenAt(page, 128, 500);
  expect(near(before, [251, 248, 243])).toBe(true);
  const h0 = await history(page);
  const [a, b] = [await toScreen(page, 400, 500), await toScreen(page, 20, 500)];
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 10 });
  await page.mouse.up();
  await expect.poll(() => history(page)).toBe(h0 + 1);
  await expect.poll(async () => near(await screenAt(page, 128, 500), [251, 248, 243])).toBe(false);
  const shown = await screenAt(page, 128, 500);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.pendingEffects())).toBe(0);
  expect(near(await screenAt(page, 128, 500), shown), `${await screenAt(page, 128, 500)} wie ${shown}`).toBe(true);
});

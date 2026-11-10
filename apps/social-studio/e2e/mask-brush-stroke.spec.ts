import { expect, test, type Page } from '@playwright/test';
import { elements, toScreen } from './fixtures';
import { alphaPng, openPhoto } from './photoProject';

const DARK = [15, 27, 38];
const BOX = { x: 140, y: 275, width: 800, height: 800 };
const history = (page: Page) => page.evaluate(() => window.__bbzbTest.history());
const maskAt = (page: Page, pts: [number, number][]) => page.evaluate((p) => window.__bbzbTest.maskValues('e0', p), pts);

/** Foto 1000 × 1000 in der Box, Pinselmodus offen. Ausschnitt `crop` (Bildpixel; Maske hat dieselbe Grösse). */
async function openBrush(page: Page, name: string, crop = { x: 0, y: 0, scale: 0.8 }) {
  await openPhoto(page, name, BOX, { crop }, alphaPng(1000, 1000, DARK, () => 255), [740, 675]);
  const c = await toScreen(page, 740, 675);
  await page.mouse.click(c.x, c.y);
  await page.getByRole('button', { name: 'Maske bearbeiten' }).click();
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.veils())).toBe(1);
}

async function stroke(page: Page, pts: number[][]) {
  const s = await Promise.all(pts.map(([x, y]) => toScreen(page, x!, y!)));
  await page.mouse.move(s[0]!.x, s[0]!.y);
  await page.mouse.down();
  for (const p of s.slice(1)) await page.mouse.move(p.x, p.y, { steps: 8 });
  await page.mouse.up();
}

test('Undo/Redo, Esc und verpasstes Loslassen mitten im Strich: kein Fehler, der Strich zählt, der nächste geht', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openBrush(page, 'Mitten');
  const h0 = await history(page);
  await stroke(page, [[300, 400], [780, 400]]);
  await expect.poll(() => history(page)).toBe(h0 + 1);

  // Strg + Z und Strg + Y bei gedrückter Taste wirken nicht; der Strich wird ein Schritt
  const a = await toScreen(page, 300, 600);
  const b = await toScreen(page, 780, 600);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, a.y, { steps: 4 });
  await page.keyboard.press('Control+z');
  await page.mouse.move(b.x, b.y, { steps: 4 });
  await page.keyboard.press('Control+y');
  await page.mouse.move(b.x, b.y + 20, { steps: 2 });
  await page.mouse.up();
  await expect.poll(() => history(page)).toBe(h0 + 2);
  expect((await maskAt(page, [[300 / 0.8 - 175, 400 / 0.8 - 344], [540 / 0.8 - 175, 600 / 0.8 - 344]]))!.values).toEqual([0, 0]);
  await stroke(page, [[300, 800], [780, 800]]);
  await expect.poll(() => history(page)).toBe(h0 + 3);

  // Esc bei gedrückter Taste: der Strich wird erst gespeichert, dann endet der Modus
  const [a9, b9] = [await toScreen(page, 300, 900), await toScreen(page, 780, 900)];
  await page.mouse.move(a9.x, a9.y);
  await page.mouse.down();
  await page.mouse.move(b9.x, b9.y, { steps: 6 });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect.poll(() => history(page)).toBe(h0 + 4);
  expect(await page.evaluate(() => window.__bbzbTest.ui().maskEditId)).toBeNull();
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.pendingEffects())).toBe(0);
  const px = await page.evaluate(() => window.__bbzbTest.slidePixels(0, [[540 / 1080, 900 / 1350]]));
  expect(px[0]!.slice(36, 39), 'Esc-Strich ausgeblendet').toEqual([0, 159, 226]);

  // Loslassen verpasst (Alt + Tab): die nächste Bewegung ohne gedrückte Taste beendet den Strich
  await page.getByRole('button', { name: 'Maske bearbeiten' }).click();
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.veils())).toBe(1);
  const [a7, b7] = [await toScreen(page, 300, 700), await toScreen(page, 780, 700)];
  await page.mouse.move(a7.x, a7.y);
  await page.mouse.down();
  await page.mouse.move(b7.x, b7.y, { steps: 4 });
  await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointermove', { buttons: 0, clientX: 10, clientY: 10 })));
  await expect.poll(() => history(page)).toBe(h0 + 5);
  await page.mouse.up();
  await stroke(page, [[300, 1000], [780, 1000]]);
  await expect.poll(() => history(page)).toBe(h0 + 6);
  expect(errors).toEqual([]);
  expect(((await elements(page))[0]!.props as { mask?: string }).mask).toBeDefined();
});

test('Strich nur im sichtbaren Ausschnitt: aus der Box gezogen und grosser Pinsel am Rand lassen Weggeschnittenes unberührt', async ({ page }) => {
  // Bild 1000 × 1000 bei Massstab 1, um 200 nach links verschoben: sichtbar Bild-/Maskenpixel x 200..1000, y 0..800
  await openBrush(page, 'Rand', { x: -200, y: 0, scale: 1 });
  await page.locator('.inspector').getByRole('spinbutton', { name: 'Grösse' }).fill('200');
  await page.locator('.inspector').getByRole('spinbutton', { name: 'Grösse' }).press('Enter');
  await page.locator('.inspector').getByRole('slider', { name: 'Härte' }).focus();
  await page.keyboard.press('End');
  const h0 = await history(page);
  // von innen über den linken Rand (Box x 140) bis weit hinaus, dann entlang des unteren Rands (Box y 1075)
  await stroke(page, [[540, 675], [20, 675]]);
  await stroke(page, [[300, 1070], [800, 1070]]);
  await expect.poll(() => history(page)).toBe(h0 + 2);
  const v = (await maskAt(page, [[150, 400], [195, 400], [199, 400], [202, 400], [210, 400], [500, 805], [500, 900], [500, 801], [500, 798], [500, 790]]))!;
  expect(v.width).toBe(1000);
  expect(v.values.slice(0, 3), 'links weggeschnitten: unberührt').toEqual([255, 255, 255]);
  expect(v.values.slice(3, 5), 'links am Rand drinnen: aus').toEqual([0, 0]);
  expect(v.values.slice(5, 8), 'unten weggeschnitten: unberührt').toEqual([255, 255, 255]);
  expect(v.values.slice(8), 'unten am Rand drinnen: aus').toEqual([0, 0]);
});

test('Hängt das Schreiben der Maske, meldet der Editor es, die Warteschlange läuft weiter und der nächste Strich speichert beide', async ({ page }) => {
  // das erste Schreiben einer Assetdatei nach `window.hangWrite = true` antwortet nie
  await page.addInitScript(() => {
    const orig = FileSystemFileHandle.prototype.createWritable;
    FileSystemFileHandle.prototype.createWritable = function (...a) {
      const w = window as unknown as { hangWrite?: boolean };
      if (w.hangWrite && /^[0-9a-f]{64}$/.test(this.name)) return (w.hangWrite = false), new Promise<FileSystemWritableFileStream>(() => {});
      return orig.apply(this, a);
    };
  });
  await openPhoto(page, 'Haenger', BOX, { crop: { x: 0, y: 0, scale: 1 } }, alphaPng(1000, 1000, [15, 27, 38], () => 255), [540, 675]);
  const c = await toScreen(page, 540, 675);
  await page.mouse.click(c.x, c.y);
  await page.getByRole('button', { name: 'Maske bearbeiten' }).click();
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.veils())).toBe(1);
  await page.evaluate(() => void ((window as unknown as { hangWrite: boolean }).hangWrite = true));
  const stroke = async (x: number, y: number) => {
    const [a, b] = await Promise.all([toScreen(page, x, y), toScreen(page, x + 20, y)]);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 4 });
    await page.mouse.up();
  };
  await stroke(250, 400);
  await expect(page.getByText('Der Strich ist nicht gespeichert')).toBeVisible({ timeout: 20_000 });
  expect(await page.evaluate(() => window.__bbzbTest.ui().maskEditId)).toBe('e0'); // Modus bleibt offen
  expect(await page.evaluate(() => window.__bbzbTest.history())).toBe(0);
  await stroke(250, 800);
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.history())).toBe(1);
  // beide Striche in der gespeicherten Maske: Mittelpunkte der Striche (Slide zu Foto: x - 140, y - 275, Ausschnitt 1:1)
  const m = await page.evaluate(() => window.__bbzbTest.maskValues('e0', [[260 - 140, 400 - 275], [260 - 140, 800 - 275], [700, 100]]));
  expect(m!.values).toEqual([0, 0, 255]);
});

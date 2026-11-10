import { expect, test, type Page } from '@playwright/test';
import { elements, toScreen } from './fixtures';
import { alphaPng, maskPng, openPhoto } from './photoProject';

const BOX = { x: 140, y: 275, width: 800, height: 800 };
const half = maskPng(1000, 1000, (x) => (x < 500 ? 0 : 255));
const hist = (page: Page) => page.evaluate(() => window.__bbzbTest.history());
const maskId = async (page: Page) => ((await elements(page))[0]!.props as { mask?: string }).mask;
const values = async (page: Page, pts: [number, number][]) => (await page.evaluate((p) => window.__bbzbTest.maskValues('e0', p), pts))!.values;
const section = (page: Page) => page.locator('section.section', { has: page.getByRole('heading', { name: 'Maske', exact: true }) });
const btn = (page: Page, name: string) => section(page).getByRole('button', { name, exact: true });

/** Das nächste Schreiben einer Assetdatei nach `window.delayWrite = ms` wartet so lange (ein Speichern im Flug). */
async function open(page: Page, name: string, mask?: Buffer) {
  await page.addInitScript(() => {
    const orig = FileSystemFileHandle.prototype.createWritable;
    FileSystemFileHandle.prototype.createWritable = async function (...a) {
      const w = window as unknown as { delayWrite?: number };
      if (w.delayWrite && /^[0-9a-f]{64}$/.test(this.name)) {
        const ms = w.delayWrite;
        w.delayWrite = 0;
        await new Promise((r) => setTimeout(r, ms));
      }
      return orig.apply(this, a);
    };
  });
  await openPhoto(page, name, BOX, { crop: { x: 0, y: 0, scale: 1 } }, alphaPng(1000, 1000, [15, 27, 38], () => 255), [540, 675], mask);
  const c = await toScreen(page, 540, 675);
  await page.mouse.click(c.x, c.y);
  await page.getByRole('button', { name: 'Maske bearbeiten' }).first().click();
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.veils())).toBe(1);
}
const delay = (page: Page, ms: number) => page.evaluate((v) => void ((window as unknown as { delayWrite: number }).delayWrite = v), ms);
async function stroke(page: Page, x: number, y: number) {
  const [a, b] = await Promise.all([toScreen(page, x, y), toScreen(page, x + 20, y)]);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 4 });
  await page.mouse.up();
}
const notice = (page: Page, re: RegExp) => page.getByText(re);

test('Strich im Flug, dann «Maske zurücksetzen»: das Zurücksetzen bleibt, der späte Strich wird mit Meldung verworfen', async ({ page }) => {
  await open(page, 'Spaet', half);
  await delay(page, 1500);
  await stroke(page, 700, 400);
  await btn(page, 'Maske zurücksetzen').click();
  await expect.poll(() => maskId(page)).toBeUndefined();
  await expect(notice(page, /Strich ist nicht übernommen/)).toBeVisible({ timeout: 10_000 });
  expect(await maskId(page)).toBeUndefined();
  expect(await hist(page)).toBe(1);
});

test('Strg + Z bei ausstehendem Speichern macht nichts Früheres rückgängig, der Strich bleibt ein Undo-Schritt', async ({ page }) => {
  await open(page, 'Undo');
  await page.evaluate(() => window.__bbzbTest.patch('e0', { rotation: 0, opacity: 0.9 }));
  const h0 = await hist(page);
  expect(h0).toBeGreaterThan(0);
  await delay(page, 1500);
  await stroke(page, 300, 400);
  await page.keyboard.press('Control+z');
  expect(await hist(page)).toBe(h0); // abgelehnt, nichts rückgängig
  expect(((await elements(page))[0] as { opacity: number }).opacity).toBe(0.9);
  await expect.poll(() => hist(page), { timeout: 10_000 }).toBe(h0 + 1);
  expect(((await elements(page))[0] as { opacity: number }).opacity).toBe(0.9);
  await page.keyboard.press('Control+z');
  await expect.poll(() => maskId(page)).toBeUndefined();
  expect(((await elements(page))[0] as { opacity: number }).opacity).toBe(0.9);
});

test('Umkehren gleich nach einem Strich: beide landen der Reihe nach, zwei Undo-Schritte', async ({ page }) => {
  await open(page, 'Reihe');
  const h0 = await hist(page);
  await delay(page, 1200);
  await stroke(page, 300, 400);
  await btn(page, 'Maske umkehren').click();
  await expect.poll(() => hist(page), { timeout: 10_000 }).toBe(h0 + 2);
  const pts: [number, number][] = [[170, 125], [560, 325]];
  await expect.poll(() => values(page, pts)).toEqual([255, 0]); // Strich (war 0) umgekehrt, Rest (war 255) umgekehrt
  await page.keyboard.press('Control+z');
  await expect.poll(() => values(page, pts)).toEqual([0, 255]);
});

test('Weich zeichnen im Flug: ein neuer Strich wird nicht still verloren, sondern gemeldet', async ({ page }) => {
  await open(page, 'Weich', half);
  const h0 = await hist(page);
  await delay(page, 1500);
  await btn(page, 'Maske weich zeichnen').click();
  await stroke(page, 700, 400);
  await expect(notice(page, /Maske wird gerade geändert/)).toBeVisible();
  await expect.poll(() => hist(page), { timeout: 10_000 }).toBe(h0 + 1);
  await stroke(page, 700, 800);
  await expect.poll(() => hist(page), { timeout: 10_000 }).toBe(h0 + 2);
});

test('Zwei Striche in einem Speicherfenster ergeben zwei Undo-Schritte', async ({ page }) => {
  await open(page, 'Zwei');
  const h0 = await hist(page);
  await delay(page, 1500);
  await stroke(page, 300, 400);
  await stroke(page, 300, 800);
  await expect.poll(() => hist(page), { timeout: 10_000 }).toBe(h0 + 2);
  const pts: [number, number][] = [[170, 125], [170, 525], [560, 325]];
  expect(await values(page, pts)).toEqual([0, 0, 255]);
  await page.keyboard.press('Control+z');
  await expect.poll(() => values(page, pts)).toEqual([0, 255, 255]);
});

test('Weich zeichnen skaliert mit dem Ausschnitt: gleiche sichtbare Weichheit bei anderer Auflösung', async ({ page }) => {
  const soft = async (scale: number) => {
    await page.goto('');
    await openPhoto(page, `Skala${scale}`, BOX, { crop: { x: 0, y: 0, scale } }, alphaPng(1000, 1000, [15, 27, 38], () => 255), [540, 675], half);
    const c = await toScreen(page, 540, 675);
    await page.mouse.click(c.x, c.y);
    const before = await maskId(page);
    await btn(page, 'Maske weich zeichnen').click();
    await expect.poll(() => maskId(page)).not.toBe(before);
    return (await values(page, [[482, 500]]))[0]!;
  };
  expect(await soft(1)).toBe(0); // Radius 12 Maskenpixel: 18 px vor der Kante unberührt
  expect(await soft(0.5)).toBeGreaterThan(0); // Radius 24 Maskenpixel
});

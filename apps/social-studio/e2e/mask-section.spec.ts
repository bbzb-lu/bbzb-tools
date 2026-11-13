import { expect, test, type Page } from '@playwright/test';
import { elements, newProject, openAllSections, toScreen } from './fixtures';
import { alphaPng, maskPng, openPhoto } from './photoProject';
import { addVideo } from './video';

const SHOTS = '.superpowers/sdd/2026-10-28-phase-4a-maske-pinsel/screens';
const BOX = { x: 140, y: 275, width: 800, height: 800 };
const DARK = [15, 27, 38];
const photo = alphaPng(1000, 1000, DARK, () => 255);
const half = maskPng(1000, 1000, (x) => (x < 500 ? 0 : 255));
const section = (page: Page) => page.locator('section.section', { has: page.getByRole('heading', { name: 'Maske', exact: true }) });
const btn = (page: Page, name: string) => section(page).getByRole('button', { name, exact: true });
const maskId = async (page: Page) => ((await elements(page))[0]!.props as { mask?: string }).mask;
const history = (page: Page) => page.evaluate(() => window.__bbzbTest.history());
const values = (page: Page, pts: [number, number][]) => page.evaluate(([p]) => window.__bbzbTest.maskValues('e0', p as [number, number][]), [pts]);

async function select(page: Page, name: string, withMask = false) {
  await openPhoto(page, name, BOX, { crop: { x: 0, y: 0, scale: 1 } }, photo, [540, 675], withMask ? half : undefined);
  const c = await toScreen(page, 540, 675);
  await page.mouse.click(c.x, c.y);
  await expect(section(page)).toBeVisible();
  await openAllSections(page);
}

test('Abschnitt «Maske» am Foto, Knöpfe mit Name und Tooltip', async ({ page }) => {
  await select(page, 'Einfach');
  await expect(section(page)).toBeVisible();
  await expect(btn(page, 'Ausblenden')).toHaveCount(0); // Pinselwerte nur im Pinselmodus
  for (const n of ['Maske bearbeiten', 'Maske umkehren', 'Maske zurücksetzen', 'Maske weich zeichnen'])
    await expect(btn(page, n)).toHaveAttribute('data-tip', /.+/);
  await expect(section(page).getByRole('slider', { name: 'Weiche Kante' })).toBeVisible();
  await btn(page, 'Maske bearbeiten').click();
  for (const n of ['Ausblenden', 'Einblenden']) await expect(btn(page, n)).toHaveAttribute('data-tip', /.+/);
  await expect(section(page).getByRole('slider', { name: 'Grösse' })).toBeVisible();
  await expect(section(page).getByRole('slider', { name: 'Härte' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(btn(page, 'Ausblenden')).toHaveCount(0);
  expect(await section(page).locator('[title]').count()).toBe(0);
  // Bild enthält den Knopf nicht mehr
  await expect(page.locator('section.section', { has: page.getByRole('heading', { name: 'Bild', exact: true }) }).getByRole('button', { name: 'Maske bearbeiten' })).toHaveCount(0);
});

test('Nicht am leeren Platzhalter und nicht am Video', async ({ page }) => {
  await openPhoto(page, 'Leer', BOX, {}, undefined, [540, 675]);
  const c = await toScreen(page, 540, 675);
  await page.mouse.click(c.x, c.y);
  await expect(page.getByRole('heading', { name: 'Bild', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Maske', exact: true })).toHaveCount(0);

  await newProject(page, 'Post 4:5');
  await addVideo(page);
  await expect(page.getByRole('button', { name: 'Effekte', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Maske', exact: true })).toHaveCount(0);
});

test('Ausblenden und Einblenden zeigen den aktiven Zustand', async ({ page }) => {
  await select(page, 'Modus');
  await btn(page, 'Maske bearbeiten').click();
  await expect(btn(page, 'Ausblenden')).toHaveAttribute('aria-pressed', 'true');
  await btn(page, 'Einblenden').click();
  await expect(btn(page, 'Einblenden')).toHaveAttribute('aria-pressed', 'true');
  await expect(btn(page, 'Ausblenden')).toHaveAttribute('aria-pressed', 'false');
  expect(await history(page)).toBe(0); // Ansicht, nie History
});

test('Zurücksetzen und Weich zeichnen ohne Maske sind aria-disabled und tun nichts', async ({ page }) => {
  await select(page, 'Ohne');
  for (const n of ['Maske zurücksetzen', 'Maske weich zeichnen']) {
    await expect(btn(page, n)).toHaveAttribute('aria-disabled', 'true');
    await expect(btn(page, n)).not.toHaveAttribute('disabled');
    await btn(page, n).click({ force: true });
  }
  expect(await maskId(page)).toBeUndefined();
  expect(await history(page)).toBe(0);
});

test('Umkehren und Zurücksetzen: je ein Undo-Schritt, ohne Pinselmodus, Undo und Redo stimmen', async ({ page }) => {
  await select(page, 'Umkehren', true);
  const start = await maskId(page);
  expect(await page.evaluate(() => window.__bbzbTest.ui().maskEditId)).toBeNull();
  const h0 = await history(page);
  await btn(page, 'Maske umkehren').click();
  await expect.poll(() => maskId(page)).not.toBe(start);
  expect(await history(page)).toBe(h0 + 1);
  const px = async () => (await values(page, [[250, 500], [750, 500]]))!.values;
  expect(await px()).toEqual([255, 0]);
  await btn(page, 'Maske zurücksetzen').click();
  await expect.poll(() => maskId(page)).toBeUndefined();
  expect(await history(page)).toBe(h0 + 2);
  await expect(btn(page, 'Maske zurücksetzen')).toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await px())[0]).toBe(255);
  await page.keyboard.press('Control+z');
  await expect.poll(() => maskId(page)).toBe(start);
  expect((await values(page, [[250, 500], [750, 500]]))!.values).toEqual([0, 255]);
  await page.keyboard.press('Control+y');
  await expect.poll(() => maskId(page)).not.toBe(start);
});

test('Umkehren ohne Maske blendet alles aus, Zurücksetzen holt es zurück', async ({ page }) => {
  await select(page, 'Alles');
  await btn(page, 'Maske umkehren').click();
  await expect.poll(() => maskId(page)).toBeDefined();
  expect((await values(page, [[10, 10], [900, 900]]))!.values).toEqual([0, 0]);
  await expect(btn(page, 'Maske zurücksetzen')).toHaveAttribute('aria-disabled', 'false');
});

test('Weich zeichnen: Kante wird weich, ein Undo-Schritt je Klick, Weichheit ändert nichts am Dokument', async ({ page }) => {
  await select(page, 'Weich', true);
  const start = await maskId(page);
  const h0 = await history(page);
  const slider = section(page).getByRole('slider', { name: 'Weiche Kante' });
  await slider.focus();
  await slider.press('End');
  expect(await history(page)).toBe(h0); // der Regler allein ändert nichts
  await btn(page, 'Maske weich zeichnen').click();
  await expect.poll(() => maskId(page)).not.toBe(start);
  expect(await history(page)).toBe(h0 + 1);
  const [a, b, far0, far1] = (await values(page, [[490, 500], [510, 500], [100, 500], [900, 500]]))!.values;
  expect(a).toBeGreaterThan(0);
  expect(b).toBeLessThan(255);
  expect([far0, far1]).toEqual([0, 255]);
  await page.keyboard.press('Control+z');
  await expect.poll(() => maskId(page)).toBe(start);
});

test('Im Pinselmodus wirken Umkehren und Zurücksetzen auf die Arbeitskopie', async ({ page }) => {
  await select(page, 'Im Modus', true);
  await btn(page, 'Maske bearbeiten').click();
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.veils())).toBe(1);
  // Ein Strich nach jeder Operation: er malt in die Arbeitskopie. Wäre sie veraltet, kämen die Werte vor der Operation zurück.
  const paint = async () => {
    const before = await maskId(page);
    const [a, b] = await Promise.all([toScreen(page, 200, 300), toScreen(page, 220, 300)]);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 4 });
    await page.mouse.up();
    await expect.poll(() => maskId(page)).not.toBe(before);
  };
  const far = async () => (await values(page, [[250, 500], [750, 500]]))!.values;
  await btn(page, 'Maske umkehren').click();
  await expect.poll(async () => (await far())[0]).toBe(255);
  await paint();
  expect(await far()).toEqual([255, 0]);
  await btn(page, 'Maske zurücksetzen').click();
  await expect.poll(() => maskId(page)).toBeUndefined();
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.veils())).toBe(1);
  await paint();
  expect(await far()).toEqual([255, 255]);
  expect(await page.evaluate(() => window.__bbzbTest.ui().maskEditId)).toBe('e0'); // Modus bleibt
});

test('Kontextmenü «Maske bearbeiten» öffnet den Pinselmodus, nicht am Video', async ({ page }) => {
  await select(page, 'Menü');
  const at = await toScreen(page, 540, 675);
  await page.mouse.click(at.x, at.y, { button: 'right' });
  await page.getByRole('menu', { name: 'Kontextmenü' }).getByRole('menuitem', { name: 'Maske bearbeiten', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.ui().maskEditId)).toBe('e0');

  await newProject(page, 'Post 4:5');
  const id = await addVideo(page);
  const b = (await elements(page)).find((e) => e.id === id)!;
  const v = await toScreen(page, b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.click(v.x, v.y, { button: 'right' });
  await expect(page.getByRole('menu', { name: 'Kontextmenü' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Maske bearbeiten' })).toHaveCount(0);
});

for (const [w, h] of [[1280, 720], [1536, 864]] as const)
  test(`Bei ${w} × ${h} bedienbar, die Seite scrollt nicht`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await select(page, `Gross ${w}`, true);
    await btn(page, 'Maske bearbeiten').click();
    await btn(page, 'Maske weich zeichnen').scrollIntoViewIfNeeded();
    await expect(btn(page, 'Maske weich zeichnen')).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await section(page).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/task-4-section-${w}.png` });
  });

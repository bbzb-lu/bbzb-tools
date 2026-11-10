import { expect, test, type Page } from '@playwright/test';
import { elements, newProject, toScreen, openSection } from './fixtures';
import { alphaPng, openPhoto } from './photoProject';
import { addVideo, twoTone } from './video';

const SHOTS = '.superpowers/sdd/2026-10-28-phase-4b-ki-freistellen/screens';
const BOX = { x: 140, y: 275, width: 800, height: 800 };
const DARK = [15, 27, 38];
const BLAU = [0, 159, 226];
const photo = alphaPng(1000, 1000, DARK, () => 255);
const section = (page: Page) => page.locator('section.section', { has: page.getByRole('heading', { name: 'Maske', exact: true }) });
const btn = (page: Page, name: string) => section(page).getByRole('button', { name, exact: true });
const maskId = async (page: Page, id = 'e0') => ((await elements(page)).find((e) => e.id === id)?.props as { mask?: string } | undefined)?.mask;
const history = (page: Page) => page.evaluate(() => window.__bbzbTest.history());
const fake = (page: Page, mode: 'kreis' | 'leer' | 'netz', ms: number) => page.evaluate(([m, t]) => window.__bbzbTest.fakeCutout(m as 'kreis', t as number), [mode, ms] as const);
/**
 * Zwei Punkte, relativ zur Slide wie im Export: Bildpixel (400, 400) im Kreis (Mitte 500, Radius 250) und eine Ecke ausserhalb.
 * `crop.scale` 1 zeigt das 1000-px-Foto 1:1, die Box (800) also nur Bildpixel 0 bis 800.
 */
const probe = (page: Page) =>
  page.evaluate(() => window.__bbzbTest.slidePixels(0, [[540 / 1080, 675 / 1350], [180 / 1080, 315 / 1350]])).then((p) => p.map((px) => px.slice(0, 3)));
const close = (a: number[], b: number[]) => a.every((v, i) => Math.abs(v - b[i]!) <= 3);

async function select(page: Page, name: string) {
  await openPhoto(page, name, BOX, { crop: { x: 0, y: 0, scale: 1 } }, photo, [540, 675]);
  const c = await toScreen(page, 540, 675);
  await page.mouse.click(c.x, c.y);
  await expect(section(page)).toBeVisible();
}

test.beforeAll(twoTone);

test('«Hintergrund entfernen» legt die Kreismaske an, sichtbar im Export, Strg + Z nimmt sie in einem Schritt zurück', async ({ page }) => {
  await select(page, 'Kreis');
  await expect(btn(page, 'Hintergrund entfernen')).toHaveAttribute('data-tip', /.+/);
  const [mid0, corner0] = await probe(page);
  expect(close(mid0!, DARK) && close(corner0!, DARK)).toBe(true);
  await fake(page, 'kreis', 300);
  const h0 = await history(page);
  await btn(page, 'Hintergrund entfernen').click();
  await expect.poll(() => maskId(page)).toBeDefined();
  await expect(btn(page, 'Hintergrund entfernen')).toBeVisible();
  expect(await history(page)).toBe(h0 + 1);
  const [mid, corner] = await probe(page);
  expect(close(mid!, DARK)).toBe(true); // Motiv bleibt
  expect(close(corner!, BLAU)).toBe(true); // Hintergrund weg, die Slide scheint durch
  await page.screenshot({ path: `${SHOTS}/task-4-done.png` });
  await page.keyboard.press('Control+z');
  await expect.poll(() => maskId(page)).toBeUndefined();
  expect(await history(page)).toBe(h0);
  expect(close((await probe(page))[1]!, DARK)).toBe(true);
});

test('Während des Laufs: Statuszeile, Abbrechen behält den Fokus, Maskenknöpfe gesperrt; Abbrechen lässt das Foto unberührt', async ({ page }) => {
  await select(page, 'Abbrechen');
  await fake(page, 'kreis', 30000);
  const h0 = await history(page);
  await btn(page, 'Hintergrund entfernen').click();
  // Live-Region (immer da, gemeinsam mit der Kontextleiste) ohne Prozent, sichtbare Zeile mit Prozent
  await expect(page.locator('#context-live')).toHaveText(/^Modell wird geladen, einmalig ca\. \d+ MB$/);
  await expect(section(page).locator('p.hint').first()).toHaveText(/^Modell wird geladen, einmalig ca\. \d+ MB, 100 %$/);
  await expect(btn(page, 'Abbrechen')).toBeFocused(); // derselbe Knopf, der Fokus bleibt
  for (const n of ['Maske bearbeiten', 'Maske umkehren', 'Maske zurücksetzen', 'Maske weich zeichnen']) {
    await expect(btn(page, n)).toHaveAttribute('aria-disabled', 'true');
    await expect(btn(page, n)).toHaveAttribute('data-tip', 'Die Freistellung läuft noch');
  }
  await btn(page, 'Maske umkehren').click({ force: true });
  await btn(page, 'Maske bearbeiten').click({ force: true });
  expect(await page.evaluate(() => window.__bbzbTest.ui().maskEditId)).toBeNull();
  const at = await toScreen(page, 540, 675);
  await page.mouse.click(at.x, at.y, { button: 'right' });
  const item = page.getByRole('menu', { name: 'Kontextmenü' }).getByRole('menuitem', { name: 'Maske bearbeiten', exact: true });
  await expect(item).toHaveAttribute('aria-disabled', 'true');
  await expect(item).toHaveAttribute('data-tip', 'Die Freistellung läuft noch');
  await item.click({ force: true });
  expect(await page.evaluate(() => window.__bbzbTest.ui().maskEditId)).toBeNull();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu', { name: 'Kontextmenü' })).toHaveCount(0);
  await section(page).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/task-4-running.png` });
  await btn(page, 'Abbrechen').focus();
  await page.keyboard.press('Enter');
  await expect(btn(page, 'Hintergrund entfernen')).toHaveAttribute('aria-disabled', 'false');
  await expect(btn(page, 'Hintergrund entfernen')).toBeFocused();
  await expect(page.locator('#context-live')).toHaveText('');
  await expect(section(page).locator('p.hint:not(.reason)')).toHaveCount(0); // Statuszeile weg (der Grund unter den Sticker-Knöpfen bleibt)
  await expect(btn(page, 'Maske umkehren')).toHaveAttribute('aria-disabled', 'false');
  expect(await maskId(page)).toBeUndefined();
  expect(await history(page)).toBe(h0);
  await expect(page.locator('.notice')).toHaveCount(0);
});

/** Zwei gleiche Fotos (Strg + D), e0 gewählt; liefert die Id der Kopie. */
async function twoPhotos(page: Page, name: string) {
  await select(page, name);
  await page.keyboard.press('Control+d');
  await expect.poll(async () => (await elements(page)).length).toBe(2);
  const copy = (await elements(page)).find((e) => e.id !== 'e0')!.id;
  await page.evaluate(() => window.__bbzbTest.select('e0'));
  return copy;
}

test('Foto während des Laufs gelöscht: Lauf sofort abgebrochen, das andere Foto lässt sich gleich freistellen', async ({ page }) => {
  const copy = await twoPhotos(page, 'Löschen');
  await fake(page, 'kreis', 60000); // endet nie von selbst im Test: nur der Abbruch beim Löschen gibt den Knopf frei
  await btn(page, 'Hintergrund entfernen').click();
  await expect(btn(page, 'Abbrechen')).toBeVisible();
  await openSection(page, 'Ebene');
  await page.getByRole('button', { name: 'Löschen', exact: true }).click();
  await expect.poll(async () => (await elements(page)).map((e) => e.id)).toEqual([copy]);
  await page.evaluate((id) => window.__bbzbTest.select(id), copy);
  await expect(btn(page, 'Hintergrund entfernen')).toHaveAttribute('aria-disabled', 'false');
  await expect(page.locator('.notice')).toHaveCount(0);
  await fake(page, 'kreis', 0);
  await btn(page, 'Hintergrund entfernen').click();
  await expect.poll(() => maskId(page, copy)).toBeDefined();
});

test('Zweites Foto während eines Laufs: «Hintergrund entfernen» ist aria-disabled mit Erklärung', async ({ page }) => {
  const copy = await twoPhotos(page, 'Zwei');
  await fake(page, 'kreis', 60000); // läuft, bis der Test abbricht
  await btn(page, 'Hintergrund entfernen').click();
  await page.evaluate((id) => window.__bbzbTest.select(id), copy);
  await expect(btn(page, 'Hintergrund entfernen')).toHaveAttribute('aria-disabled', 'true');
  await expect(btn(page, 'Hintergrund entfernen')).toHaveAttribute('data-tip', 'Eine Freistellung läuft schon');
  await expect(btn(page, 'Maske umkehren')).toHaveAttribute('aria-disabled', 'false'); // nur das laufende Foto ist gesperrt
  await btn(page, 'Hintergrund entfernen').click({ force: true });
  await page.evaluate(() => window.__bbzbTest.select('e0'));
  await btn(page, 'Abbrechen').click();
  await page.evaluate((id) => window.__bbzbTest.select(id), copy);
  await expect(btn(page, 'Hintergrund entfernen')).toHaveAttribute('aria-disabled', 'false');
  expect(await maskId(page, copy)).toBeUndefined(); // der gesperrte Klick hat nichts gestartet
  expect(await maskId(page)).toBeUndefined();
});

test('Netzfehler: Meldung mit Hinweis auf die Freigabe, Knopf wieder bereit; kein Motiv: Meldung, keine Maske', async ({ page }) => {
  await select(page, 'Netz');
  await fake(page, 'netz', 0);
  await btn(page, 'Hintergrund entfernen').click();
  await expect(page.locator('.notice')).toContainText('huggingface.co');
  await expect(btn(page, 'Hintergrund entfernen')).toHaveAttribute('aria-disabled', 'false');
  await fake(page, 'leer', 0);
  await btn(page, 'Hintergrund entfernen').click();
  await expect(page.locator('.notice')).toContainText('Kein Motiv gefunden');
  expect(await maskId(page)).toBeUndefined();
});

test('Nicht am Video', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addVideo(page);
  await expect(page.getByRole('button', { name: 'Effekte', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hintergrund entfernen' })).toHaveCount(0);
});

test('Screenshot des Abschnitts in Ruhe', async ({ page }) => {
  await select(page, 'Ruhe');
  await section(page).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/task-4-section.png` });
});

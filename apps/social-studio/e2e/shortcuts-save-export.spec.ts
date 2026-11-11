import { expect, test } from '@playwright/test';
import { newProject } from './fixtures';

/** Hört auf keydown und meldet, ob jemand preventDefault aufgerufen hat. */
const watchDefault = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    (window as unknown as { prevented: boolean[] }).prevented = [];
    window.addEventListener('keydown', (e) => setTimeout(() => (window as unknown as { prevented: boolean[] }).prevented.push(e.defaultPrevented)), { passive: true });
  });
const reset = (page: import('@playwright/test').Page) => page.evaluate(() => ((window as unknown as { prevented: boolean[] }).prevented = []));
const prevented = (page: import('@playwright/test').Page) => page.evaluate(() => (window as unknown as { prevented: boolean[] }).prevented.at(-1));

test('Strg + S lädt die Projektdatei herunter und blockt «Seite speichern»', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await watchDefault(page);
  const download = page.waitForEvent('download');
  await page.keyboard.press('Control+s');
  expect((await download).suggestedFilename()).toMatch(/\.bbzbsocial$/);
  await expect.poll(() => prevented(page)).toBe(true);
});

test('Strg + E öffnet den Export-Dialog und blockt die Suche', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await watchDefault(page);
  await page.keyboard.press('Control+e');
  await expect(page.getByRole('dialog', { name: 'Exportieren' })).toBeVisible();
  await expect.poll(() => prevented(page)).toBe(true);
});

test('im Projektnamen tun Strg + S und Strg + E nichts, blocken aber den Browser', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await watchDefault(page);
  let downloaded = false;
  page.on('download', () => (downloaded = true));
  await page.getByLabel('Projektname').focus();
  await page.keyboard.press('Control+s');
  await expect.poll(() => prevented(page)).toBe(true);
  await reset(page);
  await page.keyboard.press('Control+e');
  await expect.poll(() => prevented(page)).toBe(true);
  await page.waitForTimeout(300);
  expect(downloaded).toBe(false);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('bei offenem Dialog tun Strg + S und Strg + E nichts, blocken aber den Browser', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await watchDefault(page);
  await page.getByRole('button', { name: 'Exportieren' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  let downloaded = false;
  page.on('download', () => (downloaded = true));
  await page.keyboard.press('Control+s');
  await expect.poll(() => prevented(page)).toBe(true);
  await reset(page);
  await page.keyboard.press('Control+e');
  await expect.poll(() => prevented(page)).toBe(true);
  await page.waitForTimeout(300);
  expect(downloaded).toBe(false);
  await expect(page.getByRole('dialog')).toHaveCount(1);
});

test('Strg + E öffnet den Dialog auch, solange Schriften laden; Export bleibt gesperrt', async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route('**/seguibl*.ttf', async (r) => {
    await held;
    await r.continue();
  });
  try {
    await page.goto('', { waitUntil: 'commit' });
    await page.getByRole('button', { name: 'Post 4:5' }).click();
    await expect(page.locator('#slide-layouts')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#slide-layouts')).toBeHidden();
    await page.keyboard.press('Control+e');
    const dialog = page.getByRole('dialog', { name: 'Exportieren' });
    await expect(dialog.getByRole('button', { name: 'Schriften werden geladen …' })).toBeDisabled();
  } finally {
    release();
  }
});

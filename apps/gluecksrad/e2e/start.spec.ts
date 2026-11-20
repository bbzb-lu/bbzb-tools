import { expect, test, type Page } from '@playwright/test';
import { foreignRequests } from '../../../e2e/helpers';

const liste = (page: Page) => page.getByRole('textbox', { name: 'Optionen' });

test('Seite lädt, Kopf zeigt Glücksrad, keine fremden Requests', async ({ page }) => {
  const foreign = foreignRequests(page);
  await page.goto('');
  await expect(page.getByRole('link', { name: 'BBZB Tools, Glücksrad, zur Startseite' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Glücksrad');
  await page.waitForLoadState('networkidle');
  expect(foreign).toEqual([]);
});

test('Drehen zeigt genau eine der Optionen als Ergebnis', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('');
  await liste(page).fill('Anna\nBen\nCleo');
  await page.getByRole('button', { name: 'Drehen' }).click();
  await expect(page.locator('.ergebnis')).toHaveText(/^(Anna|Ben|Cleo)$/);
});

test('Drehung landet auf dem angezeigten Ergebnis', async ({ page }) => {
  await page.goto('');
  await liste(page).fill('Anna\nBen\nCleo\nDora');
  await page.getByRole('button', { name: 'Drehen' }).click();
  await expect(page.locator('.ergebnis')).toHaveText(/\S/, { timeout: 8000 });
  const name = (await page.locator('.ergebnis').textContent())!;
  // Der Name, dessen Beschriftung nach der Drehung am höchsten steht, liegt unter dem Zeiger
  const texte = await page.locator('.rad text').evaluateAll((els) => els.map((e) => ({ t: e.textContent, r: e.getBoundingClientRect() })));
  const oben = texte.reduce((a, b) => (b.r.top + b.r.height / 2 < a.r.top + a.r.height / 2 ? b : a));
  expect(oben.t).toBe(name);
});

test('Textdatei laden: CRLF, Leerzeilen und Doppelte werden bereinigt', async ({ page }) => {
  await page.goto('');
  await page.locator('input[type=file]').setInputFiles({ name: 'namen.txt', mimeType: 'text/plain', buffer: Buffer.from('Anna\r\nBen\r\n\r\nAnna\r\nCleo') });
  await expect(liste(page)).toHaveValue('Anna\nBen\nCleo');
});

test('Mehrere: genau zwei verschiedene Kacheln leuchten, Anzahl wird begrenzt', async ({ page }) => {
  await page.goto('');
  await liste(page).fill('A\nB\nC\nD\nE');
  await page.getByText('Mehrere', { exact: true }).click();
  await page.getByLabel('Anzahl').fill('2');
  await page.getByRole('button', { name: 'Ziehen' }).click();
  await expect(page.locator('.kacheln li.an')).toHaveCount(2);
  await page.getByLabel('Anzahl').fill('9');
  await page.getByRole('button', { name: 'Ziehen' }).click();
  await expect(page.locator('.kacheln li.an')).toHaveCount(5);
});

test('Gewinner entfernen leert die Liste ohne Absturz', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('');
  await liste(page).fill('A\nB');
  await page.getByRole('switch', { name: 'Gewinner entfernen' }).click();
  await page.getByRole('button', { name: 'Drehen' }).click();
  await page.getByRole('button', { name: 'Drehen' }).click();
  await expect(liste(page)).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Drehen' })).toBeDisabled();
});

test('Liste bleibt nach dem Neuladen erhalten', async ({ page }) => {
  await page.goto('');
  await liste(page).fill('Anna\nBen');
  await page.reload();
  await expect(liste(page)).toHaveValue('Anna\nBen');
});

test('Handy: Rad und Knopf sichtbar, kein horizontales Scrollen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('');
  await liste(page).fill('Anna\nBen\nCleo');
  await expect(page.locator('.rad')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Drehen' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

import { expect, test, type Page } from '@playwright/test';
import { addSlide, newProject } from './fixtures';

const SHOTS = '.superpowers/sdd/2026-10-27-phase-2-10-1-nachbesserung/screens';
const menu = (page: Page) => page.getByRole('menu', { name: 'Kontextmenü' });
const item = (page: Page, name: string) => menu(page).getByRole('menuitem', { name, exact: true });
const tile = (page: Page, n: number) => page.locator('.slide-tile').nth(n);
const slideCount = (page: Page) => page.evaluate(() => window.__bbzbTest.project().slides.length);

test('Rechtsklick auf eine Slide-Kachel: eigenes Menü, Duplizieren und Verschieben', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addSlide(page);
  expect(await slideCount(page)).toBe(2);
  await tile(page, 0).click({ button: 'right' });
  await expect(menu(page)).toBeVisible();
  await expect(menu(page).getByRole('menuitem')).toHaveCount(4);
  await expect(item(page, 'Nach links')).toHaveAttribute('aria-disabled', 'true');
  await expect(item(page, 'Nach rechts')).not.toHaveAttribute('aria-disabled', 'true');
  await page.screenshot({ path: `${SHOTS}/item1-slide-menu.png` });
  const first = await page.evaluate(() => window.__bbzbTest.project().slides[0]!.id);
  await item(page, 'Nach rechts').click();
  expect(await page.evaluate(() => window.__bbzbTest.project().slides[1]!.id)).toBe(first);
  await tile(page, 1).click({ button: 'right' });
  await item(page, 'Slide duplizieren').click();
  expect(await slideCount(page)).toBe(3);
  await tile(page, 2).click({ button: 'right' });
  await item(page, 'Slide löschen').click();
  expect(await slideCount(page)).toBe(2);
});

test('die letzte Slide lässt sich im Menü nicht löschen', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await tile(page, 0).click({ button: 'right' });
  await expect(item(page, 'Slide löschen')).toHaveAttribute('aria-disabled', 'true');
});

test('Rechtsklick auf die Kopfzeile: App-Menü; im Projektnamen das Menü fürs Textfeld', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await page.locator('.editor-header').click({ position: { x: 5, y: 5 }, button: 'right' });
  await expect(menu(page)).toBeVisible();
  await expect(menu(page).getByRole('menuitem')).toHaveCount(4);
  await expect(item(page, 'Rückgängig')).toHaveAttribute('aria-disabled', 'true');
  await expect(item(page, 'Exportieren')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/item1-app-menu.png` });
  await page.keyboard.press('Escape');
  await expect(menu(page)).toBeHidden();
  // Textfeld: eigenes Menü mit den Bearbeiten-Befehlen fürs Feld (2.10.2)
  await page.getByLabel('Projektname').click({ button: 'right' });
  await expect(item(page, 'Einfügen')).toBeVisible();
  await expect(item(page, 'Exportieren')).toHaveCount(0);
});

test('App-Menü: der erste freie Eintrag hat den Fokus (Rückgängig ist noch gesperrt)', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await page.locator('.editor-header').click({ position: { x: 5, y: 5 }, button: 'right' });
  await expect(item(page, 'Rückgängig')).toHaveAttribute('aria-disabled', 'true');
  await expect(item(page, 'Projektdatei sichern')).toBeFocused();
});

test('Alt + Pfeil am Rand verschiebt nichts und raubt später keinen Fokus', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addSlide(page);
  await tile(page, 0).focus();
  await page.keyboard.press('Alt+ArrowLeft'); // erste Slide: nichts zu verschieben
  await page.evaluate(() => (document.activeElement as HTMLElement).blur());
  await page.keyboard.press('Control+z'); // Slide weg: die aktuelle Slide wechselt
  await expect.poll(() => slideCount(page)).toBe(1);
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
});

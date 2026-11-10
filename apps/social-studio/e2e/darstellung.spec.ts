import { expect, test, type Page } from '@playwright/test';
import { addPhoto, elements, newProject, png } from './fixtures';

/** Phase 4c Task 12: «Darstellung» mit Deckkraft ist an jedem Elementtyp offen, ohne dass jemand etwas aufklappt. */

const panel = (page: Page) => page.getByLabel('Eigenschaften');
const opacity = (page: Page) => panel(page).getByRole('slider', { name: 'Deckkraft' });

test('Deckkraft ist an Text, Tag, Brand und Foto sofort erreichbar', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const setups: [string, () => Promise<unknown>][] = [
    ['text', () => page.getByRole('button', { name: 'Text hinzufügen' }).click()],
    ['tag', () => page.evaluate(() => window.__bbzbTest.insertTag('cta'))],
    ['brand', () => page.evaluate(() => window.__bbzbTest.insertBrand('scribble-01'))],
    ['photo', () => addPhoto(page, png(1200, 1500))],
  ];
  for (const [type, add] of setups) {
    await add();
    await expect.poll(async () => (await elements(page)).at(-1)?.type).toBe(type);
    await expect(panel(page).getByRole('button', { name: 'Darstellung', exact: true })).toHaveAttribute('aria-expanded', 'true');
    await expect(opacity(page)).toBeVisible();
    await opacity(page).focus();
    await page.keyboard.press('ArrowLeft');
    await expect.poll(async () => (await elements(page)).at(-1)!.opacity).toBeCloseTo(0.99);
  }
});

test('Text: Stil und Ausrichtung per Pfeiltaste', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await page.getByRole('button', { name: 'Text hinzufügen' }).click();
  await expect.poll(async () => (await elements(page)).length).toBe(1);
  const props = async () => (await elements(page))[0]!.props as { style: string; align: string };
  const align = panel(page).getByRole('radio', { name: 'Links' });
  await align.focus();
  await page.keyboard.press('ArrowRight');
  await expect(panel(page).getByRole('radio', { name: 'Mitte' })).toBeChecked();
  await expect.poll(async () => (await props()).align).toBe('center');
  const stil = (await props()).style === 'titel' ? 'Kommentar' : 'Titel';
  const cur = panel(page).getByRole('radio', { checked: true, name: /^(Titel|Kommentar)$/ });
  await cur.focus();
  await page.keyboard.press(stil === 'Kommentar' ? 'ArrowRight' : 'ArrowLeft');
  await expect(panel(page).getByRole('radio', { name: stil })).toBeChecked();
});

test('Standort-Tag: «Fachbereich zeigen» ist ein Schalter und lässt sich mit Leertaste umlegen', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await page.evaluate(() => window.__bbzbTest.insertTag('schul'));
  await page.getByLabel('Standort', { exact: true }).selectOption('Bahnhof');
  const sw = panel(page).getByRole('switch', { name: 'Fachbereich zeigen' });
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await sw.focus();
  await page.keyboard.press('Space');
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByLabel('Fachbereich', { exact: true })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(sw).toHaveAttribute('aria-checked', 'false');
});

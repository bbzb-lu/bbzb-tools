import { expect, test, type Locator } from '@playwright/test';
import { foreignRequests } from '../../../e2e/helpers';
import { newProject } from './fixtures';

/** Kurzanleitung (#17): öffnet von Startseite und Kopfzeile, Fokus im Dialog, Esc gibt ihn zurück. */
async function checkDialog(trigger: Locator, shot: string) {
  const page = trigger.page();
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Kurzanleitung' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('ol > li')).toHaveCount(6);
  await expect(dialog.getByRole('heading', { name: 'Deine Daten' })).toBeVisible();
  await expect(dialog).not.toContainText(/ß|–/);
  expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${shot}.png` }); // nur für die Abnahme von Hand
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
}

test('Kurzanleitung von der Startseite, ohne fremde Requests', async ({ page }) => {
  const outside = foreignRequests(page);
  await page.goto('');
  await checkDialog(page.getByRole('button', { name: 'Kurzanleitung' }), 'task-14-start');
  expect(outside).toEqual([]);
});

test('Kurzanleitung aus der Kopfzeile, ohne fremde Requests', async ({ page }) => {
  const outside = foreignRequests(page);
  await newProject(page, 'Post 4:5');
  await checkDialog(page.locator('.editor-header').getByRole('button', { name: 'Hilfe', exact: true }), 'task-14-header');
  expect(outside).toEqual([]);
});

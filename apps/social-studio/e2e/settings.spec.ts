import { expect, test } from '@playwright/test';
import { newProject } from './fixtures';

test('Einstellungen: Dialog mit Akzentfarbe (auch im Einfach-Modus), ein Undo-Schritt, Esc gibt den Fokus zurück', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const btn = page.locator('.editor-header').getByRole('button', { name: 'Einstellungen', exact: true });
  await expect(btn).toHaveAttribute('data-tip', 'Einstellungen');
  await btn.click();
  const dialog = page.getByRole('dialog', { name: 'Projekteinstellungen' });
  await expect(dialog.getByRole('group', { name: 'Akzentfarbe' })).toBeVisible();
  await dialog.getByLabel('Standortabhängig').check({ force: true });
  expect((await page.evaluate(() => window.__bbzbTest.project())).accentMode).toBe('standort');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(btn).toBeFocused();
  await page.keyboard.press('Control+z');
  expect((await page.evaluate(() => window.__bbzbTest.project())).accentMode ?? 'fix').toBe('fix');
});

test('Slide-Inspector hat keinen Abschnitt «Projekt» mehr', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await expect(page.getByRole('heading', { name: /^Slide \d/ })).toBeVisible();
  await expect(page.locator('.inspector').getByRole('heading', { name: 'Projekt', exact: true })).toHaveCount(0);
  await expect(page.locator('.inspector').getByLabel('Standortabhängig')).toHaveCount(0);
});

test('Exportqualität: Wahl in den Einstellungen, ein Undo-Schritt, Bitrate und JPEG-Qualität folgen', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await page.getByRole('button', { name: 'Einstellungen', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Projekteinstellungen' });
  const group = dialog.getByRole('group', { name: 'Exportqualität' });
  await expect(group.getByLabel('Standard')).toBeChecked();
  await expect(dialog.getByText('Video etwa 60 MB pro Minute, JPEG 92 %.')).toBeVisible();
  await group.getByLabel('Klein').check({ force: true });
  await expect(dialog.getByText('Video etwa 30 MB pro Minute, JPEG 80 %.')).toBeVisible();
  expect((await page.evaluate(() => window.__bbzbTest.project())).exportQuality).toBe('klein');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+z');
  expect((await page.evaluate(() => window.__bbzbTest.project())).exportQuality ?? 'standard').toBe('standard');
});

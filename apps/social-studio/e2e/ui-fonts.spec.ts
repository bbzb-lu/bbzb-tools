import { expect, test } from '@playwright/test';
import { newProject } from './fixtures';

const SHOTS = process.env.SHOTS; // Screenshots nur auf Wunsch (SHOTS=Ordner)

test('Oberfläche nutzt die lokal gebündelten Schriften, kein Export-Hinweis', async ({ page }) => {
  await page.goto('');
  await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible();
  expect(await page.evaluate(() => document.fonts.check('700 1em "Host Grotesk"'))).toBe(true);
  expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain('Host Grotesk');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/task-2-start.png` });
  await newProject(page, 'Post 4:5');
  await expect(page.getByText(/Schrift.*fehl/)).toHaveCount(0);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/task-2-editor.png` });
});

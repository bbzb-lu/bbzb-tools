import { expect, test } from '@playwright/test';
import { foreignRequests } from '../../../e2e/helpers';

test('Seite lädt, Kopf zeigt __NAME__, keine fremden Requests', async ({ page }) => {
  const foreign = foreignRequests(page);
  await page.goto('');
  await expect(page.getByRole('link', { name: 'BBZB Tools, __NAME__, zur Startseite' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('__NAME__');
  await page.waitForLoadState('networkidle');
  expect(foreign).toEqual([]);
});

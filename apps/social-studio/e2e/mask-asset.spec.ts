import { expect, test } from '@playwright/test';
import { newProject } from './fixtures';

test('Maske: speichern und lesen ergibt dieselben Pixel und dieselbe ID (Edge, OPFS)', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const r = await page.evaluate(() => window.__bbzbTest.maskRoundtrip());
  expect(r.id).toMatch(/^[0-9a-f]{64}$/);
  expect([r.width, r.height]).toEqual([37, 23]);
  expect(r.before.some((v) => v < 255)).toBe(true); // der Strich hat etwas ausgeblendet
  expect(r.after).toEqual(r.before);
  expect(r.again).toBe(r.id);
});

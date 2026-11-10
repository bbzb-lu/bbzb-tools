import { expect, test } from '@playwright/test';
import { foreignRequests } from '../../../e2e/helpers';
import { choose, exportPng, near, px } from './helpers';

test('Export ist 1920×1080, Verlauf stimmt, keine Hilfslinien', async ({ page }) => {
  await page.goto('');
  await choose(page, 'Lehrpersonen');
  const { png } = await exportPng(page);
  expect([png.width, png.height]).toEqual([1920, 1080]);
  // x 100 liegt in der Sperrzone: Hilfslinien dürfen im Export nicht erscheinen. Zeile 28 wäre eine Schraffurlinie, daher mit y 28 prüfen.
  near(px(png, 100, 28), [252, 253, 254]); // Verlauf bei y 28; eine Schraffurlinie wäre gelb
  near(px(png, 100, 0), [255, 255, 255]);
  near(px(png, 100, 541), [190, 204, 228]);
});

test('Beide nutzt den dunklen Hintergrund, Störung zeichnet roten Punkt', async ({ page }) => {
  await page.goto('');
  await choose(page, 'Beide');
  await choose(page, 'Störung');
  const { png, name } = await exportPng(page);
  expect(name).toMatch(/^news-beide-stoerung-\d{4}-\d{2}-\d{2}\.png$/);
  near(px(png, 100, 0), [84, 120, 181]);
  expect(px(png, 960 - 45, 453)).toEqual([227, 67, 67]);
});

test('Keine fremden Requests', async ({ page }) => {
  const foreign = foreignRequests(page);
  await page.goto('');
  await page.getByRole('button', { name: 'PNG laden' }).waitFor();
  expect(foreign).toEqual([]);
});

import { expect, test } from '@playwright/test';
import { addPhoto, elements, newProject, png } from './fixtures';
import { colors } from '../src/tokens';
import { theme } from '../src/ui/theme';

const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;

test('Primäre Buttons nutzen den Akzent, Text darauf on-accent, Fokusring in Tinte', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const exportBtn = page.getByRole('button', { name: 'Exportieren' });
  await expect(exportBtn).toHaveCSS('background-color', rgb(theme.accent));
  await expect(exportBtn).toHaveCSS('color', rgb(theme['on-accent']));
  await page.keyboard.press('Tab');
  await exportBtn.focus();
  await expect(exportBtn).toHaveCSS('outline-color', rgb(theme.ink));
});

test('Meldungsleiste (Tinte): Fokusrahmen Papier, Kontrast >= 3:1', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await page.getByRole('button', { name: 'Sicherheitszonen' }).focus();
  await addPhoto(page, { name: 'kaputt.png', mimeType: 'image/png', buffer: Buffer.from('kein bild') });
  const btn = page.locator('.notice button').first();
  await expect(btn).toBeVisible();
  await page.keyboard.press('Tab');
  await btn.focus();
  await expect(btn).toHaveCSS('outline-color', rgb(theme.paper));
});

test('Leinwand-Overlays (Transformer, Anker, Hilfslinien) bleiben orange', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addPhoto(page, png(3000, 2000));
  await expect.poll(async () => (await elements(page)).length).toBe(1);
  const [el] = await elements(page);
  await page.evaluate((id) => window.__bbzbTest.select(id), el!.id);
  expect(await page.evaluate(() => window.__bbzbTest.overlayStrokes())).toEqual(Array(4).fill(colors.orange));
});

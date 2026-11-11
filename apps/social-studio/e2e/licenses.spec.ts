import { expect, test } from '@playwright/test';
import { newProject } from './fixtures';

const FILES = ['host-grotesk-OFL.txt', 'newsreader-OFL.txt', 'tabler-MIT.txt', 'heic-to-LGPL-3.0.txt', 'GPL-3.0.txt', 'mediabunny-MPL-2.0.txt', 'transformers-js-Apache-2.0.txt', 'onnxruntime-web-MIT.txt', 'isnet-DIS-Apache-2.0.txt'];

test('Startseite: «Lizenzen» zeigt alle freien Bestandteile mit Lizenztext und Quelle', async ({ page }) => {
  await page.goto('');
  await page.getByRole('button', { name: 'Lizenzen', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Lizenzen und Quellen' });
  await expect(dialog.getByRole('listitem')).toHaveCount(9);
  for (const name of [/Host Grotesk/, /Newsreader/, /Tabler Icons/, /Doodles von Khushmeen/, /heic-to 1\.6\.6 mit libheif 1\.23\.6 und libde265 1\.0\.16/, /Mediabunny 1\.62\.1/, /Transformers\.js 3\.8\.1/, /ONNX Runtime Web 1\.22/, /ISNet/]) {
    await expect(dialog.getByRole('listitem').filter({ hasText: name })).toHaveCount(1);
  }
  // Externe Links nur per Klick und mit rel; Lizenztexte liegen als Dateien im Studio
  const links = dialog.getByRole('link');
  for (const a of await links.all()) await expect(a).toHaveAttribute('rel', 'noopener noreferrer');
  for (const file of FILES) {
    await expect(dialog.locator(`a[href="/social-studio/licenses/${file}"]`)).toHaveCount(1);
    const res = await page.request.get(`licenses/${file}`);
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text.length).toBeGreaterThan(500);
    expect(text.trimStart().startsWith('<')).toBe(false); // kein SPA-Fallback (index.html)
  }
  expect(await (await page.request.get('licenses/GPL-3.0.txt')).text()).toContain('GNU GENERAL PUBLIC LICENSE');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Lizenzen', exact: true })).toBeFocused();
});

test('Editor: «Lizenzen» in den Projekteinstellungen, Dialog passt bei 1280 × 720 ohne Überlauf', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await newProject(page, 'Post 4:5');
  await page.getByRole('button', { name: 'Einstellungen', exact: true }).click();
  await page.getByRole('dialog', { name: 'Projekteinstellungen' }).getByRole('button', { name: 'Lizenzen' }).click();
  const dialog = page.getByRole('dialog', { name: 'Lizenzen und Quellen' });
  await expect(dialog).toBeVisible();
  const box = (await dialog.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(720);
  expect(await dialog.evaluate((d) => d.scrollWidth <= d.clientWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/licenses-editor-1280.png' });
});

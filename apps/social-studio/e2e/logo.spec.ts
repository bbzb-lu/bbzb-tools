import { expect, test, type Locator } from '@playwright/test';
import { foreignRequests } from '../../../e2e/helpers';
import { newProject } from './fixtures';

const NAME = 'BBZB Tools, Social Studio, zur Startseite';

/** Logo der Suite: Quadrat mit Toolnamen (Schrift, keine Bilddatei, Host Grotesk 800 lokal); Zeigen blendet «BBZB Tools» ein. */
async function expectLogo(logo: Locator) {
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAccessibleName(NAME);
  expect(await logo.evaluate((e) => e.tagName)).not.toBe('IMG');
  const [tool, suite] = [logo.locator('.bbzb-logo-tool'), logo.locator('.bbzb-logo-suite')];
  await expect(tool).toHaveText('Social Studio');
  expect(await logo.evaluate((e) => [getComputedStyle(e).fontWeight, document.fonts.check('800 16px "Host Grotesk"')])).toEqual(['800', true]);
  const opacity = (l: Locator) => l.evaluate((e) => getComputedStyle(e).opacity);
  await expect.poll(() => opacity(suite)).toBe('0');
  await logo.hover();
  await expect.poll(() => opacity(suite)).toBe('1');
  await expect.poll(() => opacity(tool)).toBe('0');
  await logo.page().mouse.move(0, 400);
  await expect.poll(() => opacity(tool)).toBe('1');
}

test('Logo im Kopf und auf der Startseite: Schrift aus dem Entwurf, lokal geladen, keine Bilddatei', async ({ page }) => {
  const outside = foreignRequests(page);
  const pngs: string[] = [];
  page.on('request', (r) => /logo-social-studio/.test(r.url()) && pngs.push(r.url()));
  await page.goto('');
  await expect(page.getByRole('heading', { level: 1, name: 'Social Studio' })).toBeAttached();
  await expectLogo(page.getByRole('link', { name: NAME }));
  await newProject(page, 'Post 4:5');
  await expectLogo(page.locator('.editor-header').getByRole('link', { name: NAME }));
  expect(pngs).toEqual([]);
  expect(outside).toEqual([]);
});

test('Favicon und Apple-Touch-Icon im Schild-Stil (scripts/favicons.mjs), lokal, scharf in 32 und 180 px', async ({ page }) => {
  await page.goto('');
  for (const [rel, size] of [['icon', 32], ['apple-touch-icon', 180]] as const) {
    const href = await page.locator(`link[rel="${rel}"]`).getAttribute('href');
    expect(href).toMatch(/^\/social-studio\/[a-z-]+\.png$/);
    const dim = await page.evaluate(async (u) => {
      const img = new Image();
      img.src = u;
      await img.decode();
      return [img.naturalWidth, img.naturalHeight];
    }, href!);
    expect(dim).toEqual([size, size]);
  }
});

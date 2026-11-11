import { expect, test, type Locator } from '@playwright/test';
import { foreignRequests } from '../../../e2e/helpers';
import { newProject } from './fixtures';

const NAME = 'BBZB Tools, Social Studio, zur Startseite';

/** Wortmarke der Suite: Schrift statt Bilddatei, «BBZB Tools», darunter «Social Studio» in Akzent, Host Grotesk 800 lokal. */
async function expectLogo(logo: Locator) {
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAccessibleName(NAME);
  expect(await logo.evaluate((e) => e.tagName)).not.toBe('IMG');
  await expect(logo).toHaveText('BBZB ToolsSocial Studio');
  const s = await logo.evaluate((e) => {
    const [name, sub] = [...e.children].map((c) => getComputedStyle(c));
    const root = getComputedStyle(document.documentElement);
    return { w: name!.fontWeight, sub: sub!.color, accent: root.getPropertyValue('--accent').trim(), loaded: document.fonts.check('800 22px "Host Grotesk"') };
  });
  expect(s.w).toBe('800');
  expect(s.loaded).toBe(true);
  const hex = s.accent.match(/[0-9a-f]{2}/gi)!.map((h) => parseInt(h, 16));
  expect(s.sub).toBe(`rgb(${hex.join(', ')})`);
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

test('Favicon und Apple-Touch-Icon aus dem «st»-Monogramm, lokal, scharf in 32 und 180 px', async ({ page }) => {
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

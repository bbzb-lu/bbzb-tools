import { expect, test, type Page } from '@playwright/test';
import { readdirSync } from 'node:fs';

// Port von verify.js aus der alten Embed-Vorlage: jedes Embed in beiden SharePoint-Grössen
const ids = readdirSync('embeds', { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('_')).map((e) => e.name);
const GROESSEN = [[480, 350], [350, 250]] as const;
const EXTERN = ['https://sudoku-api.vercel.app', 'https://stream.streambase.ch'];

/** Öffnet ein Embed offline (die zwei erlaubten fremden Hosts brechen ab) und sammelt Fehler. */
async function oeffne(page: Page, id: string, [w, h]: readonly [number, number]) {
  const fehler: string[] = [];
  page.on('pageerror', (e) => fehler.push(`JS: ${e.message}`));
  page.on('response', (r) => r.status() >= 400 && fehler.push(`${r.status()} ${r.url()}`));
  for (const host of EXTERN) await page.route(`${host}/**`, (r) => r.abort());
  await page.setViewportSize({ width: w, height: h });
  await page.goto(`${id}/`);
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  return fehler;
}

/** Prüft die Pixel- und Grössenregeln auf dem gerade sichtbaren Bildschirm. */
async function regeln(page: Page) {
  return page.evaluate(() => {
    const d = document.documentElement;
    const weich = (s: string) => s !== 'none' && [...s.matchAll(/(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px/g)].some((m) => parseFloat(m[3]!) > 0);
    const alle = [...document.querySelectorAll<HTMLElement>('*')].filter((e) => e.getClientRects().length);
    return {
      scrollt: d.scrollWidth > d.clientWidth || d.scrollHeight > d.clientHeight,
      rawpixel: [...document.fonts].some((f) => /RawPixel/i.test(f.family) && f.status === 'loaded'),
      rund: alle.filter((e) => getComputedStyle(e).borderRadius.split(' ').some((r) => parseFloat(r) > 0)).map((e) => e.className || e.tagName),
      weich: alle.filter((e) => weich(getComputedStyle(e).boxShadow)).map((e) => e.className || e.tagName),
      schliessen: document.querySelectorAll('.titlebar-close').length,
    };
  });
}

for (const id of ids)
  for (const g of GROESSEN)
    test(`${id} ${g[0]} × ${g[1]}: kein Scrollen, RawPixel, eckig, harte Schatten, keine Fehler`, async ({ page }) => {
      const fehler = await oeffne(page, id, g);
      expect(await regeln(page)).toEqual({ scrollt: false, rawpixel: true, rund: [], weich: [], schliessen: 0 });
      expect(fehler).toEqual([]);
    });

for (const id of ids)
  test(`${id}: Titel-Schrift wächst mit der Grösse (clamp greift)`, async ({ page }) => {
    const groesse = async (g: readonly [number, number]) => {
      await oeffne(page, id, g);
      const titel = page.locator('.ts-title').first();
      return (await titel.count()) ? titel.evaluate((e) => parseFloat(getComputedStyle(e).fontSize)) : null;
    };
    const [gross, klein] = [await groesse(GROESSEN[0]), await groesse(GROESSEN[1])];
    test.skip(gross === null, 'kein Titelbildschirm');
    expect(gross).toBeGreaterThan(klein!);
  });

test('Sudoku ohne Rätsel-API: Einzelspiel startet mit lokalem Rätsel', async ({ page }) => {
  const fehler = await oeffne(page, 'sudoku', GROESSEN[0]);
  await page.locator('#mode-single').click();
  await page.locator('#play-btn').click();
  await expect(page.locator('#game-screen')).toBeVisible({ timeout: 10_000 });
  expect(await page.locator('#board .cell.given').count()).toBeGreaterThan(17);
  expect(await regeln(page)).toMatchObject({ scrollt: false, rund: [], weich: [] });
  expect(fehler).toEqual([]);
});

test('Vier gewinnt gegen den Computer: ein Zug, der Computer antwortet', async ({ page }) => {
  const fehler = await oeffne(page, 'viergewinnt', GROESSEN[0]);
  await page.locator('#mode-cpu').click();
  await page.locator('#start-btn').click();
  await expect(page.locator('#game-screen')).toBeVisible();
  await page.locator('#board .cell').nth(3).click();
  await expect(page.locator('#board .disc')).toHaveCount(2, { timeout: 10_000 });
  expect(await regeln(page)).toMatchObject({ scrollt: false, rund: [], weich: [] });
  expect(fehler).toEqual([]);
});

test('Radio ohne Stream: Seite bleibt ohne Fehler', async ({ page }) => {
  const fehler = await oeffne(page, 'radio-player', GROESSEN[0]);
  await expect(page.locator('body')).toBeVisible();
  expect(fehler).toEqual([]);
});

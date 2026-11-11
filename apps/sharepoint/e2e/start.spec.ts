import { expect, test } from '@playwright/test';
import { foreignRequests } from '../../../e2e/helpers';

test.beforeEach(async ({ page }) => {
  for (const host of ['https://sudoku-api.vercel.app', 'https://stream.streambase.ch']) await page.route(`${host}/**`, (r) => r.abort());
});

test('Übersicht: Kopf, sechs Embeds mit Vorschau, nur erlaubte fremde Requests', async ({ page }) => {
  const foreign = foreignRequests(page);
  await page.goto('');
  await expect(page.getByRole('link', { name: 'BBZB Tools, SharePoint Embeds, zur Startseite' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('SharePoint Embeds');
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(6);
  for (const f of await page.locator('iframe.vorschau').all()) {
    await f.scrollIntoViewIfNeeded();
    await expect(f).toHaveAttribute('width', '480');
  }
  await expect(page.frameLocator('iframe[title="Vorschau Tic-Tac-Toe"]').locator('body')).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(foreign.filter((u) => !/sudoku-api\.vercel\.app|stream\.streambase\.ch/.test(u))).toEqual([]);
});

test('Sortierung «Name» und Vorschau «Mobil»', async ({ page }) => {
  await page.goto('');
  const namen = () => page.getByRole('heading', { level: 2 }).allInnerTexts();
  const neu = await namen();
  await page.getByText('Name', { exact: true }).click();
  const n = await namen();
  expect(n).toEqual([...n].sort((a, b) => a.localeCompare(b, 'de')));
  expect(n).not.toEqual(neu);
  await page.getByText('Mobil 350 × 250').click();
  await expect(page.locator('iframe.vorschau').first()).toHaveAttribute('height', '250');
});

test('Einbettungscode kopieren: iframe auf /sharepoint/<id>/ dieser Adresse, Rückmeldung «Kopiert»', async ({ page, context, baseURL }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('');
  const karte = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Sudoku' }) });
  await karte.getByRole('button', { name: 'Einbettungscode kopieren' }).click();
  await expect(karte.getByRole('status')).toHaveText('Kopiert');
  const origin = new URL(baseURL!).origin;
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    `<iframe src="${origin}/sharepoint/sudoku/" width="480" height="350" style="border:0;overflow:hidden" title="Sudoku" allow="clipboard-write"></iframe>`,
  );
});

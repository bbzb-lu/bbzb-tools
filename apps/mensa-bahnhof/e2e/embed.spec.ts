import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { foreignRequests } from '../../../e2e/helpers';

const fixture = fileURLToPath(new URL('./fixture-menu.json', import.meta.url));

// SharePoint-Webpart «Einbetten»: Desktop und Mobil
for (const [width, height] of [[480, 350], [350, 250]] as const) {
  test(`Embed ${width} × ${height}: heute ohne Scrollen, Preis Mitarbeitende`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const foreign = foreignRequests(page);
    const fehler: string[] = [];
    page.on('pageerror', (e) => fehler.push(e.message));
    await page.clock.setFixedTime(new Date('2026-11-24T10:00:00'));
    await page.route('**/menu.json', (r) => r.fulfill({ path: fixture }));
    await page.goto('embed/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mensa Bahnhof Heute, 24.11.');
    const zeilen = page.getByRole('listitem');
    await expect(zeilen).toHaveCount(4);
    for (const z of await zeilen.all()) await expect(z).toBeInViewport({ ratio: 1 });
    await expect(zeilen.first()).toContainText('CHF 14.50');
    await expect(zeilen.nth(1).locator('.badge.vegi')).toHaveText('Vegan');
    await expect(page.getByRole('link', { name: 'Ganze Woche' })).toHaveAttribute('target', '_blank');
    const scroll = await page.evaluate(() => [document.documentElement.scrollHeight, document.documentElement.scrollWidth]);
    expect(scroll).toEqual([height, width]);
    expect(foreign).toEqual([]);
    expect(fehler).toEqual([]);
  });
}

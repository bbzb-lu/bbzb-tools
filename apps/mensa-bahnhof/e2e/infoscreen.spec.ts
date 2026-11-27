import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { foreignRequests } from '../../../e2e/helpers';

const fixture = fileURLToPath(new URL('./fixture-menu.json', import.meta.url));

// enlogic-Infoscreen beim Eingang: 1920 × 1080, läuft tagelang ohne Reload
test('Infoscreen: heute bildschirmfüllend, Lernende zuerst, frischt sich selbst auf', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const foreign = foreignRequests(page);
  const fehler: string[] = [];
  page.on('pageerror', (e) => fehler.push(e.message));
  await page.clock.install({ time: new Date('2026-11-24T10:00:00') });
  let status = 200;
  await page.route('**/menu.json', (r) => (status === 200 ? r.fulfill({ path: fixture }) : r.fulfill({ status })));
  const antwort = await page.goto('infoscreen/');
  expect(antwort?.headers()['content-security-policy']).toContain('frame-ancestors *');

  const h1 = page.getByRole('heading', { level: 1 });
  await expect(h1).toContainText('Heute, Dienstag 24. November');
  const karten = page.getByRole('article');
  await expect(karten).toHaveCount(4);
  for (const k of await karten.all()) await expect(k).toBeInViewport({ ratio: 1 });
  const erste = karten.first();
  await expect(erste).toContainText('Schweins- geschnetzeltes Zürcher Art');
  await expect(erste.locator('.preis-schu')).toHaveText(/CHF 11\.50\s*Lernende/);
  await expect(erste.locator('.preis-ma')).toHaveText(/Mitarbeitende\s*14\.50/);
  await expect(erste.locator('.preis-ext')).toHaveText(/Externe\s*14\.50/);
  await expect(erste.locator('.preise > *')).toHaveClass([/preis-schu/, /preis-ma/, /preis-ext/]);
  await expect(karten.nth(1).locator('.badge.vegi')).toHaveText('Vegan');
  const scroll = await page.evaluate(() => [document.documentElement.scrollHeight, document.documentElement.scrollWidth]);
  expect(scroll).toEqual([1080, 1920]);

  // Nächster Tag ohne Reload: nach dem Neuladen (alle 30 Minuten) steht Mittwoch
  await page.clock.setSystemTime(new Date('2026-11-25T07:00:00'));
  await page.clock.runFor(30 * 60_000);
  await expect(h1).toContainText('Heute, Mittwoch 25. November');
  await expect(karten.first()).toContainText('Kalbshacksteak');

  // Fällt menu.json aus, bleibt das letzte Menü stehen
  status = 500;
  await page.clock.runFor(30 * 60_000);
  await expect(h1).toContainText('Heute, Mittwoch 25. November');
  await expect(karten).toHaveCount(4);

  expect(foreign).toEqual([]);
  expect(fehler).toEqual([]);
});

import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { foreignRequests } from '../../../e2e/helpers';

const fixture = fileURLToPath(new URL('./fixture-menu.json', import.meta.url));
const SV = 'https://sv-gastronomie.ch/menu/BBZB,%20Luzern/Mittagsmen%C3%BC';
let foreign: string[];
let fehler: string[];

async function oeffne(page: Page, { zeit = '2026-11-24T10:00:00', pfad = '', status = 200 } = {}) {
  foreign = foreignRequests(page);
  fehler = [];
  page.on('pageerror', (e) => fehler.push(e.message));
  await page.clock.setFixedTime(new Date(zeit));
  await page.route('**/menu.json', (r) => (status === 200 ? r.fulfill({ path: fixture }) : r.fulfill({ status })));
  await page.goto(pfad);
}

test.afterEach(async ({ page }) => {
  await page.waitForLoadState('networkidle');
  expect(foreign).toEqual([]);
  expect(fehler).toEqual([]);
});

test('Kopf und Überschrift für heute', async ({ page }) => {
  await oeffne(page);
  await expect(page.getByRole('link', { name: 'BBZB Tools, Mensa Bahnhof, zur Startseite' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Heute, Dienstag 24. November');
});

test('Gericht von heute mit grossem Preis für Mitarbeitende', async ({ page }) => {
  await oeffne(page);
  const karte = page.getByRole('article').first();
  await expect(karte.getByText('Schweins- geschnetzeltes Zürcher Art')).toBeVisible();
  await expect(karte.locator('.preis-gross')).toContainText('Mitarbeitende');
  await expect(karte.locator('.preis-gross')).toContainText('CHF 14.50');
});

test('Alle Labels gebündelt im Kartenkopf, Vegan grün', async ({ page }) => {
  await oeffne(page);
  const [ohne, querbeet] = [page.getByRole('article').nth(0), page.getByRole('article').nth(1)];
  await expect(ohne.getByText('Butternudeln')).toBeVisible(); // Linie ohne Feld labels
  await expect(ohne.locator('.badge')).toHaveCount(0);
  await expect(querbeet.locator('.badge')).toHaveText(['Vegan', 'Laktosefrei']); // gebündelt, Vegi zuerst
  await expect(querbeet.locator('.badge.vegi')).toHaveText('Vegan');
  await expect(querbeet.locator('.badge svg')).toHaveCount(2);
});

test('?preis=schu hebt Lernende hervor', async ({ page }) => {
  await oeffne(page, { pfad: '?preis=schu' });
  const gross = page.getByRole('article').first().locator('.preis-gross');
  await expect(gross).toContainText('Lernende');
  await expect(gross).toContainText('CHF 11.50');
});

test('Klick auf Do zeigt den Donnerstag, Überschrift bleibt heute', async ({ page }) => {
  await oeffne(page);
  await page.getByText(/^Do\s/).click();
  await expect(page.getByText('Schweins-Stotzen Saltimbocca')).toBeVisible();
  await expect(page.getByText('Schweins- geschnetzeltes Zürcher Art')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('Donnerstag 26. November');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Heute');
});

test('Samstag zeigt die kommende Woche ab Montag', async ({ page }) => {
  await oeffne(page, { zeit: '2026-11-28T10:00:00' });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Am Montag, 30. November');
  await expect(page.getByText('Folgewoche Rindfleisch Lasagne')).toBeVisible();
});

test('Fehlt die Datei: Hinweis mit Link auf SV', async ({ page }) => {
  await oeffne(page, { status: 404 });
  await expect(page.getByText('Der Menüplan dieser Woche ist noch nicht da')).toBeVisible();
  await expect(page.locator('main').getByRole('link')).toHaveAttribute('href', SV);
});

test('Fusszeile mit Quelle und Stand', async ({ page }) => {
  await oeffne(page);
  await expect(page.getByRole('link', { name: 'SV Restaurant' })).toHaveAttribute('href', SV);
  await expect(page.getByText(/^Stand: 24\.11\.2026/)).toBeVisible();
});

test.describe('Handy 360 × 740', () => {
  test.use({ viewport: { width: 360, height: 740 } });
  test('erstes Gericht ohne Scrollen sichtbar', async ({ page }) => {
    await oeffne(page);
    await expect(page.getByText('Schweins- geschnetzeltes Zürcher Art')).toBeInViewport();
    await expect(page.getByRole('article').first().locator('.preis-gross')).toBeInViewport({ ratio: 1 });
  });
});

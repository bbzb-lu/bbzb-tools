import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
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

test('Infoscreen: Nacht ohne Netz zeigt am Morgen trotzdem den neuen Tag', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.clock.install({ time: new Date('2026-11-24T18:00:00') });
  let status = 200;
  await page.route('**/menu.json', (r) => (status === 200 ? r.fulfill({ path: fixture }) : r.fulfill({ status })));
  await page.goto('infoscreen/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Dienstag 24. November');
  status = 500;
  await page.clock.setSystemTime(new Date('2026-11-25T07:00:00'));
  await page.clock.runFor(60_000);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Heute, Mittwoch 25. November');
  await expect(page.getByRole('article').first()).toContainText('Kalbshacksteak');
});

test('Infoscreen: sechs Linien mit langen Namen, alle Preise im Bild', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.clock.setFixedTime(new Date('2026-11-24T10:00:00'));
  const datei = JSON.parse(readFileSync(fixture, 'utf8'));
  const tag = datei.wochen[0].tage[1];
  const lang = { ...tag.linien[1], gericht: 'Hausgemachte Kürbis-Ravioli an Salbeibutter mit geröstetem Parmesan und Pinienkernen', beilagen: 'Rucola, Kirschtomaten, Balsamico-Reduktion, Brot, Tagessalat oder Suppe nach Wahl, dazu ein Dessert vom Buffet' };
  tag.linien = [...tag.linien, lang, lang].map((l: object, i: number) => ({ ...l, linie: `Linie ${i + 1}` }));
  await page.route('**/menu.json', (r) => r.fulfill({ json: datei }));
  await page.goto('infoscreen/');
  await expect(page.getByRole('article')).toHaveCount(6);
  for (const p of await page.locator('.preis-schu, .preis-ma, .preis-ext').all()) await expect(p).toBeInViewport({ ratio: 1 });
  // kein Preis ragt über den Rand seiner Karte hinaus (dort schneidet overflow: hidden ab)
  const ueber = await page.locator('.preise').evaluateAll((ps) =>
    ps.filter((p) => [...p.querySelectorAll('strong, .preis-ma, .preis-ext')].some((e) => e.scrollWidth > p.clientWidth + 1)).length);
  expect(ueber).toBe(0);
  const scroll = await page.evaluate(() => [document.documentElement.scrollHeight, document.documentElement.scrollWidth]);
  expect(scroll).toEqual([1080, 1920]);
});

test('Infoscreen: schmalere Fläche (enlogic-Vorschau), Preise einzeilig und im Bild', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1010 });
  await page.clock.setFixedTime(new Date('2026-11-24T10:00:00'));
  await page.route('**/menu.json', (r) => r.fulfill({ path: fixture }));
  await page.goto('infoscreen/');
  for (const p of await page.locator('.preis-schu strong, .preis-ma, .preis-ext').all()) {
    await expect(p).toBeInViewport({ ratio: 1 });
    const [hoehe, zeile] = await p.evaluate((e) => [e.getBoundingClientRect().height, parseFloat(getComputedStyle(e).fontSize) * 1.6]);
    expect(hoehe).toBeLessThan(zeile);
  }
  // Labels unten, direkt über den Preisen
  await expect(page.getByRole('article').nth(1).locator('.info-labels + .preise')).toHaveCount(1);
});

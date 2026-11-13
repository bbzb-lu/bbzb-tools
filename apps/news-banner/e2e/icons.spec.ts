import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { choose, exportPng, near, pick, px, slotButton, strong } from './helpers';

const LEFT = [440, 380, 780, 644] as const;
const RIGHT = [1120, 380, 1460, 644] as const;

test('Icons erscheinen in ihren Plätzen, nie in Sperrzonen oder ausserhalb der Banner-Zone', async ({ page }) => {
  await page.goto('');
  await pick(page, 'Links', 'cloud', 'cloud');
  await pick(page, 'Rechts', 'gauge', 'gauge');
  const { png } = await exportPng(page);
  expect(strong(png, ...LEFT)).toBeGreaterThan(3000);
  expect(strong(png, ...RIGHT)).toBeGreaterThan(3000);
  expect(strong(png, 0, 0, 1920, 370)).toBe(0);
  expect(strong(png, 0, 650, 1920, 1080)).toBe(0);
  expect(strong(png, 0, 0, 266, 1080)).toBe(0);
  expect(strong(png, 1652, 0, 1920, 1080)).toBe(0);
});

test('Lehrpersonen: blaue Icons auf hellem Grund', async ({ page }) => {
  await page.goto('');
  await choose(page, 'Lehrpersonen');
  await pick(page, 'Links', 'network', 'network');
  const { png } = await exportPng(page);
  let blue = 0;
  for (let y = 380; y < 644; y++) for (let x = 440; x < 780; x++) { const [r, , b] = px(png, x, y); if (r! < 90 && b! > 180) blue++; }
  expect(blue).toBeGreaterThan(3000);
});

test('Icon unten ist erst nach dem Einschalten im Export', async ({ page }) => {
  await page.goto('');
  const area = [880, 530, 1040, 640] as const;
  expect(strong((await exportPng(page)).png, ...area)).toBe(0);
  await page.getByRole('switch', { name: 'Icon unten zeigen' }).click();
  await pick(page, 'Unten', 'key', 'key');
  expect(strong((await exportPng(page)).png, ...area)).toBeGreaterThan(300);
});

test('Suche findet über Stichwörter wie auf lucide.dev, Apps-Tab sucht Marken', async ({ page }) => {
  await page.goto('');
  await choose(page, 'Icons');
  const search = page.getByRole('searchbox');
  await search.fill('wireless');
  await expect(page.getByRole('button', { name: 'wifi', exact: true })).toBeVisible(); // «wireless» steht nur als Stichwort bei wifi
  await search.fill('alert-circle'); // alter Name (Alias) findet das umbenannte Icon
  await expect(page.getByRole('button', { name: 'circle-exclamation-point', exact: true })).toBeVisible();
  await search.fill('qqqqzz');
  await expect(page.getByText('Nichts gefunden')).toBeVisible();
  await choose(page, 'Apps');
  await page.getByRole('searchbox').fill('goog');
  await expect(page.getByRole('button', { name: 'Google Drive', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Teams', exact: true })).toHaveCount(0);
  await page.getByRole('searchbox').fill('');
  await page.getByRole('button', { name: 'Teams', exact: true }).click();
  await expect(page.getByText('Gewählt:')).toContainText('Teams');
  const { png } = await exportPng(page);
  expect(strong(png, ...LEFT)).toBeGreaterThan(2000);
});

test('Klick auf die Vorschau wählt den Icon-Platz, «Beide» zeigt eine schwebende Meldung', async ({ page }) => {
  await page.goto('');
  const box = (await page.getByLabel(/Vorschau des Banners/).boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.7, box.y + box.height * 0.5);
  await expect(slotButton(page, 'rechts')).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.6);
  await expect(slotButton(page, 'unten')).toHaveAttribute('aria-pressed', 'true');
  const before = await page.locator('.left-box').evaluate((e) => e.scrollHeight);
  await choose(page, 'Beide');
  const note = page.getByRole('status');
  await expect(note).toContainText('dunkle Vorlage');
  expect(await page.locator('.left-box').evaluate((e) => e.scrollHeight)).toBe(before); // Seitenleiste bleibt, wie sie ist
  expect((await note.evaluate((e) => getComputedStyle(e).position))).toBe('fixed');
  await choose(page, 'Lernende');
  await expect(note).toHaveCount(0);
});

test('Eigenes Bild wird eingepasst, falsche Dateien geben eine Meldung', async ({ page }) => {
  await page.goto('');
  await slotButton(page, 'links').click();
  await choose(page, 'Bild');
  const red = new PNG({ width: 400, height: 100 });
  for (let i = 0; i < red.data.length; i += 4) red.data.set([255, 0, 0, 255], i);
  const input = page.locator('input[type=file]');
  await input.setInputFiles({ name: 'rot.png', mimeType: 'image/png', buffer: PNG.sync.write(red) });
  const { png } = await exportPng(page);
  // 400×100 in 340×262: Breite begrenzt, also 340×85, mittig um (610, 512)
  expect(px(png, 610, 512)).toEqual([255, 0, 0]);
  expect(px(png, 450, 512)).toEqual([255, 0, 0]);
  expect(px(png, 610, 512 - 60)[0]).not.toBe(255);
  await input.setInputFiles({ name: 'x.txt', mimeType: 'text/plain', buffer: Buffer.from('hallo') });
  await expect(page.getByRole('alert')).toContainText('Dieses Format geht nicht');
  await input.setInputFiles({ name: 'kaputt.png', mimeType: 'image/png', buffer: Buffer.from('kein bild') });
  await expect(page.getByRole('alert')).toContainText('liess sich nicht öffnen');
});

async function ownImage(page: Page, file: { name: string; mimeType: string; buffer: Buffer }) {
  await slotButton(page, 'links').click();
  await choose(page, 'Bild');
  await page.locator('input[type=file]').setInputFiles(file);
}

test('Eigenes Bild mit durchsichtigem Grund bekommt Schein, Farbe bleibt', async ({ page }) => {
  await page.goto('');
  const c = new PNG({ width: 400, height: 400 });
  for (let y = 0; y < 400; y++) for (let x = 0; x < 400; x++) if ((x - 200) ** 2 + (y - 200) ** 2 < 150 ** 2) c.data.set([255, 0, 0, 255], (y * 400 + x) * 4);
  await ownImage(page, { name: 'kreis.png', mimeType: 'image/png', buffer: PNG.sync.write(c) });
  const { png } = await exportPng(page);
  // auf den Inhalt zugeschnitten: Kreis 262×262 um (610, 512), Radius 131
  expect(px(png, 610, 512)).toEqual([255, 0, 0]);
  const [x, y] = [610 + 131 + 12, 512];
  expect(px(png, x, y)[0]! - px(png, 2, y)[0]!).toBeGreaterThan(2); // heller als der Verlauf
});

test('Deckendes Bild (JPEG) bekommt keinen Schein', async ({ page }) => {
  await page.goto('');
  const b64 = await page.evaluate(async () => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 200;
    const g = cv.getContext('2d')!;
    g.fillStyle = 'rgb(255,0,0)';
    g.fillRect(0, 0, 200, 200);
    const blob = await new Promise<Blob>((r) => cv.toBlob((b) => r(b!), 'image/jpeg', 0.95));
    return btoa(String.fromCharCode(...new Uint8Array(await blob.arrayBuffer())));
  });
  await ownImage(page, { name: 'foto.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64') });
  const { png } = await exportPng(page);
  // quadratisch: 262×262 um (610, 512), Kante bei x = 741
  near(px(png, 741 + 12, 512), px(png, 2, 512)); // Verlauf ist nur vertikal
});

test('Eigene SVG-Datei (nur viewBox) wird eingepasst', async ({ page }) => {
  await page.goto('');
  await slotButton(page, 'links').click();
  await choose(page, 'Bild');
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#00ff00"/></svg>';
  await page.locator('input[type=file]').setInputFiles({ name: 'logo.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(svg) });
  const { png } = await exportPng(page);
  // quadratisch: Höhe begrenzt, 262×262 um (610, 512)
  expect(px(png, 610, 512)).toEqual([0, 255, 0]);
  expect(px(png, 610 + 120, 512 + 120)).toEqual([0, 255, 0]);
  expect(px(png, 610 + 140, 512)).not.toEqual([0, 255, 0]);
});

test('Start zeigt eine Auswahl statt eines leeren Rasters, Hilfslinien lassen sich bei der Vorschau schalten', async ({ page }) => {
  await page.goto('');
  await expect(page.getByRole('list', { name: 'Häufig gebraucht' }).getByRole('button')).toHaveCount(30);
  await expect(page.getByText('Sperrzone, bleibt leer')).toBeVisible();
  await page.getByRole('switch', { name: 'Hilfslinien zeigen' }).click();
  await expect(page.getByText('Sperrzone, bleibt leer')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
});

test('Nach dem Export meldet die App den Dateinamen', async ({ page }) => {
  await page.goto('');
  await exportPng(page);
  await expect(page.getByRole('status')).toContainText(/Gespeichert als news-le-info-\d{4}-\d{2}-\d{2}\.png/);
});

test('Nur die Ergebnisliste scrollt, die Seitenleiste bleibt stehen und rückt nicht ein (1366×768)', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('');
  const box = page.locator('.left-box');
  const grid = page.locator('.icon-grid');
  const widthBefore = await box.evaluate((e) => e.clientWidth);
  await page.getByRole('searchbox').fill('a'); // 120 Treffer
  await expect(grid.getByRole('button')).toHaveCount(120);
  const m = await box.evaluate((e) => ({ w: e.clientWidth, scroll: e.scrollHeight, client: e.clientHeight }));
  expect(m.scroll).toBeLessThanOrEqual(m.client + 1); // kein Scrollbalken an der Seitenleiste
  expect(m.w).toBe(widthBefore); // nichts rückt ein
  const g = await grid.evaluate((e) => ({ scroll: e.scrollHeight, client: e.clientHeight, overflowY: getComputedStyle(e).overflowY }));
  expect(g.overflowY).toBe('auto');
  expect(g.scroll).toBeGreaterThan(g.client); // die Liste scrollt in sich
  expect(g.client).toBeGreaterThanOrEqual(140); // und ist noch gross genug für mehrere Zeilen
});

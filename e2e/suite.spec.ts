import { expect, test } from '@playwright/test';
import { tools } from '../apps/startseite/src/tools';
import { readdirSync } from 'node:fs';
import { foreignRequests } from './helpers';

// wie scripts/embeds.mjs embedOrdner: Ordner ohne `_`
const embeds = readdirSync('embeds', { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('_')).map((e) => `/sharepoint/${e.name}/`);
const seiten = ['/', '/datenschutz/', ...tools.map((t) => t.pfad), ...embeds];
/** Einzige erlaubte fremde Hosts, je nur auf ihrem Pfad (spec: Sudoku-Rätsel, Radio-Stream). */
const EXTERN: Record<string, string> = { '/sharepoint/sudoku/': 'https://sudoku-api.vercel.app', '/sharepoint/radio-player/': 'https://stream.streambase.ch' };

test('jede Seite: keine fremden Requests (ausser Sudoku-API und Radio-Stream auf ihrem Pfad)', async ({ page }) => {
  // offline testen: die zwei erlaubten Hosts nie wirklich anfragen
  for (const host of Object.values(EXTERN)) await page.route(`${host}/**`, (r) => r.abort());
  for (const p of seiten) {
    const foreign = foreignRequests(page);
    await page.goto(p);
    await page.waitForLoadState('networkidle');
    expect(foreign.filter((u) => !EXTERN[p] || !u.startsWith(EXTERN[p])), p).toEqual([]);
  }
});

test('jede Seite liefert genau eine CSP', async ({ request }) => {
  for (const p of seiten) {
    const csp = (await request.get(p)).headers()['content-security-policy'];
    expect(csp, p).toBeTruthy();
    expect(csp, p).not.toContain(',');
  }
});

test('Kachel öffnet das Tool, Logo führt zurück', async ({ page }) => {
  for (const t of tools) {
    await page.goto('/');
    await page.getByRole('link', { name: new RegExp(t.name) }).click();
    await expect(page).toHaveURL(new RegExp(`${t.pfad}$`));
    // ohne 404.html liefert Pages für fehlende Pfade die Startseite mit 200, darum den Tool-Namen im Header prüfen
    await expect(page.getByRole('link', { name: `BBZB Tools, ${t.name}, zur Startseite` })).toContainText(t.name);
    await page.getByRole('link', { name: `BBZB Tools, ${t.name}, zur Startseite` }).click();
    await expect(page).toHaveURL(/\/$/);
  }
});

test('Unterpfad ohne Schrägstrich und Neuladen laden vollständig', async ({ page }) => {
  for (const t of tools) {
    const failed: string[] = [];
    // ERR_ABORTED: das Neuladen bricht laufende Ladevorgänge ab (z. B. Bilder in Vorschau-iframes), fehlende Dateien kommen als Status ≥ 400
    page.on('requestfailed', (r) => r.failure()?.errorText !== 'net::ERR_ABORTED' && failed.push(r.url()));
    page.on('response', (r) => {
      if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
    });
    await page.goto(t.pfad.slice(0, -1));
    await expect(page).toHaveURL(new RegExp(`${t.pfad}$`));
    await page.waitForLoadState('networkidle'); // sonst bricht reload laufende Schrift-Anfragen ab (ERR_ABORTED)
    await page.reload();
    await page.waitForLoadState('networkidle');
    // fonts.check() wäre auch ohne @font-face true; load() liefert nur bei vorhandener Schrift einen Eintrag
    expect(await page.evaluate(async () => (await document.fonts.load('16px "Host Grotesk"')).length)).toBeGreaterThan(0);
    expect(failed).toEqual([]);
  }
});

test('unbekannter Pfad liefert 404', async ({ request }) => {
  expect((await request.get('/gibt-es-nicht/')).status()).toBe(404);
});

const direktive = (csp: string, name: string) => csp.split(';').map((d) => d.trim()).filter((d) => d.startsWith(`${name} `));

test('connect-src: nur Studio (Hugging Face) und Sudoku (Rätsel-API) dürfen fremd laden, media-src nur Radio', async ({ request }) => {
  const connect: Record<string, string> = { '/social-studio/': " https://huggingface.co https://*.hf.co", '/sharepoint/sudoku/': ' https://sudoku-api.vercel.app' };
  for (const p of seiten) {
    const csp = (await request.get(p)).headers()['content-security-policy']!;
    expect(direktive(csp, 'connect-src'), p).toEqual([`connect-src 'self'${connect[p] ?? ''}`]);
    expect(direktive(csp, 'media-src').join(), p).not.toMatch(p === '/sharepoint/radio-player/' ? /^$/ : /https:/);
  }
  expect(direktive((await request.get('/sharepoint/radio-player/')).headers()['content-security-policy']!, 'media-src')).toEqual(["media-src 'self' https://stream.streambase.ch"]);
});

test('frame-ancestors: nur Embeds dürfen in SharePoint eingebettet werden, alles andere nirgends', async ({ request }) => {
  for (const p of seiten) {
    const csp = (await request.get(p)).headers()['content-security-policy']!;
    expect(direktive(csp, 'frame-ancestors'), p).toEqual([embeds.includes(p) ? "frame-ancestors 'self' https://sluz.sharepoint.com" : "frame-ancestors 'none'"]);
  }
});

test('Startseite: Datenschutz-Satz, Feedback, LegicCard verlinkt GitHub in neuem Tab', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Alles bleibt in deinem Browser')).toBeVisible();
  await expect(page.getByRole('link', { name: /Feedback geben/ })).toHaveAttribute('href', /=%22Startseite%22$/);
  const legic = page.getByRole('link', { name: /LegicCard Creator/ });
  await expect(legic).toHaveAttribute('href', 'https://github.com/alexejwaser/Identity-Card-Photo-Creator');
  await expect(legic).toHaveAttribute('target', '_blank');
  await expect(page.getByRole('region', { name: 'Zuletzt bearbeitet' })).toHaveCount(0); // leer: kein Bereich
});

test('Kopfleiste bleibt beim Scrollen oben, Logo der Startseite zeigt «BBZB Tools»', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await page.goto('/');
  const logo = page.getByRole('link', { name: 'BBZB Tools, Startseite' });
  await expect(logo).toHaveText('BBZB Tools');
  await page.mouse.wheel(0, 1500);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(500);
  expect((await page.locator('.bbzb-header').boundingBox())!.y).toBe(0);
  await expect(logo).toBeInViewport();
});

test('jede Tool-Seite hat Favicon und Apple-Touch-Icon im eigenen Pfad, beide laden (Embeds behalten ihre Pixel-Icons)', async ({ page, request }) => {
  for (const p of seiten.filter((p) => !embeds.includes(p))) {
    await page.goto(p);
    for (const rel of ['icon', 'apple-touch-icon']) {
      const href = await page.locator(`link[rel="${rel}"]`).getAttribute('href');
      expect(href, `${p} ${rel}`).toMatch(/^\/([a-z-]+\/)?(favicon|apple-touch-icon)\.png$/);
      expect((await request.get(href!)).headers()['content-type'], `${p} ${rel}`).toBe('image/png');
    }
  }
});

import { expect, test } from '@playwright/test';
import { tools } from '../apps/startseite/src/tools';
import { foreignRequests } from './helpers';

const seiten = ['/', '/datenschutz/', ...tools.map((t) => t.pfad)];

test('jede Seite: keine fremden Requests', async ({ page }) => {
  for (const p of seiten) {
    const foreign = foreignRequests(page);
    await page.goto(p);
    await page.waitForLoadState('networkidle');
    expect(foreign, p).toEqual([]);
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
    page.on('requestfailed', (r) => failed.push(r.url()));
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

test('connect-src: nur das Social Studio darf KI-Modelle von Hugging Face laden', async ({ request }) => {
  for (const p of seiten) {
    const csp = (await request.get(p)).headers()['content-security-policy']!;
    const connect = csp.split(';').map((d) => d.trim()).filter((d) => d.startsWith('connect-src'));
    expect(connect, p).toEqual([p === '/social-studio/' ? "connect-src 'self' https://huggingface.co https://*.hf.co" : "connect-src 'self'"]);
  }
});

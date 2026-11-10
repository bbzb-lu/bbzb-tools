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
    await expect(page.getByRole('link', { name: 'BBZB Tools, zur Startseite' })).toContainText(t.name);
    await page.getByRole('link', { name: 'BBZB Tools, zur Startseite' }).click();
    await expect(page).toHaveURL(/\/$/);
  }
});

test('Unterpfad ohne Schrägstrich und Neuladen laden vollständig', async ({ page }) => {
  for (const t of tools) {
    const failed: string[] = [];
    page.on('requestfailed', (r) => failed.push(r.url()));
    await page.goto(t.pfad.slice(0, -1));
    await page.waitForLoadState('networkidle'); // sonst bricht reload laufende Schrift-Anfragen ab (ERR_ABORTED)
    await page.reload();
    await page.waitForLoadState('networkidle');
    // fonts.check() wäre auch ohne @font-face true; load() liefert nur bei vorhandener Schrift einen Eintrag
    expect(await page.evaluate(async () => (await document.fonts.load('16px "Host Grotesk"')).length)).toBeGreaterThan(0);
    expect(failed).toEqual([]);
  }
});

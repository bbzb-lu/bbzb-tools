import { expect, test, type Page } from '@playwright/test';
import { foreignRequests } from '../../../e2e/helpers';

const liste = (page: Page) => page.getByRole('textbox', { name: 'Optionen' });

test('Seite lädt, Kopf zeigt Glücksrad, keine fremden Requests', async ({ page }) => {
  const foreign = foreignRequests(page);
  await page.goto('');
  await expect(page.getByRole('link', { name: 'BBZB Tools, Glücksrad, zur Startseite' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Glücksrad');
  await page.waitForLoadState('networkidle');
  expect(foreign).toEqual([]);
});

test('Drehen zeigt genau eine der Optionen als Ergebnis', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('');
  await liste(page).fill('Anna\nBen\nCleo');
  await page.getByRole('button', { name: 'Drehen' }).click();
  await expect(page.locator('.ergebnis')).toHaveText(/^(Anna|Ben|Cleo)$/);
});

test('Drehung landet auf dem angezeigten Ergebnis', async ({ page }) => {
  await page.goto('');
  await liste(page).fill('Anna\nBen\nCleo\nDora');
  await page.getByRole('button', { name: 'Drehen' }).click();
  await expect(page.locator('.ergebnis')).toHaveText(/\S/, { timeout: 8000 });
  const name = (await page.locator('.ergebnis').textContent())!;
  // Der Name, dessen Beschriftung nach der Drehung am höchsten steht, liegt unter dem Zeiger
  const texte = await page.locator('.rad text').evaluateAll((els) => els.map((e) => ({ t: e.textContent, r: e.getBoundingClientRect() })));
  const oben = texte.reduce((a, b) => (b.r.top + b.r.height / 2 < a.r.top + a.r.height / 2 ? b : a));
  expect(oben.t).toBe(name);
});

test('Textdatei laden: CRLF, Leerzeilen und Doppelte werden bereinigt', async ({ page }) => {
  await page.goto('');
  await page.locator('input[type=file]').setInputFiles({ name: 'namen.txt', mimeType: 'text/plain', buffer: Buffer.from('Anna\r\nBen\r\n\r\nAnna\r\nCleo') });
  await expect(liste(page)).toHaveValue('Anna\nBen\nCleo');
});

test('Mehrere: genau zwei verschiedene Kacheln leuchten, Anzahl wird begrenzt', async ({ page }) => {
  await page.goto('');
  await liste(page).fill('A\nB\nC\nD\nE');
  await page.getByText('Mehrere', { exact: true }).click();
  await page.getByLabel('Anzahl').fill('2');
  await page.getByRole('button', { name: 'Ziehen' }).click();
  await expect(page.locator('.kacheln li.an')).toHaveCount(2);
  await page.getByLabel('Anzahl').fill('9');
  await page.getByRole('button', { name: 'Ziehen' }).click();
  await expect(page.locator('.kacheln li.an')).toHaveCount(5);
});

test('Gewinner entfernen: Ergebnis bleibt sichtbar, Rad springt nicht, Entfernen erst beim nächsten Drehen', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('');
  await liste(page).fill('A\nB');
  await page.getByRole('switch', { name: 'Gewinner entfernen' }).click();
  await page.getByRole('button', { name: 'Drehen' }).click();
  await expect(page.locator('.ergebnis')).toHaveText(/^(A|B)$/);
  await expect(liste(page)).toHaveValue(/^A\nB$/);
  await page.getByRole('button', { name: 'Drehen' }).click();
  await expect(page.locator('.ergebnis')).toHaveText(/^(A|B)$/);
  await expect(liste(page)).toHaveValue(/^(A|B)$/);
  await expect(page.getByRole('button', { name: 'Drehen' })).toBeDisabled();
});

test('Während der Drehung sind Liste, Datei, Modus und Schalter gesperrt', async ({ page }) => {
  await page.goto('');
  await liste(page).fill('A\nB\nC');
  await page.getByRole('button', { name: 'Drehen' }).click();
  await expect(liste(page)).toBeDisabled();
  await expect(page.locator('input[type=file]')).toBeDisabled();
  await expect(page.getByRole('radio', { name: 'Mehrere' })).toBeDisabled();
  await expect(page.getByRole('switch', { name: 'Gewinner entfernen' })).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('.ergebnis')).toHaveText(/\S/, { timeout: 8000 });
  await expect(liste(page)).toBeEnabled();
  await expect(page.getByRole('radio', { name: 'Mehrere' })).toBeEnabled();
});

test('Liste bleibt nach dem Neuladen erhalten', async ({ page }) => {
  await page.goto('');
  await liste(page).fill('Anna\nBen');
  await page.reload();
  await expect(liste(page)).toHaveValue('Anna\nBen');
});

test('Handy: Rad und Knopf sichtbar, kein horizontales Scrollen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('');
  await liste(page).fill('Anna\nBen\nCleo');
  await expect(page.locator('.rad')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Drehen' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('Optionen als Textdatei speichern, bei leerer Liste gesperrt', async ({ page }) => {
  await page.goto('');
  const speichern = page.getByRole('button', { name: 'Als Textdatei speichern' });
  await expect(speichern).toBeDisabled();
  await liste(page).fill('Anna\n\nBen\nAnna');
  const [datei] = await Promise.all([page.waitForEvent('download'), speichern.click()]);
  expect(datei.suggestedFilename()).toBe('gluecksrad-optionen.txt');
  const pfad = await datei.path();
  expect((await import('node:fs')).readFileSync(pfad, 'utf8')).toBe('Anna\nBen\n');
});

test('Gewinner erscheint als Karte über dem Rad und lässt sich mit Klick und Esc schliessen', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('');
  await liste(page).fill('Anna\nBen');
  await page.getByRole('button', { name: 'Drehen' }).click();
  const karte = page.locator('.gewinner-karte');
  await expect(karte).toBeVisible();
  await expect(karte.locator('.ergebnis')).toHaveText(/^(Anna|Ben)$/);
  await karte.click();
  await expect(karte).toHaveCount(0);
  await page.getByRole('button', { name: 'Drehen' }).click();
  await expect(karte).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(karte).toHaveCount(0);
});

test('Leerzustand: Rad zeigt «Optionen eintragen», Drehen gesperrt', async ({ page }) => {
  await page.goto('');
  await expect(page.locator('.rad')).toContainText('Optionen eintragen');
  await expect(page.getByRole('button', { name: 'Drehen' })).toBeDisabled();
  await liste(page).fill('A\nB');
  await expect(page.locator('.rad')).not.toContainText('Optionen eintragen');
});

test('Zweites Drehen: Gewinner erscheint erst, wenn das Rad steht', async ({ page }) => {
  await page.goto('');
  await liste(page).fill('Anna\nBen\nCleo\nDora');
  await page.getByRole('button', { name: 'Drehen' }).click();
  await expect(page.locator('.gewinner-karte')).toBeVisible({ timeout: 8000 });
  await page.getByRole('button', { name: 'Drehen' }).click();
  // Die Drehung dauert 4 s: nach 1,5 s darf noch keine Karte da sein
  await page.waitForTimeout(1500);
  await expect(page.locator('.gewinner-karte')).toHaveCount(0);
  await expect(page.locator('.gewinner-karte')).toBeVisible({ timeout: 8000 });
});

test('Vorlage anklicken füllt die Liste', async ({ page }) => {
  await page.goto('');
  await page.getByRole('button', { name: 'Mittagessen' }).click();
  await expect(liste(page)).toHaveValue(/^Pizza\n/);
  await expect(page.getByText(/^\d+ von 100$/)).toHaveText('8 von 100');
  await expect(page.getByRole('button', { name: 'Mittagessen' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Ja nein' }).click();
  await expect(liste(page)).toHaveValue('Ja\nNein\nVielleicht\nFrag nochmal');
});

test.describe('Wahnsinn-Modus', () => {
  test('Effekte nur während Drehung und Karte, zweimal hintereinander, ohne Fehler und fremde Requests', async ({ page }) => {
    test.setTimeout(60_000);
    const fehler: string[] = [];
    page.on('pageerror', (e) => fehler.push(e.message));
    const foreign = foreignRequests(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('');
    await liste(page).fill('Anna\nBen\nCleo\nDora');
    await page.getByRole('switch', { name: 'Wahnsinn' }).click();
    const main = page.locator('main.gr');
    for (let runde = 0; runde < 2; runde++) {
      await page.getByRole('button', { name: 'Drehen' }).click();
      await expect(main).toHaveClass(/wm-dreht/);
      await expect(page.locator('canvas.fx-canvas')).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await expect(page.locator('.gewinner-karte')).toBeVisible({ timeout: 12_000 });
      await expect(main).toHaveClass(/wm-sieg/);
      await page.locator('.gewinner-karte').click();
      await expect(main).not.toHaveClass(/wm-/);
      await expect(page.locator('canvas.fx-canvas')).toHaveCount(0);
    }
    expect(fehler).toEqual([]);
    expect(foreign).toEqual([]);
  });

  test('Mit «weniger Bewegung» ist der Schalter gesperrt, ohne Modus bleibt die Seite ruhig', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('');
    await expect(page.getByRole('switch', { name: 'Wahnsinn' })).toHaveAttribute('aria-disabled', 'true');
    await liste(page).fill('A\nB');
    await page.getByRole('button', { name: 'Drehen' }).click();
    await expect(page.locator('.gewinner-karte')).toBeVisible();
    await expect(page.locator('main.gr')).not.toHaveClass(/wm-/);
    await expect(page.locator('canvas.fx-canvas')).toHaveCount(0);
  });

  test('Wahnsinn ändert die normale Seite nicht und fehlt im Modus «Mehrere»', async ({ page }) => {
    await page.goto('');
    await expect(page.locator('main.gr')).not.toHaveClass(/wm-/);
    await page.getByRole('switch', { name: 'Wahnsinn' }).click();
    await expect(page.getByRole('switch', { name: 'Ton' })).toBeVisible();
    await page.getByText('Mehrere', { exact: true }).click();
    await expect(page.getByRole('switch', { name: 'Wahnsinn' })).toHaveCount(0);
  });
});

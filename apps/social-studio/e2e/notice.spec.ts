import { expect, test, type Page } from '@playwright/test';
import { channelBtn, newProject, selectCta } from './fixtures';
import { notice as noticeTokens } from '../src/tokens';

// Echte Bildlaufleisten wie unter Windows: Playwright blendet sie sonst mit --hide-scrollbars aus.
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] }, viewport: { width: 1280, height: 720 } });

const notify = (page: Page, kind: 'info' | 'error', text: string) => page.evaluate(([k, t]) => window.__bbzbTest.notify(k as 'info' | 'error', t!), [kind, text]);
const heights = (page: Page) =>
  page.evaluate(() => ({ doc: document.documentElement.scrollHeight, win: innerHeight, editor: document.querySelector('.editor')?.getBoundingClientRect().height ?? 0 }));

test('Info-Meldung verändert die Höhe der Seite nicht', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const before = await heights(page);
  expect(before.doc).toBeLessThanOrEqual(before.win);
  await selectCta(page);
  await channelBtn(page, 'LinkedIn').click();
  await expect(page.getByRole('alert')).toBeVisible();
  const after = await heights(page);
  expect(after.doc).toBeLessThanOrEqual(after.win);
  expect(after.editor).toBe(before.editor);
  const pos = await page.locator('.notice').evaluate((e) => ({ p: getComputedStyle(e).position, r: e.getBoundingClientRect() }));
  expect(pos.p).toBe('fixed');
  expect(Math.abs(pos.r.x + pos.r.width / 2 - 640)).toBeLessThan(2);
  expect(pos.r.y).toBeGreaterThan(40);
});

test('Startseite: Kopie-Meldung macht die Seite nicht scrollbar', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await page.getByRole('button', { name: 'Übersicht' }).click();
  await page.getByRole('button', { name: /als Story kopieren/ }).click();
  await expect(page.getByRole('alert')).toContainText('ist angelegt');
  const h = await heights(page);
  expect(h.doc).toBeLessThanOrEqual(h.win);
});

test('Info verschwindet nach infoMs, Fehler bleibt', async ({ page }) => {
  await page.clock.install();
  await newProject(page, 'Post 4:5');
  await notify(page, 'info', 'Eine Info.');
  await expect(page.getByRole('alert')).toHaveText('Eine Info.');
  await page.clock.runFor(noticeTokens.infoMs - 500);
  await expect(page.getByRole('alert')).toHaveText('Eine Info.');
  await page.clock.runFor(600);
  await expect(page.locator('.notice')).toHaveCount(0);
  await notify(page, 'error', 'Ein Fehler.');
  await page.clock.runFor(noticeTokens.infoMs * 3);
  await expect(page.getByRole('alert')).toHaveText('Ein Fehler.');
});

test('Neue Meldung setzt den Timer zurück', async ({ page }) => {
  await page.clock.install();
  await newProject(page, 'Post 4:5');
  await notify(page, 'info', 'Eins.');
  await page.clock.runFor(noticeTokens.infoMs - 1000);
  await notify(page, 'info', 'Zwei.');
  await page.clock.runFor(noticeTokens.infoMs - 1000);
  await expect(page.getByRole('alert')).toHaveText('Zwei.');
  await page.clock.runFor(1500);
  await expect(page.locator('.notice')).toHaveCount(0);
});

test('Maus über der Meldung hält sie offen, danach läuft die Zeit weiter', async ({ page }) => {
  await page.clock.install();
  await newProject(page, 'Post 4:5');
  await notify(page, 'info', 'Eine Info.');
  await page.locator('.notice').hover();
  await page.clock.runFor(noticeTokens.infoMs * 2);
  await expect(page.getByRole('alert')).toBeVisible();
  await page.mouse.move(5, 400);
  await page.clock.runFor(noticeTokens.infoMs + 500);
  await expect(page.locator('.notice')).toHaveCount(0);
});

test('Fokus im Schliessen-Knopf hält die Meldung offen', async ({ page }) => {
  await page.clock.install();
  await newProject(page, 'Post 4:5');
  await notify(page, 'info', 'Eine Info.');
  await page.locator('.notice button').focus();
  await page.clock.runFor(noticeTokens.infoMs * 2);
  await expect(page.getByRole('alert')).toBeVisible();
});

test('role=alert und Schliessen bleiben; Meldung hat Vorrang vor einem offenen Dialog', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await page.getByRole('button', { name: 'Exportieren' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await notify(page, 'error', 'Ein Fehler.');
  await expect(page.getByRole('alert')).toHaveText('Ein Fehler.');
  // Top-Layer wie der Dialog, aber später geöffnet: liegt darüber (der modale Dialog macht sie bis zu seinem Schliessen nicht bedienbar)
  expect(await page.locator('.notice').evaluate((e) => e.matches(':popover-open'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.locator('.notice').getByRole('button', { name: 'Schliessen', exact: true }).click();
  await expect(page.locator('.notice')).toHaveCount(0);
});

for (const width of [1100, 1280, 1536]) {
  test(`Meldung liegt unter der Kopfzeile und verdeckt keinen Knopf (${width} px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 720 });
    await newProject(page, 'Post 4:5');
    await selectCta(page);
    await channelBtn(page, 'LinkedIn').click();
    await expect(page.getByRole('alert')).toBeVisible();
    const n = (await page.locator('.notice').boundingBox())!;
    const h = (await page.locator('.editor-header').boundingBox())!;
    expect(n.y).toBeGreaterThanOrEqual(h.y + h.height);
    // der nächste Kanalwechsel klappt, solange die Meldung steht
    await channelBtn(page, 'Instagram').click();
    await expect(channelBtn(page, 'Instagram')).toBeChecked();
    const d = await heights(page);
    expect(d.doc).toBeLessThanOrEqual(d.win);
  });
}

test('Nach Hover und Schliessen läuft die nächste Info wieder ab', async ({ page }) => {
  await page.clock.install();
  await newProject(page, 'Post 4:5');
  await notify(page, 'info', 'Eins.');
  await page.locator('.notice').hover();
  await page.locator('.notice button').click();
  await expect(page.locator('.notice')).toHaveCount(0);
  await page.mouse.move(5, 400);
  await notify(page, 'info', 'Zwei.');
  await page.clock.runFor(noticeTokens.infoMs + 500);
  await expect(page.locator('.notice')).toHaveCount(0);
});

test('Fehler mit Fokus auf dem X, per Enter geschlossen: nächste Info läuft ab', async ({ page }) => {
  await page.clock.install();
  await newProject(page, 'Post 4:5');
  await notify(page, 'error', 'Fehler.');
  await page.locator('.notice button').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.notice')).toHaveCount(0);
  await notify(page, 'info', 'Zwei.');
  await page.clock.runFor(noticeTokens.infoMs + 500);
  await expect(page.locator('.notice')).toHaveCount(0);
});

test('Grössenänderung: Meldung bleibt unter der Kopfzeile', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await notify(page, 'error', 'Fehler.');
  await page.setViewportSize({ width: 900, height: 720 });
  await expect
    .poll(async () => {
      const n = (await page.locator('.notice').boundingBox())!;
      const h = (await page.locator('.editor-header').boundingBox())!;
      return n.y >= h.y + h.height - 0.5;
    })
    .toBe(true);
});

test('Fehler und Info unterscheiden sich durch Symbol und Rand, nicht nur durch Farbe', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const shot = async (n: string) => {
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/task-13a-meldung-${n}.png` });
  };
  await notify(page, 'info', 'Das Foto ist gespeichert.');
  await expect(page.locator('.notice').getByRole('img', { name: 'Hinweis' })).toBeVisible();
  const edge = (k: string) => page.locator(`.notice-${k}`).evaluate((e) => getComputedStyle(e).borderLeftWidth);
  expect(await edge('info')).toBe('1px');
  await shot('info');
  await notify(page, 'error', 'Das Foto konnte nicht gelesen werden.');
  await expect(page.locator('.notice').getByRole('img', { name: 'Fehler' })).toBeVisible();
  expect(await edge('error')).toBe('6px');
  await shot('fehler');
});

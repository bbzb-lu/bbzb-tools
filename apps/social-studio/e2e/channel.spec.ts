import { expect, test, type Page } from '@playwright/test';
import { channelBtn, elements, newProject, selectCta } from './fixtures';

const SHOTS = '.superpowers/sdd/2026-10-27-phase-2-8-oberflaeche/screens';
const ctas = async (page: Page) => (await elements(page)).filter((e) => e.type === 'tag' && (e.props as { variant: string }).variant === 'cta');
const channel = channelBtn;

test('Kanal wechseln tauscht den CTA der Abschluss-Slide samt Breite, ein Undo stellt zurück', async ({ page }) => {
  await newProject(page, 'Post 4:5', 'Carousel');
  await expect(page.getByRole('group', { name: 'Kanal' })).toHaveCount(0); // nicht in der Kopfzeile, nicht ohne CTA
  await selectCta(page);
  await expect(page.locator('.editor-header').getByRole('group', { name: 'Kanal' })).toHaveCount(0);
  await expect(channel(page, 'Instagram')).toBeChecked();
  const [before] = await ctas(page);
  expect((before!.props as { text: string }).text).toBe('LINK IN BIO');
  await channel(page, 'LinkedIn').click();
  await expect(channel(page, 'LinkedIn')).toBeChecked();
  await expect.poll(async () => ((await ctas(page))[0]!.props as { text: string }).text).toBe('BBZB.LU.CH');
  const [after] = await ctas(page);
  expect(after!.width).not.toBe(before!.width);
  expect((await page.evaluate(() => window.__bbzbTest.project())).channel).toBe('linkedin');
  await page.screenshot({ path: `${SHOTS}/task-2-kanal.png` });
  await page.keyboard.press('Control+z');
  await expect.poll(async () => ((await ctas(page))[0]!.props as { text: string }).text).toBe('LINK IN BIO');
  expect((await ctas(page))[0]!.width).toBe(before!.width);
  await expect(channel(page, 'Instagram')).toBeChecked();
});

test('Eigener CTA-Text bleibt, neuer CTA nimmt den Text des Kanals', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await selectCta(page, 'Jetzt anmelden'); // vorhandener CTA mit eigenem Text bleibt
  await channel(page, 'LinkedIn').click();
  await page.evaluate(() => window.__bbzbTest.insertTag('cta'));
  await expect.poll(async () => (await ctas(page)).map((e) => (e.props as { text: string }).text).sort()).toEqual(['BBZB.LU.CH', 'Jetzt anmelden']);
  await channel(page, 'Instagram').click();
  await expect(channel(page, 'Instagram')).toBeChecked();
  await expect.poll(async () => (await ctas(page)).map((e) => (e.props as { text: string }).text).sort()).toEqual(['Jetzt anmelden', 'LINK IN BIO']);
});

test('Kanal-Gruppe erklärt sich, Wechsel meldet die Zahl angepasster Link-Hinweise', async ({ page }) => {
  await newProject(page, 'Post 4:5', 'Carousel');
  await selectCta(page);
  await expect(channel(page, 'LinkedIn')).toHaveAccessibleDescription('Gilt für alle CTA im Projekt.');
  await channel(page, 'LinkedIn').click();
  await expect(page.getByRole('alert')).toHaveText('1 Link-Hinweis angepasst.');
  await page.keyboard.press('Control+z'); // ein Undo-Schritt: Kanal und CTA-Text zusammen
  await expect(channel(page, 'Instagram')).toBeChecked();
  expect(((await ctas(page))[0]!.props as { text: string }).text).toBe('LINK IN BIO');
  await channel(page, 'LinkedIn').click();
  await expect(page.getByRole('alert')).toHaveText('1 Link-Hinweis angepasst.');
  await page.getByRole('button', { name: 'Schliessen' }).click();
  await page.evaluate(() => window.__bbzbTest.insertTag('cta')); // wählt den neuen CTA aus
  await channel(page, 'Instagram').click();
  await expect(page.getByRole('alert')).toHaveText('2 Link-Hinweise angepasst.');
});

test('Ohne Link-Hinweis mit Standardtext ändert der Wechsel nur den Kanal', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await selectCta(page, 'Jetzt anmelden');
  await channel(page, 'LinkedIn').click();
  await expect(page.getByRole('alert')).toHaveText('Kein Link-Hinweis mit Standardtext gefunden.');
  expect((await page.evaluate(() => window.__bbzbTest.project())).channel).toBe('linkedin');
  await page.keyboard.press('Control+z');
  await expect(channel(page, 'Instagram')).toBeChecked();
});

test('Andere Tag-Varianten zeigen keinen Kanal-Schalter', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  for (const v of ['schul', 'fach', 'frei', 'ort']) {
    await page.evaluate((x) => window.__bbzbTest.insertTag(x), v);
    await expect(page.getByRole('group', { name: 'Kanal' })).toHaveCount(0);
  }
});

test('Kanal-Gruppe hat sichtbare Beschriftung und Hinweiszeile', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await selectCta(page);
  const group = page.getByRole('group', { name: 'Kanal' });
  await expect(group.locator('legend')).toBeVisible();
  await expect(group.getByText('Gilt für alle CTA im Projekt.')).toBeVisible();
});

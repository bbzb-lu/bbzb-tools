import { expect, test, type Page } from '@playwright/test';
import { elements, newProject } from './fixtures';

const tip = (page: Page) => page.locator('.tooltip');
const shown = (page: Page) => tip(page).evaluate((e) => e.matches(':popover-open'));
/** Task 2 setzt data-tip an die echten Knöpfe; bis dahin bekommen bestehende Knöpfe das Attribut per Skript. */
async function arm(page: Page, name: string, tipText: string, keys?: string) {
  const b = page.getByRole('button', { name, exact: true });
  await b.evaluate((e, [t, k]) => {
    e.setAttribute('data-tip', t!);
    if (k) e.setAttribute('data-keys', k);
    else e.removeAttribute('data-keys'); // echte Knöpfe tragen seit Task 3 eigene Kürzel
  }, [tipText, keys]);
  return b;
}

test('Maus: nach 400 ms sichtbar, mit Text und Tasten; Verlassen schliesst', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const b = await arm(page, 'Text hinzufügen', 'Text einfügen', 'Strg+Z');
  await b.hover();
  expect(await shown(page)).toBe(false);
  await expect.poll(() => shown(page)).toBe(true);
  await expect(tip(page)).toContainText('Text einfügen');
  await expect(tip(page).locator('kbd')).toHaveText(['Strg', 'Z']);
  await page.mouse.move(5, 400);
  await expect.poll(() => shown(page)).toBe(false);
});

test('Fokus: Tab zeigt ihn, Mausklick nicht; Esc schliesst und hebt die Auswahl trotzdem auf', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const b = await arm(page, 'Text hinzufügen', 'Text einfügen');
  await b.click(); // legt Text an, Element ist gewählt
  await expect.poll(() => elements(page)).toHaveLength(1);
  await page.waitForTimeout(600);
  expect(await shown(page)).toBe(false);
  await page.keyboard.press('Shift+Tab'); // Tastatur bewegt den Fokus weg und zurück: :focus-visible gilt
  await page.keyboard.press('Tab');
  await expect(b).toBeFocused();
  await expect.poll(() => shown(page)).toBe(true);
  expect(await page.evaluate(() => window.__bbzbTest.selected())).not.toBeNull();
  await page.keyboard.press('Escape');
  expect(await shown(page)).toBe(false);
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.selected())).toBeNull();
});

test('zweiter Knopf kurz nach dem ersten erscheint sofort', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const a = await arm(page, 'Text hinzufügen', 'Eins');
  const c = await arm(page, 'Übersicht', 'Zwei');
  await a.hover();
  await expect.poll(() => shown(page)).toBe(true);
  await c.hover();
  await expect(tip(page)).toContainText('Zwei', { timeout: 100 });
  expect(await shown(page)).toBe(true);
});

test('am rechten und unteren Rand liegt er im Fenster und überdeckt den Knopf nicht', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const right = page.getByRole('button', { name: 'Exportieren', exact: true });
  const bottom = page.getByRole('button', { name: 'Slide hinzufügen', exact: true });
  for (const b of [right, bottom]) {
    await b.evaluate((e) => e.setAttribute('data-tip', 'Ein längerer Tooltip-Text zum Prüfen'));
    await b.hover();
    await expect.poll(() => shown(page)).toBe(true);
    const t = (await tip(page).boundingBox())!;
    const a = (await b.boundingBox())!;
    const vp = page.viewportSize()!;
    expect(t.x).toBeGreaterThanOrEqual(0);
    expect(t.y).toBeGreaterThanOrEqual(0);
    expect(t.x + t.width).toBeLessThanOrEqual(vp.width);
    expect(t.y + t.height).toBeLessThanOrEqual(vp.height);
    const overlap = t.x < a.x + a.width && a.x < t.x + t.width && t.y < a.y + a.height && a.y < t.y + t.height;
    expect(overlap).toBe(false);
    await page.mouse.move(5, 400);
    await expect.poll(() => shown(page)).toBe(false);
  }
});

test('zweiter langer Tooltip am rechten Rand: im Fenster, ohne unnötigen Umbruch', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const b = await arm(page, 'Exportieren', 'Kurz');
  await b.hover();
  await expect.poll(() => shown(page)).toBe(true);
  await page.mouse.move(5, 400);
  await expect.poll(() => shown(page)).toBe(false);
  await b.evaluate((e) => e.setAttribute('data-tip', 'Ein ziemlich langer Tooltip-Text, länger'));
  await b.hover(); // innerhalb der Schonfrist: sofort, mit der Position des vorigen Tooltips
  await expect(tip(page)).toContainText('langer');
  const t = (await tip(page).boundingBox())!;
  expect(t.x + t.width).toBeLessThanOrEqual(page.viewportSize()!.width - 4);
  expect(t.height).toBeLessThan(40); // eine Zeile; veraltetes left würde den Kasten zum Umbruch zwingen
});

test('offener Tooltip folgt geändertem data-tip und data-keys', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const b = await arm(page, 'Text hinzufügen', 'Alt', 'Strg+Z');
  await b.hover();
  await expect.poll(() => shown(page)).toBe(true);
  await b.evaluate((e) => {
    e.setAttribute('data-tip', 'Neu');
    e.setAttribute('data-keys', 'Strg+Umschalt+Z');
  });
  await expect(tip(page)).toContainText('Neu');
  await expect(tip(page).locator('kbd')).toHaveText(['Strg', 'Umschalt', 'Z']);
});

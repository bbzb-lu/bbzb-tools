import { expect, test, type Page } from '@playwright/test';
import { addPhoto, addScrim, elements, newProject, openSection, png } from './fixtures';

const plus = (page: Page) => page.getByRole('button', { name: 'Effekt hinzufügen', exact: true });
const menu = (page: Page) => page.getByRole('menu', { name: 'Effekt hinzufügen' });
const slide = (page: Page) => page.evaluate(() => window.__bbzbTest.project().slides[0]!);

test('Effekte: «+» öffnet das Menü mit Name und Hinweis, Pfeiltasten wandern, Esc schliesst und der Fokus kehrt zurück', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await expect(plus(page)).toHaveAttribute('aria-haspopup', 'menu');
  await plus(page).click();
  await expect(menu(page)).toBeVisible();
  const items = menu(page).getByRole('menuitem');
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toContainText('Filmkörnung');
  await expect(items.nth(1)).toContainText('Dunkler Rand');
  await expect(items.nth(0)).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(items.nth(1)).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(items.nth(0)).toBeFocused(); // rundum
  await page.keyboard.press('ArrowUp');
  await expect(items.nth(1)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu(page)).toBeHidden();
  await expect(plus(page)).toBeFocused();
});

test('Effekte: Klick ausserhalb schliesst; Enter fügt hinzu, Korn bekommt einen Haken und ist gesperrt, Fokus zurück auf «+»', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await plus(page).click();
  await page.mouse.click(5, 5);
  await expect(menu(page)).toBeHidden();

  await plus(page).click();
  await expect(menu(page).getByRole('menuitem').first()).toBeFocused();
  await page.keyboard.press('Enter'); // erster Eintrag: Korn
  await expect(menu(page)).toBeHidden();
  await expect(plus(page)).toBeFocused();
  expect((await slide(page)).grain).toBe(true);

  await plus(page).click();
  const korn = menu(page).getByRole('menuitem', { name: /^Korn/ });
  await expect(korn).toHaveAttribute('aria-disabled', 'true');
  await expect(korn).toContainText('schon hinzugefügt');
  await korn.click({ force: true });
  await expect(menu(page)).toBeVisible(); // gesperrt: nichts passiert
  expect((await slide(page)).grain).toBe(true);
  await expect(menu(page).getByRole('menuitem', { name: /^Verlauf/ })).not.toHaveAttribute('aria-disabled', 'true');
});

test('Effekte: Verlauf bis zum Limit von vier, Entfernen gibt einen Platz frei, ein Undo-Schritt je Handgriff', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  for (let i = 0; i < 4; i++) {
    await plus(page).click();
    await menu(page).getByRole('menuitem', { name: /^Verlauf/ }).click();
  }
  expect((await slide(page)).scrims!.map((s) => s.side)).toEqual(['unten', 'oben', 'links', 'rechts']);
  await plus(page).click();
  const verlauf = menu(page).getByRole('menuitem', { name: /^Verlauf/ });
  await expect(verlauf).toHaveAttribute('aria-disabled', 'true');
  await verlauf.click({ force: true });
  expect((await slide(page)).scrims).toHaveLength(4);
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Verlauf Oben entfernen', exact: true }).click();
  await expect(plus(page)).toBeFocused();
  expect((await slide(page)).scrims!.map((s) => s.side)).toEqual(['unten', 'links', 'rechts']);
  await plus(page).click();
  await expect(menu(page).getByRole('menuitem', { name: /^Verlauf/ })).not.toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+z');
  expect((await slide(page)).scrims).toHaveLength(4);
});

test('Effekt-Zeilen klappen ein (aria-expanded, Inhalt nicht tabbar); Seite wechseln belegt keine zweite', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await plus(page).click();
  await menu(page).getByRole('menuitem', { name: /^Verlauf/ }).click();
  const head = page.getByRole('button', { name: 'Verlauf Unten', exact: true });
  await expect(head).toHaveAttribute('aria-expanded', 'true');
  const row = page.getByRole('region', { name: 'Verlauf Unten' });
  await expect(row.getByRole('radio', { name: 'Mittel' })).toBeChecked();
  await head.click();
  await expect(head).toHaveAttribute('aria-expanded', 'false');
  await expect(row.getByRole('radio', { name: 'Mittel' })).toBeHidden();
  await openSection(page, 'Verlauf Unten');
  await row.getByLabel('Seite').selectOption('oben');
  expect((await slide(page)).scrims).toEqual([{ side: 'oben', strength: 'mittel' }]);
  await plus(page).click();
  await menu(page).getByRole('menuitem', { name: /^Verlauf/ }).click();
  expect((await slide(page)).scrims!.map((s) => s.side)).toEqual(['oben', 'unten']);
});

test('Inspector: «Ebene» steht bei Mehrfachauswahl zuoberst und startet offen, Hinweis auf Deutsch', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await page.evaluate(async () => {
    await window.__bbzbTest.insertTag('cta');
    await window.__bbzbTest.insertTag('cta');
  });
  await page.keyboard.press('Control+a');
  const panel = page.getByRole('complementary', { name: 'Eigenschaften' });
  await expect(panel.getByRole('heading', { level: 2 })).toHaveText('2 Elemente');
  const ebene = panel.getByRole('button', { name: 'Ebene', exact: true });
  await expect(ebene).toHaveAttribute('aria-expanded', 'true');
  await expect(panel.getByRole('button', { name: 'Löschen' })).toBeVisible();
  await ebene.click();
  await expect(panel.getByRole('button', { name: 'Duplizieren' })).toBeHidden();
  await openSection(page, 'Ebene');
  await expect(panel.getByRole('button', { name: 'Löschen' })).toBeVisible();
});

test('Effekte am Foto: sind alle Einträge gesperrt, hat das Menü den Fokus und Esc schliesst nur das Menü, die Auswahl bleibt', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addPhoto(page, png(400, 300));
  await expect.poll(() => elements(page)).toHaveLength(1);
  const [photo] = await elements(page);
  for (const side of ['Unten', 'Oben', 'Links', 'Rechts']) await addScrim(page, side);
  for (const n of ['Rahmen', 'Korn']) if (!(await page.getByLabel('Eigenschaften').getByRole('button', { name: `${n} entfernen`, exact: true }).count())) await page.getByRole('button', { name: 'Effekt hinzufügen', exact: true }).click().then(() => menu(page).getByRole('menuitem', { name: new RegExp(`^${n}`) }).click());
  await plus(page).click();
  await expect(menu(page)).toBeVisible();
  await expect(menu(page).locator('[role=menuitem]:not([aria-disabled=true])')).toHaveCount(0);
  await expect(menu(page)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu(page)).toBeHidden();
  expect(await page.evaluate(() => window.__bbzbTest.selected())).toBe(photo!.id);
});

test('Esc schliesst Slide-Popover und Unterlage-Popover, die Auswahl bleibt', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addPhoto(page, png(400, 300));
  await expect.poll(() => elements(page)).toHaveLength(1);
  const [photo] = await elements(page);
  const selected = () => page.evaluate(() => window.__bbzbTest.selected());
  for (const [trigger, pop] of [['Slide hinzufügen', '#slide-layouts'], ['Unterlage', '#stage-backdrop']] as const) {
    await page.getByRole('button', { name: trigger, exact: false }).first().click();
    await expect(page.locator(pop)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator(pop)).toBeHidden();
    expect(await selected()).toBe(photo!.id);
  }
});

test('Esc im Effektmenü bei Fokus auf dem Auslöser: die Auswahl bleibt', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addPhoto(page, png(400, 300));
  await expect.poll(() => elements(page)).toHaveLength(1);
  const [photo] = await elements(page);
  await plus(page).click();
  await plus(page).focus(); // Fokus auf den Auslöser statt im Menü
  await expect(menu(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu(page)).toBeHidden();
  expect(await page.evaluate(() => window.__bbzbTest.selected())).toBe(photo!.id);
});

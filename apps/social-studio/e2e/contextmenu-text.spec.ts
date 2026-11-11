import { expect, test, type Page } from '@playwright/test';
import { elements, newProject, toScreen } from './fixtures';

const SHOTS = '.superpowers/sdd/2026-10-27-phase-2-10-2/screens';
const menu = (page: Page) => page.getByRole('menu', { name: 'Kontextmenü' });
const item = (page: Page, name: string) => menu(page).getByRole('menuitem', { name, exact: true });
const name = (page: Page) => page.getByLabel('Projektname');
const textArea = (page: Page) => page.getByRole('textbox', { name: 'Text', exact: true });

/** Text hinzufügen und per Doppelklick bearbeiten: Textfeld über der Leinwand. */
async function editText(page: Page) {
  await page.getByRole('button', { name: 'Text hinzufügen' }).click();
  await expect.poll(() => elements(page)).toHaveLength(1);
  const e = (await elements(page))[0]!;
  const c = await toScreen(page, e.x + e.width / 2, e.y + e.height / 2);
  await page.mouse.dblclick(c.x, c.y);
  await expect(textArea(page)).toBeFocused();
  return textArea(page);
}
const textOf = async (page: Page) => ((await elements(page))[0]!.props as { text: string }).text;

test('Rechtsklick im Projektnamen: eigenes Menü; Kopieren und Einfügen über die Zwischenablage', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await newProject(page, 'Post 4:5');
  await name(page).fill('Sommerlager 2026');
  await name(page).click({ button: 'right' });
  await expect(menu(page)).toBeVisible();
  // nichts markiert: Ausschneiden und Kopieren gesperrt
  await expect(item(page, 'Kopieren')).toHaveAttribute('aria-disabled', 'true');
  await expect(item(page, 'Einfügen')).not.toHaveAttribute('aria-disabled', 'true');
  await item(page, 'Alles auswählen').click();
  await expect(menu(page)).toBeHidden();
  await expect(name(page)).toBeFocused();
  expect(await name(page).evaluate((i: HTMLInputElement) => [i.selectionStart, i.selectionEnd])).toEqual([0, 16]);
  await name(page).click({ button: 'right', position: { x: 20, y: 10 } });
  await expect(item(page, 'Kopieren')).not.toHaveAttribute('aria-disabled', 'true');
  await page.screenshot({ path: `${SHOTS}/item2-text-menu.png` });
  await item(page, 'Kopieren').click();
  await expect(name(page)).toBeFocused();
  // Markierung bleibt: Menü öffnen hat das Feld nicht verlassen
  expect(await name(page).evaluate((i: HTMLInputElement) => [i.selectionStart, i.selectionEnd])).toEqual([0, 16]);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('Sommerlager 2026');
  // Einfügen in ein anderes Feld (Text auf der Leinwand): ersetzt die Markierung wie getippt
  await name(page).press('Enter');
  const ta = await editText(page);
  await ta.press('ControlOrMeta+A');
  const b = (await ta.boundingBox())!;
  await page.mouse.click(b.x + 10, b.y + b.height / 2, { button: 'right' });
  await item(page, 'Einfügen').click();
  await expect(ta).toHaveValue('Sommerlager 2026');
  await ta.press('Control+Enter');
  await expect(ta).toBeHidden();
  expect(await textOf(page)).toBe('Sommerlager 2026');
});

test('Einfügen ohne Berechtigung: Hinweis auf Strg + V, das Feld bleibt unverändert', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await page.evaluate(() => {
    navigator.clipboard.readText = () => Promise.reject(new DOMException('denied', 'NotAllowedError'));
  });
  await name(page).fill('Lager');
  await name(page).click({ button: 'right' });
  await item(page, 'Einfügen').click();
  await expect(page.getByText('Einfügen: drücke Strg + V.')).toBeVisible();
  await expect(name(page)).toHaveValue('Lager');
});

test('Ausschneiden im Feld; Schieberegler und Auswahlfelder behalten das Menü des Browsers', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await newProject(page, 'Post 4:5');
  await name(page).fill('abc');
  await name(page).selectText();
  await name(page).click({ button: 'right' });
  await item(page, 'Ausschneiden').click();
  await expect(name(page)).toHaveValue('');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('abc');
  // Felder ohne Text, im Editor eingesetzt: der Handler fängt das Ereignis nicht ab (das native Menü sieht der Test nicht)
  const native = await page.evaluate(() =>
    ['<select><option>a</option></select>', '<input type="range">', '<input type="file">', '<input type="checkbox">', '<input type="color">', '<input type="radio">'].map((html) => {
      const host = document.querySelector('.editor-header')!;
      host.insertAdjacentHTML('beforeend', html);
      const el = host.lastElementChild!;
      const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      el.dispatchEvent(e);
      el.remove();
      return e.defaultPrevented;
    }),
  );
  expect(native).toEqual([false, false, false, false, false, false]);
  await expect(menu(page)).toBeHidden();
});

test('Rechtsklick im Text-Bearbeitungsfeld der Leinwand: Bearbeiten bleibt aktiv, Markierung bleibt', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const ta = await editText(page);
  await ta.fill('Hallo Welt');
  await ta.evaluate((t: HTMLTextAreaElement) => t.setSelectionRange(0, 5));
  const box = (await ta.boundingBox())!;
  await page.mouse.click(box.x + 10, box.y + box.height / 2, { button: 'right' });
  await expect(menu(page)).toBeVisible();
  await expect(ta).toBeVisible(); // Menü öffnen beendet das Bearbeiten nicht
  await page.keyboard.press('Escape');
  await expect(menu(page)).toBeHidden();
  await expect(ta).toBeFocused();
  expect(await ta.evaluate((t: HTMLTextAreaElement) => [t.selectionStart, t.selectionEnd])).toEqual([0, 5]);
  await page.mouse.click(box.x + 10, box.y + box.height / 2, { button: 'right' });
  await item(page, 'Alles auswählen').click();
  await expect(ta).toBeFocused();
  expect(await ta.evaluate((t: HTMLTextAreaElement) => [t.selectionStart, t.selectionEnd])).toEqual([0, 10]);
  // Klick daneben beendet das Bearbeiten wie gewohnt
  await page.mouse.click(box.x + 10, box.y + box.height / 2, { button: 'right' });
  const c = await toScreen(page, 900, 1300);
  await page.mouse.click(c.x, c.y);
  await expect(ta).toBeHidden();
  expect(await textOf(page)).toBe('Hallo Welt');
});

const canUndo = async (page: Page) => (await page.locator('.editor-header').getByRole('button', { name: 'Rückgängig' }).getAttribute('aria-disabled')) !== 'true';

test('Menü öffnen übernimmt keinen Entwurf: geleerter Projektname, Einfügen ergibt nur den eingefügten Text, ohne Undo-Schritt', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await newProject(page, 'Post 4:5');
  expect(await canUndo(page)).toBe(false);
  await page.evaluate(() => navigator.clipboard.writeText('Neu'));
  await name(page).fill('');
  await name(page).click({ button: 'right' });
  await expect(menu(page)).toBeVisible();
  expect(await canUndo(page), 'Menü öffnen schreibt nichts').toBe(false);
  await item(page, 'Einfügen').click();
  await expect(name(page)).toHaveValue('Neu');
  // Entwurf tippen, Menü öffnen und mit Esc schliessen: weiterhin kein Undo-Schritt, Entwurf bleibt
  await name(page).fill('Entwurf');
  await name(page).click({ button: 'right' });
  await expect(menu(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(name(page)).toBeFocused();
  await expect(name(page)).toHaveValue('Entwurf');
  expect(await canUndo(page)).toBe(false);
  await name(page).press('Enter');
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.project().name)).toBe('Entwurf');
});

test('Zahlenfeld: Entwurf bleibt beim Öffnen des Menüs stehen, Einfügen fügt in den Entwurf ein', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await newProject(page, 'Post 4:5');
  await page.getByRole('button', { name: 'Text hinzufügen' }).click();
  const size = page.getByRole('spinbutton', { name: 'Grösse' });
  const before = await size.inputValue();
  await page.evaluate(() => navigator.clipboard.writeText('0'));
  await size.fill('1');
  await size.click({ button: 'right' });
  await expect(menu(page)).toBeVisible();
  await expect(size, 'nicht übernommen und begrenzt').toHaveValue('1');
  await item(page, 'Einfügen').click();
  // Zahlenfelder haben keine Auswahl-API: Edge setzt die Schreibmarke nach dem Zurückgeben des Fokus an den Anfang
  await expect(size).toHaveValue(/^(10|01)$/);
  expect(before).not.toMatch(/^(10|01)$/);
});

test('Menü ohne freien Eintrag (leeres, schreibgeschütztes Feld): Fokus im Menü, Esc schliesst', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await page.evaluate(() => document.querySelector('.editor-header')!.insertAdjacentHTML('beforeend', '<input id="ro" readonly aria-label="Nur lesen">'));
  await page.locator('#ro').click({ button: 'right' });
  await expect(menu(page)).toBeVisible();
  await expect(menu(page).locator('[role=menuitem]:not([aria-disabled=true])')).toHaveCount(0);
  await expect(menu(page)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu(page)).toBeHidden();
  await expect(page.locator('#ro')).toBeFocused();
});

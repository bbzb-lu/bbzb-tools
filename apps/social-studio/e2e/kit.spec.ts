import { expect, test, type Page } from '@playwright/test';
import { elements, newProject, openSection } from './fixtures';

async function addText(page: Page) {
  await newProject(page, 'Post 4:5');
  await page.getByRole('button', { name: 'Text hinzufügen' }).click();
  await expect.poll(() => elements(page)).toHaveLength(1);
}

test('Umschalter: Pfeiltaste wechselt die Wahl, Tab verlässt die Reihe', async ({ page }) => {
  await addText(page);
  const titel = page.getByRole('radio', { name: 'Titel' });
  await titel.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Kommentar' })).toBeChecked();
});

test('echte einklappbare Section: Tastatur, nicht tabbar wenn zu, Zustand überlebt Remount, openSection', async ({ page }) => {
  await page.goto('');
  await page.evaluate(() => window.__bbzbTest.mountSection(true));
  const head = page.getByRole('button', { name: 'Testabschnitt', exact: true });
  const inner = page.getByRole('textbox', { name: 'Innenfeld' });
  await expect(head).toHaveAttribute('aria-expanded', 'false');
  await expect(inner).toBeHidden();
  await head.focus();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))).not.toBe('Innenfeld'); // zugeklappt: nicht tabbar
  await head.focus();
  await page.keyboard.press('Enter');
  await expect(head).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Tab');
  await expect(inner).toBeFocused();
  await head.focus();
  await page.keyboard.press('Space');
  await expect(head).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Space');
  await expect(head).toHaveAttribute('aria-expanded', 'true');
  await page.evaluate(() => window.__bbzbTest.mountSection(false));
  await page.evaluate(() => window.__bbzbTest.mountSection(true));
  await expect(head).toHaveAttribute('aria-expanded', 'true'); // Remount: bleibt offen
  await openSection(page, 'Testabschnitt'); // offen: ohne Wirkung
  await head.click();
  await expect(head).toHaveAttribute('aria-expanded', 'false');
  await openSection(page, 'Testabschnitt');
  await expect(inner).toBeVisible();
});

test('Umschalter: Enter und Space auf einem Radio ändern die Wahl nicht, Space wählt', async ({ page }) => {
  await addText(page);
  const kommentar = page.getByRole('radio', { name: 'Kommentar' });
  await kommentar.focus();
  await page.keyboard.press('Enter');
  await expect(kommentar).not.toBeChecked(); // Radios kennen kein Enter
  await page.keyboard.press('Space');
  await expect(kommentar).toBeChecked();
});

test('Tastenschatten erzeugt bei 1280x720 und 1536x864 keine Scrollbalken in den Panels', async ({ page }) => {
  for (const [w, h] of [[1280, 720], [1536, 864]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await addText(page);
    const over = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.inspector, .side, .slide-list, .slidebar, .library-panel')]
        .filter((e) => getComputedStyle(e).overflowX !== 'visible' && e.scrollWidth > e.clientWidth)
        .map((e) => e.className),
    );
    expect(over, `${w}x${h}`).toEqual([]);
  }
});

test('Schatten nur an Tasten: Reiter, Abschnittsleiste, Kacheln und Menüeinträge bekommen auch beim Hover keinen', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const shadow = async (loc: import('@playwright/test').Locator) => {
    await loc.hover();
    return loc.evaluate((e) => getComputedStyle(e).boxShadow);
  };
  const add = page.getByRole('button', { name: 'Slide hinzufügen', exact: true });
  expect(await shadow(add)).not.toBe('none'); // eine Taste hebt sich beim Hover ab
  for (const loc of [
    page.getByRole('tab', { name: 'Ebenen' }),
    page.getByRole('tab', { name: 'Icons' }),
    page.getByRole('button', { name: 'Hintergrund', exact: true }),
    page.getByRole('button', { name: 'Scribble 1' }).first(),
  ]) expect(await shadow(loc)).toBe('none');
  await page.getByRole('button', { name: 'Effekt hinzufügen' }).click();
  expect(await shadow(page.getByRole('menuitem').first())).toBe('none');
});

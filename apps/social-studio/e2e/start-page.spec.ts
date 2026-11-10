import { expect, test, type Page } from '@playwright/test';
import { newProject } from './fixtures';

test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

const shown = (page: Page) => page.locator('.tooltip').evaluate((e) => e.matches(':popover-open'));

/** n Projekte anlegen; das erste heisst `first`. Endet auf der Startseite. */
async function projects(page: Page, names: string[]) {
  for (const [i, name] of names.entries()) {
    await newProject(page, i % 2 ? 'Story 9:16' : 'Post 4:5');
    await page.getByLabel('Projektname').fill(name);
    await page.getByLabel('Projektname').press('Enter');
    await page.getByRole('button', { name: 'Übersicht' }).click();
  }
  await expect(page.getByRole('listitem')).toHaveCount(names.length);
}

test('Format-Knöpfe heissen «… anlegen»', async ({ page }) => {
  await page.goto('');
  await expect(page.getByRole('button', { name: 'Post 4:5 anlegen', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Story 9:16 anlegen', exact: true })).toBeVisible();
});

test('Projektzeile: Öffnen mit Icon und Text, Icon-Aktionen mit Namen und Tooltip, kein Überlauf bei 1280 px', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await projects(page, ['Sporttag', 'Ein sehr langer Projektname für die Berufsmesse im Herbst mit Lernenden aus allen Abteilungen']);
  const row = page.getByRole('listitem').filter({ hasText: 'Sporttag' });
  const open = row.getByRole('button', { name: '«Sporttag» öffnen', exact: true });
  await expect(open).toHaveText('Öffnen');
  await expect(open.locator('.tabler-icon')).toHaveCount(1);
  for (const [name, tip] of [
    ['«Sporttag» duplizieren', 'Duplizieren'],
    ['«Sporttag» als Story kopieren', 'Als Story kopieren'],
    ['«Sporttag» löschen', 'Löschen'],
  ] as const) {
    const b = row.getByRole('button', { name, exact: true });
    await expect(b).toHaveText('');
    await expect(b.locator('.tabler-icon')).toHaveCount(1);
    await expect(b).toHaveAttribute('data-tip', tip);
    expect(await b.evaluate((e) => e.getAttribute('title'))).toBeNull();
  }
  await row.getByRole('button', { name: '«Sporttag» duplizieren', exact: true }).hover();
  await expect.poll(() => shown(page)).toBe(true);
  await expect(page.locator('.tooltip')).toContainText('Duplizieren');
  const overflow = await page.evaluate(() => [
    document.documentElement.scrollWidth - innerWidth,
    ...[...document.querySelectorAll('.project-list li')].map((li) => li.scrollWidth - li.clientWidth),
  ]);
  expect(overflow.every((d) => d <= 0), JSON.stringify(overflow)).toBe(true);
  // Aktionen bleiben bei langem Namen im Fenster
  for (const b of await page.locator('.row-actions button').all()) {
    const r = (await b.boundingBox())!;
    expect(r.x + r.width).toBeLessThanOrEqual(1280);
  }
});

test('Löschen-Dialog fragt weiter nach, Abbrechen behält das Projekt', async ({ page }) => {
  await projects(page, ['Weg damit']);
  await page.getByRole('button', { name: '«Weg damit» löschen', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('«Weg damit» löschen?');
  await dialog.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page.getByRole('listitem')).toHaveCount(1);
});

test('Startseite ist beim Anlegen gesperrt: Datei, Formate und Zeilenaktionen sind aria-disabled und tun nichts', async ({ page }) => {
  await projects(page, ['Alt']);
  const r = await page.evaluate(async () => {
    let fileClicks = 0;
    const orig = HTMLInputElement.prototype.click;
    HTMLInputElement.prototype.click = function (this: HTMLInputElement) {
      if (this.type === 'file') fileClicks++;
      else orig.call(this);
    };
    const btn = (n: string) => [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === n || b.textContent!.trim() === n)!;
    btn('Post 4:5 anlegen').click();
    for (let i = 0; i < 5; i++) await Promise.resolve(); // React rendert in Mikrotasks, das Speichern (IndexedDB) läuft noch
    const names = ['Projektdatei öffnen', 'Post 4:5 anlegen', 'Story 9:16 anlegen', '«Alt» öffnen', '«Alt» duplizieren', '«Alt» als Story kopieren', '«Alt» löschen'];
    const disabled = names.map((n) => [n, btn(n).getAttribute('aria-disabled')]);
    for (const n of names) btn(n).click();
    return { disabled, fileClicks, dialogOpen: !!document.querySelector('dialog[open]') };
  });
  expect(r.disabled.filter(([, v]) => v !== 'true')).toEqual([]);
  expect(r.fileClicks).toBe(0);
  expect(r.dialogOpen).toBe(false);
  await expect(page.getByLabel('Projektname')).toBeVisible();
  await page.getByRole('button', { name: 'Übersicht' }).click();
  await expect(page.getByRole('listitem')).toHaveCount(2); // Alt + das neue, keine Kopie
});

test('Meldungsleiste: Schliessen ist ein X-Icon mit Namen', async ({ page }) => {
  await projects(page, ['Alt']);
  await page.getByRole('button', { name: '«Alt» als Story kopieren', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('ist angelegt');
  const close = page.locator('.notice').getByRole('button', { name: 'Schliessen', exact: true });
  await expect(close).toHaveText('');
  await expect(close.locator('.tabler-icon')).toHaveCount(1);
  await expect(close).toHaveAttribute('data-tip', 'Schliessen');
  await close.click();
  await expect(page.locator('.notice')).toHaveCount(0);
});

test('Esc im Projektnamen: setzt den Entwurf zurück und nimmt den Fokus, der zweite Esc hebt die Auswahl auf', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await page.getByRole('button', { name: 'Text hinzufügen' }).click();
  const id = (await page.evaluate(() => window.__bbzbTest.selected()))!;
  expect(id).toBeTruthy();
  const name = page.getByLabel('Projektname');
  const before = await name.inputValue();
  await name.fill('Verworfen');
  await page.keyboard.press('Escape');
  await expect(name).toHaveValue(before);
  await expect(name).not.toBeFocused();
  expect(await page.evaluate(() => window.__bbzbTest.project().name)).toBe(before); // der Entwurf wurde nicht übernommen
  expect(await page.evaluate(() => window.__bbzbTest.selected())).toBe(id);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => window.__bbzbTest.selected())).toBeNull();
});

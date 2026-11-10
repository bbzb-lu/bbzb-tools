import { expect, test, type Page } from '@playwright/test';
import { elements, newProject, toScreen } from './fixtures';

const shots = '.superpowers/sdd/2026-10-26-phase-2-7-tabler-icons/screens';
const library = (page: Page) => page.getByRole('complementary', { name: 'Bibliothek' });
const search = (page: Page) => library(page).getByRole('searchbox', { name: 'Icons suchen' });
const tiles = (page: Page) => library(page).locator('.library-grid .library-tile');
const status = (page: Page) => library(page).getByRole('status');

async function openIcons(page: Page) {
  await newProject(page, 'Post 4:5');
  await library(page).getByRole('tab', { name: 'Icons' }).click();
}

test('Suche: Hinweis, Treffer, Gross und Leerzeichen, Meldung ohne Treffer, Leeren zeigt Markenicons', async ({ page }) => {
  await openIcons(page);
  await expect(tiles(page)).toHaveCount(5);
  await expect(search(page)).toHaveAttribute('placeholder', 'Icon suchen…');
  await expect(library(page).getByText('Suche auf Englisch, z. B. home, arrow, camera.')).toBeVisible();

  await search(page).fill('home');
  await expect(library(page).getByRole('button', { name: 'home', exact: true })).toBeVisible();
  const n = await tiles(page).count();
  expect(n).toBeGreaterThan(0);
  await expect(status(page)).toHaveText(`${n} Treffer`);
  await expect(library(page).locator('.library-grid img').first()).toBeVisible();
  await library(page).screenshot({ path: `${shots}/task-3-suche-home.png`, animations: 'disabled' });

  await search(page).fill('Camera ');
  await expect(library(page).getByRole('button', { name: 'camera', exact: true })).toBeVisible();

  await search(page).fill('arrow');
  await expect.poll(() => tiles(page).count()).toBe(120);

  await search(page).fill('zzzzqq');
  await expect(tiles(page)).toHaveCount(0);
  await expect(status(page)).toHaveText('Keine Icons gefunden. Suche auf Englisch.');
  await library(page).screenshot({ path: `${shots}/task-3-keine-treffer.png`, animations: 'disabled' });

  await search(page).fill('');
  await expect(tiles(page)).toHaveCount(5);
  await expect(library(page).getByRole('button', { name: 'Velo', exact: true })).toBeVisible();
});

test('Klick und Enter fügen ein, der Fokus bleibt beim Tippen im Feld', async ({ page }) => {
  await openIcons(page);
  await search(page).click();
  await search(page).pressSequentially('home');
  await expect(search(page)).toBeFocused();
  await library(page).getByRole('button', { name: 'home', exact: true }).click();
  await expect.poll(() => elements(page)).toHaveLength(1);
  expect((await elements(page))[0]).toMatchObject({ type: 'brand', props: { brandId: 'tabler-home' } });

  await search(page).fill('camera');
  const cam = library(page).getByRole('button', { name: 'camera', exact: true });
  await cam.focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => elements(page)).toHaveLength(2);
  expect(((await elements(page))[1]!.props as { brandId: string }).brandId).toBe('tabler-camera');
});

test('Ziehen eines nie eingefügten Treffers auf die Leinwand', async ({ page }) => {
  await openIcons(page);
  await search(page).fill('camera');
  const target = page.locator('.canvas-scroll');
  const box = (await target.boundingBox())!;
  const p = await toScreen(page, 600, 500);
  await library(page).getByRole('button', { name: 'camera', exact: true }).dragTo(target, { targetPosition: { x: p.x - box.x, y: p.y - box.y } });
  await expect.poll(() => elements(page)).toHaveLength(1);
  expect(((await elements(page))[0]!.props as { brandId: string }).brandId).toBe('tabler-camera');
});

test('Icon-Datei wird erst nach Fokus auf das Suchfeld angefordert', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await openIcons(page);
  await page.waitForTimeout(300);
  expect(requests.filter((u) => /outline-/.test(u))).toEqual([]);
  await search(page).focus();
  await expect.poll(() => requests.filter((u) => /outline-/.test(u)).length).toBe(1);
});

test('Laden schlägt fehl: Meldung statt Treffer', async ({ page }) => {
  await page.route('**/outline-*.js', (r) => r.abort());
  await openIcons(page);
  await search(page).fill('home');
  await expect(status(page)).toHaveText('Die Icons konnten nicht geladen werden. Lade die Seite neu.');
});

test('Der letzte Suchbegriff gewinnt', async ({ page }) => {
  await openIcons(page);
  await search(page).fill('home');
  await search(page).fill('camera');
  await expect(library(page).getByRole('button', { name: 'camera', exact: true })).toBeVisible();
  await expect(library(page).getByRole('button', { name: 'home', exact: true })).toHaveCount(0);
  await page.waitForTimeout(400);
  await expect(library(page).getByRole('button', { name: 'home', exact: true })).toHaveCount(0);
});

test('Vorschauen der Treffer warten nicht auf die Scribble-Warteschlange', async ({ page }) => {
  await page.route(/scribble.*\.png/i, async (r) => {
    await new Promise((res) => setTimeout(res, 400));
    await r.continue();
  });
  await newProject(page, 'Post 4:5'); // Tab Scribbles ist offen, seine PNG-Vorschauen stehen in der Warteschlange
  await library(page).getByRole('tab', { name: 'Icons' }).click();
  await search(page).fill('home');
  await expect(library(page).locator('.library-grid img').first()).toBeVisible({ timeout: 2000 });
});

test('Tabler-Hinweis mit Logo unter Markenicons und unter Treffern', async ({ page }) => {
  await openIcons(page);
  const link = library(page).getByRole('link', { name: /Icons von Tabler/ });
  for (const q of ['', 'home']) {
    await search(page).fill(q);
    if (q) await expect(library(page).getByRole('button', { name: 'home', exact: true })).toBeVisible();
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', 'https://tabler.io/icons');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(link).toContainText('(öffnet in neuem Tab)');
    expect(await link.locator('img').evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);
  }
  await library(page).screenshot({ path: '.superpowers/sdd/2026-10-27-phase-2-8-oberflaeche/screens/task-6-tabler.png', animations: 'disabled' });
});

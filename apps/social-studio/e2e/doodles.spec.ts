import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { colors } from '../src/tokens';
import { elements, exportPng, newProject } from './fixtures';

const library = (page: Page) => page.getByRole('complementary', { name: 'Bibliothek' });
const search = (page: Page) => library(page).getByRole('searchbox', { name: 'Doodles suchen' });
const tiles = (page: Page) => library(page).locator('.library-grid .library-tile');
const status = (page: Page) => library(page).getByRole('status');
const category = (page: Page) => library(page).getByRole('combobox', { name: 'Kategorie' });

const SHOTS = process.env.SHOTS;

async function openDoodles(page: Page) {
  await newProject(page, 'Post 4:5');
  await library(page).getByRole('tab', { name: 'Doodles' }).click();
}

test('Suche «bell», Klick fügt mittig ein, Export zeigt orange Linien ohne weisse Fläche', async ({ page }) => {
  await openDoodles(page);
  await expect(search(page)).toHaveAttribute('placeholder', 'Doodle suchen…');
  await search(page).fill('bell');
  await expect(tiles(page).first()).toBeVisible();
  expect(await tiles(page).count()).toBeGreaterThan(0);
  await expect(library(page).locator('.library-grid img').first()).toBeVisible();
  if (SHOTS) await library(page).screenshot({ path: `${SHOTS}/task-2-bell.png`, animations: 'disabled' });
  await tiles(page).first().click();
  await expect.poll(() => elements(page)).toHaveLength(1);
  const [el] = await elements(page);
  expect(el).toMatchObject({ type: 'brand', props: { brandId: expect.stringMatching(/^doodle-/) } });
  expect([el!.x + el!.width / 2, el!.y + el!.height / 2]).toEqual([540, 675]);
  expect((el!.props as { color?: string }).color ?? 'akzent').toBe('akzent');
  const [png] = await exportPng(page);
  const c = [1, 3, 5].map((i) => parseInt(colors.orange.slice(i, i + 2), 16));
  let orange = 0;
  let white = 0;
  for (let i = 0; i < png!.width * png!.height; i++) {
    const p = [0, 1, 2].map((k) => png!.data[i * 4 + k]!);
    if (c.every((v, k) => Math.abs(p[k]! - v) <= 6)) orange++;
    if (p.every((v) => v === 255)) white++;
  }
  expect(orange).toBeGreaterThan(500);
  expect(orange).toBeLessThan(0.4 * el!.width * el!.height); // eine Hintergrundfläche (volles Quadrat) fiele durch
  expect(white).toBe(0); // schwach: Warmweiss ist nicht reinweiss, die Obergrenze oben fängt Flächen

});

test('Kategorien auf Deutsch; eine gewählte Kategorie zeigt alles, «Alle» höchstens 120 mit Hinweis', async ({ page }) => {
  await openDoodles(page);
  await expect(tiles(page)).toHaveCount(120);
  await expect(status(page)).toHaveText('Zeigt 120 von 427. Grenze die Suche ein.');
  if (SHOTS) await library(page).screenshot({ path: `${SHOTS}/task-2-alle.png`, animations: 'disabled' });
  expect(await category(page).locator('option').allTextContents()).toEqual([
    'Alle Kategorien', 'Pfeile', 'Währungen', 'Onlinehandel', 'Emojis', 'Finanzen', 'Essen', 'Geschlechtersymbole',
    'Handgesten', 'Gesundheit', 'Oberfläche', 'Logos', 'Verschiedenes', 'Gegenstände', 'Wetter',
  ]);
  await category(page).selectOption({ label: 'Essen' });
  await expect.poll(() => tiles(page).count()).toBe(14);
  for (const l of await tiles(page).evaluateAll((ts) => ts.map((t) => t.getAttribute('aria-label')))) expect(l).toMatch(/^food-/);
  await expect(status(page)).toHaveText('14 Treffer');
  await category(page).selectOption({ label: 'Oberfläche' });
  await expect(tiles(page)).toHaveCount(177);
  await expect(status(page)).toHaveText('177 Treffer');
  await search(page).fill('zzzzqq');
  await expect(tiles(page)).toHaveCount(0);
  await expect(status(page)).toHaveText('Keine Doodles in dieser Kategorie gefunden.');
  await category(page).selectOption({ label: 'Alle Kategorien' });
  await expect(status(page)).toHaveText('Keine Doodles gefunden. Suche auf Englisch.');
});

test('Doodle im Editor und im Export deckungsgleich', async ({ page }) => {
  await openDoodles(page);
  await search(page).fill('bell');
  await tiles(page).first().click();
  await expect.poll(() => elements(page)).toHaveLength(1);
  const [el] = await elements(page);
  // Der Knoten zeichnet im Massstab der Leinwand: auf die Elementgrösse in Slide-Pixeln skalieren
  const dataUrl = await page.evaluate(({ id, w }) => {
    const n = (window as unknown as { Konva: typeof import('konva').default }).Konva.stages[0]!.findOne(`#${id}`)!;
    return n.toDataURL({ pixelRatio: w / n.getClientRect().width });
  }, { id: el!.id, w: el!.width });
  const editor = PNG.sync.read(Buffer.from(dataUrl.split(',')[1]!, 'base64'));
  const [out] = await exportPng(page);
  const c = [1, 3, 5].map((i) => parseInt(colors.orange.slice(i, i + 2), 16));
  const isOrange = (d: Buffer, i: number) => d[i + 3]! > 200 && c.every((v, k) => Math.abs(d[i + k]! - v) <= 6);
  let e = 0;
  for (let i = 0; i < editor.data.length; i += 4) if (isOrange(editor.data, i)) e++;
  let x = 0;
  for (let yy = Math.round(el!.y); yy < el!.y + el!.height; yy++)
    for (let xx = Math.round(el!.x); xx < el!.x + el!.width; xx++) if (isOrange(out!.data, (yy * out!.width + xx) * 4)) x++;
  expect(e).toBeGreaterThan(500);
  expect(Math.abs(e - x) / e).toBeLessThan(0.03);
});

test('Projekt mit Doodle: speichern, neu laden, öffnen, Doodle sichtbar', async ({ page }) => {
  await openDoodles(page);
  await search(page).fill('bell');
  await tiles(page).first().click();
  await expect.poll(() => elements(page)).toHaveLength(1);
  await page.getByLabel('Projektname').fill('Mit Doodle');
  await page.getByLabel('Projektname').press('Enter');
  await page.reload();
  await page.getByRole('button', { name: '«Mit Doodle» öffnen', exact: true }).click();
  await expect(page.getByLabel('Projektname')).toHaveValue('Mit Doodle');
  await expect.poll(() => elements(page)).toHaveLength(1);
  await expect(page.getByRole('alert')).toHaveCount(0);
  const [png] = await exportPng(page);
  const c = [1, 3, 5].map((i) => parseInt(colors.orange.slice(i, i + 2), 16));
  let n = 0;
  for (let i = 0; i < png!.width * png!.height; i++) if (c.every((v, k) => Math.abs(png!.data[i * 4 + k]! - v) <= 6)) n++;
  expect(n).toBeGreaterThan(500);
});

test('Hinweis «Doodles von Khushmeen» und kein Fremd-Request', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await openDoodles(page);
  const link = library(page).getByRole('link', { name: /Doodles von Khushmeen/ });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', 'https://khushmeen.com/');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(link).toContainText('(öffnet in neuem Tab)');
  await expect(link.locator('img')).toHaveCount(0);
  await expect(tiles(page).first()).toBeVisible();
  const origin = new URL(page.url()).origin;
  expect(requests.filter((u) => /^https?:/.test(u) && !u.startsWith(origin))).toEqual([]);
});

test('Laden schlägt fehl: Meldung statt Treffer', async ({ page }) => {
  await page.route('**/doodles-*.js', (r) => r.abort());
  await openDoodles(page);
  await expect(status(page)).toHaveText('Die Doodles konnten nicht geladen werden. Lade die Seite neu.');
});

test('Ein eingefügtes Doodle taucht nicht im Tab «Icons» auf (nur die 5 Markenicons)', async ({ page }) => {
  await openDoodles(page);
  await search(page).fill('bell');
  await tiles(page).first().click();
  await expect.poll(() => elements(page)).toHaveLength(1);
  await library(page).getByRole('tab', { name: 'Icons' }).click();
  await expect(library(page).locator('.library-icon .library-tile')).toHaveCount(5);
});

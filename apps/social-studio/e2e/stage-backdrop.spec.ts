import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { theme } from '../src/ui/theme';
import { colors } from '../src/tokens';
import { exportPng, frames, newProject, toScreen } from './fixtures';

// Screenshots nur auf Wunsch (SHOTS=Ordner), ein normaler Lauf schreibt nichts in den Checkout
const SHOTS = process.env.SHOTS;
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const near = (a: number[], b: number[], tol = 3) => a.every((v, i) => Math.abs(v - b[i]!) <= tol);
const screenPx = async (page: Page, x: number, y: number) => {
  const p = PNG.sync.read(await page.screenshot({ clip: { x: Math.floor(x), y: Math.floor(y), width: 1, height: 1 } }));
  return [...p.data.subarray(0, 3)];
};
const backdropBtn = (page: Page) => page.getByRole('button', { name: /^Unterlage/ });
async function chooseBackdrop(page: Page, name: string) {
  await backdropBtn(page).click();
  const pop = page.getByRole('dialog', { name: 'Unterlage' });
  await expect(pop).toBeVisible();
  await pop.getByRole('radio', { name }).check();
  await page.keyboard.press('Escape');
  await expect(pop).toBeHidden();
}

test('Unterlage: färbt nur den Tisch um die Slides, Slide bleibt, Wahl bleibt nach Neuladen, Standard Grau', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await page.evaluate(() => localStorage.removeItem('social-studio.unterlage'));
  await expect(backdropBtn(page)).toHaveAccessibleName('Unterlage: Grau');
  await expect(backdropBtn(page)).toHaveAccessibleDescription(/nicht in den Export/);
  await frames(page);
  const canvas = (await page.locator('.canvas-scroll').boundingBox())!;
  const table = { x: canvas.x + 4, y: canvas.y + 4 }; // Ecke der Arbeitsfläche, ausserhalb der Slide
  const slide = await toScreen(page, 540, 675);
  expect(await screenPx(page, table.x, table.y)).toEqual(rgb(theme['unterlage-grau']));
  const slideColour = await screenPx(page, slide.x, slide.y);

  await chooseBackdrop(page, 'Dunkel');
  await expect(backdropBtn(page)).toHaveAccessibleName('Unterlage: Dunkel');
  await frames(page);
  expect(await screenPx(page, table.x, table.y)).toEqual(rgb(theme['unterlage-dunkel']));
  expect(await screenPx(page, slide.x, slide.y)).toEqual(slideColour);
  // Kopf, Fach und Leiste bleiben auf dem Tisch
  for (const sel of ['.editor-header', '.left-panel', '.slidebar'])
    expect(await page.locator(sel).evaluate((e) => getComputedStyle(e).backgroundColor), sel).toBe(`rgb(${rgb(theme.table).join(', ')})`);
  if (SHOTS) {
    await page.setViewportSize({ width: 1536, height: 864 });
    await page.screenshot({ path: `${SHOTS}/task-9-1536-dunkel.png` });
  }

  await newProject(page, 'Post 4:5'); // lädt die Seite neu
  await expect(backdropBtn(page)).toHaveAccessibleName('Unterlage: Dunkel');
  expect(await page.evaluate(() => localStorage.getItem('social-studio.unterlage'))).toBe('dunkel');
});

test('Unterlage-Popover: vier Farben als Radiogruppe, Pfeiltasten wählen', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await backdropBtn(page).click();
  const pop = page.getByRole('dialog', { name: 'Unterlage' });
  await expect(pop.getByRole('radio')).toHaveCount(4);
  await expect(pop.getByRole('group', { name: 'Unterlage, nur Ansicht' })).toBeVisible();
  await expect(pop.getByRole('radio', { name: 'Grau' })).toBeChecked();
  // Popover verdeckt den Knopf nicht und liegt im Fenster
  const [pb, bb] = await Promise.all([pop.boundingBox(), backdropBtn(page).boundingBox()]);
  expect(pb!.y + pb!.height).toBeLessThanOrEqual(bb!.y);
  expect(pb!.x + pb!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await pop.getByRole('radio', { name: 'Grau' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(pop.getByRole('radio', { name: 'Dunkel' })).toBeChecked();
  await expect(backdropBtn(page)).toHaveAccessibleName('Unterlage: Dunkel');
});

test('Slide-Kante: Haarlinie nur in der Ansicht, auf jeder Unterlage sichtbar, nie im Export; Export gleich bei jeder Unterlage', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  expect(await page.evaluate(() => window.__bbzbTest.layerNames())).toContain('slide-edge');
  const before = await exportPng(page);
  for (const [name, key] of [['Grau', 'unterlage-grau'], ['Dunkel', 'unterlage-dunkel'], ['Grün', 'unterlage-gruen'], ['Blau', 'unterlage-blau']] as const) {
    await chooseBackdrop(page, name);
    await frames(page);
    const left = await toScreen(page, 0, 675);
    const top = await toScreen(page, 540, 0);
    const table = rgb(theme[key]);
    // Pixel direkt ausserhalb der Kante: weder Unterlage noch Slide, sondern die Linie
    for (const [x, y] of [[left.x - 1, left.y], [top.x, top.y - 1]] as const) {
      const p = await screenPx(page, x, y);
      expect(near(p, table, 20), `${name}: Kante ${p} vs. Unterlage ${table}`).toBe(false);
    }
    // eine Bildschirmspalte weiter aussen wieder die Unterlage
    const out = await screenPx(page, left.x - 4, left.y);
    expect(near(out, table), `${name}: ${out} ${table} ${JSON.stringify(left)}`).toBe(true);
  }
  // Mit Unterlage Blau exakt derselbe Export wie mit Grau, die Ecke trägt die Slide-Farbe (keine Linie)
  const after = await exportPng(page);
  expect(after.length).toBe(before.length);
  after.forEach((p, i) => expect(p.data.equals(before[i]!.data), `Slide ${i + 1}`).toBe(true));
  const bg = await page.evaluate(() => window.__bbzbTest.project().slides[0]!.background);
  expect([...after[0]!.data.subarray(0, 3)]).toEqual(rgb(colors[bg as keyof typeof colors]));
});

for (const size of [{ width: 1280, height: 720 }, { width: 1536, height: 864 }]) {
  test(`${size.width} px: Ansicht in der Slide-Leiste, kein Werkzeug über der Leinwand, Zoom per Knopf und Strg+0`, async ({ page }) => {
    await page.setViewportSize(size);
    await newProject(page, 'Post 4:5');
    const bar = page.locator('.slidebar');
    const group = bar.getByRole('group', { name: 'Zoom' });
    await expect(group).toBeVisible();
    for (const n of ['Sicherheitszonen', 'Verkleinern', 'Vergrössern', 'Einpassen']) await expect(bar.getByRole('button', { name: n })).toBeVisible();
    await expect(page.locator('.canvas').getByRole('button')).toHaveCount(0);
    const [canvas, b] = await Promise.all([page.locator('.canvas-scroll').boundingBox(), bar.boundingBox()]);
    expect(canvas!.y + canvas!.height).toBeLessThanOrEqual(b!.y + 1);
    await group.getByRole('button', { name: 'Vergrössern' }).click();
    await expect(page.locator('.zoom-value')).toHaveText('125 %');
    await page.locator('.canvas-scroll').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Control+0');
    await expect(page.locator('.zoom-value')).toHaveText('100 %');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
}

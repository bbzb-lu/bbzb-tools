import { expect, test, type Page } from '@playwright/test';
import { addSlide, newProject } from './fixtures';
import { LIMIT_TEXT } from '../src/model/slides';

// Screenshots nur auf Wunsch (SHOTS=Ordner), ein normaler Lauf schreibt nichts in den Checkout
const SHOTS = process.env.SHOTS;
const shot = (page: Page, name: string) => (SHOTS ? page.screenshot({ path: `${SHOTS}/${name}` }) : undefined);
const tiles = (page: Page) => page.getByRole('list', { name: 'Slides' }).getByRole('button');
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const tip = (page: Page) => page.locator('.tooltip');

/** Leer, Panorama (2 und 3), vier weitere Leere: 6 Slides wie im Befund von Task 3. */
async function sixSlides(page: Page) {
  await newProject(page, 'Post 4:5');
  await addSlide(page, 'Panorama');
  for (let i = 0; i < 3; i++) await addSlide(page);
  await expect(tiles(page)).toHaveCount(6);
}
const inside = (b: { x: number; width: number }, list: { x: number; width: number }) => b.x >= list.x - 0.5 && b.x + b.width <= list.x + list.width + 0.5;

for (const size of [{ width: 1280, height: 720 }, { width: 1536, height: 864 }]) {
  test(`${size.width} px: mindestens vier Kacheln und das aktuelle Panorama-Paar ganz sichtbar, Paar erkennbar`, async ({ page }) => {
    await page.setViewportSize(size);
    await sixSlides(page);
    await tiles(page).nth(1).click();
    await page.evaluate(() => document.querySelector('.slide-list')!.scrollTo(0, 0));
    await tiles(page).nth(2).click(); // rechte Hälfte: die ganze Gruppe muss ins Bild
    const list = (await page.getByRole('list', { name: 'Slides' }).boundingBox())!;
    let visible = 0;
    for (const t of await tiles(page).all()) if (inside((await t.boundingBox())!, list)) visible++;
    expect(visible).toBe(6);
    const act0 = (await page.locator('.slidebar-actions').boundingBox())!;
    expect(act0.y).toBeLessThan(list.y + list.height); // Aktionen in derselben Zeile (seit Task 10 auch bei 1280 px)
    for (const n of [1, 2]) expect(inside((await tiles(page).nth(n).boundingBox())!, list)).toBe(true);
    await expect(page.locator('.slide-list li').nth(1)).toHaveAttribute('data-link', 'start');
    await expect(page.locator('.slide-list li').nth(2)).toHaveAttribute('data-link', 'end');
    const [a, b] = await Promise.all([tiles(page).nth(1).boundingBox(), tiles(page).nth(2).boundingBox()]);
    expect(b!.x - (a!.x + a!.width)).toBeLessThanOrEqual(1); // Paar ohne Lücke
    const act = (await page.locator('.slidebar-actions').boundingBox())!;
    expect(act.x + act.width).toBeLessThanOrEqual(size.width);
    await shot(page, `task-4-${size.width}-panorama.png`);
  });
}

test('Namen bleiben, Löschen zeigt Icon und Wort, keine Verschieben-Knöpfe, Kacheln haben Tooltips statt title', async ({ page }) => {
  await sixSlides(page);
  await tiles(page).nth(1).click();
  for (const n of ['2 Slides duplizieren', '2 Slides löschen', 'Slide hinzufügen']) await expect(button(page, n)).toBeVisible();
  const del = button(page, '2 Slides löschen');
  await expect(del.locator('.tabler-icon')).toHaveCount(1);
  await expect(del).toContainText('2 Slides löschen');
  await expect(button(page, '2 Slides duplizieren')).toHaveText('');
  await expect(page.locator('.slidebar [title]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /nach links|nach rechts/ })).toHaveCount(0);
  await tiles(page).nth(0).hover();
  await expect(tip(page)).toContainText('Ziehen oder Alt + Pfeiltaste verschiebt die Slide.');
});

for (const format of ['Post 4:5', 'Story 9:16'] as const)
  test(`Popover (${format}): «Leer» steht nicht allein in einer Zeile, der Ring der aktuellen Kachel bleibt in der Kachel`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await newProject(page, format);
    await button(page, 'Slide hinzufügen').click();
    const pop = page.getByRole('dialog', { name: 'Slide hinzufügen' });
    await expect(pop).toBeVisible();
    const rows = await pop.locator('.layout-grid li').evaluateAll((els) => {
      const m = new Map<number, number>();
      for (const e of els) m.set(Math.round(e.getBoundingClientRect().top), (m.get(Math.round(e.getBoundingClientRect().top)) ?? 0) + 1);
      return [...m.values()];
    });
    expect(rows.at(-1)).toBeGreaterThan(1);
    const [pb, ab] = await Promise.all([pop.boundingBox(), button(page, 'Slide hinzufügen').boundingBox()]);
    expect(pb!.y + pb!.height).toBeLessThanOrEqual(ab!.y); // Popover verdeckt den Knopf nicht
    if (format === 'Post 4:5') await shot(page, 'task-4-1280-popover.png');
    await page.keyboard.press('Escape');
    // Aussenkante eines Umrisses (Breite + Versatz) liegt nicht ausserhalb der Kachel; seit 4c ist die aktuelle Kachel invers, ohne Umriss
    const out = await tiles(page).first().evaluate((e) => {
      const c = getComputedStyle(e);
      return c.outlineStyle === 'none' ? 0 : parseFloat(c.outlineWidth) + parseFloat(c.outlineOffset);
    });
    expect(out).toBeLessThanOrEqual(0);
  });

test('Panorama-Paar bleibt bei vielen Slides ganz in der Liste, auch nach Scrollen', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await newProject(page, 'Post 4:5');
  await addSlide(page, 'Panorama');
  for (let i = 0; i < 11; i++) await addSlide(page);
  await expect(tiles(page)).toHaveCount(14);
  const listEl = page.getByRole('list', { name: 'Slides' });
  expect(await listEl.evaluate((e) => e.scrollWidth > e.clientWidth)).toBe(true); // wirklich übervoll
  // Klicks per DOM, damit nicht Playwright die Kachel ins Bild scrollt: das muss die App selbst tun
  const click = (n: number) => tiles(page).nth(n).evaluate((e) => (e as HTMLElement).click());
  await click(13); // ganz nach rechts
  await expect(tiles(page).nth(13)).toHaveAttribute('aria-current', 'true');
  await click(2); // rechte Hälfte des Paars: beide Hälften müssen zurück ins Bild
  const list = (await listEl.boundingBox())!;
  for (const n of [1, 2]) expect(inside((await tiles(page).nth(n).boundingBox())!, list), `Kachel ${n + 1}`).toBe(true);
});

test('bei 20 Slides zeigen gesperrtes «Slide hinzufügen» und «Duplizieren» den Hinweis als Tooltip', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  for (let i = 0; i < 19; i++) await addSlide(page);
  await expect(tiles(page)).toHaveCount(20);
  for (const name of ['Slide hinzufügen', 'Slide duplizieren']) {
    const b = button(page, name);
    await expect(b).toBeDisabled();
    await b.hover();
    await expect.poll(() => tip(page).evaluate((e) => e.matches(':popover-open'))).toBe(true);
    await expect(tip(page)).toContainText(LIMIT_TEXT);
    await page.mouse.move(5, 400);
    await expect.poll(() => tip(page).evaluate((e) => e.matches(':popover-open'))).toBe(false);
  }
});

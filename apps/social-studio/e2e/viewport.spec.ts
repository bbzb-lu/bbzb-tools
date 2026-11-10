import { expect, test, type Page } from '@playwright/test';
import { addPhoto, addSlide, elements, frames, newProject, png } from './fixtures';

/** Ziel Full HD mit 125 % und kleinstes Gerät: alles sichtbar, nichts scrollt waagrecht (Befund Alexej 2b). */
const sizes = [
  { width: 1536, height: 864 },
  { width: 1366, height: 768 }, // häufiges Laptop-Format, liegt im Bereich, in dem das Logo erscheint
  { width: 1280, height: 720 },
];
// Echte Bildlaufleisten wie unter Windows (17 px): Playwright blendet sie sonst mit --hide-scrollbars aus.
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });
const panels = ['.editor-header', '.library', '.library-panel', '.inspector', '.layers', '.layer-list', '.slidebar', '.view-tools'];

async function expectFits(page: Page, what: string) {
  await frames(page);
  const r = await page.evaluate((sel) => {
    const out: string[] = [];
    const doc = document.documentElement;
    if (doc.scrollWidth > innerWidth) out.push(`Seite ${doc.scrollWidth} > ${innerWidth}`);
    for (const s of sel)
      for (const el of document.querySelectorAll(s)) if (el.scrollWidth > el.clientWidth) out.push(`${s} ${el.scrollWidth} > ${el.clientWidth}`);
    return out;
  }, panels);
  expect(r, what).toEqual([]);
  // Slide-Leiste mit der Ansicht liegt unter der Leinwand, nie darüber
  const [canvas, bar] = await Promise.all([page.locator('.canvas-scroll').boundingBox(), page.locator('.slidebar').boundingBox()]);
  expect(canvas!.y + canvas!.height, what).toBeLessThanOrEqual(bar!.y + 1);
  const must = [
    ...(await page.locator('.editor-header :is(button, input):not(dialog *)').all()),
    page.getByRole('button', { name: 'Exportieren' }),
    page.locator('.zoom-bar'),
    page.getByRole('button', { name: 'Sicherheitszonen' }),
    page.getByRole('button', { name: /^Unterlage/ }),
    page.getByRole('button', { name: 'Slide hinzufügen', exact: true }),
  ];
  const vp = page.viewportSize()!;
  for (const l of must) {
    const b = (await l.boundingBox())!;
    expect(b, `${what}: ${await l.evaluate((e) => e.outerHTML.slice(0, 80))}`).not.toBeNull();
    expect(b.x >= 0 && b.y >= 0 && b.x + b.width <= vp.width && b.y + b.height <= vp.height, `${what}: ${await l.evaluate((e) => e.outerHTML.slice(0, 80))} ${JSON.stringify(b)}`).toBe(true);
  }
}

for (const size of sizes) {
  test(`${size.width} × ${size.height}: alles sichtbar, nichts scrollt waagrecht`, async ({ page }) => {
    await page.setViewportSize(size);
    await newProject(page, 'Post 4:5');
    await page.addStyleTag({ content: '::-webkit-scrollbar{width:17px;height:17px}' });
    await page.getByRole('button', { name: 'Text hinzufügen' }).click();
    await page.evaluate(() => window.__bbzbTest.insertTag('cta'));
    await page.evaluate(() => window.__bbzbTest.insertBrand('scribble-01'));
    await addPhoto(page, png(800, 600));
    await expect.poll(async () => (await elements(page)).length).toBe(4);
    const ids = (await elements(page)).map((e) => e.id);
    await page.evaluate(() => window.__bbzbTest.select(null as unknown as string));
    await expectFits(page, 'ohne Auswahl');
    for (const id of ids) {
      await page.evaluate((i) => window.__bbzbTest.select(i), id);
      const type = (await elements(page)).find((e) => e.id === id)!.type;
      await expectFits(page, `${type} gewählt`);
    }
  });
}

test('1280 × 720 mit 8 Slides: Slide-Leiste hat eine Zeile, nichts scrollt, nichts überlappt', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await newProject(page, 'Post 4:5');
  for (let i = 0; i < 7; i++) await addSlide(page);
  const tiles = page.getByRole('list', { name: 'Slides' }).getByRole('button');
  await expect(tiles).toHaveCount(8);
  await frames(page);
  const bar = (await page.locator('.slidebar').boundingBox())!;
  const tile = (await tiles.first().boundingBox())!;
  const pad = await page.locator('.slidebar').evaluate((e) => parseFloat(getComputedStyle(e).paddingTop) + parseFloat(getComputedStyle(e).paddingBottom));
  const listPad = await page.locator('.slide-list').evaluate((e) => parseFloat(getComputedStyle(e).paddingTop) + parseFloat(getComputedStyle(e).paddingBottom));
  const sbar = await page.locator('.slide-list').evaluate((e) => (e as HTMLElement).offsetHeight - e.clientHeight); // waagrechte Bildlaufleiste
  expect(bar.height).toBeLessThanOrEqual(tile.height + pad + listPad + sbar + 1);
  const list = (await page.locator('.slide-list').boundingBox())!;
  const act = (await page.locator('.slidebar-actions').boundingBox())!;
  expect(act.y).toBeLessThan(list.y + list.height); // Aktionen neben den Kacheln
  expect(list.x + list.width).toBeLessThanOrEqual(act.x + 1); // keine Überlappung
  expect(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight || document.documentElement.scrollWidth > innerWidth)).toBe(false);
  const name = (n: string) => page.getByRole('button', { name: n, exact: true });
  for (const n of ['Slide hinzufügen', 'Slide duplizieren', 'Slide löschen']) await expect(name(n)).toBeVisible();
  await page.setViewportSize({ width: 1536, height: 864 });
  await expect(name('Slide hinzufügen')).toContainText('Slide hinzufügen');
});

test('1280 × 720 mit 20 Slides: Kacheln scrollen, Leiste bleibt eine Zeile (mit Bildlaufleiste), Leinwand nicht verdeckt', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await newProject(page, 'Post 4:5');
  for (let i = 0; i < 19; i++) await addSlide(page);
  const list = page.locator('.slide-list');
  await expect(list.getByRole('button')).toHaveCount(20);
  await frames(page);
  expect(await list.evaluate((e) => e.scrollWidth > e.clientWidth)).toBe(true);
  const [bar, tile, canvas, act, lb] = await Promise.all([
    page.locator('.slidebar').boundingBox(),
    list.getByRole('button').first().boundingBox(),
    page.locator('.canvas-scroll').boundingBox(),
    page.locator('.slidebar-actions').boundingBox(),
    list.boundingBox(),
  ]);
  // Kachel + Polster der Leiste und der Liste (1.5 rem + 0.75 rem), dazu die Bildlaufleiste der Liste (höchstens 17 px, hier gemessen)
  const extra = await list.evaluate((e) => (e as HTMLElement).offsetHeight - e.clientHeight);
  expect(bar!.height).toBeLessThanOrEqual(tile!.height + 16 + 12 + extra + 1);
  expect(canvas!.y + canvas!.height).toBeLessThanOrEqual(bar!.y + 1); // Leinwand endet über der Leiste
  expect(act!.y).toBeLessThan(lb!.y + lb!.height);
  expect(lb!.x + lb!.width).toBeLessThanOrEqual(act!.x + 1);
  expect(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight || document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

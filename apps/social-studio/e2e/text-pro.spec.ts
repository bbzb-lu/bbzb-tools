import { expect, test, type Page } from '@playwright/test';
import { addSlide, elements, newProject, openLayers, overlayVsElement, toScreen } from './fixtures';

type Props = { style: string; lineHeight?: number; tracking?: number };
const first = async (page: Page) => (await elements(page))[0]!;
const props = async (page: Page) => (await first(page)).props as Props;

/** Bildschirmpunkt in der Mitte des ersten Elements. */
async function center(page: Page) {
  const e = await first(page);
  return toScreen(page, e.x + e.width / 2, e.y + e.height / 2);
}

async function addText(page: Page) {
  await newProject(page, 'Post 4:5');
  await page.getByRole('button', { name: 'Text hinzufügen' }).click();
  await expect.poll(() => elements(page)).toHaveLength(1);
}

test('Zeilenabstand und Laufweite immer sichtbar, Regler = ein Undo-Schritt', async ({ page }) => {
  await addText(page);
  const line = page.getByRole('slider', { name: 'Zeilenabstand' });
  const track = page.getByRole('slider', { name: 'Laufweite' });
  await expect(page.getByRole('slider', { name: 'Grösse' })).toBeVisible();
  // Standard = Stilwert
  await expect(line).toHaveValue('100');
  await expect(track).toHaveValue('-40'); // Wert = Stilwert + Abweichung, wie das Zahlenfeld es zeigt
  await expect(track).toHaveAttribute('aria-valuetext', '−40');
  const h0 = (await first(page)).height;

  await line.scrollIntoViewIfNeeded(); // bei kleinem Fenster liegt der Regler unter der Falz
  const box = (await line.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * 0.4, y); // ungefähr 100 %
  await page.mouse.down();
  // bis über das Bahnende (Task 14: Bahn über die ganze Panelbreite, 96 % der Breite reicht dort nicht mehr bis 130)
  for (let i = 1; i <= 8; i++) await page.mouse.move(box.x + box.width * (0.4 + i * 0.08), y);
  await page.mouse.up();
  await expect.poll(async () => (await props(page)).lineHeight).toBe(130);
  expect((await first(page)).height).toBeGreaterThan(h0); // Höhe neu gemessen
  await page.mouse.click(5, 5);
  await page.keyboard.press('Control+Z');
  await expect.poll(async () => (await props(page)).lineHeight ?? 100).toBe(100);
  expect((await first(page)).height).toBe(h0);

  // Tastatur auf der Laufweite: Pfeil = 1/1000 em
  const c = await center(page);
  await page.mouse.click(c.x, c.y);
  await track.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await props(page)).tracking).toBe(1);
  await expect(track).toHaveAttribute('aria-valuetext', '−39');
  // Stilwechsel setzt auf die Stilwerte zurück
  await page.getByText('Kommentar', { exact: true }).click();
  await expect.poll(() => props(page)).toMatchObject({ style: 'kommentar', tracking: undefined, lineHeight: undefined });
  await expect(track).toHaveAttribute('aria-valuetext', '−10');
});

for (const style of ['Titel', 'Kommentar'] as const) {
  test(`Textarea nimmt Zeilenabstand und Laufweite des Elements (${style})`, async ({ page }) => {
    await addText(page);
    if (style === 'Kommentar') await page.getByText('Kommentar', { exact: true }).click();
    const line = page.getByRole('slider', { name: 'Zeilenabstand' });
    await line.focus();
    await page.keyboard.press('End'); // 130 %
    await page.getByRole('slider', { name: 'Laufweite' }).focus();
    await page.keyboard.press('End'); // +20
    await expect.poll(() => props(page)).toMatchObject({ lineHeight: 130, tracking: 20 });
    // zweizeilig, damit der Zeilenabstand die Höhe bestimmt
    let c = await center(page);
    await page.mouse.dblclick(c.x, c.y);
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type('Eins\nZwei');
    await page.keyboard.press('Control+Enter');
    await expect(page.locator('textarea')).toHaveCount(0);
    c = await center(page);
    await page.mouse.dblclick(c.x, c.y);
    const { ta, el } = await overlayVsElement(page);
    for (const k of ['x', 'y', 'w', 'h'] as const) expect(Math.abs(ta[k] - el[k]), k).toBeLessThanOrEqual(1.5);
    const css = await page.locator('textarea').evaluate((t) => {
      const s = getComputedStyle(t);
      return { lig: s.fontVariantLigatures, ls: parseFloat(s.letterSpacing), lh: parseFloat(s.lineHeight), fs: parseFloat(s.fontSize) };
    });
    expect(css.lig).toBe('none');
    const st = style === 'Titel' ? { em: -0.04, lh: 0.86 } : { em: -0.01, lh: 76 / 66 };
    expect(css.ls / css.fs).toBeCloseTo(st.em + 0.02, 3);
    expect(css.lh / css.fs).toBeCloseTo(st.lh * 1.3, 2);
  });
}

test('Stilwechsel nimmt den automatischen Ebenennamen mit, ein eigener Name bleibt', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addSlide(page, 'Titel'); // Preset-Texte heissen «Titel» und «Kommentar»
  await openLayers(page);
  const layers = page.getByRole('list', { name: 'Ebenen' });
  const byRole = async (role: string) => (await elements(page)).find((e) => e.role === role)!;
  const k = await byRole('kommentar');
  await page.evaluate((i) => window.__bbzbTest.select(i), k.id);
  await page.getByLabel('Eigenschaften').getByText('Titel', { exact: true }).click();
  await expect.poll(async () => (await byRole('kommentar')).name).toBe('Titel');
  await expect(layers.getByText('Titel', { exact: true })).toHaveCount(2);
  // ein Undo-Schritt für Stil und Name
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await byRole('kommentar')).name).toBe('Kommentar');
  await expect.poll(async () => ((await byRole('kommentar')).props as Props).style).toBe('kommentar');
  // von Hand umbenannt: bleibt
  await page.evaluate(([i]) => window.__bbzbTest.patch(i as string, { name: 'Mein Titelblatt' }), [k.id]);
  await page.getByLabel('Eigenschaften').getByText('Titel', { exact: true }).click();
  await expect.poll(async () => ((await byRole('kommentar')).props as Props).style).toBe('titel');
  expect((await byRole('kommentar')).name).toBe('Mein Titelblatt');
});

test('Zahlenfeld Grösse: offener Entwurf gilt auch, wenn danach die leere Leinwand angeklickt wird', async ({ page }) => {
  await addText(page);
  await page.getByRole('spinbutton', { name: 'Grösse' }).fill('123'); // ohne Enter
  const o = await toScreen(page, 0, 0);
  await page.mouse.click(o.x + 16, o.y - 19); // Rand der Leinwand: hebt die Auswahl auf, Panel wird abgebaut
  await expect(page.getByRole('heading', { name: 'Slide 1' })).toBeVisible();
  await expect.poll(async () => ((await first(page)).props as { fontSize: number }).fontSize).toBe(123);
});

import { mkdir, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { openSlideLayouts, dropPng, elements, exportPng, frames, gradientPng, newProject, toScreen } from './fixtures';

const SHOTS = '.superpowers/sdd/2026-10-21-phase-2b-layouts-und-hilfen/screens';
// Verknüpfte Kacheln nennen ihre Gruppe («Slide 3, Panorama mit Slide 4»)
const tile = (page: Page, n: number) => page.getByRole('button', { name: new RegExp(`^Slide ${n}(,|$)`) });
type El = Awaited<ReturnType<typeof elements>>[number];
const empty = (e: El) => e.type === 'photo' && !('assetId' in (e.props as object));
const center = (e: El) => ({ x: e.x + e.width / 2, y: e.y + e.height / 2 });

/** Alle leeren Fotorahmen der Slide füllen: Slide anklicken, dann je ein erzeugtes Bild (kein Personenfoto) hineinziehen. */
async function fillSlide(page: Page, n: number) {
  await tile(page, n).click();
  const w = 1080;
  const frames_ = (await elements(page)).filter((e) => empty(e) && center(e).x > (n - 1) * w && center(e).x <= n * w);
  for (const [k, f] of frames_.entries()) {
    const before = (await elements(page)).filter(empty).length;
    const c = center(f);
    await dropPng(page, c.x, c.y, gradientPng(Math.round(f.width) + 200, Math.round(f.height) + 200, [255, 78 - k * 30, k * 60], [0, 159, 226]));
    await expect.poll(async () => (await elements(page)).filter(empty).length).toBe(before - 1);
  }
}

/** Text auf der Leinwand ersetzen, wie von Hand: Doppelklick, alles markieren, tippen, daneben klicken. */
async function editText(page: Page, role: string, text: string) {
  const t = (await elements(page)).find((e) => e.role === role && e.x < 1080)!;
  const c = center(t);
  const p = await toScreen(page, c.x, c.y);
  await page.mouse.dblclick(p.x, p.y);
  await expect(page.locator('textarea')).toBeFocused();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type(text);
  await page.mouse.click(5, 5);
  await expect.poll(async () => ((await elements(page)).find((e) => e.id === t.id)!.props as { text: string }).text).toBe(text);
}

/** Probelauf Phase 2b: ein Carousel von Hand bauen, wie es Lernende tun würden. Misst die Zeit des gespielten Ablaufs. */
test('Probelauf: Carousel über die Layout-Wahl, Fotos in Rahmen, Texte, Layoutwechsel, Export', async ({ page }) => {
  const t0 = Date.now();
  // Slides über die Layout-Wahl: Titel (Wahl beim Start), dann Vollbild, Panorama, Collage, Abschluss
  await newProject(page, 'Post 4:5', 'Carousel');
  await page.getByLabel('Projektname').fill('Probelauf');
  await page.getByLabel('Projektname').press('Enter');

  await fillSlide(page, 1);
  await editText(page, 'titel', 'Sporttag 2026');
  await editText(page, 'kommentar', 'Seilpark und Flowtrail am Pilatus.');
  for (const n of [2, 3, 5, 6]) await fillSlide(page, n); // 3 ist das Panorama über 3 und 4

  // Slide 2 auf «Querformat» umstellen: das Foto zieht mit
  // Ein Klick auf die Kachel zeigt die Slide samt Layout im Inspector (das zuletzt abgelegte Foto liegt auf Slide 6).
  await tile(page, 2).click();
  await expect(page.getByRole('complementary', { name: 'Eigenschaften' }).getByRole('heading', { level: 2 })).toHaveText('Slide 2');
  await (await openSlideLayouts(page)).getByRole('button', { name: 'Querformat' }).click();
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.project().slides[1]!.layout)).toBe('querformat');
  const els = await elements(page);
  expect(els.filter(empty)).toHaveLength(0); // kein Rahmen leer geblieben
  await frames(page);
  await page.screenshot({ path: `${SHOTS}/task-9-probelauf.png` });

  const pngs = await exportPng(page);
  expect(pngs).toHaveLength(6);
  for (const p of pngs) expect([p.width, p.height]).toEqual([1080, 1350]);
  // Nur für die Abnahme (SHOT=1): Exporte zum Ansehen ablegen, Zeit des gespielten Ablaufs ausgeben
  if (process.env.SHOT) {
    await mkdir(SHOTS, { recursive: true });
    for (const [i, p] of pngs.entries()) await writeFile(`${SHOTS}/task-9-export-${i + 1}.png`, PNG.sync.write(p));
    console.log(`Probelauf (gespielt): ${((Date.now() - t0) / 1000).toFixed(1)} s, ${els.length} Elemente`);
  }
});

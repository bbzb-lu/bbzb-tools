import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { unzipSync } from 'fflate';
import { PNG } from 'pngjs';
import { addEffect, addPhoto, effectRemove, elements, exportPng, meanDiff, newProject, openAllSections, openSection, png } from './fixtures';

const slide = (page: Page) => page.evaluate(() => window.__bbzbTest.project().slides[0]!);
const knob = (page: Page) => page.getByLabel('Eigenschaften').getByRole('slider', { name: 'Korn Stärke', exact: true });

/** Streuung des Grünkanals (blaue Fläche: nur das Korn streut). */
function spread(p: PNG) {
  let s = 0, q = 0;
  const n = p.width * p.height;
  for (let i = 0; i < n; i++) {
    const g = p.data[i * 4 + 1]!;
    s += g;
    q += g * g;
  }
  return Math.sqrt(q / n - (s / n) ** 2);
}

/** Knopf senkrecht ziehen (nach oben = stärker, 150 px = ganzer Bereich), mehrere Bewegungen in einer Geste. */
async function drag(page: Page, dy: number) {
  await knob(page).scrollIntoViewIfNeeded(); // 64-px-Knopf: im langen Foto-Inspector sonst ausserhalb der Ansicht
  const b = (await knob(page).boundingBox())!;
  const [cx, cy] = [b.x + b.width / 2, b.y + b.height / 2];
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (const k of [1, 2, 3]) await page.mouse.move(cx, cy + (dy * k) / 3);
  await page.mouse.up();
}

test('Slide: Korn-Stärke am Drehregler (Standard 40), Ziehen = ein Undo-Schritt und stärkeres Korn, Tastatur, Doppelklick, Entfernen', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await openSection(page, 'Hintergrund');
  await page.getByRole('radio', { name: 'Blau', exact: true }).check();
  await addEffect(page, 'Korn');
  const k = knob(page);
  await expect(k).toHaveAttribute('aria-valuenow', '40');
  await expect(k).toHaveAttribute('aria-valuetext', '40 %');
  await expect(page.getByLabel('Eigenschaften').locator('.knob-value')).toHaveText('40'); // Zahl ohne Einheit wie im Entwurf
  expect(await slide(page)).not.toHaveProperty('grainStrength'); // Standard: kein Feld, wie ein altes Projekt
  const [before] = await exportPng(page);

  await drag(page, -45); // 45 px von 150 px über 100 = +30
  await expect.poll(async () => (await slide(page)).grainStrength).toBe(70);
  const [after] = await exportPng(page);
  console.log(`Streuung Grün: 40 → ${spread(before!).toFixed(2)}, 70 → ${spread(after!).toFixed(2)}`);
  expect(spread(after!)).toBeGreaterThan(1.4 * spread(before!));
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await slide(page)).grainStrength).toBeUndefined(); // ganze Geste in einem Schritt
  await expect(k).toHaveAttribute('aria-valuenow', '40');

  await k.focus();
  await page.keyboard.press('ArrowUp');
  await expect.poll(async () => (await slide(page)).grainStrength).toBe(41);
  await page.keyboard.press('Home');
  await expect.poll(async () => (await slide(page)).grainStrength).toBe(0);
  const [none] = await exportPng(page);
  expect(spread(none!)).toBe(0); // 0 = kein Korn
  await k.focus(); // der Export-Dialog hat den Fokus genommen
  await page.keyboard.press('End');
  await expect(k).toHaveAttribute('aria-valuetext', '100 %');
  await k.dblclick();
  await expect.poll(async () => (await slide(page)).grainStrength).toBe(40);

  await effectRemove(page, 'Korn').click();
  await expect(k).toHaveCount(0);
  const s = await slide(page);
  expect(s.grain).toBe(false);
  expect(s).not.toHaveProperty('grainStrength'); // neu hinzugefügt = wieder Standard
});

test('Foto: Korn-Stärke am Drehregler (Standard 14), stärker nach Ziehen; Projektdatei behält die Stärken', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addEffect(page, 'Korn'); // Slide-Korn, Stärke über Tastatur
  await knob(page).focus();
  await page.keyboard.press('PageUp');
  await expect.poll(async () => (await slide(page)).grainStrength).toBe(50);
  await addPhoto(page, png(1080, 1350));
  await expect.poll(async () => (await elements(page))[0]?.props).toMatchObject({ grain: false });
  await openAllSections(page);
  await page.getByRole('button', { name: 'BBZB-Look', exact: true }).click(); // nur das Korn vergleichen
  const [raw] = await exportPng(page);
  await addEffect(page, 'Korn');
  await expect(knob(page)).toHaveAttribute('aria-valuenow', '14');
  const [std] = await exportPng(page);
  await drag(page, -60); // +40
  const props = async () => (await elements(page))[0]!.props as { grain?: boolean; grainStrength?: number };
  await expect.poll(async () => (await props()).grainStrength).toBe(54);
  const [strong] = await exportPng(page);
  const d = (a: PNG) => Math.min(...meanDiff(a, raw!));
  console.log(`Abweichung vom Rohbild: 14 → ${d(std!).toFixed(2)}, 54 → ${d(strong!).toFixed(2)}`);
  expect(d(strong!)).toBeGreaterThan(2 * d(std!));

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Projektdatei sichern' }).click();
  const files = unzipSync(new Uint8Array(await readFile(await (await download).path())));
  const json = JSON.parse(new TextDecoder().decode(files['project.json']!)).project;
  expect(json.slides[0]).toMatchObject({ grain: true, grainStrength: 50 });
  expect(Object.values(json.elements as Record<string, { props: object }>)[0]!.props).toMatchObject({ grain: true, grainStrength: 54 });
});

test('Slide: beim Drehen bleibt das alte Korn stehen, bis das neue fertig ist (kein Aufblitzen der flachen Farbe)', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addEffect(page, 'Korn');
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.pendingEffects())).toBe(0);
  // jedes Bild prüfen, ob der Hintergrund-Knoten die flache Farbe (Rect) statt der Korn-Canvas ist
  const watch = page.evaluate(
    () =>
      new Promise<number>((done) => {
        const k = (window as unknown as { Konva: typeof import('konva').default }).Konva;
        let flat = 0, n = 0;
        const tick = () => {
          const bg = (k.stages[0]!.findOne('.content') as import('konva').default.Layer).getChildren()[0];
          if (bg instanceof k.Rect) flat++;
          if (++n < 60) requestAnimationFrame(tick);
          else done(flat);
        };
        requestAnimationFrame(tick);
      }),
  );
  const b = (await knob(page).boundingBox())!;
  const [cx, cy] = [b.x + b.width / 2, b.y + b.height / 2];
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 20; i++) await page.mouse.move(cx, cy - i * 3);
  await page.mouse.up();
  expect(await watch).toBe(0);
  await expect.poll(async () => (await slide(page)).grainStrength).toBe(80);
});

test('Slide: Drehen rechnet das Korn als Vorschau in kleiner Auflösung, Loslassen in voller (sliding wie bei den Reglern)', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addEffect(page, 'Korn');
  const bgHeight = () =>
    page.evaluate(() => {
      const k = (window as unknown as { Konva: typeof import('konva').default }).Konva;
      const bg = (k.stages[0]!.findOne('.content') as import('konva').default.Layer).getChildren()[0];
      return bg instanceof k.Image ? (bg.image() as HTMLCanvasElement).height : 0;
    });
  await expect.poll(bgHeight).toBe(1350);
  const b = (await knob(page).boundingBox())!;
  const [cx, cy] = [b.x + b.width / 2, b.y + b.height / 2];
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 5; i++) await page.mouse.move(cx, cy - i * 6);
  await expect.poll(bgHeight).toBe(540); // Vorschau (PREVIEW_MAX) während der Geste
  await page.mouse.up();
  await expect.poll(bgHeight).toBe(1350);
  expect((await slide(page)).grainStrength).toBe(60);
});

import { expect, test, type Page } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import type { LayoutPreset } from '../src/core/types';
import type { Element } from '../src/model/types';
import { addPhoto, addSlide, elements, frames, newProject, png, toScreen, openSection } from './fixtures';

const DIR = `${import.meta.dirname}/../src/plugins/layouts/presets`;
const presets: LayoutPreset[] = readdirSync(DIR).map((f) => JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8')));
const FORMAT = { post: 'Post 4:5', story: 'Story 9:16' } as const;
const selected = (page: Page) => page.evaluate(() => window.__bbzbTest.selected());
const hit = (page: Page, x: number, y: number) => page.evaluate(([x, y]) => window.__bbzbTest.hit(x!, y!), [x, y]);

/** Punkt (fx, fy) in der gedrehten Box des Elements, globale Koordinaten. */
function at(e: Element, fx: number, fy: number): [number, number] {
  const a = (e.rotation * Math.PI) / 180;
  const [lx, ly] = [fx * e.width, fy * e.height];
  return [e.x + lx * Math.cos(a) - ly * Math.sin(a), e.y + lx * Math.sin(a) + ly * Math.cos(a)];
}
function inside(e: Element, px: number, py: number): boolean {
  const a = (-e.rotation * Math.PI) / 180;
  const [dx, dy] = [px - e.x, py - e.y];
  const [lx, ly] = [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)];
  return lx >= 0 && lx <= e.width && ly >= 0 && ly <= e.height;
}

// Review Focus 1: jedes Element mit Rolle (Platzhalter, Scribble, Text, Tag) per Klick auf seine sichtbare Mitte wählen
for (const preset of presets) {
  test(`Auswahl «${preset.label}» ${FORMAT[preset.format as keyof typeof FORMAT]}: jedes Element per Klick auf seine sichtbare Mitte`, async ({ page }) => {
    await newProject(page, FORMAT[preset.format as keyof typeof FORMAT]);
    for (let i = 1; i < preset.slides; i++) await addSlide(page);
    await page.evaluate((p) => window.__bbzbTest.applyLayout(p, 0), preset);
    const els = await elements(page);
    expect(els).toHaveLength(preset.elements.length);
    const width = (await page.evaluate(() => window.__bbzbTest.project().format.width));
    for (const [i, e] of els.entries()) {
      expect(e.role, e.name).toBeTruthy();
      // Mitte, sonst der nächste Punkt der Box, den kein höheres Element verdeckt (z. B. Panorama-Foto unter dem Pfeil)
      const grid = [0.5, 0.35, 0.65, 0.2, 0.8];
      const point = grid.flatMap((fy) => grid.map((fx) => at(e, fx, fy))).find(([px, py]) => !els.slice(i + 1).some((o) => inside(o, px, py)))!;
      expect(point, `${e.name}: sichtbarer Punkt`).toBeDefined();
      await page.getByRole('list', { name: 'Slides' }).getByRole('button').nth(Math.floor(point[0] / width)).click();
      await page.keyboard.press('Escape');
      await frames(page);
      const s = await toScreen(page, ...point);
      // Markenbilder erscheinen erst nach dem Einfärben: warten, bis die Trefferfläche steht
      await expect.poll(() => hit(page, s.x, s.y), `${preset.id}: ${e.name}`).toBe(e.id);
      await page.mouse.click(s.x, s.y);
      expect(await selected(page), `${preset.id}: ${e.name}`).toBe(e.id);
    }
  });
}

test('Klick auf ein Foto, dann Doppelklick nach 200 ms: Ausschnittmodus, das Foto bleibt gewählt', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addPhoto(page, png(1080, 1350));
  await expect.poll(async () => (await elements(page)).length).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.pendingEffects())).toBe(0);
  const [photo] = await elements(page);
  await frames(page);
  const c = await toScreen(page, 540, 675);
  await expect.poll(() => hit(page, c.x, c.y)).toBe(photo!.id);
  await page.mouse.click(c.x, c.y);
  await page.waitForTimeout(200);
  await page.mouse.dblclick(c.x, c.y);
  await openSection(page, 'Bild');
  await expect(page.getByRole('button', { name: 'Ausschnitt bearbeiten' })).toHaveAttribute('aria-pressed', 'true');
  await frames(page);
  expect(await selected(page)).toBe(photo!.id);
});

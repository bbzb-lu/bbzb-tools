import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { theme } from '../src/ui/theme';
import { frames, newProject, toScreen, view } from './fixtures';

/** Schreibmatte nach Entwurf: Lineal über den Slides, Passermarken an den Ecken der Arbeitsfläche. Nur Ansicht. */
const lum = ([r, g, b]: number[]) => 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** Pixel eines Bildschirmausschnitts (Bildschirm-px, DPR 1). */
async function patch(page: Page, x: number, y: number, w: number, h: number) {
  const p = PNG.sync.read(await page.screenshot({ clip: { x: Math.round(x), y: Math.round(y), width: w, height: h } }));
  return Array.from({ length: w * h }, (_, i) => [...p.data.subarray(i * 4, i * 4 + 3)]);
}
/** Am stärksten von der Unterlage abweichende Helligkeit im 7×7-Feld um (x, y). */
async function strongest(page: Page, x: number, y: number, table: number[]) {
  const px = await patch(page, x - 3, y - 3, 7, 7);
  return Math.max(...px.map((p) => Math.abs(lum(p) - lum(table))));
}
async function chooseBackdrop(page: Page, name: string) {
  await page.getByRole('button', { name: /^Unterlage/ }).click();
  const pop = page.getByRole('dialog', { name: 'Unterlage' });
  await pop.getByRole('radio', { name }).check();
  await page.keyboard.press('Escape');
  await expect(pop).toBeHidden();
}
/** Mitten der dunklen bzw. hellen Striche in der Lineal-Zeile, in Bildschirm-px. */
async function tickCenters(page: Page, y: number, x0: number, x1: number, table: number[]) {
  const row = await patch(page, x0, y, Math.round(x1 - x0), 1);
  const on = row.map((p) => Math.abs(lum(p) - lum(table)) > 40);
  const centers: number[] = [];
  for (let i = 0; i < on.length; i++) if (on[i] && !on[i - 1]) {
    let j = i;
    while (on[j + 1]) j++;
    centers.push(Math.round(x0) + (i + j) / 2);
  }
  return centers;
}

test('Schreibmatte: Passermarken und Lineal auf jeder Unterlage sichtbar, Teilstriche folgen dem Zoom', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  for (const [name, key] of [['Grau', 'unterlage-grau'], ['Dunkel', 'unterlage-dunkel'], ['Grün', 'unterlage-gruen'], ['Blau', 'unterlage-blau']] as const) {
    await chooseBackdrop(page, name);
    await frames(page);
    const table = rgb(theme[key]);
    const tl = await toScreen(page, 0, 0);
    const br = await toScreen(page, 1080, 1350);
    // Passermarken 14 px schräg ausserhalb jeder Ecke
    for (const [x, y] of [[tl.x - 14, tl.y - 14], [br.x + 14, tl.y - 14], [tl.x - 14, br.y + 14], [br.x + 14, br.y + 14]] as const)
      expect(await strongest(page, x, y, table), `${name}: Kreuz bei ${x},${y}`).toBeGreaterThan(60);
    // Zwischen Kreuz und Slide-Ecke (diagonal) liegt nur die Unterlage
    expect(await strongest(page, tl.x - 20, tl.y - 4, table), `${name}: frei`).toBeLessThan(10);
    // Lineal: Striche alle 1/20 Slide-Breite
    const v = await view(page);
    const c = await tickCenters(page, tl.y - 12, tl.x - 2, br.x - 2, table);
    expect(c.length, `${name}: ${c}`).toBe(20);
    c.slice(1).forEach((x, i) => expect(Math.abs(x - c[i]! - 54 * v.scale), `${name}: Abstand`).toBeLessThan(1.5));
  }
  // Verkleinert: kleinere Abstände, Striche und Marken bleiben in Bildschirm-px
  const before = (await view(page)).scale;
  await page.getByRole('button', { name: 'Verkleinern' }).click();
  await frames(page);
  const v = await view(page);
  expect(v.scale).toBeLessThan(before);
  const tl = await toScreen(page, 0, 0);
  const br = await toScreen(page, 1080, 1350);
  const c = await tickCenters(page, tl.y - 12, tl.x - 2, br.x - 2, rgb(theme['unterlage-blau']));
  expect(c.length).toBe(20);
  c.slice(1).forEach((x, i) => expect(Math.abs(x - c[i]! - 54 * v.scale)).toBeLessThan(1.5));
  expect(await strongest(page, tl.x - 14, tl.y - 14, rgb(theme['unterlage-blau']))).toBeGreaterThan(60);
});

/**
 * Struktur-Schutz: der Export klont nur die Ebene «content» (renderSlide). Fängt, wenn die Matte in «content» rutscht
 * oder verschwindet. Fängt nicht, wenn der Exporter selbst einmal die ganze Stage klont; ein Pixelvergleich hilft da
 * nicht, weil Lineal und Kreuze ausserhalb der Slide-Fläche liegen und ohnehin abgeschnitten würden.
 */
test('Schreibmatte liegt in der Ansichtsebene, nie in der exportierten Ebene «content»', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  expect(await page.evaluate(() => window.__bbzbTest.nodeLayer('mat'))).toBe('slide-edge');
  expect(await page.evaluate(() => window.__bbzbTest.contentNames())).not.toContain('mat');
});

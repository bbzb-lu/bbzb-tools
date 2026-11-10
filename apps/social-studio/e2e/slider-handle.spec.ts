import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { theme } from '../src/ui/theme';
import { elements, newProject } from './fixtures';

/** Griff wie die Bauteile «Fader» im Entwurf: 20 × 28 px, Papier mit Rand in Tinte, Akzentstrich 4 × 20 px in der Mitte, kein Schatten. */
const SCALE = 4;
test.use({ deviceScaleFactor: SCALE });

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const near = (a: number[], b: number[], tol = 12) => a.every((v, i) => Math.abs(v - b[i]!) <= tol);

/** Läufe (in CSS-px) einer Farbe entlang einer Zeile oder Spalte des Screenshots. */
function run(png: PNG, fixed: number, horizontal: boolean, color: number[]) {
  const n = horizontal ? png.width : png.height;
  const hits: number[] = [];
  for (let i = 0; i < n; i++) {
    const at = ((horizontal ? fixed * png.width + i : i * png.width + fixed) * 4);
    if (near([png.data[at]!, png.data[at + 1]!, png.data[at + 2]!], color)) hits.push(i);
  }
  return hits.length ? { from: hits[0]! / SCALE, len: (hits.at(-1)! - hits[0]! + 1) / SCALE, count: hits.length / SCALE } : null;
}

async function handle(page: Page, name: string) {
  const s = page.getByRole('slider', { name });
  await s.focus();
  await page.keyboard.press('Home');
  await page.evaluate(() => (document.activeElement as HTMLElement).blur());
  const box = (await s.boundingBox())!;
  // Griff steht links: Ausschnitt 30 × 40 px um ihn herum (oben und unten 6 px Luft)
  return PNG.sync.read(await page.screenshot({ clip: { x: box.x, y: box.y + box.height / 2 - 20, width: 30, height: 40 } }));
}

test('Regler-Griff: Grösse, Rand, Akzentstrich und Schatten wie im Entwurf', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await page.getByRole('button', { name: 'Text hinzufügen' }).click();
  await expect.poll(() => elements(page)).toHaveLength(1);
  const png = await handle(page, 'Grösse');
  const mid = 20 * SCALE; // Zeile durch die Griffmitte
  // Papierfläche + Rand: Breite des Griffs in der oberen Hälfte (über der Bahn)
  const ink = rgb(theme.ink);
  const top = run(png, mid - 10 * SCALE, true, ink)!;
  expect(top.len, 'Griffbreite mit Rand').toBeCloseTo(20, 0);
  expect(top.count, 'Rand links und rechts je 1.5 px (nicht auf 1 px gerundet)').toBeCloseTo(3, 0);
  // Akzentstrich: 4 px breit, 20 px hoch, mittig
  const accent = rgb(theme.accent);
  const across = run(png, mid, true, accent)!;
  expect(across.len, 'Strichbreite').toBeCloseTo(4, 0);
  expect(across.from + across.len / 2, 'Strich mittig').toBeCloseTo(top.from + 10, 0);
  const col = Math.round((across.from + 2) * SCALE);
  const down = run(png, col, false, accent)!;
  expect(down.len, 'Strichhöhe').toBeCloseTo(20, 0);
  // Höhe des Griffs: Randspalte innen am linken Rand von oben bis unten 28 px
  const edge = run(png, Math.round((top.from + 0.5) * SCALE), false, ink)!;
  expect(edge.len, 'Griffhöhe').toBeCloseTo(28, 0);
  // Kein Schatten: rechts neben dem Griff liegt nur die Bahn (6 px, ganz Tinte wie im Entwurf), nichts darüber oder darunter
  const beside = run(png, Math.round((top.from + 21.5) * SCALE), false, ink);
  expect(beside?.len, 'nur die Bahn neben dem Griff').toBeCloseTo(6, 0);
});

test('Regler-Griff ist bis zum unteren Rand greifbar (Teilstriche fangen keine Zeiger)', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await page.getByRole('button', { name: 'Text hinzufügen' }).click();
  await expect.poll(() => elements(page)).toHaveLength(1);
  const s = page.getByRole('slider', { name: 'Grösse' });
  await s.focus();
  await page.keyboard.press('Home');
  const box = (await s.boundingBox())!;
  const x = box.x + 10; // Griffmitte bei Wert min
  const y = box.y + box.height - 2;
  expect(await page.evaluate(([px, py]) => document.elementFromPoint(px!, py!)?.getAttribute('aria-label'), [x, y])).toBe('Grösse');
  // Ziehen am unteren Griffrand ändert den Wert
  const before = await s.inputValue();
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 60, y, { steps: 4 });
  await page.mouse.up();
  await expect(s).not.toHaveValue(before);
});

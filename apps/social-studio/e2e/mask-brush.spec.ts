import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { brush } from '../src/tokens';
import { elements, exportPng, frames, toScreen } from './fixtures';
import { alphaPng, openPhoto } from './photoProject';

const SHOTS = '.superpowers/sdd/2026-10-28-phase-4a-maske-pinsel/screens';
const BLAU = [0, 159, 226];
const DARK = [15, 27, 38];
const BOX = { x: 140, y: 275, width: 800, height: 800 };

const near = (a: number[], b: number[], t = 4) => a.every((v, k) => Math.abs(v - b[k]!) <= t);
const t = (page: Page) => ({
  ui: () => page.evaluate(() => window.__bbzbTest.ui()),
  history: () => page.evaluate(() => window.__bbzbTest.history()),
  mask: async () => ((await elements(page))[0]!.props as { mask?: string }).mask,
  ring: () => page.evaluate(() => window.__bbzbTest.brushRing()),
  veils: () => page.evaluate(() => window.__bbzbTest.veils()),
  /** Was der Export zeigt (Slide 1) an Slide-Punkten: RGB oben links im 5 × 5-Fleck. */
  px: (pts: number[][]) =>
    page.evaluate((p) => window.__bbzbTest.slidePixels(0, p.map(([x, y]) => [x! / 1080, y! / 1350])).map((c) => c.slice(0, 3)), pts),
});

async function openBrush(page: Page, name: string) {
  await openPhoto(page, name, BOX, { crop: { x: 0, y: 0, scale: 0.8 } }, alphaPng(1000, 1000, DARK, () => 255), [740, 675]);
  const c = await toScreen(page, 740, 675);
  await page.mouse.click(c.x, c.y);
  await page.getByRole('button', { name: 'Maske bearbeiten' }).click();
  await expect.poll(() => t(page).veils()).toBe(1);
}

/** Strich über Slide-Punkte, mit Zwischenschritten wie eine echte Maus. */
async function stroke(page: Page, pts: number[][], steps = 8) {
  const s = await Promise.all(pts.map(([x, y]) => toScreen(page, x!, y!)));
  await page.mouse.move(s[0]!.x, s[0]!.y);
  await page.mouse.down();
  for (const p of s.slice(1)) await page.mouse.move(p.x, p.y, { steps });
  await page.mouse.up();
}

test('Knopf öffnet, Esc und Klick auf ein anderes Element beenden; Pinsel und Ausschnitt schliessen sich aus', async ({ page }) => {
  await openPhoto(page, 'Modus', BOX, { crop: { x: 0, y: 0, scale: 0.8 } }, alphaPng(1000, 1000, DARK, () => 255), [740, 675]);
  await page.evaluate(() => window.__bbzbTest.insertTag('schul', { x: 540, y: 150 }));
  const tag = (await elements(page)).find((e) => e.type === 'tag')!.id;
  const c = await toScreen(page, 740, 675);
  await page.mouse.click(c.x, c.y);
  const btn = page.getByRole('button', { name: 'Maske bearbeiten' });
  await btn.click();
  await expect(btn).toHaveAttribute('aria-pressed', 'true');
  expect((await t(page).ui()).maskEditId).toBe('e0');
  await page.mouse.move(c.x, c.y);
  await expect.poll(() => t(page).ring()).not.toBeNull();
  expect(await page.evaluate(() => window.__bbzbTest.transformerNodes())).toBe(0); // keine Anfasser im Modus

  await page.keyboard.press('Escape');
  await expect.poll(async () => (await t(page).ui()).maskEditId).toBeNull();
  expect([await t(page).veils(), await t(page).ring(), (await t(page).ui()).cropEditId]).toEqual([0, null, null]);
  expect(await page.evaluate(() => window.__bbzbTest.selected())).toBe('e0');

  await btn.click();
  const g = await toScreen(page, 540, 150);
  await page.mouse.click(g.x, g.y);
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.selected())).toBe(tag);
  expect([(await t(page).ui()).maskEditId, await t(page).veils()]).toEqual([null, 0]);

  await page.mouse.click(c.x, c.y);
  await btn.click();
  await page.getByRole('button', { name: 'Ausschnitt bearbeiten' }).click();
  expect(await t(page).ui()).toMatchObject({ maskEditId: null, cropEditId: 'e0' });
  await expect(btn).toHaveAttribute('aria-pressed', 'false');
  await btn.click();
  expect(await t(page).ui()).toMatchObject({ maskEditId: 'e0', cropEditId: null });
});

test('Ausblenden und Einblenden: ein Strich ist ein Undo-Schritt, Redo stellt ihn wieder her, X tauscht', async ({ page }) => {
  await openBrush(page, 'Striche');
  const h0 = await t(page).history();
  await stroke(page, [[300, 675], [780, 675]]);
  await expect.poll(() => t(page).history()).toBe(h0 + 1);
  expect(await t(page).mask()).toBeDefined();
  // im Modus zeigt das Element das ganze Foto (mit Folie); nach dem Verlassen maskiert
  await page.keyboard.press('Escape');
  let [mid, off] = await t(page).px([[540, 675], [540, 500]]);
  expect(near(mid!, BLAU, 2), `ausgeblendet ${mid}`).toBe(true);
  expect(near(off!, DARK), `sichtbar ${off}`).toBe(true);

  await page.keyboard.press('Control+z');
  await expect.poll(() => t(page).mask()).toBeUndefined();
  await expect.poll(async () => near((await t(page).px([[540, 675]]))[0]!, DARK)).toBe(true);
  await page.keyboard.press('Control+Shift+z');
  await expect.poll(() => t(page).mask()).toBeDefined();
  await expect.poll(async () => near((await t(page).px([[540, 675]]))[0]!, BLAU, 2)).toBe(true);

  await page.getByRole('button', { name: 'Maske bearbeiten' }).click();
  await expect.poll(() => t(page).veils()).toBe(1);
  await page.keyboard.press('x');
  expect((await t(page).ui()).brush.mode).toBe('show');
  // im Inspector (das Ebenen-Panel hat eigene Knöpfe «Ausblenden»)
  const inspector = page.getByLabel('Eigenschaften');
  await expect(inspector.getByRole('button', { name: 'Einblenden' })).toHaveAttribute('aria-pressed', 'true');
  await expect(inspector.getByRole('button', { name: 'Ausblenden' })).toHaveAttribute('aria-pressed', 'false');
  const h1 = await t(page).history();
  await stroke(page, [[460, 675], [620, 675]]);
  await expect.poll(() => t(page).history()).toBe(h1 + 1);
  const shown = await t(page).mask();
  await page.keyboard.press('Escape');
  [mid, off] = await t(page).px([[540, 675], [340, 675]]);
  expect(near(mid!, DARK), `wieder eingeblendet ${mid}`).toBe(true);
  expect(near(off!, BLAU, 2), `bleibt aus ${off}`).toBe(true);
  // Undo im Modus: die Arbeitskopie lädt den vorigen Stand, der nächste Strich baut darauf auf
  await page.getByRole('button', { name: 'Maske bearbeiten' }).click();
  await page.keyboard.press('Control+z');
  await expect.poll(() => t(page).mask()).not.toBe(shown);
  await page.keyboard.press('Escape');
  await expect.poll(async () => near((await t(page).px([[540, 675]]))[0]!, BLAU, 2)).toBe(true);
});

test('Grösse per Regler und Tasten begrenzt, Härte weich bis hart, Ring in richtiger Grösse bei 25 % und 800 %', async ({ page }) => {
  await openBrush(page, 'Grösse');
  const size = async () => (await t(page).ui()).brush.size;
  const slider = page.locator('.inspector').getByRole('slider', { name: 'Grösse' });
  await slider.focus();
  await page.keyboard.press('End');
  expect(await size()).toBe(brush.size.max);
  await page.keyboard.press(']');
  await page.keyboard.press('+');
  expect(await size()).toBe(brush.size.max);
  await page.keyboard.press('Home');
  await page.keyboard.press('[');
  await page.keyboard.press('-');
  expect(await size()).toBe(brush.size.min);
  await page.keyboard.press('+');
  expect(await size()).toBeGreaterThan(brush.size.min);
  await expect(slider.locator('xpath=ancestor::fieldset')).toHaveAttribute('data-tip', /\[.*\]/);

  // Härte: harter Strich oben, weicher unten, je Durchmesser 200; 70 px neben der Linie
  const num = page.locator('.inspector').getByRole('spinbutton', { name: 'Grösse' });
  await num.fill('200');
  await num.press('Enter');
  const hard = page.locator('.inspector').getByRole('slider', { name: 'Härte' });
  await hard.focus();
  await page.keyboard.press('End');
  const h0 = await t(page).history();
  await stroke(page, [[200, 450], [880, 450]]);
  await expect.poll(() => t(page).history()).toBe(h0 + 1);
  await hard.focus();
  await page.keyboard.press('Home');
  expect((await t(page).ui()).brush).toMatchObject({ size: 200, hardness: 0 });
  await stroke(page, [[200, 850], [880, 850]]);
  await expect.poll(() => t(page).history()).toBe(h0 + 2);
  await page.keyboard.press('Escape');
  const [hardEdge, softEdge, softMid] = await t(page).px([[540, 520], [540, 920], [540, 850]]);
  expect(near(hardEdge!, BLAU, 2), `hart: ganz aus ${hardEdge}`).toBe(true);
  expect(near(softEdge!, BLAU, 20) || near(softEdge!, DARK, 20), `weich: halb ${softEdge}`).toBe(false);
  expect(near(softMid!, BLAU, 6), `weich: Mitte aus ${softMid}`).toBe(true);

  await page.getByRole('button', { name: 'Maske bearbeiten' }).click();
  for (const zoom of [0.25, 8]) {
    const key = zoom < 1 ? 'Control+-' : 'Control+=';
    await page.locator('.canvas-scroll').focus();
    for (let i = 0; i < 20 && (await t(page).ui()).zoom !== zoom; i++) await page.keyboard.press(key);
    expect((await t(page).ui()).zoom).toBe(zoom);
    const box = (await page.locator('.canvas-scroll').boundingBox())!;
    const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await page.mouse.move(at.x, at.y);
    await page.mouse.move(at.x + 3, at.y + 2);
    await expect.poll(() => t(page).ring()).not.toBeNull();
    const ring = (await t(page).ring())!;
    const { scale } = await page.evaluate(() => window.__bbzbTest.view());
    expect(ring.r).toBe(100);
    expect(ring.screenR).toBeCloseTo(100 * scale, 3);
    const s = await toScreen(page, ring.x, ring.y);
    expect(Math.abs(s.x - at.x - 3) + Math.abs(s.y - at.y - 2), `Ring an der Maus bei ${zoom}`).toBeLessThan(1.5);
    await frames(page);
    if (zoom === 8) await page.screenshot({ path: `${SHOTS}/task-3-ring-800.png` });
  }
});

test('Strich ausserhalb des Fotos ändert nichts; Strg + Mausrad zoomt und malt nicht; Strich über den Rand hinaus', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openBrush(page, 'Aussen');
  const h0 = await t(page).history();
  await stroke(page, [[200, 150], [900, 160]]);
  await frames(page);
  expect([await t(page).history(), await t(page).mask()]).toEqual([h0, undefined]);
  expect((await t(page).ui()).maskEditId).toBeNull(); // Klick daneben beendet den Modus, wie beim Ausschnitt

  const c = await toScreen(page, 540, 675);
  await page.mouse.click(c.x, c.y);
  await page.getByRole('button', { name: 'Maske bearbeiten' }).click();
  await expect.poll(() => t(page).veils()).toBe(1);
  await page.mouse.move(c.x, c.y);
  const zoom = (await t(page).ui()).zoom;
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -200);
  await page.keyboard.up('Control');
  await expect.poll(async () => (await t(page).ui()).zoom).toBeGreaterThan(zoom);
  await frames(page);
  expect([await t(page).history(), await t(page).mask(), (await t(page).ui()).maskEditId]).toEqual([h0, undefined, 'e0']);

  await page.keyboard.press('Control+0');
  await frames(page);
  await stroke(page, [[540, 675], [1060, 1340]], 20);
  await expect.poll(() => t(page).history()).toBe(h0 + 1);
  expect(errors).toEqual([]);
});

test('Folie nur im Editor, kein Aufblitzen bei Strichende und beim Verlassen, Export ohne Folie', async ({ page }) => {
  await openBrush(page, 'Folie');
  await stroke(page, [[300, 675], [780, 675]]);
  await expect.poll(() => t(page).mask()).toBeDefined();
  const c = await toScreen(page, 540, 675);
  await page.mouse.move(c.x + 200, c.y - 300);
  await frames(page);
  const shot = PNG.sync.read(await page.screenshot({ path: `${SHOTS}/task-3-brush.png` }));
  const i = (Math.round(c.y) * shot.width + Math.round(c.x)) * 4;
  const veil = [shot.data[i]!, shot.data[i + 1]!, shot.data[i + 2]!];
  // Foto bleibt unter der Folie sichtbar (dunkel, nicht Slide-Blau), rot getönt
  expect(veil[0]! - DARK[0]! > 60 && veil[2]! < 90, `rote Folie über dem Foto ${veil}`).toBe(true);

  // Verlassen gedrosselt, auch direkt nach einem Strich (Speichern läuft noch): an jedem Bild zeigt das Foto den letzten Stand
  await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: 6 });
  const probe = (pts: number[][]) =>
    page.evaluate(async (p) => {
      const out = [];
      for (let k = 0; k < 6; k++) {
        out.push(window.__bbzbTest.slidePixels(0, p.map(([x, y]) => [x! / 1080, y! / 1350])).map((q) => q.slice(0, 3)));
        await new Promise((r) => requestAnimationFrame(r));
      }
      return out;
    }, pts);
  await stroke(page, [[300, 950], [780, 950]]);
  await page.keyboard.press('Escape');
  for (const [a, b, d] of await probe([[540, 675], [540, 950], [540, 1050]])) {
    expect(near(a!, BLAU, 2) && near(b!, BLAU, 2), `Verlassen: aus ${a} ${b}`).toBe(true);
    expect(near(d!, DARK), `Verlassen: sichtbar ${d}`).toBe(true);
  }
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.pendingEffects())).toBe(0);
  expect(await t(page).veils()).toBe(0);

  await page.getByRole('button', { name: 'Maske bearbeiten' }).click();
  await expect.poll(() => t(page).veils()).toBe(1);
  const [out] = await exportPng(page);
  const px = [0, 1, 2].map((k) => out!.data[(675 * out!.width + 540) * 4 + k]!);
  expect(near(px, BLAU, 2), `Export ohne Folie ${px}`).toBe(true);
});

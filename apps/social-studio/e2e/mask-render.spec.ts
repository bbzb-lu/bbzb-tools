import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { canvasToMask } from '../src/model/mask';
import { elements, exportPng, frames, toScreen } from './fixtures';
import { alphaPng, maskPng, openPhoto, type Box } from './photoProject';

const BLAU = [0, 159, 226];
const DARK = [15, 27, 38];
const ORANGE = [255, 78, 0];
const WARMWEISS = [251, 248, 243];

const px = (p: PNG, x: number, y: number) => [0, 1, 2].map((k) => p.data[(y * p.width + x) * 4 + k]!);
const near = (a: number[], b: number[], t = 4) => a.every((v, k) => Math.abs(v - b[k]!) <= t);
const settled = (page: Page) => expect.poll(() => page.evaluate(() => window.__bbzbTest.pendingEffects())).toBe(0);

/** Was die Leinwand zeigt (Bildschirmfoto), an Slide-Punkten. */
async function screenPx(page: Page, pts: number[][]) {
  await frames(page);
  const shot = PNG.sync.read(await page.screenshot());
  const out = [];
  for (const [wx, wy] of pts) {
    const s = await toScreen(page, wx!, wy!);
    out.push(px(shot, Math.round(s.x), Math.round(s.y)));
  }
  return out;
}

const solid = (w: number, h: number, rgb: number[]) => alphaPng(w, h, rgb, () => 255);
// Linke Hälfte ausgeblendet
const HALF = maskPng(1000, 1000, (x) => (x < 500 ? 0 : 255));
const BOX = { x: 140, y: 275, width: 800, height: 800 };

for (const [label, fx] of [['ohne Effekte', {}], ['mit Look und Korn', { look: true, grain: true }]] as const) {
  test(`Maske ${label}: ausgeblendete Hälfte durchsichtig, Leinwand und Export gleich`, async ({ page }) => {
    await openPhoto(page, `Halb ${label}`, BOX, { crop: { x: 0, y: 0, scale: 0.8 }, ...fx }, solid(1000, 1000, DARK), [740, 675], HALF);
    await settled(page);
    const pts = [[340, 675], [200, 400], [740, 675], [900, 1000]];
    const [out] = await exportPng(page);
    const exp = pts.map(([x, y]) => px(out!, x!, y!));
    // ausgeblendet: Slide-Hintergrund (Korn und Look nur auf dem Sichtbaren); sichtbar: Foto
    expect(near(exp[0]!, BLAU, 2), `ausgeblendet ${exp[0]}`).toBe(true);
    expect(near(exp[1]!, BLAU, 2), `ausgeblendet ${exp[1]}`).toBe(true);
    expect(near(exp[2]!, BLAU, 30), `sichtbar ${exp[2]}`).toBe(false);
    const scr = await screenPx(page, pts);
    scr.forEach((c, i) => expect(near(c, exp[i]!, 10), `Leinwand ${c} vs Export ${exp[i]} bei ${pts[i]}`).toBe(true));
  });
}

// Bild 1000 × 800: Orange genau dort, wo die halb so grosse Maske (500 × 400) ausblendet, sonst dunkel. Asymmetrisch (Band links, Kreis rechts oben).
const hidden = (mx: number, my: number) => mx < 150 || Math.hypot(mx + 0.5 - 350, my + 0.5 - 150) < 70;
const PATTERN = (() => {
  const p = new PNG({ width: 1000, height: 800 });
  for (let y = 0; y < 800; y++) for (let x = 0; x < 1000; x++) p.data.set([...(hidden(x >> 1, y >> 1) ? ORANGE : DARK), 255], (y * 1000 + x) * 4);
  return PNG.sync.write(p);
})();
const MASK = maskPng(500, 400, (x, y) => (hidden(x, y) ? 0 : 255));
const mval = (x: number, y: number) => (x < 0 || y < 0 || x >= 500 || y >= 400 ? -1 : hidden(x, y) ? 0 : 255);

/** Liegt der Slide-Punkt mindestens 3 px innerhalb der gedrehten Box (der Ausschnitt ragt darüber hinaus, wird aber abgeschnitten)? */
function inBox(b: Box & { rotation: number }, x: number, y: number) {
  const r = (-b.rotation * Math.PI) / 180;
  const [dx, dy] = [x - b.x, y - b.y];
  const [lx, ly] = [Math.cos(r) * dx - Math.sin(r) * dy, Math.sin(r) * dx + Math.cos(r) * dy];
  return lx > 3 && ly > 3 && lx < b.width - 3 && ly < b.height - 3;
}

type Case = { box: Box; rotation: number; crop: { x: number; y: number; scale: number }; flipX: boolean; flipY?: boolean };
const CASES: Record<string, Case> = {
  einfach: { box: { x: 100, y: 200, width: 800, height: 640 }, rotation: 0, crop: { x: 0, y: 0, scale: 0.8 }, flipX: false },
  'Ausschnitt, unproportional': { box: { x: 90, y: 150, width: 900, height: 500 }, rotation: 0, crop: { x: -300, y: -100, scale: 1.2 }, flipX: false },
  'gespiegelt, Ausschnitt': { box: { x: 90, y: 150, width: 900, height: 500 }, rotation: 0, crop: { x: -300, y: -100, scale: 1.2 }, flipX: true },
  'gedreht und gespiegelt': { box: { x: 200, y: 300, width: 800, height: 640 }, rotation: 25, crop: { x: 0, y: 0, scale: 0.8 }, flipX: true },
  'senkrecht gespiegelt, gedreht': { box: { x: 90, y: 150, width: 900, height: 500 }, rotation: 15, crop: { x: -300, y: -100, scale: 1.2 }, flipX: true, flipY: true },
};

for (const [label, c] of Object.entries(CASES)) {
  test(`Maske deckungsgleich mit dem Foto (${label}): kein Orange sichtbar, Pinselgeometrie canvasToMask trifft`, async ({ page }) => {
    const box = { ...c.box };
    const mid = [box.x + box.width * 0.75, box.y + box.height * 0.75];
    await openPhoto(page, label, box, { crop: c.crop, flipX: c.flipX, flipY: c.flipY }, PATTERN, mid, MASK);
    if (c.rotation) await page.evaluate((r) => window.__bbzbTest.patch('e0', { rotation: r }), c.rotation);
    await settled(page);
    const [out] = await exportPng(page);
    let orange = 0, dark = 0;
    for (let y = 0; y < out!.height; y++)
      for (let x = 0; x < out!.width; x++) {
        const [r, g, b] = px(out!, x, y);
        if (r! > 200 && g! < 120 && b! < 60) orange++;
        if (near([r!, g!, b!], DARK, 6)) dark++;
      }
    expect(orange, 'Orange (ausgeblendeter Bildteil) sichtbar').toBe(0);
    expect(dark, 'sichtbarer Bildteil').toBeGreaterThan(20000);
    // Rückwärts: jeder Slide-Pixel über canvasToMask (wie der Pinsel) in die Maske; deutlich aus = Hintergrund, deutlich an = Foto
    const el = { ...(await elements(page))[0]!, rotation: c.rotation };
    let off = 0, on = 0;
    for (let y = 0; y < out!.height; y += 6)
      for (let x = 0; x < out!.width; x += 6) {
        const m = canvasToMask(el, { x: 0, y: 0, width: el.width, height: el.height }, c.crop, { x: c.flipX, y: !!c.flipY }, { width: 1000, height: 800 }, { width: 500, height: 400 }, { x: x + 0.5, y: y + 0.5 });
        const around = [-2, 0, 2].flatMap((dx) => [-2, 0, 2].map((dy) => mval(Math.floor(m.x + dx), Math.floor(m.y + dy))));
        if (around.includes(-1) || !inBox(el, x + 0.5, y + 0.5)) continue; // ausserhalb oder am Rand von Bild oder Box
        const got = px(out!, x, y);
        if (around.every((v) => v === 0)) {
          off++;
          expect(near(got, BLAU, 3), `${x}/${y} ausgeblendet, ist ${got}`).toBe(true);
        } else if (around.every((v) => v === 255)) {
          on++;
          expect(near(got, DARK, 4), `${x}/${y} sichtbar, ist ${got}`).toBe(true);
        }
      }
    expect(off).toBeGreaterThan(200);
    expect(on).toBeGreaterThan(200);
  });
}

test('Rahmen mit Kontur folgt der Maskenform, nicht der Box', async ({ page }) => {
  // nur eine Scheibe (Radius 300 Maskenpixel = 180 Slide-px um 540/675) sichtbar
  const disc = maskPng(1000, 1000, (x, y) => (Math.hypot(x + 0.5 - 500, y + 0.5 - 500) < 300 ? 255 : 0));
  const box = { x: 240, y: 375, width: 600, height: 600 };
  await openPhoto(page, 'Kontur', box, { crop: { x: 0, y: 0, scale: 0.6 }, frame: true, frameOutside: true }, solid(1000, 1000, DARK), [540, 675], disc);
  await settled(page);
  const [out] = await exportPng(page);
  expect(near(px(out!, 540, 675), DARK), 'Mitte: Foto').toBe(true);
  for (const [x, y] of [[540 + 192, 675], [540, 675 - 192], [540 - 128, 675 + 128 + 8]]) expect(near(px(out!, x!, y!), WARMWEISS, 6), `Kontur bei ${x}/${y}: ${px(out!, x!, y!)}`).toBe(true);
  // Boxrand und Boxecke: kein Rechteckrahmen, Hintergrund
  for (const [x, y] of [[box.x - 12, 675], [box.x + 20, box.y + 20], [540, box.y + box.height + 12]]) expect(near(px(out!, x!, y!), BLAU, 3), `kein Rahmen bei ${x}/${y}: ${px(out!, x!, y!)}`).toBe(true);
});

test('Vollständig ausgeblendet mit Rahmen, Look, Korn und Verlauf: kein Absturz, Export liefert die Slide', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const none = maskPng(400, 400, () => 0);
  await openPhoto(page, 'Leer', BOX, { crop: { x: 0, y: 0, scale: 2 }, frame: true, frameOutside: true, look: true, grain: true, scrims: [{ side: 'unten', strength: 'stark' }] }, solid(400, 400, DARK), [540, 675], none);
  await settled(page);
  const [out] = await exportPng(page);
  expect([out!.width, out!.height]).toEqual([1080, 1350]);
  for (const [x, y] of [[540, 675], [BOX.x + 10, BOX.y + BOX.height - 10], [BOX.x - 12, 675]]) expect(near(px(out!, x!, y!), BLAU, 2), `${x}/${y}: ${px(out!, x!, y!)}`).toBe(true);
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Defekte Maskendatei: Foto ohne Maske mit einer Meldung, Export läuft', async ({ page }) => {
  await openPhoto(page, 'Kaputt', BOX, { crop: { x: 0, y: 0, scale: 0.8 } }, solid(1000, 1000, DARK), [740, 675], Buffer.from('keine PNG-Datei'));
  await expect(page.getByRole('alert')).toContainText('Maske');
  await settled(page);
  const [out] = await exportPng(page);
  expect(near(px(out!, 340, 675), DARK), 'Foto unmaskiert').toBe(true);
});

test('Skalieren: die Live-Vorschau zeigt die Maske mit, nach dem Loslassen gleich', async ({ page }) => {
  await openPhoto(page, 'Live', BOX, { crop: { x: 0, y: 0, scale: 0.8 }, look: true }, solid(1000, 1000, DARK), [740, 675], HALF);
  await settled(page);
  const c = await toScreen(page, 740, 675);
  await page.mouse.click(c.x, c.y);
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.transformerNodes())).toBe(1);
  // rechte Kante um 200 nach rechts: Box 1000 × 800, Bild deckend skaliert (1.0), Grenze der Maske bei x = 140 + 500
  const h = await toScreen(page, BOX.x + BOX.width, BOX.y + BOX.height / 2);
  await page.mouse.move(h.x, h.y);
  await page.mouse.down();
  const k = (await toScreen(page, 1, 0)).x - (await toScreen(page, 0, 0)).x; // Bildschirm-px je Slide-px
  for (let i = 1; i <= 5; i++) await page.mouse.move(h.x + 200 * k * (i / 5), h.y);
  const during = await screenPx(page, [[BOX.x + 400, 500], [BOX.x + 600, 1000]]);
  expect(near(during[0]!, BLAU, 10), `mitten in der Geste ausgeblendet: ${during[0]}`).toBe(true);
  expect(near(during[1]!, BLAU, 30), `mitten in der Geste sichtbar: ${during[1]}`).toBe(false);
  await page.mouse.up();
  await settled(page);
  expect((await elements(page))[0]!.width).toBeGreaterThan(950);
  const [out] = await exportPng(page);
  expect(near(px(out!, BOX.x + 400, 500), BLAU, 2)).toBe(true);
  expect(near(px(out!, BOX.x + 600, 1000), BLAU, 30)).toBe(false);
});

test('Maske wechselt (Undo/Redo, Strichende): die alte bleibt sichtbar, bis die neue geladen ist', async ({ page }) => {
  await openPhoto(page, 'Wechsel', BOX, { crop: { x: 0, y: 0, scale: 0.8 } }, solid(1000, 1000, DARK), [740, 675], HALF);
  await settled(page);
  // grosse Maske B (linke Hälfte an, rechte aus), Laden dauert gedrosselt mehrere Bilder
  const right = await page.evaluate(() => window.__bbzbTest.putMask(2048, 2048, 1024));
  await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: 6 });
  const pts: [number, number][] = [[340 / 1080, 675 / 1350], [740 / 1080, 675 / 1350]];
  const during = await page.evaluate(async ({ id, pts }) => {
    const t = window.__bbzbTest;
    t.patch('e0', { props: { ...(t.elements()[0]!.props as object), mask: id } } as never);
    for (let i = 0; i < 3; i++) await new Promise((r) => requestAnimationFrame(r));
    return { pending: t.pendingEffects(), px: t.slidePixels(0, pts) };
  }, { id: right, pts });
  expect(during.pending, 'neue Maske lädt noch').toBeGreaterThan(0);
  // alte Maske A: links aus, rechts Foto (5 × 5-Fleck, je Pixel RGB)
  expect(near(during.px[0]!.slice(0, 3), BLAU, 2), `links ${during.px[0]!.slice(0, 3)}`).toBe(true);
  expect(near(during.px[1]!.slice(0, 3), DARK, 4), `rechts sichtbar während des Ladens: ${during.px[1]!.slice(0, 3)}`).toBe(true);
  await settled(page);
  const after = await page.evaluate((pts) => window.__bbzbTest.slidePixels(0, pts), pts);
  expect(near(after[0]!.slice(0, 3), DARK, 4), `links nachher ${after[0]!.slice(0, 3)}`).toBe(true);
  expect(near(after[1]!.slice(0, 3), BLAU, 2), `rechts nachher ${after[1]!.slice(0, 3)}`).toBe(true);
});

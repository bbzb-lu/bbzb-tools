import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { canvasToMask } from '../src/model/mask';
import type { Element } from '../src/model/types';
import { elements, openSlideLayouts, toScreen } from './fixtures';
import { maskPng, openPhoto } from './photoProject';

const ORANGE = [255, 78, 0];
const DARK = [15, 27, 38];

// Bild 1000 × 800: Orange genau dort, wo die halb so grosse Maske (500 × 400) ausblendet, sonst dunkel (wie mask-render.spec.ts)
const hidden = (mx: number, my: number) => mx < 150 || Math.hypot(mx + 0.5 - 350, my + 0.5 - 150) < 70;
const PATTERN = (() => {
  const p = new PNG({ width: 1000, height: 800 });
  for (let y = 0; y < 800; y++) for (let x = 0; x < 1000; x++) p.data.set([...(hidden(x >> 1, y >> 1) ? ORANGE : DARK), 255], (y * 1000 + x) * 4);
  return PNG.sync.write(p);
})();
const MASK = maskPng(500, 400, (x, y) => (hidden(x, y) ? 0 : 255));
const mval = (x: number, y: number) => (x < 0 || y < 0 || x >= 500 || y >= 400 ? -1 : hidden(x, y) ? 0 : 255);

type Photo = Element & { props: { mask?: string; crop: { x: number; y: number; scale: number }; flipX?: boolean; flipY?: boolean } };

/**
 * Deckungsgleich: jeder Rasterpunkt der Slide über canvasToMask (Pinselgeometrie) in die Maske. Deutlich aus: kein Foto
 * (weder Orange noch Dunkel, Hintergrund blau); deutlich an: Foto (dunkel). Prüft auch, dass nirgends Orange erscheint.
 */
async function congruent(page: Page, photo: Photo, slide: number, format = { width: 1080, height: 1350 }) {
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.pendingEffects())).toBe(0);
  const pts: [number, number][] = [];
  for (let y = 9; y < format.height; y += 18) for (let x = 9; x < format.width; x += 18) pts.push([x, y]);
  const got = await page.evaluate(([i, p]) => window.__bbzbTest.slidePixels(i, p), [slide, pts.map(([x, y]) => [x / format.width, y / format.height] as [number, number])] as const);
  let on = 0, off = 0;
  pts.forEach(([x, y], k) => {
    const c = got[k]!.slice(36, 39); // Mitte des 5 × 5-Flecks
    expect(c[0]! > 200 && c[1]! < 120 && c[2]! < 60, `Orange bei ${x}/${y}: ${c}`).toBe(false);
    const area = { x: 0, y: 0, width: photo.width, height: photo.height };
    const m = canvasToMask(photo, area, photo.props.crop, { x: !!photo.props.flipX, y: !!photo.props.flipY }, { width: 1000, height: 800 }, { width: 500, height: 400 }, { x: x + slide * format.width, y });
    const around = [-2, 0, 2].flatMap((dx) => [-2, 0, 2].map((dy) => mval(Math.floor(m.x + dx), Math.floor(m.y + dy))));
    const inside = x + slide * format.width > photo.x + 3 && y > photo.y + 3 && x + slide * format.width < photo.x + photo.width - 3 && y < photo.y + photo.height - 3;
    if (around.includes(-1) || !inside) return;
    if (around.every((v) => v === 0)) {
      off++;
      expect(c[2]! > c[0]! + 30, `${x}/${y} ausgeblendet, ist ${c}`).toBe(true);
    } else if (around.every((v) => v === 255)) {
      on++;
      expect(Math.max(...c), `${x}/${y} sichtbar, ist ${c}`).toBeLessThan(60);
    }
  });
  expect(off, 'ausgeblendete Punkte geprüft').toBeGreaterThan(50);
  expect(on, 'sichtbare Punkte geprüft').toBeGreaterThan(50);
}

const photos = async (page: Page) => (await elements(page)).filter((e) => e.type === 'photo') as Photo[];

test('Maske bleibt deckungsgleich bei Layoutwechsel, Duplizieren, Ausschneiden und Einfügen, Slide duplizieren, Kopie als Story', async ({ page }) => {
  test.setTimeout(90000);
  await openPhoto(page, 'Reise', { x: 100, y: 200, width: 800, height: 640 }, { crop: { x: 0, y: 0, scale: 0.8 }, flipX: true }, PATTERN, [700, 680], MASK);
  const [first] = await photos(page);
  const mask = first!.props.mask!;
  await congruent(page, first!, 0);

  // Layoutwechsel: das freie Foto zieht in den Platzhalter (neue Box, neuer Ausschnitt), die Maske kommt mit
  await page.keyboard.press('Escape');
  await (await openSlideLayouts(page)).getByRole('button', { name: 'Titel' }).click();
  await expect.poll(async () => (await photos(page))[0]!.role).toBe('foto');
  const placed = (await photos(page))[0]!;
  expect([placed.props.mask, placed.width]).toEqual([mask, 1080]);
  // Titel, Kommentar und Tag des Layouts ausblenden: geprüft wird nur das Foto (der Tag ist selbst orange)
  for (const e of (await elements(page)).filter((e) => e.type !== 'photo')) await page.evaluate((id) => window.__bbzbTest.patch(id, { visible: false }), e.id);
  await congruent(page, placed, 0);

  // Duplizieren (Strg + D), dann das Original löschen: die Kopie allein
  await page.evaluate((id) => window.__bbzbTest.select(id), placed.id);
  await page.locator('.canvas-scroll').focus();
  await page.keyboard.press('Control+d');
  await expect.poll(async () => (await photos(page)).length).toBe(2);
  const copy = (await photos(page)).find((e) => e.id !== placed.id)!;
  expect(copy.props.mask).toBe(mask);
  await page.evaluate((id) => window.__bbzbTest.select(id), placed.id);
  await page.keyboard.press('Delete');
  await expect.poll(async () => (await photos(page)).length).toBe(1);
  await congruent(page, (await photos(page))[0]!, 0);

  // Ausschneiden und Einfügen
  await page.evaluate((id) => window.__bbzbTest.select(id), copy.id);
  await page.keyboard.press('ControlOrMeta+x');
  await expect.poll(async () => (await photos(page)).length).toBe(0);
  await page.keyboard.press('ControlOrMeta+v');
  await expect.poll(async () => (await photos(page)).length).toBe(1);
  const pasted = (await photos(page))[0]!;
  expect([pasted.id === copy.id, pasted.props.mask]).toEqual([false, mask]);
  await congruent(page, pasted, 0);

  // Slide duplizieren: die zweite Slide zeigt dasselbe
  await page.getByRole('button', { name: 'Slide duplizieren' }).click();
  await expect.poll(async () => (await photos(page)).length).toBe(2);
  const second = (await photos(page)).find((e) => e.x >= 1080)!;
  expect(second.props.mask).toBe(mask);
  await congruent(page, second, 1);

  // Kopie als Story (anderes Format): Box und Ausschnitt neu, Maske gleich
  await page.getByRole('button', { name: 'Übersicht' }).click();
  await page.getByRole('button', { name: '«Reise» als Story kopieren', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('ist angelegt');
  await page.getByRole('button', { name: /^«(?!Reise»).*» öffnen$/ }).click();
  await expect(page.getByLabel('Projektname')).toHaveValue(/Story/);
  await expect.poll(async () => (await photos(page)).length).toBe(2);
  const story = (await photos(page)).sort((a, b) => a.x - b.x)[0]!;
  expect(story.props.mask).toBe(mask);
  const c = await toScreen(page, story.x + story.width / 2, story.y + story.height / 2);
  await expect.poll(() => page.evaluate(([x, y]) => window.__bbzbTest.hit(x!, y!), [c.x, c.y])).toBe(story.id);
  await congruent(page, story, 0, { width: 1080, height: 1920 });
});

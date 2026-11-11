import { expect, test, type Locator, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { slider as sliderTokens } from '../src/tokens';
import { elements, newProject } from './fixtures';

test.use({ deviceScaleFactor: 4 });

const SCALE = 4;
const props = async (page: Page) => (await elements(page))[0]!.props as { fontSize: number; opacity?: number };
const size = (page: Page) => page.getByRole('slider', { name: 'Grösse' });
const field = (page: Page, name: string) => page.getByRole('spinbutton', { name });

async function addText(page: Page) {
  await newProject(page, 'Post 4:5');
  await page.getByRole('button', { name: 'Text hinzufügen' }).click();
  await expect.poll(() => elements(page)).toHaveLength(1);
}

/** Zeile aus dem Screenshot: erster und letzter Pixel, der vom Hintergrund abweicht (in CSS-px relativ zum Regler). */
async function extent(page: Page, slider: Locator, dy: number) {
  const box = (await slider.boundingBox())!;
  const margin = 6;
  const buf = await page.screenshot({ clip: { x: box.x - margin, y: box.y, width: box.width + 2 * margin, height: box.height } });
  const png = PNG.sync.read(buf);
  const row = Math.round((box.height / 2 + dy) * SCALE);
  const at = (x: number) => (row * png.width + x) * 4;
  const bg = [png.data[at(0)]!, png.data[at(0) + 1]!, png.data[at(0) + 2]!];
  const differs = (x: number) => [0, 1, 2].reduce((n, c) => n + Math.abs(png.data[at(x) + c]! - bg[c]!), 0) > 40;
  let first = -1;
  let last = -1;
  for (let x = 0; x < png.width; x++) if (differs(x)) {
      if (first < 0) first = x;
      last = x;
    }
  expect(first, 'Pixel in dieser Zeile gefunden').toBeGreaterThanOrEqual(0);
  return { left: first / SCALE - margin, right: (last + 1) / SCALE - margin, width: box.width };
}

async function flush(page: Page, slider: Locator) {
  await page.evaluate(() => (document.activeElement as HTMLElement).blur()); // Fokusring nicht mitmessen
  const track = await extent(page, slider, 0);
  const thumb = await extent(page, slider, -6); // Griff ist höher als die Bahn: diese Zeile trifft nur den Griff
  return { trackLeft: track.left, trackRight: track.right, thumbLeft: thumb.left, thumbRight: thumb.right };
}

test('Griff schliesst bei 0 und bei 100 % bündig mit der Bahn ab (Toleranz 1 px)', async ({ page }) => {
  await addText(page);
  const s = size(page);
  await s.focus();
  await page.keyboard.press('End');
  let m = await flush(page, s);
  expect(Math.abs(m.thumbRight - m.trackRight), `rechts: Griff ${m.thumbRight} Bahn ${m.trackRight}`).toBeLessThanOrEqual(1);
  await s.focus();
  await page.keyboard.press('Home');
  m = await flush(page, s);
  expect(Math.abs(m.thumbLeft - m.trackLeft), `links: Griff ${m.thumbLeft} Bahn ${m.trackLeft}`).toBeLessThanOrEqual(1);
});

test('Zahlenfeld und Regler zeigen denselben Wert, in beide Richtungen', async ({ page }) => {
  await addText(page);
  const s = size(page);
  const f = field(page, 'Grösse');
  await expect(f).toHaveValue('150');
  await expect(s).toHaveValue('150');
  await s.focus();
  await page.keyboard.press('End');
  await expect(f).toHaveValue('600');
  await page.keyboard.press('Home');
  await expect(f).toHaveValue('8');
  await f.fill('300');
  await f.press('Enter');
  await expect(s).toHaveValue('300');
});

test('Pfeiltasten, Pos1 und Ende, Bild auf/ab', async ({ page }) => {
  await addText(page);
  const s = size(page);
  await s.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await props(page)).fontSize).toBe(151);
  await page.keyboard.press('ArrowUp');
  await expect.poll(async () => (await props(page)).fontSize).toBe(152);
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowDown');
  await expect.poll(async () => (await props(page)).fontSize).toBe(150);
  await page.keyboard.press('End');
  await expect.poll(async () => (await props(page)).fontSize).toBe(600);
  await page.keyboard.press('PageDown');
  await expect.poll(async () => (await props(page)).fontSize).toBeLessThan(600);
  await page.keyboard.press('Home');
  await expect.poll(async () => (await props(page)).fontSize).toBe(8);
});

test('Doppelklick auf den Griff setzt auf den Standard zurück, ein Undo-Schritt', async ({ page }) => {
  await addText(page);
  const f = field(page, 'Grösse');
  await f.fill('300');
  await f.press('Enter');
  await expect.poll(async () => (await props(page)).fontSize).toBe(300);
  const s = size(page);
  const box = (await s.boundingBox())!;
  const t = sliderTokens.thumb;
  const x = box.x + t / 2 + (box.width - t) * ((300 - 8) / (600 - 8));
  await page.mouse.dblclick(x, box.y + box.height / 2);
  await expect.poll(async () => (await props(page)).fontSize).toBe(150);
  await expect(f).toHaveValue('150');
  await page.mouse.click(5, 5);
  await page.keyboard.press('Control+Z');
  await expect.poll(async () => (await props(page)).fontSize).toBe(300);
});

test('Deckkraft: Zahlenfeld, Regler und Zurücksetzen', async ({ page }) => {
  await addText(page);
  const s = page.getByRole('slider', { name: 'Deckkraft' });
  const f = field(page, 'Deckkraft');
  await expect(f).toHaveValue('100');
  await s.focus();
  await page.keyboard.press('Home');
  await expect(f).toHaveValue('0');
  await expect(s).toHaveAttribute('aria-valuetext', '0 %');
  const box = (await s.boundingBox())!;
  await page.mouse.dblclick(box.x + sliderTokens.thumb / 2, box.y + box.height / 2);
  await expect(f).toHaveValue('100');
});

test('Regler sind im Kontrastmodus sichtbar (forced-colors)', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await addText(page);
  const s = size(page);
  await s.focus();
  await page.keyboard.press('End');
  const m = await flush(page, s);
  expect(m.thumbRight).toBeGreaterThan(m.thumbLeft);
  expect(Math.abs(m.thumbRight - m.trackRight)).toBeLessThanOrEqual(1);
});

test('Zahlenfeld: Pfeiltaste im Feld übernimmt den Wert sofort (ein Undo-Schritt), die Anzeige folgt dem Regler danach', async ({ page }) => {
  await addText(page);
  const start = (await props(page)).fontSize;
  // Pfeiltaste im Feld = native Änderung ohne Tippen: früher blieb sie ein Entwurf, bis das Feld den Fokus verlor
  await field(page, 'Grösse').focus();
  await page.keyboard.press('ArrowUp');
  await expect.poll(async () => (await props(page)).fontSize).toBe(start + 1);
  await expect(field(page, 'Grösse')).toHaveValue(String(start + 1));
  await page.keyboard.press('ArrowUp');
  await expect.poll(async () => (await props(page)).fontSize).toBe(start + 2);
  await page.keyboard.press('Tab'); // im Feld gilt Strg + Z dem Text
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await props(page)).fontSize).toBe(start + 1);
  // danach Regler: das Feld zeigt den echten Wert, nicht den letzten Tastendruck
  await size(page).focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await props(page)).fontSize).toBe(start + 2);
  await expect(field(page, 'Grösse')).toHaveValue(String(start + 2));
  await page.keyboard.press('Home');
  const min = (await props(page)).fontSize;
  await expect(field(page, 'Grösse')).toHaveValue(String(min));
});

test('Pfeiltaste im Feld gehalten: ein Undo-Schritt für die ganze Serie', async ({ page }) => {
  await addText(page);
  const start = (await props(page)).fontSize;
  await field(page, 'Grösse').focus();
  await page.keyboard.down('ArrowUp');
  for (let i = 0; i < 4; i++) await page.keyboard.down('ArrowUp'); // Wiederholung bei gehaltener Taste
  await page.keyboard.up('ArrowUp');
  await expect.poll(async () => (await props(page)).fontSize).toBe(start + 5);
  await page.keyboard.press('Tab'); // im Feld gilt Strg + Z dem Text
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await props(page)).fontSize).toBe(start);
});

test('Ein Zahlenfeld beendet keine fremde Geste: Fokus und Verlassen lassen sie offen', async ({ page }) => {
  await addText(page);
  const x0 = (await elements(page))[0]!.x;
  await page.evaluate(() => window.__bbzbTest.gesture.start()); // z. B. ein Ziehen auf der Leinwand
  await page.evaluate((id) => window.__bbzbTest.patch(id, { x: 321 }), (await elements(page))[0]!.id);
  await field(page, 'Grösse').focus();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => window.__bbzbTest.gesture.open())).toBe(true);
  await page.evaluate(() => window.__bbzbTest.gesture.end());
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await elements(page))[0]!.x).toBe(x0);
});

test('Klick in ein Zahlenfeld wählt den ganzen Wert: Tippen ersetzt ihn', async ({ page }) => {
  await addText(page);
  const f = field(page, 'Grösse');
  await f.click();
  await page.keyboard.type('55');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await props(page)).fontSize).toBe(55);
  // zweiter Klick im selben Feld setzt nur den Cursor (keine erneute Auswahl): «1» hängt an, der Wert wird nicht 1
  await f.click();
  await page.keyboard.press('End');
  await page.keyboard.type('1');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await props(page)).fontSize).toBeGreaterThan(55);
});

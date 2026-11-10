import { expect, test, type Page } from '@playwright/test';
import { bbzbsocial, elements, exportPng, frames, newProject, toScreen, view } from './fixtures';

const toggle = (page: Page) => page.getByRole('button', { name: 'Sicherheitszonen' });
const layers = (page: Page) => page.evaluate(() => window.__bbzbTest.layerNames());
const px = (png: { data: Buffer; width: number }, x: number, y: number) => [...png.data.subarray((y * png.width + x) * 4, (y * png.width + x) * 4 + 3)];

test('Sicherheitszonen: Standard aus, an/aus per Taste und Maus, nie im Export', async ({ page }) => {
  await newProject(page, 'Story 9:16');
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
  expect(await layers(page)).not.toContain('safezones');
  await toggle(page).focus();
  await page.keyboard.press('Enter');
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => layers(page)).toContain('safezones');
  expect(await page.evaluate(() => window.__bbzbTest.safeZoneListening())).toBe(false);
  // Die Überlagerung liegt über der Leinwand: Bildschirmfoto sieht oben ein dunkleres Band
  await frames(page);
  const top = await toScreen(page, 540, 100);
  const mid = await toScreen(page, 540, 1000);
  const shot = async (p: { x: number; y: number }) => (await page.screenshot({ clip: { x: p.x, y: p.y, width: 1, height: 1 } }));
  expect((await shot(top)).equals(await shot(mid))).toBe(false);
  // Export mit eingeblendeter Überlagerung: Pixel in der Zone gleich wie in der Mitte
  const [slide] = await exportPng(page);
  expect(slide!.height).toBe(1920);
  expect(px(slide!, 540, 100)).toEqual(px(slide!, 540, 1000));
  expect(px(slide!, 540, 1700)).toEqual(px(slide!, 540, 1000));
  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
  expect(await layers(page)).not.toContain('safezones');
});

test('Post zeigt andere Zonen als Story: Seitenränder statt oben und unten', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await toggle(page).click();
  await frames(page);
  const post = await page.evaluate(() => window.__bbzbTest.safeZoneRects());
  expect(post.map((r) => [r.width, r.height])).toEqual([[33.75, 1350], [33.75, 1350]]);
  await page.getByRole('button', { name: 'Übersicht' }).click();
  await newProjectKeep(page);
  await frames(page);
  const story = await page.evaluate(() => window.__bbzbTest.safeZoneRects());
  expect(story.map((r) => [r.width, r.height])).toEqual([[1080, 250], [1080, 340]]);
});

test('Ränder 72 px: vier Linien pro Slide, nie im Export', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await toggle(page).click();
  await frames(page);
  const m = await page.evaluate(() => window.__bbzbTest.safeZoneMargins());
  expect(m).toHaveLength(4);
  expect(m).toContainEqual([72, 0, 72, 1350]);
  expect(m).toContainEqual([0, 1278, 1080, 1278]);
  // nicht Blau (wie Collage), nicht Orange (Zonen, Hilfslinie): dunkle Linie auf hellem Untergrund
  expect((await page.evaluate(() => window.__bbzbTest.safeZoneMarginStrokes()))[0]).toEqual({ line: '#0F1B26', back: 'rgba(251,248,243,0.6)' });
  const [slide] = await exportPng(page);
  expect(px(slide!, 72, 600)).toEqual(px(slide!, 100, 600));
  expect(px(slide!, 600, 1278)).toEqual(px(slide!, 600, 1200));
});

/** Story mit leerem Foto «m» (Oberkante 400); Hilfsfunktionen zum Ziehen in Schritten. */
async function openZone(page: Page) {
  const project = {
    schemaVersion: 1, id: 'p-zone2', name: 'Zone2', format: { id: 'story', width: 1080, height: 1920 }, createdAt: 0, updatedAt: 0,
    slides: [{ id: 's1', background: 'warmweiss' }],
    elements: { m: { id: 'm', type: 'photo', name: 'm', x: 300, y: 400, width: 200, height: 200, rotation: 0, opacity: 1, visible: true, locked: false, props: { crop: { x: 0, y: 0, scale: 1 } } } },
    order: ['m'], assets: {},
  };
  await page.goto('');
  await page.locator('input[type=file]').setInputFiles({ name: 'x.bbzbsocial', mimeType: 'application/zip', buffer: bbzbsocial(project) });
  await page.getByRole('listitem').filter({ hasText: 'Zone2' }).getByRole('button', { name: 'Öffnen' }).click();
  await expect(page.getByLabel('Projektname')).toHaveValue('Zone2');
  await frames(page);
}
async function dragTo(page: Page, from: number, dy: number, fraction: [number, number]) {
  const { scale } = await view(page);
  const a = await toScreen(page, 400, from);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = fraction[0]; i <= fraction[1]; i++) await page.mouse.move(a.x, a.y + (dy * scale * i) / 5);
}
const guides = (page: Page) => page.evaluate(() => window.__bbzbTest.guides());

test('Wechselt die Auswahl mitten in der Geste, verschwinden die Hilfslinien', async ({ page }) => {
  await openZone(page);
  await toggle(page).click();
  await dragTo(page, 500, -147, [1, 5]);
  expect((await guides(page)).y).toBe(250);
  await page.keyboard.press('Escape'); // Auswahl aufheben
  await expect.poll(() => guides(page)).toEqual({ x: null, y: null });
  await page.mouse.up();
});

test('Eine Änderung desselben Elements mitten in der Geste hält das Einrasten nicht an', async ({ page }) => {
  await openZone(page);
  await toggle(page).click();
  await dragTo(page, 500, -147, [1, 3]);
  await page.evaluate(() => window.__bbzbTest.patch('m', { opacity: 0.9 })); // Store-Update, Auswahl bleibt
  await frames(page);
  const { scale } = await view(page);
  const a = await toScreen(page, 400, 500);
  await page.mouse.move(a.x, a.y - 147 * scale * 0.9);
  await page.mouse.move(a.x, a.y - 147 * scale);
  expect((await guides(page)).y).toBe(250);
  await page.mouse.up();
});

async function newProjectKeep(page: Page) {
  await page.getByRole('button', { name: 'Story 9:16' }).click();
  await expect(page.getByLabel('Projektname')).toBeVisible();
  await page.keyboard.press('Escape'); // Layout-Wahl zum Start schliessen
}

test('Snapping kennt die Zonenränder nur bei eingeblendeter Überlagerung', async ({ page }) => {
  const project = {
    schemaVersion: 1, id: 'p-zone', name: 'Zone', format: { id: 'story', width: 1080, height: 1920 }, createdAt: 0, updatedAt: 0,
    slides: [{ id: 's1', background: 'warmweiss' }],
    elements: { m: { id: 'm', type: 'photo', name: 'm', x: 300, y: 400, width: 200, height: 200, rotation: 0, opacity: 1, visible: true, locked: false, props: { crop: { x: 0, y: 0, scale: 1 } } } },
    order: ['m'], assets: {},
  };
  await page.goto('');
  await page.locator('input[type=file]').setInputFiles({ name: 'x.bbzbsocial', mimeType: 'application/zip', buffer: bbzbsocial(project) });
  await page.getByRole('listitem').filter({ hasText: 'Zone' }).getByRole('button', { name: 'Öffnen' }).click();
  await expect(page.getByLabel('Projektname')).toHaveValue('Zone');
  await frames(page);
  const dragUp = async (dy: number) => {
    const { scale } = await view(page);
    const a = await toScreen(page, 400, 500);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    for (let i = 1; i <= 5; i++) await page.mouse.move(a.x, a.y + (dy * scale * i) / 5);
    const guides = await page.evaluate(() => window.__bbzbTest.guides());
    await page.mouse.up();
    return guides;
  };
  expect((await dragUp(-147)).y).toBeNull(); // Oberkante 253: ohne Überlagerung nichts bei 250
  await page.keyboard.press('Control+z');
  await toggle(page).click();
  expect((await dragUp(-147)).y).toBe(250);
  await expect.poll(async () => (await elements(page))[0]!.y).toBe(250); // exakt, keine Gleitkommareste
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await elements(page))[0]!.y).toBe(400);
});

test('Bildschirmfoto: Hilfslinie auf dem Zonenrand', async ({ page }) => {
  test.skip(!process.env.SHOT, 'nur für die Abnahme');
  await openZone(page);
  await toggle(page).click();
  await dragTo(page, 500, -147, [1, 5]);
  await page.screenshot({ path: '.superpowers/sdd/2026-10-21-phase-2b-layouts-und-hilfen/screens/task-2-zone-snap.png' });
  await page.mouse.up();
});

test('Tag rastet bei Zoom 200 % oben und unten am 72-px-Rand ein', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await page.getByRole('tab', { name: 'Tags' }).click();
  await page.getByRole('button', { name: 'Standort' }).click();
  await expect.poll(() => elements(page)).toHaveLength(1);
  await page.keyboard.press('Escape');
  await toggle(page).click();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Vergrössern' }).click();
  await expect(page.locator('.zoom-value')).toHaveText('195 %');
  const tag = (await elements(page))[0]!;
  const scroll = page.locator('.canvas-scroll');
  // oben: 7 Welt-px unter dem Rand, 5 nach oben ziehen: Rest 2 Welt-px = 3.9 Bildschirm-px, unter der Schwelle 6
  await page.evaluate((id) => window.__bbzbTest.patch(id, { x: 300, y: 79 }), tag.id);
  await scroll.evaluate((e) => (e.scrollTop = 0));
  await frames(page);
  let v = await view(page);
  let a = await toScreen(page, 300 + tag.width / 2, 79 + tag.height / 2);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= 5; i++) await page.mouse.move(a.x, a.y - (5 * v.scale * i) / 5);
  expect((await guides(page)).y).toBe(72);
  await page.mouse.up();
  await expect.poll(async () => (await elements(page))[0]!.y).toBe(72);
  // unten: Unterkante 7 Welt-px über dem Rand, 5 nach unten ziehen
  const y0 = 1350 - 72 - 7 - tag.height;
  await page.evaluate((a) => window.__bbzbTest.patch(a.id, { x: 300, y: a.y }), { id: tag.id, y: y0 });
  await scroll.evaluate((e) => (e.scrollTop = e.scrollHeight));
  await frames(page);
  v = await view(page);
  a = await toScreen(page, 300 + tag.width / 2, y0 + tag.height / 2);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= 5; i++) await page.mouse.move(a.x, a.y + (5 * v.scale * i) / 5);
  expect((await guides(page)).y).toBe(1278);
  await page.mouse.up();
  await expect.poll(async () => (await elements(page))[0]!.y + tag.height).toBe(1278);
});

for (const fmt of ['Post 4:5', 'Story 9:16'] as const) {
  test(`Bildschirmfoto Ränder: ${fmt}`, async ({ page }) => {
    test.skip(!process.env.SHOT, 'nur für die Abnahme');
    await newProject(page, fmt);
    await toggle(page).click();
    await frames(page);
    await page.screenshot({ path: `.superpowers/sdd/2026-10-22-phase-2-3-verlauf-und-raender/screens/task-3-${fmt.split(' ')[0]!.toLowerCase()}.png` });
  });
}

test('Bildschirmfoto Ränder: blaue Slide (Collage) mit Foto', async ({ page }) => {
  test.skip(!process.env.SHOT, 'nur für die Abnahme');
  await newProject(page, 'Post 4:5', 'Carousel');
  await page.getByRole('button', { name: 'Slide 5', exact: true }).click();
  await toggle(page).click();
  await frames(page);
  await page.screenshot({ path: '.superpowers/sdd/2026-10-22-phase-2-3-verlauf-und-raender/screens/task-3-collage.png' });
});

import { expect, test, type Page } from '@playwright/test';
import { openSlideLayouts, addPhoto, addSlide, dropPng, elements, frames, gradientPng, newProject, png, openSection } from './fixtures';

const SHOTS = '.superpowers/sdd/2026-10-21-phase-2b-layouts-und-hilfen/screens';
const SHOTS_21 = '.superpowers/sdd/2026-10-22-phase-2-1-nachbesserungen/screens';
const project = (page: Page) => page.evaluate(() => window.__bbzbTest.project());
const tiles = (page: Page) => page.getByRole('list', { name: 'Slides' }).getByRole('button');

/** Neue Elemente (Platzhalter) setzen Korn und bei Fotos Look ausdrücklich (Ruling R10). */
async function expectGrainExplicit(page: Page) {
  const els = await elements(page);
  for (const e of els.filter((e) => e.type === 'photo')) expect(e.props, e.name).toMatchObject({ grain: true, look: true });
}

test('Neues Projekt: eine Slide, die Layout-Wahl ist offen und hat den Fokus', async ({ page }) => {
  await page.goto('');
  await expect(page.getByRole('radio')).toHaveCount(0); // keine Startvorlagen-Auswahl mehr
  await page.screenshot({ path: `${SHOTS_21}/task-4-start.png` });
  await page.getByRole('button', { name: 'Post 4:5' }).click();
  const pop = page.getByRole('dialog', { name: 'Layout wählen' });
  await expect(pop).toBeVisible();
  await expect(pop.getByRole('button', { name: 'Titel' })).toBeFocused();
  await expect(tiles(page)).toHaveCount(1);
  expect(await elements(page)).toHaveLength(0);
  await frames(page);
  await page.screenshot({ path: `${SHOTS_21}/task-4-editorstart.png` });
});

test('Layout-Wahl beim Start: eine Wahl gilt Slide 1, ein Undo-Schritt', async ({ page }) => {
  await page.goto('');
  await page.getByRole('button', { name: 'Post 4:5' }).click();
  await page.getByRole('dialog', { name: 'Layout wählen' }).getByRole('button', { name: 'Titel' }).click();
  await expect.poll(async () => (await project(page)).slides[0]!.layout).toBe('titel');
  await expect(tiles(page)).toHaveCount(1);
  expect((await elements(page)).length).toBeGreaterThan(0);
  await expectGrainExplicit(page);
  await expect(page.getByRole('button', { name: 'Slide hinzufügen' })).toBeFocused();
  await page.keyboard.press('Control+z');
  expect(await elements(page)).toHaveLength(0);
  expect((await project(page)).slides[0]!.layout).toBeUndefined();
  await expect(page.getByRole('button', { name: 'Rückgängig' })).toBeDisabled();
});

test('Layout-Wahl beim Start: Esc lässt eine leere Slide, «Slide hinzufügen» wirkt danach wieder auf neue Slides', async ({ page }) => {
  await page.goto('');
  await page.getByRole('button', { name: 'Post 4:5' }).click();
  await expect(page.getByRole('dialog', { name: 'Layout wählen' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Layout wählen' })).toBeHidden();
  await expect(tiles(page)).toHaveCount(1);
  expect(await elements(page)).toHaveLength(0);
  await addSlide(page, 'Titel');
  await expect(tiles(page)).toHaveCount(2);
  expect((await project(page)).slides.map((s) => s.layout)).toEqual([undefined, 'titel']);
});

test('Ein vorhandenes Projekt öffnen zeigt die Layout-Wahl nicht', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await page.getByRole('button', { name: 'Übersicht' }).click();
  await page.getByRole('button', { name: /^«.*» öffnen$/ }).click();
  await expect(page.getByLabel('Projektname')).toBeVisible();
  await expect(page.locator('#slide-layouts')).toBeHidden();
});

test('Doppelklick auf das Format legt ein einziges Projekt an', async ({ page }) => {
  await page.goto('');
  await page.getByRole('button', { name: 'Post 4:5' }).dblclick();
  await expect(tiles(page)).toHaveCount(1);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Übersicht' }).click();
  await expect(page.getByRole('list').getByRole('listitem')).toHaveCount(1);
});

test('Layout-Wahl beim Start wartet auf die Schriften, bevor sie das Layout anwendet', async ({ page }) => {
  let release = () => {};
  const held = new Promise<void>((r) => (release = r));
  await page.route('**/seguibl*.ttf', async (r) => {
    await held;
    await r.continue();
  });
  await page.goto('', { waitUntil: 'commit' });
  await page.getByRole('button', { name: 'Post 4:5' }).click();
  await page.getByRole('dialog', { name: 'Layout wählen' }).getByRole('button', { name: 'Titel' }).click();
  expect(await elements(page)).toHaveLength(0);
  release();
  await expect.poll(async () => (await elements(page)).length).toBeGreaterThan(0);
});

test('Vorlage «Leer»: eine leere Slide', async ({ page }) => {
  await newProject(page, 'Post 4:5', 'Leer');
  await expect(tiles(page)).toHaveCount(1);
  expect(await elements(page)).toHaveLength(0);
});

test('Story mit den Carousel-Layouts über die Layout-Wahl: dieselben Layouts als 9:16, Korn ausdrücklich, Auswahl zeigt die Story-Varianten', async ({ page }) => {
  await newProject(page, 'Story 9:16', 'Carousel');
  await expect(tiles(page)).toHaveCount(6);
  const p = await project(page);
  expect(p.slides.map((s) => s.layout)).toEqual(['titel-story', 'vollbild-story', 'panorama-story', 'panorama-story', 'collage-story', 'abschluss-story']);
  await expectGrainExplicit(page);
  await expect((await openSlideLayouts(page)).getByRole('button')).toHaveCount(8);
  await expect((await openSlideLayouts(page)).getByRole('button', { name: 'Titel' })).toHaveAttribute('aria-current', 'true');
  await addSlide(page, 'Drei Fotos');
  await expect(tiles(page)).toHaveCount(7);
  expect((await project(page)).slides[1]!.layout).toBe('dreiFotos-story');
  await expectGrainExplicit(page);
  await page.getByRole('button', { name: 'Sicherheitszonen' }).click();
  await frames(page);
  await page.screenshot({ path: `${SHOTS}/task-7-story-sicherheitszonen.png` });
});

test('«Slide hinzufügen» mit Panorama fügt zwei Slides ein, ein Undo-Schritt', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await page.getByRole('button', { name: 'Slide hinzufügen' }).click();
  const pop = page.getByRole('dialog', { name: 'Slide hinzufügen' });
  await expect(pop).toBeVisible();
  await frames(page);
  await page.screenshot({ path: `${SHOTS}/task-5-slide-hinzufuegen.png` });
  // Tastatur: Tab führt vom Button in die Auswahl, Esc schliesst sie
  await page.keyboard.press('Tab');
  await expect(pop.getByRole('button', { name: 'Titel' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(pop).toBeHidden();
  await expect(tiles(page)).toHaveCount(1);

  await addSlide(page, 'Panorama');
  await expect(tiles(page)).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Slide hinzufügen' })).toBeFocused();
  await expect(tiles(page).nth(1)).toHaveAttribute('aria-current', 'true');
  expect((await project(page)).slides.map((s) => s.layout)).toEqual([undefined, 'panorama', 'panorama']);
  const pano = (await elements(page)).find((e) => e.type === 'photo')!;
  expect(pano).toMatchObject({ x: 1080, width: 2160, role: 'foto' });
  await expectGrainExplicit(page);
  await page.keyboard.press('Control+z');
  await expect(tiles(page)).toHaveCount(1);
  expect(await elements(page)).toHaveLength(0);
});

test('Layout auf eine Slide mit Inhalt: Foto und Text ziehen um, ein Undo stellt alles wieder her', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addPhoto(page, png(800, 600));
  await expect.poll(async () => (await elements(page)).length).toBe(1);
  await page.getByRole('button', { name: 'Text hinzufügen' }).click();
  await expect.poll(async () => (await elements(page)).length).toBe(2);
  await page.keyboard.press('Escape');
  const before = await elements(page);
  const [photo, text] = before;

  // per Tastatur: Kachel fokussieren, Enter
  await (await openSlideLayouts(page)).getByRole('button', { name: 'Titel' }).focus();
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await project(page)).slides[0]!.layout).toBe('titel');
  await expect(page.getByRole('button', { name: 'Layout ändern' })).toBeFocused(); // Fokus fällt nicht auf body
  const after = await elements(page);
  expect(after.find((e) => e.id === photo!.id)).toMatchObject({ role: 'foto', x: 0, y: 0, width: 1080, height: 1350, props: { assetId: (photo!.props as { assetId: string }).assetId, grain: false, look: true, scrims: [{ side: 'oben', strength: 'leicht' }] } });
  expect(after.find((e) => e.id === text!.id)).toMatchObject({ role: 'titel', props: { text: 'Titel', color: 'warmweiss' } });
  expect(after.map((e) => e.role)).toEqual(['foto', 'titel', 'kommentar', 'schulTag']);
  const titelSlide = (await project(page)).slides[0]!;
  expect(titelSlide).toMatchObject({ background: 'blau' });
  await expect((await openSlideLayouts(page)).getByRole('button', { name: 'Titel' })).toHaveAttribute('aria-current', 'true');
  await frames(page);
  await page.screenshot({ path: `${SHOTS}/task-5-layout-einfach.png` });

  // Wechsel auf ein Layout ohne Titel (Ruling R8): der eigene Titel bleibt frei liegen, über dem Layout; unveränderter
  // Beispielkommentar und Schul-Tag des alten Layouts werden ersetzt und stapeln sich nicht
  await (await openSlideLayouts(page)).getByRole('button', { name: 'Collage' }).click();
  await expect.poll(async () => (await project(page)).slides[0]!.layout).toBe('collage');
  const collage = await elements(page);
  expect(collage.at(-1)).toMatchObject({ id: text!.id, role: 'titel', props: { text: 'Titel' } });
  expect(collage.find((e) => e.id === photo!.id)).toMatchObject({ role: 'foto' });
  expect(collage.map((e) => e.role)).toEqual(['foto', 'sticker', 'ortTag', 'titel']);
  expect(collage.find((e) => e.id === photo!.id)!.props).toMatchObject({ frame: true });
  expect((collage.find((e) => e.id === photo!.id)!.props as { scrims?: object }).scrims).toBeUndefined(); // Verlauf des Titels unverändert: folgt der Collage (keiner)
  const collageSlide = (await project(page)).slides[0]!;
  expect([collageSlide.background, collageSlide.grain]).toEqual(['blau', true]);
  await frames(page);
  await page.screenshot({ path: `${SHOTS}/task-5-layout-collage.png` });

  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await project(page)).slides[0]!.layout).toBe('titel');
  expect(await elements(page)).toEqual(after);
  expect((await project(page)).slides[0]).toEqual(titelSlide); // Elemente und Slide-Eigenschaften im selben Undo-Schritt
  await page.keyboard.press('Control+z');
  await expect.poll(() => elements(page)).toEqual(before);
  expect((await project(page)).slides[0]).toEqual({ id: (await project(page)).slides[0]!.id, background: 'warmweiss' });
});

test('Geänderter Beispieltext und kopiertes Scribble bleiben beim Layoutwechsel, ein Undo stellt alles wieder her', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await (await openSlideLayouts(page)).getByRole('button', { name: 'Vollbild' }).click();
  await expect.poll(async () => (await project(page)).slides[0]!.layout).toBe('vollbild');
  const els = await elements(page);
  const k = els.find((e) => e.role === 'kommentar')!;
  const pfeil = els.find((e) => e.role === 'scribble')!;
  await page.evaluate(([id, props]) => window.__bbzbTest.patch(id, { props: { ...(props as object), text: 'Mein Kommentar' } }), [k.id, k.props] as const);
  await page.evaluate((id) => window.__bbzbTest.select(id), pfeil.id);
  await openSection(page, 'Ebene');
  await page.getByRole('button', { name: 'Duplizieren', exact: true }).click();
  await expect.poll(async () => (await elements(page)).length).toBe(els.length + 1);
  await page.keyboard.press('Escape');
  const before = await elements(page);

  await (await openSlideLayouts(page)).getByRole('button', { name: 'Drei Fotos' }).click();
  await expect.poll(async () => (await project(page)).slides[0]!.layout).toBe('dreiFotos');
  const after = await elements(page);
  const copy = before.at(-1)!;
  expect(after.find((e) => e.id === copy.id)).toEqual(copy); // Kopie bleibt, wo sie war
  expect(after.find((e) => e.id === k.id)).toMatchObject({ props: { text: 'Mein Kommentar' } }); // geänderter Text bleibt
  expect(after.find((e) => e.id === pfeil.id)).toBeUndefined(); // unverändertes Original ersetzt
  const grain = async () => (await project(page)).slides[0]!.grain;
  expect(await grain()).toBe(true); // Korn an
  const photos = after.filter((e) => e.type === 'photo');
  expect(photos.map((e) => (e.props as { scrims?: object }).scrims)).toEqual([undefined, undefined, undefined]); // Verlauf unten weg
  await page.keyboard.press('Control+z');
  await expect.poll(() => elements(page)).toEqual(before);
  expect(await grain()).toBeUndefined();
  expect(before.find((e) => e.type === 'photo')!.props).toMatchObject({ scrim: { side: 'unten', strength: 'stark' } });
});

test('Grenze 20 Slides: Panorama passt nicht mehr, klare Meldung', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  for (let i = 0; i < 18; i++) await addSlide(page);
  await expect(tiles(page)).toHaveCount(19);
  await addSlide(page, 'Panorama');
  await expect(page.getByRole('alert')).toHaveText('Instagram erlaubt höchstens 20 Slides. «Panorama» braucht 2 Slides.');
  await expect(tiles(page)).toHaveCount(19);
});

test('Drop auf ein freies Foto über einem Platzhalter wird ein neues Foto, Text darüber verdeckt nicht', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await (await openSlideLayouts(page)).getByRole('button', { name: 'Vollbild' }).click();
  await expect.poll(async () => (await elements(page)).length).toBe(3);
  const ph = (await elements(page)).find((e) => e.role === 'foto')!;
  await addPhoto(page, png(400, 300)); // frei, mittig über dem Platzhalter
  await expect.poll(async () => (await elements(page)).length).toBe(4);
  const free = (await elements(page)).at(-1)!;
  await dropPng(page, free.x + free.width / 2, free.y + free.height / 2, gradientPng(300, 300));
  await expect.poll(async () => (await elements(page)).length).toBe(5);
  const now = await elements(page);
  expect(now.find((e) => e.id === ph.id)!.props).not.toHaveProperty('assetId');
  expect(now.at(-1)).toMatchObject({ type: 'photo', props: { grain: false, look: true } });
  expect(now.at(-1)!.role).toBeUndefined();
  // über dem Kommentar (Text über dem Platzhalter) füllt der Drop den Platzhalter
  const k = now.find((e) => e.role === 'kommentar')!;
  await dropPng(page, k.x + 20, k.y + 20, gradientPng(300, 300));
  await expect.poll(async () => (await elements(page)).find((e) => e.id === ph.id)!.props).toHaveProperty('assetId');
});

test('«Slide hinzufügen» auf der linken Panorama-Hälfte: Panorama bleibt ganz, neue Slide an Stelle 5', async ({ page }) => {
  await newProject(page, 'Post 4:5', 'Carousel');
  await tiles(page).nth(2).click();
  await addSlide(page);
  await expect(tiles(page)).toHaveCount(7);
  await expect(tiles(page).nth(4)).toHaveAttribute('aria-current', 'true');
  const p = await project(page);
  expect(p.slides.map((s) => s.layout)).toEqual(['titel', 'vollbild', 'panorama', 'panorama', 'leer', 'collage', 'abschluss']);
  const pano = (await elements(page)).find((e) => e.type === 'photo' && e.width === 2160);
  expect(pano).toMatchObject({ x: 2 * 1080, y: 0 });
});

test('Slide-Inspector: «Layout ändern» klappt die Kacheln auf, Wahl und Slidewechsel klappen zu', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addSlide(page);
  const toggle = page.getByRole('button', { name: 'Layout ändern' });
  const list = page.getByRole('list', { name: 'Layout für diese Slide' });
  await openSection(page, 'Layout');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(list).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(list).toBeVisible();
  await expect(page.getByText('Fotos und Texte ziehen in die neuen Rahmen mit.')).toBeVisible();
  await tiles(page).nth(0).click(); // Slidewechsel klappt zu
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await list.getByRole('button', { name: 'Vollbild' }).click();
  await expect.poll(async () => (await project(page)).slides[0]!.layout).toBe('vollbild');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(list).toBeHidden();
  await expect(toggle).toBeFocused();
  await toggle.click();
  await list.getByRole('button', { name: 'Titel' }).focus();
  await page.keyboard.press('Escape'); // schliesst das Panel, Fokus auf den Knopf
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toBeFocused();
});

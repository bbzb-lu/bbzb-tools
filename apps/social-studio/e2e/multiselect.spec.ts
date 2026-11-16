import { expect, test, type Page } from '@playwright/test';
import { addSlide, elements, frames, newProject, toScreen } from './fixtures';

const marked = (page: Page) => page.locator('.layer-name[aria-pressed="true"]');
const hit = (page: Page, x: number, y: number) => page.evaluate(([x, y]) => window.__bbzbTest.hit(x!, y!), [x, y]);

/** Drei Texte auf Slide 1: A und B oben nebeneinander, C unten. */
async function threeTexts(page: Page) {
  await newProject(page, 'Post 4:5');
  const spots = [[100, 100], [600, 100], [100, 800]] as const;
  for (const [x, y] of spots) {
    await page.getByRole('button', { name: 'Text hinzufügen' }).click();
    const el = (await elements(page)).at(-1)!;
    await page.evaluate(([id, x, y]) => window.__bbzbTest.patch(id as string, { x: x as number, y: y as number, width: 300, height: 100 }), [el.id, x, y] as const);
    await page.keyboard.press('Escape');
  }
  await frames(page);
  const ids = (await elements(page)).map((e) => e.id);
  for (const [i, [x, y]] of spots.entries()) {
    const s = await toScreen(page, x + 20, y + 20);
    await expect.poll(() => hit(page, s.x, s.y)).toBe(ids[i]);
  }
  return ids;
}

test('Aufziehrahmen wählt zwei Texte, Shift-Klick ergänzt und entfernt, Klick ins Leere wählt ab', async ({ page }) => {
  const [a, b, c] = await threeTexts(page);
  const from = await toScreen(page, 40, 40);
  const to = await toScreen(page, 960, 300);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.rubberVisible())).toBe(true);
  await frames(page);
  await page.screenshot({ path: '.superpowers/sdd/2026-10-27-phase-2-10-bedienung/screens/task-4-drag.png' });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.rubberVisible())).toBe(false);
  await expect(marked(page)).toHaveCount(2);
  await frames(page);
  await page.screenshot({ path: '.superpowers/sdd/2026-10-27-phase-2-10-bedienung/screens/task-4-result.png' });
  await expect(page.locator(`[data-layer="${a}"]`)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator(`[data-layer="${b}"]`)).toHaveAttribute('aria-pressed', 'true');

  const cp = await toScreen(page, 120, 820);
  await page.keyboard.down('Shift');
  await page.mouse.click(cp.x, cp.y);
  await expect(marked(page)).toHaveCount(3);
  const ap = await toScreen(page, 120, 120);
  await page.mouse.click(ap.x, ap.y);
  await page.keyboard.up('Shift');
  await expect(marked(page)).toHaveCount(2);
  await expect(page.locator(`[data-layer="${a}"]`)).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator(`[data-layer="${c}"]`)).toHaveAttribute('aria-pressed', 'true');

  const empty = await toScreen(page, 700, 600); // unten steht jetzt die Leiste der Mehrfachauswahl
  await page.mouse.click(empty.x, empty.y);
  await expect(marked(page)).toHaveCount(0);
});

test('Klick ins Leere auf einer anderen Slide setzt die Slide, Aufziehen auf Slide 2 wählt nur dort', async ({ page }) => {
  await threeTexts(page);
  await addSlide(page);
  await page.keyboard.press('Escape');
  const tiles = page.getByRole('list', { name: 'Slides' }).getByRole('button');
  await tiles.first().click();
  const empty = await toScreen(page, 1080 + 500, 1200);
  await page.mouse.click(empty.x, empty.y);
  await expect(tiles.nth(1)).toHaveAttribute('aria-current', 'true');
  // Rahmen über die Slide-Grenze startet auf Slide 2: die Texte auf Slide 1 bleiben ungewählt
  const from = await toScreen(page, 1080 + 40, 40);
  const to = await toScreen(page, 600, 300);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await page.mouse.up();
  await expect(marked(page)).toHaveCount(0);
});

test('Leertaste ziehen verschiebt die Leinwand und zieht keinen Rahmen', async ({ page }) => {
  await threeTexts(page);
  const from = await toScreen(page, 40, 40);
  await page.keyboard.down('Space');
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 400, from.y + 100, { steps: 5 });
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.rubberVisible())).toBe(false);
  await page.mouse.up();
  await page.keyboard.up('Space');
  await expect(marked(page)).toHaveCount(0);
});

const pos = async (page: Page, id: string) => {
  const e = (await elements(page)).find((x) => x.id === id)!;
  return { x: e.x, y: e.y, width: e.width, height: e.height };
};
const SHOTS = '.superpowers/sdd/2026-10-27-phase-2-10-bedienung/screens';

test('Zwei Elemente ziehen: beide gleich weit, ein Undo stellt beide zurück; Klick und Shift-Klick wie erwartet', async ({ page }) => {
  const [a, b] = await threeTexts(page);
  const ap = await toScreen(page, 150, 150);
  await page.mouse.click(ap.x, ap.y);
  const bp = await toScreen(page, 650, 150);
  await page.keyboard.down('Shift');
  await page.mouse.click(bp.x, bp.y);
  await page.keyboard.up('Shift');
  await expect(marked(page)).toHaveCount(2);
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.transformerNodes())).toBe(2);
  // Klick ohne Zug auf ein gewähltes Element behält die Mehrfachauswahl
  await page.mouse.click(ap.x, ap.y);
  await expect(marked(page)).toHaveCount(2);

  const to = await toScreen(page, 150 + 61, 150 + 47); // weit weg von Linien: kein Einrasten
  await page.mouse.move(ap.x, ap.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => (await pos(page, a!)).x).toBeGreaterThan(130);
  const [na, nb] = [await pos(page, a!), await pos(page, b!)];
  expect(nb.x - 600).toBeCloseTo(na.x - 100, 6);
  expect(nb.y - 100).toBeCloseTo(na.y - 100, 6);
  expect(na.y).toBeGreaterThan(130);
  await page.keyboard.press('Control+z');
  await expect.poll(() => pos(page, a!)).toMatchObject({ x: 100, y: 100 });
  expect(await pos(page, b!)).toMatchObject({ x: 600, y: 100 });

  // Einrasten mit der gemeinsamen Box: die rechte Kante von B (900 + 106) rastet am Rand 1008 ein, A geht mit
  const snapTo = await toScreen(page, 150 + 106, 150);
  await page.mouse.move(ap.x, ap.y);
  await page.mouse.down();
  await page.mouse.move(snapTo.x, snapTo.y, { steps: 6 });
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.guides().x)).toBe(1008);
  await page.mouse.up();
  await expect.poll(() => pos(page, b!)).toMatchObject({ x: 708 });
  expect(await pos(page, a!)).toMatchObject({ x: 208 });
  const placed = await pos(page, a!);

  // Shift-Klick auf ein gewähltes Element nimmt es heraus und zieht es nicht
  const on = await toScreen(page, placed.x + 50, 150);
  await page.keyboard.down('Shift');
  await page.mouse.move(on.x, on.y);
  await page.mouse.down();
  await page.mouse.move(on.x + 80, on.y + 60, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await expect(marked(page)).toHaveCount(1);
  expect(await pos(page, a!)).toEqual(placed);

  // Doppelklick in der Mehrfachauswahl: Textbearbeitung nur für dieses Element
  await page.evaluate((ids) => window.__bbzbTest.selectIds(ids), [a!, b!]);
  const bOn = await toScreen(page, 708 + 50, 150);
  await page.mouse.dblclick(bOn.x, bOn.y);
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.selected())).toBe(b);
});

test('Mehrfachauswahl skalieren: Ecke skaliert beide proportional, kein Drehanfasser, Gesperrtes bleibt stehen', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  for (let i = 0; i < 3; i++) await page.evaluate(() => window.__bbzbTest.insertBrand('scribble-01'));
  await expect.poll(() => elements(page)).toHaveLength(3);
  const [s1, s2, s3] = (await elements(page)).map((e) => e.id);
  const places = [[100, 100], [500, 100], [100, 800]] as const;
  for (const [i, id] of [s1, s2, s3].entries())
    await page.evaluate(([id, x, y]) => window.__bbzbTest.patch(id as string, { x: x as number, y: y as number }), [id, places[i]![0], places[i]![1]] as const);
  await page.evaluate((id) => window.__bbzbTest.patch(id, { locked: true }), s3!);
  await page.evaluate((ids) => window.__bbzbTest.selectIds(ids), [s1!, s2!, s3!]);
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.transformerNodes())).toBe(2);
  expect((await page.evaluate(() => window.__bbzbTest.transformerAnchors())).sort()).toEqual(['bottom-left', 'bottom-right', 'top-left', 'top-right']);
  await frames(page);
  await page.screenshot({ path: `${SHOTS}/task-5-group.png` });

  const [b1, b2, b3] = [await pos(page, s1!), await pos(page, s2!), await pos(page, s3!)];
  const corner = await toScreen(page, 500 + b2.width, 100 + Math.max(b1.height, b2.height));
  await page.mouse.move(corner.x, corner.y);
  await page.mouse.down();
  await page.mouse.move(corner.x + 70, corner.y + 70, { steps: 6 });
  await frames(page);
  await page.screenshot({ path: `${SHOTS}/task-5-scale.png` });
  await page.mouse.up();
  await expect.poll(async () => (await pos(page, s1!)).width).toBeGreaterThan(b1.width + 5);
  const [n1, n2] = [await pos(page, s1!), await pos(page, s2!)];
  const f = n1.width / b1.width;
  expect(n2.width / b2.width).toBeCloseTo(f, 3);
  expect(n1.height / b1.height).toBeCloseTo(f, 3);
  expect(n1).toMatchObject({ x: 100, y: 100 });
  expect(n2.x - 100).toBeCloseTo(400 * f, 3);
  expect(await pos(page, s3!)).toEqual(b3);
  await page.keyboard.press('Control+z'); // ein Undo-Schritt für beide
  await expect.poll(() => pos(page, s1!)).toEqual(b1);
  expect(await pos(page, s2!)).toEqual(b2);

  // Ziehen: das gesperrte Element in der Auswahl bleibt stehen
  const from = await toScreen(page, 100 + b1.width / 2, 100 + b1.height / 2);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 50, from.y + 40, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => (await pos(page, s2!)).x).toBeGreaterThan(510);
  expect(await pos(page, s3!)).toEqual(b3);
});

test('Auswahl ändert sich mitten im Mehrfach-Ziehen (Esc): Store und Leinwand stimmen nach dem Loslassen überein', async ({ page }) => {
  const [a, b] = await threeTexts(page);
  await page.evaluate((ids) => window.__bbzbTest.selectIds(ids), [a!, b!]);
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.transformerNodes())).toBe(2);
  const from = await toScreen(page, 150, 150);
  const to = await toScreen(page, 150 + 61, 150 + 47);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await frames(page);
  const canvas = await page.evaluate((ids) => ids.map((id) => window.__bbzbTest.nodePos(id)), [a!, b!]);
  expect(canvas[0]!.x).toBeGreaterThan(130);
  expect([await pos(page, a!), await pos(page, b!)].map(({ x, y }) => ({ x, y }))).toEqual(canvas);
});

test('Gruppe mit gedrehtem Element: Shift gibt das Seitenverhältnis nicht frei, Drehung bleibt', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  for (let i = 0; i < 2; i++) await page.evaluate(() => window.__bbzbTest.insertBrand('scribble-01'));
  await expect.poll(() => elements(page)).toHaveLength(2);
  const [s1, s2] = (await elements(page)).map((e) => e.id);
  await page.evaluate(([a, b]) => {
    window.__bbzbTest.patch(a!, { x: 100, y: 100 });
    window.__bbzbTest.patch(b!, { x: 500, y: 150, rotation: 15 });
    window.__bbzbTest.selectIds([a!, b!]);
  }, [s1!, s2!]);
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.transformerNodes())).toBe(2);
  await frames(page);
  const b1 = await pos(page, s1!);
  const corner = await toScreen(page, 100, 100); // oben links: fester Punkt unten rechts
  await page.keyboard.down('Shift');
  await page.mouse.move(corner.x, corner.y);
  await page.mouse.down();
  await page.mouse.move(corner.x - 80, corner.y - 10, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await expect.poll(async () => (await pos(page, s1!)).width).toBeGreaterThan(b1.width + 5);
  const r2 = (await elements(page)).find((e) => e.id === s2)!.rotation;
  expect(r2).toBeCloseTo(15, 3);
});

test('Tastatur: Strg + A, Pfeile, Strg + C / V auf anderer Slide, Entf', async ({ page }) => {
  const ids = await threeTexts(page);
  const slide = (n: number) => page.getByRole('list', { name: 'Slides' }).getByRole('button').nth(n);
  const ap = await toScreen(page, 150, 150);
  await page.mouse.click(ap.x, ap.y); // Fokus von der Werkzeugleiste auf die Leinwand
  await page.keyboard.press('Control+a');
  await expect(marked(page)).toHaveCount(3);
  const before = await pos(page, ids[0]!);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Shift+ArrowDown');
  const after = await pos(page, ids[0]!);
  expect([after.x - before.x, after.y - before.y]).toEqual([1, 10]);
  expect((await pos(page, ids[2]!)).y).toBe(810);

  await page.keyboard.press('ControlOrMeta+c');
  await addSlide(page);
  await expect(slide(1)).toHaveAttribute('aria-current', 'true');
  await page.keyboard.press('ControlOrMeta+v');
  await expect(marked(page)).toHaveCount(3);
  const all = await elements(page);
  expect(all).toHaveLength(6);
  expect(all.filter((e) => e.x >= 1080)).toHaveLength(3);

  await page.keyboard.press('Delete');
  await expect.poll(async () => (await elements(page)).length).toBe(3);
});

test('Pfeile auf dem Deckkraft-Regler bedienen den Regler, nicht das Element', async ({ page }) => {
  const [a] = await threeTexts(page);
  const ap = await toScreen(page, 150, 150);
  await page.mouse.click(ap.x, ap.y);
  const slider = page.getByRole('slider', { name: 'Deckkraft' });
  await slider.focus();
  const v = await slider.inputValue();
  const before = await pos(page, a!);
  await page.keyboard.press('ArrowLeft');
  expect(await slider.inputValue()).not.toBe(v);
  expect(await pos(page, a!)).toEqual(before);
  const empty = await toScreen(page, 700, 1200);
  await page.mouse.click(empty.x, empty.y);
  await page.mouse.click(ap.x, ap.y); // Fokus zurück auf die Leinwand, Element neu gewählt
  await page.keyboard.press('ArrowRight');
  expect((await pos(page, a!)).x).toBe(before.x + 1);
});

test('Sperren in der Mehrfachauswahl sperrt beide, der Knopf zeigt danach «Entsperren»', async ({ page }) => {
  const [a, b] = await threeTexts(page);
  await page.evaluate((ids) => window.__bbzbTest.selectIds(ids), [a!, b!]);
  const props = page.getByLabel('Eigenschaften');
  const lock = props.getByRole('button', { name: 'Sperren', exact: true });
  await page.screenshot({ path: '.superpowers/sdd/2026-11-13-phase-5-sammelrunde/screens/task-9-multi-lock.png' });
  await expect(lock).toHaveAttribute('aria-pressed', 'false');
  await lock.click();
  await expect.poll(async () => (await elements(page)).filter((e) => e.locked).map((e) => e.id)).toEqual([a, b]);
  const unlock = props.getByRole('button', { name: 'Entsperren', exact: true });
  await expect(unlock).toHaveAttribute('aria-pressed', 'true');
  await unlock.click();
  await expect.poll(async () => (await elements(page)).filter((e) => e.locked)).toHaveLength(0);
});

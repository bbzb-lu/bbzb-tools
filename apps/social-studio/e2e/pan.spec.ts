import { expect, test, type Page } from '@playwright/test';
import { elements, frames, newProject, toScreen } from './fixtures';

const scroller = (page: Page) => page.locator('.canvas-scroll');
const pos = (page: Page) => scroller(page).evaluate((e) => ({ x: e.scrollLeft, y: e.scrollTop }));
const cursor = (page: Page) => scroller(page).evaluate((e) => getComputedStyle(e.querySelector('canvas')!).cursor);

async function zoomed(page: Page, withText = false) {
  await newProject(page, 'Post 4:5');
  if (withText) {
    await page.getByRole('button', { name: 'Text hinzufügen' }).click();
    await expect.poll(() => elements(page)).toHaveLength(1);
  }
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Vergrössern' }).click();
  await expect(page.locator('.zoom-value')).toHaveText(/^2\d\d %$/);
  // Fokus bleibt absichtlich auf dem angeklickten Button (Maus): die Leertaste muss trotzdem verschieben
}

async function dragFrom(page: Page, button: 'left' | 'middle', dx: number, dy: number) {
  const box = (await scroller(page).boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down({ button });
  await page.mouse.move(x + dx / 2, y + dy / 2);
  await page.mouse.move(x + dx, y + dy);
  return () => page.mouse.up({ button });
}

test('Leertaste und Ziehen verschieben die Leinwand, nichts im Dokument', async ({ page }) => {
  await zoomed(page);
  const before = await pos(page);
  const docBefore = await elements(page);
  await page.keyboard.down('Space');
  await expect(scroller(page)).toHaveClass(/pan-ready/);
  expect(await cursor(page)).toBe('grab');
  const up = await dragFrom(page, 'left', -120, -40);
  expect(await cursor(page)).toBe('grabbing');
  await up();
  await page.keyboard.up('Space');
  const after = await pos(page);
  expect(after.x - before.x).toBeCloseTo(120, 0);
  expect(after.y - before.y).toBeCloseTo(40, 0);
  expect(await elements(page)).toEqual(docBefore);
  await expect(page.getByRole('button', { name: 'Rückgängig' })).toBeDisabled();
  await expect(scroller(page)).not.toHaveClass(/pan-ready|panning/);
});

test('Leertaste ohne Ziehen ändert nichts, auch nicht die Auswahl', async ({ page }) => {
  await zoomed(page);
  const before = await pos(page);
  const docBefore = await elements(page);
  await page.keyboard.press('Space');
  expect(await pos(page)).toEqual(before);
  expect(await elements(page)).toEqual(docBefore);
  await expect(page.getByRole('button', { name: 'Rückgängig' })).toBeDisabled();
});

test('Mittlere Maustaste verschiebt, ohne Auswahl und ohne Auto-Scroll', async ({ page }) => {
  await zoomed(page);
  const box = (await scroller(page).boundingBox())!;
  const p = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(p.x, p.y);
  await page.evaluate(() => {
    const w = window as unknown as { __md?: boolean };
    // Capture am Fenster, damit es vor dem Abfangen der Leinwand läuft; defaultPrevented gilt nach der Weitergabe, daher mouseup abwarten.
    window.addEventListener('mousedown', (m) => setTimeout(() => (w.__md = m.button === 1 && m.defaultPrevented)), true);
  });
  const before = await pos(page);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(p.x - 30, p.y - 20);
  await page.mouse.move(p.x - 60, p.y - 40);
  await page.mouse.up({ button: 'middle' });
  const after = await pos(page);
  expect(after.x - before.x).toBeCloseTo(60, 0);
  expect(after.y - before.y).toBeCloseTo(40, 0);
  expect(await page.evaluate(() => (window as unknown as { __md?: boolean }).__md)).toBe(true);
  expect(await page.evaluate(() => window.__bbzbTest.selected())).toBeNull();
  await expect(page.getByRole('button', { name: 'Rückgängig' })).toBeDisabled();
});

test('Leertaste tippt ein Leerzeichen im Projektnamen und im Text auf der Leinwand', async ({ page }) => {
  await zoomed(page, true);
  await scroller(page).evaluate((e) => e.scrollTo(0, 0));
  await frames(page);
  const name = page.getByLabel('Projektname');
  await name.fill('Sport');
  await name.press('Space');
  await name.pressSequentially('tag');
  await expect(name).toHaveValue('Sport tag');
  await expect(scroller(page)).not.toHaveClass(/pan-ready/);
  const p = await toScreen(page, 100, 100);
  await page.mouse.dblclick(p.x, p.y);
  await expect(page.locator('textarea')).toBeFocused();
  const before = await pos(page);
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('a b');
  await expect(page.locator('textarea')).toHaveValue('a b');
  expect(await pos(page)).toEqual(before);
});

test('Leertaste während eines Element-Ziehens stört das Ziehen nicht', async ({ page }) => {
  await zoomed(page, true);
  await scroller(page).evaluate((e) => e.scrollTo(0, 0));
  await frames(page);
  const [el] = await elements(page);
  const p = await toScreen(page, el!.x + 20, el!.y + 20);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 20, p.y + 10);
  await page.keyboard.press('Space');
  await page.mouse.move(p.x + 60, p.y + 30);
  await page.mouse.up();
  const [after] = await elements(page);
  expect(after!.x).toBeGreaterThan(el!.x + 10);
  await expect(scroller(page)).not.toHaveClass(/pan-ready|panning/);
});

const undoOff = (page: Page) => expect(page.getByRole('button', { name: 'Rückgängig' })).toBeDisabled();

test('Leertaste nach Mausklick auf einen Button verschiebt, löst ihn nicht aus', async ({ page }) => {
  await zoomed(page);
  const zoom = await page.locator('.zoom-value').textContent();
  await expect(page.getByRole('button', { name: 'Vergrössern' })).toBeFocused();
  const before = await pos(page);
  await page.keyboard.down('Space');
  const up = await dragFrom(page, 'left', -80, -30);
  await up();
  await page.keyboard.up('Space');
  expect((await pos(page)).x - before.x).toBeCloseTo(80, 0);
  await expect(page.locator('.zoom-value')).toHaveText(zoom!);
  expect(await page.evaluate(() => window.__bbzbTest.selected())).toBeNull();
  await undoOff(page);
});

test('Leertaste nach Klick auf «Slide duplizieren» dupliziert nicht', async ({ page }) => {
  await zoomed(page);
  await page.getByRole('button', { name: 'Slide duplizieren' }).click();
  await expect(page.getByRole('button', { name: 'Slide duplizieren' })).toBeFocused();
  const n = await page.evaluate(() => window.__bbzbTest.project().slides.length);
  expect(n).toBe(2);
  await page.keyboard.press('Space');
  expect(await page.evaluate(() => window.__bbzbTest.project().slides.length)).toBe(n);
  // andere Tasten ändern den Mausmodus nicht: Strg+Z, dann Leertaste und Ziehen verschiebt weiter
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Shift');
  const m = await page.evaluate(() => window.__bbzbTest.project().slides.length);
  const before = await pos(page);
  await page.keyboard.down('Space');
  const up = await dragFrom(page, 'left', -70, 0);
  await up();
  await page.keyboard.up('Space');
  expect((await pos(page)).x - before.x).toBeCloseTo(70, 0);
  expect(await page.evaluate(() => window.__bbzbTest.project().slides.length)).toBe(m);
});

test('Per Tab fokussierter Button wird mit der Leertaste ausgelöst', async ({ page }) => {
  await zoomed(page);
  await page.getByRole('button', { name: 'Slide duplizieren' }).focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.project().slides.length)).toBe(2);
});

test('Per Tab fokussiert, dann mit der Maus geklickt: Leertaste verschiebt, dupliziert nicht', async ({ page }) => {
  await zoomed(page);
  const dup = page.getByRole('button', { name: 'Slide duplizieren' });
  await dup.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(dup).toBeFocused();
  await dup.click(); // kein Fokuswechsel, also kein focusin: der Klick allein muss in den Mausmodus wechseln
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.project().slides.length)).toBe(2);
  const before = await pos(page);
  await page.keyboard.down('Space');
  const up = await dragFrom(page, 'left', -60, 0);
  await up();
  await page.keyboard.up('Space');
  expect((await pos(page)).x - before.x).toBeCloseTo(60, 0);
  expect(await page.evaluate(() => window.__bbzbTest.project().slides.length)).toBe(2);
});

test('Leertaste auf der ersten Kachel der Layout-Wahl wählt das Layout, verschiebt nicht', async ({ page }) => {
  await page.goto('');
  await page.getByRole('button', { name: 'Post 4:5' }).click(); // Maus: Fokus kommt per Programm auf die erste Kachel
  const picker = page.locator('#slide-layouts');
  await expect(picker.getByRole('button').first()).toBeFocused();
  await page.keyboard.down('Space');
  await expect(scroller(page)).not.toHaveClass(/pan-ready/);
  await page.keyboard.up('Space');
  await expect(picker).toBeHidden();
});

for (const mode of ['Leertaste', 'mittlere Maustaste'] as const) {
  test(`Ziehen mit ${mode} auf einem Element verschiebt die Leinwand, nicht das Element`, async ({ page }) => {
    await zoomed(page, true);
    await scroller(page).evaluate((e) => e.scrollTo(0, 0));
    await frames(page);
    const [el] = await elements(page);
    const p = await toScreen(page, el!.x + 20, el!.y + 20);
    await page.evaluate(() => (window.__bbzbTest.select as (id: string | null) => void)(null));
    const before = await pos(page);
    await page.mouse.move(p.x, p.y);
    if (mode === 'Leertaste') await page.keyboard.down('Space');
    const button = mode === 'Leertaste' ? 'left' : 'middle';
    await page.mouse.down({ button });
    await page.mouse.move(p.x - 30, p.y - 20);
    await page.mouse.move(p.x - 60, p.y - 40);
    await page.mouse.up({ button });
    if (mode === 'Leertaste') await page.keyboard.up('Space');
    expect((await elements(page))[0]).toMatchObject({ x: el!.x, y: el!.y });
    expect(await page.evaluate(() => window.__bbzbTest.selected())).toBeNull();
    expect(await pos(page)).not.toEqual(before);
    expect(await page.evaluate(() => window.__bbzbTest.project().order.length)).toBe(1);
    // kein Undo-Schritt durchs Verschieben: ein Undo nimmt nur das Hinzufügen des Textes zurück
    await page.keyboard.press('Control+z');
    expect(await page.evaluate(() => window.__bbzbTest.project().order.length)).toBe(0);
  });
}

test('Leertaste tippt ein Leerzeichen in einem Inspector-Feld', async ({ page }) => {
  await zoomed(page);
  await page.evaluate(() => window.__bbzbTest.insertTag('ort'));
  const field = page.getByRole('textbox', { name: 'Text' });
  await field.fill('Ab');
  await field.press('Space');
  await field.pressSequentially('c');
  await expect(field).toHaveValue('Ab c');
});

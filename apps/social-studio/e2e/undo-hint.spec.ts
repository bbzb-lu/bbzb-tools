import { expect, test, type Page } from '@playwright/test';
import { live, markLive, only, openReviewProject, sameLive, select, shot } from './contextBar';
import { addSlide, elements, openSection, openSlideLayouts } from './fixtures';
import { notice } from '../src/tokens';

test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] }, viewport: { width: 1280, height: 720 } });

const UNDO_MS = notice.undoMs;
const inspectorBtn = (page: Page, name: string) => page.getByLabel('Eigenschaften').getByRole('button', { name, exact: true });
const undoBtn = (page: Page) => page.locator('.context-bar').getByRole('button', { name: 'Rückgängig', exact: true });
const history = (page: Page) => page.evaluate(() => window.__bbzbTest.history());

test('Ebene gelöscht: Hinweis mit «Rückgängig» statt Meldung oben; «Rückgängig» holt sie in einem Schritt zurück', async ({ page }) => {
  await openReviewProject(page, 'Undo eins', false);
  await select(page, 'e0');
  await markLive(page); // die Region steht schon, bevor der Hinweis kommt
  const h0 = await history(page);
  await inspectorBtn(page, 'Löschen').click();
  await expect.poll(async () => (await elements(page)).length).toBe(1);
  await only(page, 'Ebene gelöscht');
  await expect(live(page)).toHaveText('Ebene gelöscht');
  await sameLive(page);
  await expect(page.locator('.notice')).toHaveCount(0);
  expect(await page.locator('.context-bar').evaluate((e) => e.contains(document.activeElement))).toBe(false);
  await shot(page, 'task-B-rueckgaengig');
  await undoBtn(page).click();
  await expect.poll(async () => (await elements(page)).map((e) => e.id)).toEqual(['e0', 'e1']);
  expect(await history(page)).toBe(h0);
  await expect(page.locator('.context-bar')).toHaveCount(0);
});

test('Mehrere Elemente und Slides: «2 Elemente gelöscht», «Slide gelöscht»', async ({ page }) => {
  await openReviewProject(page, 'Undo mehr', false);
  await select(page, 'e0', 'e1');
  await page.keyboard.press('Delete');
  await only(page, '2 Elemente gelöscht');
  await addSlide(page);
  await expect(page.locator('.context-bar')).toHaveCount(0); // neue Aktion: der Hinweis gilt nicht mehr
  await page.getByRole('button', { name: 'Slide löschen' }).click();
  await only(page, 'Slide gelöscht');
  await undoBtn(page).click();
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.project().slides.length)).toBe(2);
});

test('«Rückgängig» nur, solange das Löschen die letzte Aktion ist: danach verschwindet der Hinweis', async ({ page }) => {
  await openReviewProject(page, 'Undo letzte', false);
  await select(page, 'e0');
  await page.keyboard.press('Delete');
  await only(page, 'Ebene gelöscht');
  await select(page, 'e1');
  await page.keyboard.press('ArrowRight'); // verschiebt e1: neuer History-Schritt
  await expect(page.locator('.context-bar')).toHaveCount(0);
  await page.keyboard.press('Control+z'); // Verschieben zurück: das Löschen ist wieder die letzte Aktion, der Hinweis kommt nicht wieder
  await expect.poll(async () => (await elements(page))[0]!.x).toBe(580);
  await expect(page.locator('.context-bar')).toHaveCount(0);
  // Strg + Z direkt nach dem Löschen: der Hinweis geht mit
  await select(page, 'e1');
  await page.keyboard.press('Delete');
  await only(page, 'Ebene gelöscht');
  await page.keyboard.press('Control+z');
  await expect(page.locator('.context-bar')).toHaveCount(0);
  await page.keyboard.press('Control+y');
  await expect(page.locator('.context-bar')).toHaveCount(0);
});

test('Hinweis verschwindet nach etwa 6 s; Hover und Fokus halten ihn', async ({ page }) => {
  await page.clock.install();
  await openReviewProject(page, 'Undo Zeit', false);
  await select(page, 'e0');
  await page.keyboard.press('Delete');
  await only(page, 'Ebene gelöscht');
  await page.clock.runFor(UNDO_MS - 500);
  await only(page, 'Ebene gelöscht');
  await page.clock.runFor(600);
  await expect(page.locator('.context-bar')).toHaveCount(0);
  await select(page, 'e1');
  await page.keyboard.press('Delete');
  await page.locator('.context-bar').hover();
  await page.clock.runFor(UNDO_MS * 2);
  await only(page, 'Ebene gelöscht');
  await page.mouse.move(5, 400);
  await undoBtn(page).focus();
  await page.clock.runFor(UNDO_MS * 2);
  await only(page, 'Ebene gelöscht');
  await undoBtn(page).blur();
  await page.clock.runFor(UNDO_MS + 100);
  await expect(page.locator('.context-bar')).toHaveCount(0);
});

test('Fokus in der Leiste hält den Hinweis auch, wenn die Maus rein- und wieder rausfährt', async ({ page }) => {
  await page.clock.install();
  await openReviewProject(page, 'Undo Fokus', false);
  await select(page, 'e0');
  await page.keyboard.press('Delete');
  await only(page, 'Ebene gelöscht');
  await undoBtn(page).focus();
  await page.locator('.context-bar').hover();
  await page.mouse.move(5, 400);
  await page.clock.runFor(UNDO_MS * 2);
  await only(page, 'Ebene gelöscht');
  await page.locator('.context-bar').hover(); // Maus drin, Fokus geht: hält weiter
  await undoBtn(page).blur();
  await page.clock.runFor(UNDO_MS * 2);
  await only(page, 'Ebene gelöscht');
});

test('Ein von einer höheren Leiste verdrängter Hinweis kommt nach Ablauf der Zeit nicht wieder', async ({ page }) => {
  await page.clock.install();
  await openReviewProject(page, 'Undo verdrängt', false);
  await select(page, 'e0');
  await page.keyboard.press('Delete');
  await only(page, 'Ebene gelöscht');
  const crop = async () => {
    await select(page, 'e1');
    await openSection(page, 'Bild');
    await page.getByRole('button', { name: 'Ausschnitt bearbeiten' }).click();
    await only(page, 'Ausschnitt');
  };
  await crop();
  await page.clock.runFor(1000);
  await page.keyboard.press('Escape');
  await only(page, 'Ebene gelöscht'); // innerhalb der Zeit kommt er zurück
  await crop();
  await page.clock.runFor(UNDO_MS * 3);
  await page.keyboard.press('Escape');
  await expect(page.locator('.context-bar')).toHaveCount(0);
});

test('Layout gewechselt auf einer Slide mit Inhalt: Hinweis mit «Rückgängig»', async ({ page }) => {
  await openReviewProject(page, 'Undo Layout', false);
  const h0 = await history(page);
  const list = await openSlideLayouts(page);
  await list.getByRole('button', { name: 'Vollbild' }).click();
  await only(page, 'Layout gewechselt');
  await undoBtn(page).click();
  await expect.poll(() => history(page)).toBe(h0);
});

type Rect = { left: number; top: number; right: number; bottom: number };
const meets = (a: Rect, b: Rect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
const measure = (page: Page) =>
  page.evaluate(() => {
    const r = (e: Element | null) => (e ? (({ left, top, right, bottom }) => ({ left, top, right, bottom }))(e.getBoundingClientRect()) : null);
    const v = window.__bbzbTest.view();
    const st = document.querySelector('.konvajs-content')!.getBoundingClientRect();
    const els = window.__bbzbTest.project().elements;
    const frame = (id: string) => {
      const e = els[id]!;
      return { left: st.left + v.x + e.x * v.scale, top: st.top + v.y + e.y * v.scale, right: st.left + v.x + (e.x + e.width) * v.scale, bottom: st.top + v.y + (e.y + e.height) * v.scale };
    };
    return { stage: r(document.querySelector('.konvajs-content')), view: v, frames: [frame('e0'), frame('e1')], bar: r(document.querySelector('.context-bar')) };
  });

test('Platzierung: die Leiste ändert die Leinwand nicht und verdeckt die gewählten Elemente nicht (unten, sonst oben)', async ({ page }) => {
  await openReviewProject(page, 'Platz', false);
  const before = await measure(page);
  await select(page, 'e0', 'e1');
  await only(page, '2 Elemente');
  let m = await measure(page);
  expect([m.stage, m.view]).toEqual([before.stage, before.view]);
  for (const f of m.frames) expect(meets(m.bar!, f)).toBe(false);
  // Fotos ganz unten: die Leiste stellt sich nach oben
  await select(page);
  await page.evaluate(() => ['e0', 'e1'].forEach((id) => window.__bbzbTest.patch(id, { y: 900 })));
  await select(page, 'e0', 'e1');
  await expect(page.locator('.context-bar.top')).toBeVisible();
  m = await measure(page);
  for (const f of m.frames) expect(meets(m.bar!, f)).toBe(false);
  expect([m.stage, m.view]).toEqual([before.stage, before.view]);
  // Auswahl verschieben (Dokumentänderung, wie Ziehen oder Pfeiltasten), während die Leiste steht: nach oben, die Leiste geht nach unten; wieder hinunter, die Leiste geht nach oben
  await page.evaluate(() => ['e0', 'e1'].forEach((id) => window.__bbzbTest.patch(id, { y: 100 })));
  await expect(page.locator('.context-bar.top')).toHaveCount(0);
  await only(page, '2 Elemente');
  await page.evaluate(() => ['e0', 'e1'].forEach((id) => window.__bbzbTest.patch(id, { y: 900 })));
  await expect(page.locator('.context-bar.top')).toBeVisible();
  m = await measure(page);
  for (const f of m.frames) expect(meets(m.bar!, f)).toBe(false);
});

test('Reduced Motion: die Leiste erscheint ohne Animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openReviewProject(page, 'Ruhig');
  await only(page, 'Bitte prüfen');
  const style = await page.locator('.context-bar').evaluate((e) => getComputedStyle(e).animationName);
  expect(style).toBe('none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  expect(await page.locator('.context-bar').evaluate((e) => getComputedStyle(e).animationName)).not.toBe('none');
});

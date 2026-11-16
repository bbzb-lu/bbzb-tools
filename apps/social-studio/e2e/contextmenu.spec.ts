import { expect, test, type Page } from '@playwright/test';
import { addPhoto, addSlide, elements, frames, newProject, openLayers, png, toScreen } from './fixtures';

const SHOTS = '.superpowers/sdd/2026-10-27-phase-2-10-bedienung/screens';
const menu = (page: Page) => page.getByRole('menu', { name: 'Kontextmenü' });
const item = (page: Page, name: string) => menu(page).getByRole('menuitem', { name, exact: true });
const marked = (page: Page) => page.locator('.layer-name[aria-pressed="true"]');

/** Ein Foto und ein Text; liefert die Ebenen-Zeilen. */
async function photoAndText(page: Page) {
  await newProject(page, 'Post 4:5');
  await addPhoto(page, png(400, 300));
  await expect.poll(() => elements(page)).toHaveLength(1);
  await page.getByRole('button', { name: 'Text hinzufügen' }).click();
  await expect.poll(() => elements(page)).toHaveLength(2);
  const [photo, text] = await elements(page);
  await page.evaluate(([a, b]) => {
    window.__bbzbTest.patch(a!, { x: 100, y: 200, width: 500, height: 400 });
    window.__bbzbTest.patch(b!, { x: 100, y: 800, width: 400, height: 100 });
  }, [photo!.id, text!.id]);
  await page.keyboard.press('Escape');
  await openLayers(page);
  await frames(page);
  return { photo: photo!, text: text! };
}
const layer = (page: Page, id: string) => page.locator(`[data-layer="${id}"]`);

test('Rechtsklick auf ein Foto: Menü mit Fotoeinträgen, Duplizieren kopiert, Esc schliesst und gibt den Fokus zurück', async ({ page }) => {
  const { photo } = await photoAndText(page);
  const at = await toScreen(page, 300, 400);
  await page.mouse.click(at.x, at.y, { button: 'right' });
  await expect(menu(page)).toBeVisible();
  await expect(menu(page).getByRole('menuitem')).toHaveCount(13);
  for (const n of ['Ausschnitt bearbeiten', 'Maske bearbeiten', 'Spiegeln', 'Kopieren', 'Löschen']) await expect(item(page, n)).toBeVisible();
  await expect(item(page, 'Text bearbeiten')).toHaveCount(0);
  await expect(item(page, 'Einfügen')).toHaveAttribute('aria-disabled', 'true');
  await expect(item(page, 'Kopieren')).toBeFocused();
  await page.screenshot({ path: `${SHOTS}/task-9-foto.png` });
  await item(page, 'Duplizieren').click();
  await expect(menu(page)).toBeHidden();
  await expect.poll(() => elements(page)).toHaveLength(3);
  expect((await elements(page)).filter((e) => e.type === 'photo')).toHaveLength(2);

  // Esc: Menü zu, Fokus zurück auf die Ebenenzeile, Auswahl bleibt
  await layer(page, photo.id).focus();
  await layer(page, photo.id).click({ button: 'right' });
  await expect(menu(page)).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await expect(item(page, 'Ausschneiden')).toBeFocused();
  await page.keyboard.press('End');
  await expect(item(page, 'Spiegeln')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu(page)).toBeHidden();
  await expect(layer(page, photo.id)).toBeFocused();
  await expect(layer(page, photo.id)).toHaveAttribute('aria-pressed', 'true');
});

test('Rechtsklick im Ebenen-Panel: Text bearbeiten, Sperren, Löschen deaktiviert', async ({ page }) => {
  const { text } = await photoAndText(page);
  await layer(page, text.id).click({ button: 'right' });
  await expect(menu(page)).toBeVisible();
  await expect(item(page, 'Text bearbeiten')).toBeVisible();
  await item(page, 'Sperren').click();
  expect((await elements(page)).find((e) => e.id === text.id)!.locked).toBe(true);
  await layer(page, text.id).click({ button: 'right' });
  await expect(item(page, 'Entsperren')).toBeVisible();
  await expect(item(page, 'Löschen')).toHaveAttribute('aria-disabled', 'true');
  await item(page, 'Löschen').click({ force: true }); // bleibt offen und tut nichts
  await expect(menu(page)).toBeVisible();
  expect(await elements(page)).toHaveLength(2);
  await page.keyboard.press('Escape');
  await layer(page, text.id).click({ button: 'right' });
  await item(page, 'Entsperren').click();
  await layer(page, text.id).click({ button: 'right' });
  await item(page, 'Text bearbeiten').click();
  await expect(page.locator('textarea')).toBeFocused();
});

test('Rechtsklick wählt ein nicht gewähltes Element, behält eine Mehrfachauswahl', async ({ page }) => {
  const { photo, text } = await photoAndText(page);
  await page.evaluate((id) => window.__bbzbTest.select(id), photo.id);
  const t = await toScreen(page, 200, 850);
  await page.mouse.click(t.x, t.y, { button: 'right' });
  await expect(menu(page)).toBeVisible();
  await expect(marked(page)).toHaveCount(1);
  await expect(layer(page, text.id)).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');

  await page.evaluate((ids) => window.__bbzbTest.selectIds(ids), [photo.id, text.id]);
  await expect(marked(page)).toHaveCount(2);
  const p = await toScreen(page, 300, 400);
  await page.mouse.click(p.x, p.y, { button: 'right' });
  await expect(menu(page)).toBeVisible();
  await expect(marked(page)).toHaveCount(2);
  await expect(item(page, 'Text bearbeiten')).toHaveCount(0);
  await expect(item(page, 'Ausschnitt bearbeiten')).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/task-9-zwei.png` });
  await page.mouse.click(5, 5); // ausserhalb schliesst
  await expect(menu(page)).toBeHidden();
});

test('Leere Fläche: nur Einfügen; Einfügen nach Kopieren', async ({ page }) => {
  await photoAndText(page);
  const src = await toScreen(page, 200, 850);
  await page.mouse.click(src.x, src.y, { button: 'right' });
  await item(page, 'Kopieren').click();
  const empty = await toScreen(page, 900, 1200);
  await page.mouse.click(empty.x, empty.y, { button: 'right' });
  await expect(menu(page).getByRole('menuitem')).toHaveCount(1);
  await expect(marked(page)).toHaveCount(0);
  await expect(item(page, 'Einfügen')).not.toHaveAttribute('aria-disabled', 'true');
  await page.screenshot({ path: `${SHOTS}/task-9-leer.png` });
  await item(page, 'Einfügen').click();
  await expect.poll(() => elements(page)).toHaveLength(3);
});

test('Rechtsklick startet keinen Aufziehrahmen und kein Ziehen', async ({ page }) => {
  const { photo } = await photoAndText(page);
  const from = await toScreen(page, 700, 1000);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(from.x - 150, from.y - 150, { steps: 5 });
  expect(await page.evaluate(() => window.__bbzbTest.rubberVisible())).toBe(false);
  await page.mouse.up({ button: 'right' });
  await page.keyboard.press('Escape');
  // Rechts-Ziehen auf dem Foto verschiebt es nicht
  const a = await toScreen(page, 300, 400);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(a.x + 100, a.y + 100, { steps: 5 });
  await page.mouse.up({ button: 'right' });
  const after = (await elements(page)).find((e) => e.id === photo.id)!;
  expect([after.x, after.y]).toEqual([100, 200]);
});

test('Menü bleibt im Fenster', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 560 });
  await photoAndText(page);
  const size = page.viewportSize()!;
  const t = await toScreen(page, 200, 850);
  await page.mouse.click(t.x, t.y, { button: 'right' });
  await expect(menu(page)).toBeVisible();
  const b = (await menu(page).boundingBox())!;
  expect(b.x + b.width).toBeLessThanOrEqual(size.width);
  expect(b.y + b.height).toBeLessThanOrEqual(size.height);
  expect(b.y).toBeGreaterThanOrEqual(0);
  expect(b.y).toBeLessThan(t.y); // nach oben gerückt statt am Zeiger
  await page.screenshot({ path: `${SHOTS}/task-9-rand.png` });
});

test('Im Namensfeld der Ebene: Menü fürs Textfeld, das Umbenennen bleibt offen', async ({ page }) => {
  const { text } = await photoAndText(page);
  await layer(page, text.id).dblclick();
  const field = page.getByRole('textbox', { name: 'Name der Ebene' });
  await field.click({ button: 'right' });
  await expect(menu(page).getByRole('menuitem', { name: 'Alles auswählen' })).toBeVisible();
  await expect(field).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(field).toBeFocused();
});

test('Rechtsklick auf einen Anfasser der Mehrfachauswahl behält die Auswahl', async ({ page }) => {
  const { photo, text } = await photoAndText(page);
  await page.evaluate((ids) => window.__bbzbTest.selectIds(ids), [photo.id, text.id]);
  await frames(page);
  const corner = await toScreen(page, 100, 200); // linke obere Ecke der Gruppe (Anfasser)
  await page.mouse.click(corner.x, corner.y, { button: 'right' });
  await expect(item(page, 'Duplizieren')).toBeVisible();
  await expect(marked(page)).toHaveCount(2);
});

test('Gesperrtes Element: Ausschneiden ist deaktiviert und tut nichts', async ({ page }) => {
  const { text } = await photoAndText(page);
  await layer(page, text.id).click({ button: 'right' });
  await item(page, 'Sperren').click();
  await layer(page, text.id).click({ button: 'right' });
  await expect(item(page, 'Ausschneiden')).toHaveAttribute('aria-disabled', 'true');
});

test('Menüaktionen wirken: Ausschneiden + Einfügen, Nach vorne, Ausblenden', async ({ page }) => {
  const { text } = await photoAndText(page);
  // Ausschneiden entfernt, Einfügen holt es zurück
  await layer(page, text.id).click({ button: 'right' });
  await item(page, 'Ausschneiden').click();
  await expect.poll(() => elements(page)).toHaveLength(1);
  const empty = await toScreen(page, 900, 1200);
  await page.mouse.click(empty.x, empty.y, { button: 'right' });
  await item(page, 'Einfügen').click();
  await expect.poll(() => elements(page)).toHaveLength(2);
  expect((await elements(page)).filter((e) => e.type === 'text')).toHaveLength(1);
  // Nach vorne: beide überlappen, das untere rückt nach oben
  const [a, b] = (await elements(page)).map((e) => e.id);
  await page.evaluate(([x, y]) => {
    window.__bbzbTest.patch(x!, { x: 100, y: 200, width: 300, height: 300 });
    window.__bbzbTest.patch(y!, { x: 150, y: 250, width: 300, height: 300 });
  }, [a!, b!]);
  const lower = (await elements(page))[0]!.id;
  const upper = (await elements(page))[1]!.id;
  await layer(page, lower).click({ button: 'right' });
  await item(page, 'Nach vorne').click();
  expect((await elements(page)).map((e) => e.id)).toEqual([upper, lower]);
  // Ausblenden und wieder Einblenden
  await layer(page, lower).click({ button: 'right' });
  await item(page, 'Ausblenden').click();
  expect((await elements(page)).find((e) => e.id === lower)!.visible).toBe(false);
  await layer(page, lower).click({ button: 'right' });
  await expect(item(page, 'Einblenden')).toBeVisible();
});

test('Menü «Kopieren», Slide wechseln, Strg + V fügt ein (Marker in der Zwischenablage)', async ({ page }) => {
  const { text } = await photoAndText(page);
  await layer(page, text.id).click({ button: 'right' });
  await item(page, 'Kopieren').click();
  await addSlide(page);
  await page.keyboard.press('ControlOrMeta+v');
  await expect.poll(async () => (await elements(page)).filter((e) => e.type === 'text')).toHaveLength(2);
});

// Windows: die rechte Taste geht vor «contextmenu» hoch; mit dem Klick davor zählte Konva das als Doppelklick.
test('Windows-Rechtsklick gleich nach einem Klick: Menü des Elements, kein Doppelklick', async ({ page }) => {
  await photoAndText(page);
  // Mac und Linux melden «contextmenu» beim Drücken; hier zurückhalten und wie Windows erst nach dem Loslassen schicken
  await page.evaluate(() => window.addEventListener('contextmenu', (e) => e.isTrusted && e.stopImmediatePropagation(), true));
  const winRightClick = async (x: number, y: number) => {
    await page.mouse.down({ button: 'right' });
    await page.mouse.up({ button: 'right' });
    await page.evaluate(([cx, cy]) => {
      document.elementFromPoint(cx!, cy!)!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: cx, clientY: cy }));
    }, [x, y]);
  };
  for (const [x, y, entry] of [[300, 400, 'Maske bearbeiten'], [300, 850, 'Text bearbeiten']] as const) {
    const at = await toScreen(page, x, y);
    await page.mouse.click(at.x, at.y);
    await winRightClick(at.x, at.y);
    await expect(item(page, entry)).toBeVisible();
    expect(await page.evaluate(() => { const u = window.__bbzbTest.ui(); return [u.cropEditId, u.textEditId]; })).toEqual([null, null]);
    await page.keyboard.press('Escape');
  }
});

test('Spiegeln hat ein Untermenü: Pfeil rechts öffnet, Waagrecht und Senkrecht kippen das Foto, Pfeil links und Esc schliessen nur das Untermenü', async ({ page }) => {
  const { photo } = await photoAndText(page);
  const props = () => page.evaluate((id) => (window.__bbzbTest.elements().find((e) => e.id === id)!.props as { flipX?: boolean; flipY?: boolean }), photo.id);
  const open = async () => {
    const at = await toScreen(page, 300, 400);
    await page.mouse.click(at.x, at.y, { button: 'right' });
    await page.keyboard.press('End');
    await expect(item(page, 'Spiegeln')).toHaveAttribute('aria-haspopup', 'menu');
    await expect(item(page, 'Spiegeln')).toHaveAttribute('aria-expanded', 'false');
  };
  await open();
  await page.keyboard.press('ArrowRight');
  await expect(item(page, 'Spiegeln')).toHaveAttribute('aria-expanded', 'true');
  const sub = page.getByRole('menu', { name: 'Spiegeln' });
  await expect(sub.getByRole('menuitem')).toHaveText(['Waagrecht', 'Senkrecht']);
  // Symbol zeigt die Achse wie im Entwurf: waagerecht = senkrechte Achse
  await expect(sub.getByRole('menuitem', { name: 'Waagrecht' }).locator('svg.tabler-icon-flip-horizontal')).toHaveCount(1);
  await expect(sub.getByRole('menuitem', { name: 'Senkrecht' }).locator('svg.tabler-icon-flip-vertical')).toHaveCount(1);
  await expect(sub.getByRole('menuitem', { name: 'Waagrecht' })).toBeFocused();
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/task-13a-rechtsklick-untermenue.png` });
  await page.keyboard.press('ArrowLeft');
  await expect(sub).toHaveCount(0);
  await expect(item(page, 'Spiegeln')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(sub.getByRole('menuitem', { name: 'Waagrecht' })).toBeFocused();
  await page.keyboard.press('Escape'); // im Untermenü: nur das Untermenü zu
  await expect(sub).toHaveCount(0);
  await expect(menu(page)).toBeVisible();
  await page.keyboard.press('Enter'); // Enter am Elterneintrag öffnet ebenfalls
  await expect(sub.getByRole('menuitem', { name: 'Waagrecht' })).toBeFocused();
  await page.keyboard.press('Enter'); // Waagrecht
  await expect(menu(page)).toBeHidden();
  expect((await props()).flipX).toBe(true);

  await open();
  await item(page, 'Spiegeln').click();
  await sub.getByRole('menuitem', { name: 'Senkrecht' }).click();
  await expect(menu(page)).toBeHidden();
  expect(await props()).toMatchObject({ flipX: true, flipY: true });
});

test('Maus: Zeiger auf «Spiegeln» öffnet das Untermenü, der Klick lässt es offen, «Senkrecht» spiegelt in einem Undo-Schritt', async ({ page }) => {
  const { photo } = await photoAndText(page);
  const flipY = () => page.evaluate((id) => !!(window.__bbzbTest.elements().find((e) => e.id === id)!.props as { flipY?: boolean }).flipY, photo.id);
  const at = await toScreen(page, 300, 400);
  await page.mouse.click(at.x, at.y, { button: 'right' });
  await item(page, 'Spiegeln').hover();
  const sub = page.getByRole('menu', { name: 'Spiegeln' });
  await expect(sub).toBeVisible();
  await item(page, 'Spiegeln').click();
  await expect(sub).toBeVisible();
  await expect(item(page, 'Spiegeln')).toHaveAttribute('aria-expanded', 'true');
  await sub.getByRole('menuitem', { name: 'Senkrecht' }).click();
  await expect(menu(page)).toBeHidden();
  expect(await flipY()).toBe(true);
  await page.keyboard.press('Control+z');
  expect(await flipY()).toBe(false);
});

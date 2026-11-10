import { expect, test, type Page } from '@playwright/test';
import { addPhoto, elements, newProject, openLayers, png, toScreen, addSlide, openSection, openAllSections } from './fixtures';

const LIMIT = 'Instagram erlaubt höchstens 20 Slides.';
const tile = (page: Page, n: number) => page.getByRole('button', { name: `Slide ${n}`, exact: true });
const tiles = (page: Page) => page.getByRole('list', { name: 'Slides' }).getByRole('button');
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

async function photoProject(page: Page) {
  await newProject(page, 'Post 4:5');
  await addPhoto(page, png(1200, 1500));
  await expect.poll(() => elements(page)).toHaveLength(1);
}

/** Klick relativ zur linken oberen Ecke von Slide 1, in Bildschirm-px. */
async function clickCanvas(page: Page, x: number, y: number) {
  const o = await toScreen(page, 0, 0);
  await page.mouse.click(o.x + x, o.y + y);
}

test('Slide umsortieren nimmt nahtübergreifendes Foto mit', async ({ page }) => {
  await photoProject(page);
  const id = (await elements(page))[0]!.id;
  await page.evaluate((i) => window.__bbzbTest.patch(i, { x: 300 }), id); // Mitte bleibt auf Slide 1, rechter Teil ragt in Slide 2
  await expect.poll(async () => (await elements(page))[0]!.x).toBe(300);
  await addSlide(page);
  await addSlide(page);
  await expect(tiles(page)).toHaveCount(3);
  await tile(page, 1).dragTo(tile(page, 3));
  await expect.poll(async () => (await elements(page))[0]!.x).toBe(300 + 2 * 1080);
  await expect(tile(page, 3)).toHaveAttribute('aria-current', 'true');
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await elements(page))[0]!.x).toBe(300);
});

test('Kachel per Tastatur verschieben behält den Fokus', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addSlide(page);
  await expect(tile(page, 2)).toHaveAttribute('aria-current', 'true');
  await openSection(page, 'Hintergrund');
  await page.getByRole('radio', { name: 'Orange' }).check(); // Hintergrund von Slide 2
  await tile(page, 2).focus();
  await page.keyboard.press('Alt+ArrowLeft');
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.project().slides.map((s) => s.background))).toEqual([
    'orange',
    'warmweiss',
  ]);
  await expect(tile(page, 1)).toBeFocused();
  await expect(tile(page, 1)).toHaveAttribute('aria-current', 'true');
  await expect(page.getByRole('heading', { name: 'Slide 1' })).toBeVisible();
});

test('Alt + Pfeil auf dem Button verschiebt die Slide, im Editor sonst nie zurück im Verlauf', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addSlide(page);
  await openSection(page, 'Hintergrund');
  await page.getByRole('radio', { name: 'Orange' }).check(); // Hintergrund von Slide 2
  const url = page.url();
  const order = () => page.evaluate(() => window.__bbzbTest.project().slides.map((s) => s.background));
  await button(page, 'Slide hinzufügen').focus(); // Buttonreihe: Alt + Pfeil gilt der aktuellen Slide
  await page.keyboard.press('Alt+ArrowLeft');
  await expect.poll(order).toEqual(['orange', 'warmweiss']);
  expect(page.url()).toBe(url);
  // ausserhalb von Kacheln und Buttons: nichts bewegt sich, der Editor bleibt
  await page.getByRole('radio', { name: 'Orange' }).focus();
  await page.keyboard.press('Alt+ArrowLeft');
  await page.locator('.konvajs-content').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Alt+ArrowLeft');
  await page.waitForTimeout(300);
  expect(page.url()).toBe(url);
  expect(await order()).toEqual(['orange', 'warmweiss']);
  await expect(page.getByLabel('Projektname')).toBeVisible();
});

test('Undo und Duplizieren wirken mit Fokus auf Farbfeld und Regler', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const bg = () => page.evaluate(() => window.__bbzbTest.project().slides[0]!.background);
  await openSection(page, 'Hintergrund');
  await page.getByRole('radio', { name: 'Orange' }).check();
  await expect.poll(bg).toBe('orange');
  await expect(page.getByRole('radio', { name: 'Orange' })).toBeFocused();
  await page.keyboard.press('Control+z');
  await expect.poll(bg).toBe('warmweiss');
  // Text: Ctrl+D mit Fokus auf dem Grössenregler, Delete dort wirkungslos
  await page.getByRole('button', { name: 'Text hinzufügen' }).click();
  await page.getByRole('slider', { name: 'Grösse' }).focus();
  await page.keyboard.press('Control+d');
  await expect.poll(() => elements(page)).toHaveLength(2);
  await page.getByRole('slider', { name: 'Grösse' }).press('Delete');
  expect(await elements(page)).toHaveLength(2);
});

test('Auswahl eines Elements wählt seine Slide', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addSlide(page);
  await page.getByRole('button', { name: 'Text hinzufügen' }).click(); // auf Slide 2
  await page.keyboard.press('Escape');
  await tile(page, 1).click();
  const scale = await page.evaluate(() => (document.querySelector('.canvas-scroll')!.clientHeight - 48) / 1350);
  await clickCanvas(page, 1300 * scale, 130 * scale);
  await expect(tile(page, 2)).toHaveAttribute('aria-current', 'true');
});

test('Datei neben der Leinwand ablegen öffnet sie nicht', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const prevented = await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.items.add(new File(['x'], 'foto.png', { type: 'image/png' }));
    const target = document.querySelector('.inspector')!;
    return ['dragover', 'drop'].map((type) => {
      const ev = new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true });
      target.dispatchEvent(ev);
      return ev.defaultPrevented;
    });
  });
  expect(prevented).toEqual([true, true]);
  expect(await elements(page)).toEqual([]);
});

test('21. Slide geht nicht', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const add = button(page, 'Slide hinzufügen');
  for (let i = 0; i < 19; i++) await addSlide(page);
  await expect(tiles(page)).toHaveCount(20);
  await expect(add).toBeDisabled();
  await expect(add).toHaveAttribute('data-tip', LIMIT);
  await expect(button(page, 'Slide duplizieren')).toBeDisabled();
  await expect(tile(page, 20)).toHaveAttribute('aria-current', 'true');
  await expect(tile(page, 20)).toBeInViewport();
});

test('letzte Slide lässt sich nicht löschen', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const del = button(page, 'Slide löschen');
  await expect(del).toBeDisabled();
  // Sichtbar unterscheidbar von «Löschen» im Inspector, nicht nur für Screenreader.
  await expect(del).toHaveText('Slide löschen');
  await expect(button(page, 'Slide duplizieren')).toHaveAttribute('data-tip', 'Slide duplizieren');
  await button(page, 'Slide duplizieren').click();
  await expect(tiles(page)).toHaveCount(2);
  await del.click();
  await expect(tiles(page)).toHaveCount(1);
  await expect(del).toBeDisabled();
  await expect(tile(page, 1)).toHaveAttribute('aria-current', 'true');
});

test('Delete und Ctrl+Z', async ({ page }) => {
  await photoProject(page);
  const undo = button(page, 'Rückgängig');
  const redo = button(page, 'Wiederholen');
  await expect(redo).toBeDisabled();
  await page.keyboard.press('Control+d');
  await expect.poll(() => elements(page)).toHaveLength(2);
  await page.keyboard.press('Delete');
  await expect.poll(() => elements(page)).toHaveLength(1);
  await expect(page.getByText('Wähle ein Element aus.')).toHaveCount(0); // Slide-Inspector statt leerem Panel
  await page.keyboard.press('Control+z');
  await expect.poll(() => elements(page)).toHaveLength(2);
  await expect(redo).toBeEnabled();
  await redo.click();
  await expect.poll(() => elements(page)).toHaveLength(1);
  await undo.click();
  await undo.click();
  await expect.poll(() => elements(page)).toHaveLength(1);
  // Escape hebt die Auswahl auf, Delete wirkt dann nicht mehr
  await clickCanvas(page, 76, 76);
  await openSection(page, 'Ebene');
  await expect(button(page, 'Löschen')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Slide 1' })).toBeVisible();
  await page.keyboard.press('Delete');
  expect(await elements(page)).toHaveLength(1);
});

test('Deckkraft per Tastatur, Sperren und Ausblenden im Ebenen-Panel', async ({ page }) => {
  await photoProject(page);
  await openLayers(page);
  await clickCanvas(page, 76, 76);
  await openSection(page, 'Darstellung');
  // Deckkraft per Tastatur: ein Undo-Schritt
  const slider = page.getByRole('slider', { name: 'Deckkraft' });
  await slider.focus();
  await page.keyboard.press('ArrowLeft');
  await expect.poll(async () => (await elements(page))[0]!.opacity).toBeCloseTo(0.99);
  await expect(slider).toBeFocused(); // Undo wirkt auch mit Fokus auf dem Regler
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await elements(page))[0]!.opacity).toBe(1);
  // Sperren: Delete und «Löschen» wirken nicht
  // Sperren und Ausblenden liegen nur noch im Ebenen-Panel (nicht mehr im Inspector)
  const layerRow = page.getByRole('list', { name: 'Ebenen' }).getByRole('listitem');
  await expect(page.getByLabel('Eigenschaften').getByRole('button', { name: 'Sperren', exact: true })).toHaveCount(0);
  await layerRow.getByRole('button', { name: 'Sperren', exact: true }).click();
  await expect(layerRow.getByRole('button', { name: 'Entsperren', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await openSection(page, 'Ebene');
  await expect(button(page, 'Löschen')).toBeDisabled();
  await expect(page.getByRole('slider', { name: 'Deckkraft' })).toBeDisabled();
  await page.locator('body').press('Delete');
  expect(await elements(page)).toHaveLength(1);
  await layerRow.getByRole('button', { name: 'Ausblenden', exact: true }).click();
  await expect.poll(async () => (await elements(page))[0]!.visible).toBe(false);
});

test('Inspector zeigt Deckkraft, keine Positionsfelder, Sperren und Ausblenden nur im Ebenen-Panel', async ({ page }) => {
  await photoProject(page);
  await openLayers(page);
  await openAllSections(page);
  for (const name of ['Duplizieren', 'An gleicher Stelle duplizieren', 'Nach vorne', 'Nach hinten', 'Löschen']) await expect(button(page, name)).toBeVisible();
  const inspector = page.getByLabel('Eigenschaften');
  await expect(inspector.getByRole('slider', { name: 'Deckkraft' })).toHaveCount(1);
  // Deckkraft, die vier Bildregler und «Weiche Kante» im Abschnitt «Maske»; keine Felder für X, Y, Breite, Höhe, Drehung
  const fields = await inspector.getByRole('spinbutton').evaluateAll((l) => l.map((e) => e.getAttribute('aria-label')));
  expect(fields.sort()).toEqual(['Deckkraft', 'Helligkeit', 'Kontrast', 'Sättigung', 'Wärme', 'Weiche Kante'].sort());
  await expect(inspector.getByRole('button', { name: 'Sperren', exact: true })).toHaveCount(0);
  await expect(inspector.getByRole('button', { name: 'Ausblenden', exact: true })).toHaveCount(0);
  await expect(page.getByRole('list', { name: 'Ebenen' }).getByRole('button', { name: 'Sperren', exact: true })).toHaveCount(1);
});

test('abgebrochene Zeigergeste (pointercancel) blockiert das Mitscrollen nicht', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  for (let i = 0; i < 5; i++) await addSlide(page);
  const scroll = page.locator('.canvas-scroll');
  await expect.poll(() => scroll.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  const box = (await page.locator('.konvajs-content').boundingBox())!;
  // Touch-Geste, die der Browser abbricht: pointerdown ohne pointerup.
  const at = { clientX: box.x + 40, clientY: box.y + 5, pointerId: 1, isPrimary: true, bubbles: true };
  await page.locator('.konvajs-content').dispatchEvent('pointerdown', at);
  await page.locator('.konvajs-content').dispatchEvent('pointercancel', at);
  await tile(page, 1).focus();
  await page.keyboard.press('Enter'); // ohne Zeigerereignis
  await expect(tile(page, 1)).toHaveAttribute('aria-current', 'true');
  await expect.poll(() => scroll.evaluate((el) => el.scrollLeft)).toBe(0);
});

test('Slide-Wechsel: Auswahl nur, wenn das Element auf der neuen Slide liegt', async ({ page }) => {
  await photoProject(page);
  await openLayers(page);
  const id = (await elements(page))[0]!.id;
  await page.evaluate((i) => window.__bbzbTest.patch(i, { x: 300 }), id); // ragt von Slide 1 in Slide 2
  await addSlide(page);
  await tile(page, 2).click();
  await button(page, 'Text hinzufügen').click();
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.transformerNodes())).toBe(1);
  await openSection(page, 'Ebene');
  await expect(button(page, 'Löschen')).toBeVisible();
  // Text liegt nur auf Slide 2
  await tile(page, 1).click();
  await expect(page.getByRole('heading', { name: 'Slide 1' })).toBeVisible();
  expect(await page.evaluate(() => window.__bbzbTest.transformerNodes())).toBe(0);
  // Foto über der Naht bleibt auf Slide 2 gewählt
  await page.getByRole('list', { name: 'Ebenen' }).getByRole('button', { name: 'Foto 1', exact: true }).click();
  await tile(page, 2).click();
  await expect(tile(page, 2)).toHaveAttribute('aria-current', 'true');
  await expect(page.getByRole('heading', { name: 'Foto 1' })).toBeVisible();
});

test('Ctrl+D im Textfeld dupliziert nicht und öffnet keine Lesezeichen', async ({ page }) => {
  await photoProject(page);
  const name = page.getByLabel('Projektname');
  await name.focus();
  // Erst nach allen Handlern lesen (der Editor hört auf window).
  await page.evaluate(() =>
    document.addEventListener('keydown', (e) => {
      if (e.key === 'd') setTimeout(() => (document.body.dataset.prevented = String(e.defaultPrevented)));
    }),
  );
  await page.keyboard.press('Control+d');
  await expect(page.locator('body')).toHaveAttribute('data-prevented', 'true');
  expect(await elements(page)).toHaveLength(1);
});

test('gelöschtes Foto ist nach «Übersicht» nicht mehr im Projekt gespeichert', async ({ page }) => {
  await photoProject(page);
  const name = await page.getByLabel('Projektname').inputValue();
  await page.keyboard.press('Delete');
  await expect.poll(() => elements(page)).toHaveLength(0);
  await button(page, 'Übersicht').click();
  await page.getByRole('listitem').filter({ hasText: name }).getByRole('button', { name: 'Öffnen' }).click();
  await expect(page.getByLabel('Projektname')).toBeVisible();
  expect(await page.evaluate(() => window.__bbzbTest.project().assets)).toEqual({});
});

test('Alt + Pfeil verschiebt die aktuelle Slide, am Rand ohne Wirkung', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addSlide(page);
  await addSlide(page);
  const order = () => page.evaluate(() => window.__bbzbTest.project().slides.map((s) => s.background));
  await tile(page, 1).click();
  await openSection(page, 'Hintergrund');
  await page.getByRole('radio', { name: 'Orange' }).check();
  await tile(page, 1).focus();
  await page.keyboard.press('Alt+ArrowLeft'); // am linken Rand: nichts
  await expect.poll(order).toEqual(['orange', 'warmweiss', 'warmweiss']);
  await page.keyboard.press('Alt+ArrowRight');
  await expect.poll(order).toEqual(['warmweiss', 'orange', 'warmweiss']);
  await expect(tile(page, 2)).toHaveAttribute('aria-current', 'true');
  await page.keyboard.press('Control+z'); // ein Undo-Schritt
  await expect.poll(order).toEqual(['orange', 'warmweiss', 'warmweiss']);
  await tile(page, 3).click();
  await tile(page, 3).focus();
  await page.keyboard.press('Alt+ArrowRight'); // am rechten Rand: nichts
  await expect(tile(page, 3)).toBeFocused();
  await expect(tile(page, 3)).toHaveAttribute('aria-current', 'true');
  await expect.poll(order).toEqual(['orange', 'warmweiss', 'warmweiss']);
});

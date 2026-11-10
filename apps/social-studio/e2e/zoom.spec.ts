import { expect, test, type Page } from '@playwright/test';
import { addPhoto, elements, newProject, overlayVsElement, png, toScreen, view, addSlide } from './fixtures';

const zoomText = (page: Page) => page.locator('.zoom-value');
const percent = async (page: Page) => parseInt((await zoomText(page).textContent())!, 10);
async function wheelWith(page: Page, key: 'Control' | 'Alt', dy: number, times = 1) {
  await page.keyboard.down(key);
  for (let i = 0; i < times; i++) await page.mouse.wheel(0, dy);
  await page.keyboard.up(key);
}

async function addText(page: Page) {
  await newProject(page, 'Post 4:5');
  await page.getByRole('button', { name: 'Text hinzufügen' }).click();
  await expect.poll(() => elements(page)).toHaveLength(1);
}

test('Ctrl + Rad zoomt die Leinwand, nicht die Seite', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await expect(zoomText(page)).toHaveText('100 %');
  const before = (await view(page)).scale;
  const p = await toScreen(page, 540, 675);
  await page.mouse.move(p.x, p.y);
  await wheelWith(page, 'Control', -200);
  await expect.poll(() => percent(page)).toBeGreaterThan(100);
  expect((await view(page)).scale).toBeGreaterThan(before);
  expect(await page.evaluate(() => visualViewport!.scale)).toBe(1);
});

test('Alt + Rad und Pinch zoomen sanft', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const p = await toScreen(page, 540, 675);
  await page.mouse.move(p.x, p.y);
  await wheelWith(page, 'Alt', -100);
  await expect.poll(() => percent(page)).toBeGreaterThan(100);
  await page.getByRole('button', { name: 'Einpassen' }).click();
  await expect(zoomText(page)).toHaveText('100 %');
  // Touchpad-Pinch: viele kleine Schritte mit ctrlKey
  await page.mouse.move(p.x, p.y);
  await wheelWith(page, 'Control', -3.5, 10);
  await expect.poll(() => percent(page)).toBeGreaterThan(100);
  expect(await percent(page)).toBeLessThanOrEqual(110);
});

/** Zoomt mit Ctrl + Rad um einen Weltpunkt; Punkt und Element unter dem Zeiger bleiben (höchstens 1.5 Bildschirm-px). */
async function expectAnchored(page: Page, wx: number, wy: number, id: string) {
  const p = await toScreen(page, wx, wy);
  expect(await page.evaluate(([x, y]) => window.__bbzbTest.hit(x!, y!), [p.x, p.y])).toBe(id);
  const world = async () => {
    const box = (await page.locator('.konvajs-content').boundingBox())!;
    const v = await view(page);
    return { x: (p.x - box.x - v.x) / v.scale, y: (p.y - box.y - v.y) / v.scale, scale: v.scale };
  };
  const w0 = await world();
  await page.mouse.move(p.x, p.y);
  await wheelWith(page, 'Control', -300, 2);
  await expect.poll(() => percent(page)).toBeGreaterThan(200);
  const w1 = await world();
  expect(w1.scale).toBeGreaterThan(w0.scale * 2);
  expect(Math.abs(w1.x - w0.x) * w1.scale).toBeLessThanOrEqual(1.5);
  expect(Math.abs(w1.y - w0.y) * w1.scale).toBeLessThanOrEqual(1.5);
  expect(await page.evaluate(([x, y]) => window.__bbzbTest.hit(x!, y!), [p.x, p.y])).toBe(id);
}

test('Punkt unter dem Zeiger bleibt: eine Story-Slide, schmaler als die Ansicht', async ({ page }) => {
  await newProject(page, 'Story 9:16');
  await addPhoto(page, png(3000, 2000));
  await expect.poll(() => elements(page)).toHaveLength(1);
  const [photo] = await elements(page);
  await expectAnchored(page, 900, 960, photo!.id); // rechte Hälfte: braucht Scroll-Raum rechts (Foto 1080 × 720 bei y 600)
});

test('Punkt unter dem Zeiger bleibt: drei Slides', async ({ page }) => {
  await addText(page);
  const [text] = await elements(page);
  await addSlide(page);
  await addSlide(page);
  await page.getByRole('button', { name: 'Slide 1', exact: true }).click();
  await expect.poll(() => page.locator('.canvas-scroll').evaluate((e) => e.scrollLeft)).toBe(0);
  await expectAnchored(page, 120, 110, text!.id); // links im Textkasten (72..1008 × 72..201)
});

test('Bei Zoom senkrecht scrollen, danach trifft der Klick das richtige Element', async ({ page }) => {
  await addText(page);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.transformerNodes())).toBe(0);
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Vergrössern' }).click();
  await expect(zoomText(page)).toHaveText('305 %');
  // Zoom um die Mitte: der Text oben liegt jetzt ausserhalb, per Rad hochscrollen
  const scroll = page.locator('.canvas-scroll');
  const before = await scroll.evaluate((e) => e.scrollTop);
  expect(before).toBeGreaterThan(0);
  const start = await toScreen(page, 540, 675);
  await page.mouse.move(start.x, start.y);
  await page.mouse.wheel(0, -(before - 40));
  // Rad scrollt sanft: warten, bis die Position steht
  let top = -1;
  await expect.poll(async () => {
    const [prev, now] = [top, await scroll.evaluate((e) => e.scrollTop)];
    top = now;
    return now < before && now === prev;
  }).toBe(true);
  // vergrössert: halbe Ansicht Rand oben
  const half = (await scroll.evaluate((e) => e.clientHeight)) / 2;
  await expect.poll(async () => (await view(page)).y).toBeCloseTo(half - top, 0);
  const [text] = await elements(page);
  const c = await toScreen(page, text!.x + text!.width / 2, text!.y + text!.height / 2);
  await page.mouse.click(c.x, c.y);
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.transformerNodes())).toBe(1);
});

test('«Einpassen», Tastenkürzel und Projektwechsel', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const first = await page.getByLabel('Projektname').inputValue();
  await page.getByRole('button', { name: 'Vergrössern' }).click();
  await expect(zoomText(page)).toHaveText('125 %');
  await page.getByRole('button', { name: 'Einpassen' }).click();
  await expect(zoomText(page)).toHaveText('100 %');
  await expect(page.getByRole('button', { name: 'Verkleinern' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Verkleinern' })).toHaveAttribute('data-tip', 'Verkleinern');
  await expect(page.getByRole('button', { name: 'Verkleinern' })).toHaveAttribute('data-keys', 'Strg+−');
  await expect(page.getByRole('button', { name: 'Vergrössern' })).toHaveAttribute('data-tip', 'Vergrössern');
  await expect(page.getByRole('button', { name: 'Vergrössern' })).toHaveAttribute('data-keys', 'Strg++');
  await expect(page.getByRole('button', { name: 'Einpassen' })).toHaveAttribute('data-keys', 'Strg+0');
  await expect(page.getByRole('button', { name: 'Einpassen' })).toHaveAttribute('data-tip', 'Einpassen');
  await page.keyboard.press('Control+Equal');
  await expect(zoomText(page)).toHaveText('125 %');
  await page.keyboard.press('Control+NumpadAdd');
  await expect(zoomText(page)).toHaveText('156 %');
  await page.keyboard.press('Control+Minus');
  await expect(zoomText(page)).toHaveText('125 %');
  await page.keyboard.press('Control+Digit0');
  await expect(zoomText(page)).toHaveText('100 %');
  for (let i = 0; i < 7; i++) await page.keyboard.press('Control+Minus');
  await expect(zoomText(page)).toHaveText('25 %');
  const minus = page.getByRole('button', { name: 'Verkleinern' });
  await expect(minus).toHaveAttribute('aria-disabled', 'true');
  await minus.focus();
  await minus.click({ force: true });
  await expect(zoomText(page)).toHaveText('25 %');
  await expect(minus).toBeFocused();
  expect(await page.evaluate(() => visualViewport!.scale)).toBe(1);
  // Projekt öffnen: zurück auf «Einpassen»
  await page.getByRole('button', { name: 'Vergrössern' }).click();
  await expect(zoomText(page)).toHaveText('31 %');
  await page.getByRole('button', { name: 'Übersicht' }).click();
  await page.getByRole('listitem').filter({ hasText: first }).getByRole('button', { name: 'Öffnen' }).click();
  await expect(page.getByLabel('Projektname')).toBeVisible();
  await expect(zoomText(page)).toHaveText('100 %');
});

test('Zoom ist kein Undo-Schritt', async ({ page }) => {
  await addText(page);
  await page.getByRole('button', { name: 'Vergrössern' }).click();
  await expect(zoomText(page)).toHaveText('125 %');
  await page.keyboard.press('Control+Z'); // macht das Hinzufügen rückgängig, nicht den Zoom
  await expect.poll(() => elements(page)).toHaveLength(0);
  await expect(zoomText(page)).toHaveText('125 %');
});

test('Ausschnittmodus: Rad zoomt das Bild, Ctrl + Rad die Ansicht', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addPhoto(page, png(3000, 2000));
  await expect.poll(() => elements(page)).toHaveLength(1);
  const crop = async () => ((await elements(page))[0]!.props as { crop: { scale: number } }).crop.scale;
  const p = await toScreen(page, 540, 675);
  await page.mouse.dblclick(p.x, p.y);
  const c0 = await crop();
  await page.mouse.wheel(0, -100);
  await expect.poll(crop).toBeGreaterThan(c0);
  await expect(zoomText(page)).toHaveText('100 %');
  const c1 = await crop();
  await wheelWith(page, 'Control', -200);
  await expect.poll(() => percent(page)).toBeGreaterThan(100);
  expect(await crop()).toBe(c1);
});

test('Textbearbeitung bleibt beim Zoomen deckungsgleich', async ({ page }) => {
  await addText(page);
  const [el] = await elements(page);
  const c = await toScreen(page, el!.x + el!.width / 2, el!.y + el!.height / 2);
  await page.mouse.dblclick(c.x, c.y);
  await expect(page.locator('textarea')).toBeFocused();
  // 100 %: Slide zentriert
  expect((await view(page)).x).toBeGreaterThan(24);
  const fit = await overlayVsElement(page);
  for (const k of ['x', 'y', 'w', 'h'] as const) expect(Math.abs(fit.ta[k] - fit.el[k]), k).toBeLessThanOrEqual(1.5);
  await page.mouse.move(c.x, c.y);
  await wheelWith(page, 'Control', -300, 2);
  await expect.poll(() => percent(page)).toBeGreaterThan(200);
  await expect(page.locator('textarea')).toBeFocused();
  const { ta, el: box } = await overlayVsElement(page);
  for (const k of ['x', 'y', 'w', 'h'] as const) expect(Math.abs(ta[k] - box[k]), k).toBeLessThanOrEqual(1.5);
});

test('Alt + Rad: das Loslassen von Alt öffnet nicht das Edge-Menü', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const p = await toScreen(page, 540, 675);
  await page.mouse.move(p.x, p.y);
  await page.keyboard.down('Alt');
  await page.mouse.wheel(0, -100);
  await expect.poll(() => percent(page)).toBeGreaterThan(100);
  // nach dem Listener der App registriert: sieht dessen preventDefault
  await page.evaluate(() => {
    const w = window as unknown as { altUp?: boolean };
    window.addEventListener('keyup', (e) => void (e.key === 'Alt' && (w.altUp = e.defaultPrevented)));
  });
  await page.keyboard.up('Alt');
  expect(await page.evaluate(() => (window as unknown as { altUp?: boolean }).altUp)).toBe(true);
});

test('Fenstergrösse ändern zeigt die aktuelle Slide wieder', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 500 });
  await newProject(page, 'Post 4:5');
  for (let i = 0; i < 4; i++) await addSlide(page);
  await page.getByRole('button', { name: 'Slide 1', exact: true }).click();
  await page.getByRole('button', { name: 'Slide 5', exact: true }).click();
  const scroll = page.locator('.canvas-scroll');
  await page.setViewportSize({ width: 1400, height: 900 });
  // Slide 5 ganz sichtbar
  await expect.poll(async () => {
    const v = await view(page);
    const width = await scroll.evaluate((e) => e.clientWidth);
    const right = v.x + 5 * 1080 * v.scale;
    return right <= width + 1 && right - 1080 * v.scale >= -1;
  }).toBe(true);
});

test('Eine schmale Story-Slide bleibt beim Vergrössern mit Buttons ganz sichtbar', async ({ page }) => {
  await newProject(page, 'Story 9:16');
  const width = await page.locator('.canvas-scroll').evaluate((e) => e.clientWidth);
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Vergrössern' }).click();
    await expect(zoomText(page)).toHaveText(`${[125, 156, 195][i]} %`);
    const v = await view(page);
    expect(v.x).toBeGreaterThanOrEqual(0); // linke Kante sichtbar
    expect(v.x + 1080 * v.scale).toBeLessThanOrEqual(width); // rechte Kante sichtbar
  }
});

test('Zoom-Leiste: Gruppe, Ansage nur bei Buttons und Tasten, nicht beim Rad', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await expect(page.getByRole('group', { name: 'Zoom' })).toBeVisible();
  await expect(page.locator('.zoom-value')).not.toHaveAttribute('aria-live', /.*/);
  const live = page.locator('.zoom-bar [aria-live="polite"]');
  await page.locator('.canvas-scroll').hover(); // Maus lag sonst noch dort, wo auf der Startseite die Kachel war
  await wheelWith(page, 'Control', -100, 3);
  await expect.poll(() => percent(page)).toBeGreaterThan(100);
  await expect(live).toHaveText('');
  await page.getByRole('button', { name: 'Vergrössern' }).click();
  await expect(live).toHaveText(`Zoom ${await percent(page)} %`);
  await page.keyboard.press('Control+0');
  await expect(live).toHaveText('Zoom 100 %');
});

test('bei Zoom 100 % gibt es keinen senkrechten Scroll-Raum', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 701 });
  await newProject(page, 'Post 4:5');
  const over = () => page.locator('.canvas-scroll').evaluate((el) => el.scrollHeight - el.clientHeight);
  expect(await over()).toBeLessThanOrEqual(0);
});

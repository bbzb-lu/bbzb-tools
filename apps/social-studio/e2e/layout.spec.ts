import { expect, test, type Page } from '@playwright/test';
import { elements, newProject, toScreen, view, addSlide } from './fixtures';

const PAD = 24;
const scroll = (page: Page) => page.locator('.canvas-scroll');
const metrics = (page: Page) =>
  scroll(page).evaluate((e) => ({ left: e.scrollLeft, top: e.scrollTop, width: e.clientWidth, height: e.clientHeight, scrollWidth: e.scrollWidth }));
const tile = (page: Page, n: number) => page.getByRole('button', { name: `Slide ${n}`, exact: true });
const zoomText = (page: Page) => page.locator('.zoom-value');

async function addSlides(page: Page, n: number) {
  for (let i = 0; i < n; i++) await addSlide(page);
  await tile(page, 1).click();
}

/** Abstand links und rechts der Slides in der Ansicht (Stage-Position aus dem Test-Hook). */
async function margins(page: Page, slides: number) {
  const v = await view(page);
  const m = await metrics(page);
  return { left: v.x, right: m.width - (v.x + slides * 1080 * v.scale) };
}

test('neues Projekt: Slide waagrecht mittig, kein waagrechtes Scrollen', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await expect.poll(async () => {
    const { left, right } = await margins(page, 1);
    return Math.abs(left - right);
  }).toBeLessThanOrEqual(1);
  expect((await margins(page, 1)).left).toBeGreaterThan(PAD);
  const m = await metrics(page);
  expect([m.left, m.top, m.scrollWidth]).toEqual([0, 0, m.width]);
  expect((await view(page)).y).toBeCloseTo(PAD, 5);
});

test('Slides breiter als die Ansicht: links Rand PAD wie bisher', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 600 });
  await newProject(page, 'Post 4:5');
  await addSlides(page, 2);
  await expect.poll(async () => (await metrics(page)).left).toBe(0);
  expect((await view(page)).x).toBeCloseTo(PAD, 5);
});

test('Zoom 100 % → 300 % → 60 %: Punkt unter dem Zeiger bleibt, verkleinert wieder ohne Scrollen', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 600 });
  await newProject(page, 'Post 4:5');
  await addSlides(page, 9); // 10 Slides: auch bei 60 % breiter als die Ansicht
  // Mitte von Slide 5: weit genug rechts, dass der Anker auch bei 60 % (nur PAD Rand links) Platz hat
  await tile(page, 5).click();
  await expect.poll(async () => (await metrics(page)).left).toBeGreaterThan(0);
  // ganze Pixel: das Rad-Ereignis meldet clientX/Y ganzzahlig
  const p = await toScreen(page, 4 * 1080 + 540, 675).then(({ x, y }) => ({ x: Math.round(x), y: Math.round(y) }));
  const world = async () => {
    const box = (await page.locator('.konvajs-content').boundingBox())!;
    const v = await view(page);
    return { x: (p.x - box.x - v.x) / v.scale, y: (p.y - box.y - v.y) / v.scale, scale: v.scale };
  };
  const w0 = await world();
  await page.mouse.move(p.x, p.y);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -732); // e^(732 · 0.0015) = 3
  await expect.poll(async () => parseInt((await zoomText(page).textContent())!, 10)).toBe(300);
  const w1 = await world();
  expect(Math.abs(w1.x - w0.x) * w1.scale).toBeLessThanOrEqual(1.5);
  expect(Math.abs(w1.y - w0.y) * w1.scale).toBeLessThanOrEqual(1.5);
  await page.mouse.wheel(0, 1073); // 300 % · e^(−1073 · 0.0015) = 60 %
  await page.keyboard.up('Control');
  await expect(zoomText(page)).toHaveText('60 %');
  const w2 = await world();
  // waagrecht hält der Anker, senkrecht ist der Inhalt wieder mittig und ohne Scroll-Raum
  expect(Math.abs(w2.x - w0.x) * w2.scale).toBeLessThanOrEqual(1.5);
  const m = await metrics(page);
  expect(m.top).toBe(0);
  const v = await view(page);
  expect(v.y).toBeCloseTo((m.height - 1350 * v.scale) / 2, 0);
});

test('«Einpassen» nach dem Vergrössern: Slide wieder mittig, Scroll 0', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Vergrössern' }).click();
  await expect.poll(async () => (await metrics(page)).left).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Einpassen' }).click();
  await expect(zoomText(page)).toHaveText('100 %');
  await expect.poll(async () => [(await metrics(page)).left, (await metrics(page)).top]).toEqual([0, 0]);
  const { left, right } = await margins(page, 1);
  expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
});

async function expectSlideAt(page: Page, wx: number, n: number) {
  const p = await toScreen(page, wx, 675);
  const m = await scroll(page).boundingBox();
  expect(p.x).toBeGreaterThan(m!.x);
  expect(p.x).toBeLessThan(m!.x + m!.width);
  await page.mouse.click(p.x, p.y);
  await expect(tile(page, n)).toHaveAttribute('aria-current', 'true');
}

test('Klick auf die leere Slide wählt die richtige Slide, zentriert und vergrössert', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 600 }); // zwei Slides passen eingepasst nebeneinander (seit 4c ohne Werkzeugleiste über der Leinwand)
  await newProject(page, 'Post 4:5');
  await addSlides(page, 1);
  expect((await view(page)).x).toBeGreaterThan(PAD); // zwei Slides passen: zentriert
  await expectSlideAt(page, 1080 + 50, 2);
  await expectSlideAt(page, 1080 - 50, 1);
  // Buttons zoomen um die Mitte der Slides, also um die Naht
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Vergrössern' }).click();
  await expect(zoomText(page)).toHaveText('244 %');
  await expectSlideAt(page, 1080 + 50, 2);
  await expectSlideAt(page, 1080 - 50, 1);
});

/** Legt ein PNG am Weltpunkt ab (wie aus dem Explorer gezogen). */
async function dropPhoto(page: Page, wx: number, wy: number) {
  const p = await toScreen(page, wx, wy);
  const dataTransfer = await page.evaluateHandle(async () => {
    const c = new OffscreenCanvas(400, 500);
    c.getContext('2d')!.fillRect(0, 0, 400, 500);
    const dt = new DataTransfer();
    dt.items.add(new File([await c.convertToBlob()], 'foto.png', { type: 'image/png' }));
    return dt;
  });
  await scroll(page).dispatchEvent('drop', { dataTransfer, clientX: p.x, clientY: p.y });
}

test('Datei-Drop landet auf der Slide unter dem Zeiger, zentriert und vergrössert', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addSlides(page, 1);
  await dropPhoto(page, 1080 + 300, 675);
  await expect.poll(() => elements(page)).toHaveLength(1);
  await expect(tile(page, 2)).toHaveAttribute('aria-current', 'true');
  expect((await elements(page))[0]!.x).toBeGreaterThanOrEqual(1080);
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Vergrössern' }).click();
  await expect(zoomText(page)).toHaveText('244 %');
  await dropPhoto(page, 1080 - 50, 675);
  await expect.poll(() => elements(page)).toHaveLength(2);
  await expect(tile(page, 1)).toHaveAttribute('aria-current', 'true');
  expect((await elements(page))[1]!.x).toBeLessThan(1080);
});

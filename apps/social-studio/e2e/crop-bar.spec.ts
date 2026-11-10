import { expect, test, type Page } from '@playwright/test';
import { addPhoto, addSlide, elements, newProject, openSection, png } from './fixtures';
import { alphaPng, openPhoto } from './photoProject';

// Echte Bildlaufleisten wie unter Windows: die Leiste muss über der waagrechten stehen (Playwright blendet sie sonst aus).
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

test('Ausschnitt-Leiste: erscheint im Ausschnittmodus mit Hinweis, «Fertig» beendet ihn, Esc ebenso', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addPhoto(page, png(400, 300));
  await expect.poll(() => elements(page)).toHaveLength(1);
  const geometry = async () => JSON.stringify(((await elements(page))[0]!) && (({ x, y, width, height, props }) => ({ x, y, width, height, crop: (props as { crop: unknown }).crop }))((await elements(page))[0]!));
  const before = await geometry();
  const bar = page.getByRole('group', { name: 'Ausschnitt' });
  await expect(bar).toHaveCount(0);
  await openSection(page, 'Bild');
  await page.getByRole('button', { name: 'Ausschnitt bearbeiten' }).click();
  await expect(bar).toBeVisible();
  await expect(bar).toContainText('Ziehen verschiebt das Bild');
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/task-13a-ausschnitt.png` });
  expect(await geometry()).toBe(before); // die Leiste ändert nichts am Modell
  await bar.getByRole('button', { name: 'Fertig' }).click();
  await expect(bar).toHaveCount(0);
  expect(await geometry()).toBe(before);
  expect(await page.evaluate(() => window.__bbzbTest.ui().cropEditId)).toBeNull();
  await page.getByRole('button', { name: 'Ausschnitt bearbeiten' }).click();
  await expect(bar).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(bar).toHaveCount(0);
});

const BOX = { x: 140, y: 275, width: 800, height: 800 };
const GAP = 12; // 0.75rem

/** Rechtecke auf dem Bildschirm: Stage, Foto-Rahmen, Leiste und Oberkante der waagrechten Bildlaufleiste. */
const measure = (page: Page) =>
  page.evaluate(() => {
    const r = (e: Element | null) => (e ? (({ left, top, right, bottom }) => ({ left, top, right, bottom }))(e.getBoundingClientRect()) : null);
    const scroll = document.querySelector<HTMLElement>('.canvas-scroll')!;
    const s = scroll.getBoundingClientRect();
    const v = window.__bbzbTest.view();
    const st = document.querySelector('.konvajs-content')!.getBoundingClientRect();
    const e = window.__bbzbTest.project().elements.e0!;
    return {
      stage: r(document.querySelector('.konvajs-content')),
      view: v,
      zoom: window.__bbzbTest.ui().zoom,
      frame: { left: st.left + v.x + e.x * v.scale, top: st.top + v.y + e.y * v.scale, right: st.left + v.x + (e.x + e.width) * v.scale, bottom: st.top + v.y + (e.y + e.height) * v.scale },
      bar: r(document.querySelector('.context-bar')),
      scrollbarTop: s.top + scroll.clientTop + scroll.clientHeight,
      scrollbarH: scroll.offsetHeight - scroll.clientHeight - scroll.clientTop,
      scrollMid: s.left + scroll.clientLeft + scroll.clientWidth / 2,
    };
  });
type Rect = { left: number; top: number; right: number; bottom: number };
const meets = (a: Rect, b: Rect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

for (const size of [{ width: 1280, height: 720 }, { width: 1536, height: 864 }]) {
  for (const slides of [1, 6]) {
    test(`Ausschnitt-Leiste ${size.width} × ${size.height}, ${slides} Slide(s): über der Bildlaufleiste, Leinwand unverändert, Foto frei`, async ({ page }) => {
      await page.setViewportSize(size);
      await openPhoto(page, `Leiste ${slides}`, BOX, { crop: { x: -100, y: -100, scale: 1 } }, alphaPng(1000, 1000, [15, 27, 38], () => 255), [540, 675]);
      for (let i = 1; i < slides; i++) await addSlide(page);
      if (slides > 1) await page.locator('.slide-tile[data-slide="0"]').click();
      await page.evaluate(() => window.__bbzbTest.select('e0'));
      await openSection(page, 'Bild');
      const before = await measure(page);
      await page.getByRole('button', { name: 'Ausschnitt bearbeiten' }).click();
      const bar = page.getByRole('group', { name: 'Ausschnitt' });
      await expect(bar).toBeVisible();
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const m = await measure(page);
      expect([m.stage, m.view, m.zoom]).toEqual([before.stage, before.view, before.zoom]); // Leinwand und Slide stehen still
      expect(m.scrollbarH).toBeGreaterThanOrEqual(12); // die Leiste ist wirklich da
      expect(m.bar!.bottom).toBeLessThanOrEqual(m.scrollbarTop - GAP + 0.5);
      expect(Math.abs((m.bar!.left + m.bar!.right) / 2 - m.scrollMid)).toBeLessThanOrEqual(1);
      expect(meets(m.bar!, m.frame)).toBe(false);
      if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/crop-bar-${size.width}-${slides}.png` });
      await bar.getByRole('button', { name: 'Fertig' }).click();
      await expect(bar).toHaveCount(0);
      expect((await measure(page)).stage).toEqual(before.stage);
    });
  }
}

test('Ausschnitt-Leiste: verdeckt sie unten das Foto, steht sie oben', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  // Foto im unteren Viertel der Slide: unten läge die Leiste darauf
  await openPhoto(page, 'Unten', { x: 140, y: 1000, width: 800, height: 330 }, {}, alphaPng(800, 330, [15, 27, 38], () => 255), [540, 1150]);
  await page.evaluate(() => window.__bbzbTest.select('e0'));
  await openSection(page, 'Bild');
  await page.getByRole('button', { name: 'Ausschnitt bearbeiten' }).click();
  await expect(page.locator('.context-bar.top')).toBeVisible();
  const m = await measure(page);
  expect(meets(m.bar!, m.frame)).toBe(false);
  expect(m.bar!.top).toBeLessThan(m.frame.top);
  await page.keyboard.press('Escape');
  await expect(page.locator('.context-bar')).toHaveCount(0);
});

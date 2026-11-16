import { expect, test } from '@playwright/test';
import { newProject } from './fixtures';

// Echte Bildlaufleisten wie unter Windows: Playwright blendet sie sonst mit --hide-scrollbars aus.
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

test('Hauptviewport und Panels haben die Bildlaufleiste im Theme, Scrollen geht weiter', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await newProject(page, 'Post 4:5', 'Carousel');
  const theme = await page.evaluate(() => {
    const px = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--scrollbar'));
    const probe = (sel: string) => { const e = document.querySelector<HTMLElement>(sel)!; return { sel, w: e.offsetWidth - e.clientWidth - 2 * e.clientLeft, h: e.offsetHeight - e.clientHeight }; };
    return { px, bars: ['.canvas-scroll', '.inspector'].map(probe) };
  });
  expect(theme.px).toBeGreaterThanOrEqual(12);
  expect(theme.bars[0]).toMatchObject({ w: theme.px, h: theme.px }); // senkrecht und waagrecht am Hauptviewport
  expect(theme.bars[1]!.w).toBe(theme.px);
  // Griff: Tinte auf Papiergrau, eckig
  const scroll = page.locator('.canvas-scroll');
  expect(await scroll.evaluate((e) => getComputedStyle(e, '::-webkit-scrollbar-thumb').borderRadius)).toBe('0px');
  expect(await scroll.evaluate((e) => getComputedStyle(e, '::-webkit-scrollbar-thumb').backgroundColor))
    .toBe(await page.evaluate(() => { const d = document.createElement('i'); d.style.color = 'var(--ink)'; document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c; }));
  // Scrollen funktioniert weiter: Rad und Tastatur
  const box = (await scroll.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const left = () => scroll.evaluate((e) => e.scrollLeft);
  expect(await scroll.evaluate((e) => e.scrollWidth > e.clientWidth)).toBe(true);
  await page.mouse.wheel(300, 0);
  await expect.poll(left).toBeGreaterThan(0);
});

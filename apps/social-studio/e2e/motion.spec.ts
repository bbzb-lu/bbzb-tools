import { expect, test, type Page } from '@playwright/test';
import { newProject } from './fixtures';

/** Tasten bewegen sich weich, aber nur über transform (Regel «Animationen»); mit reduzierter Bewegung gar nicht. */
const SELECTORS = ['.editor-header button.icon-btn', '.left-tabs [role="tab"]', '.layout-tile, .library-tile', '.section-toggle', '.chevron'];

const transition = (page: Page, selector: string) => page.locator(selector).first().evaluate((el) => {
  const c = getComputedStyle(el);
  return { property: c.transitionProperty, duration: c.transitionDuration, timing: c.transitionTimingFunction };
});

test('Tasten animieren nur transform, kurz und ease-out', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const t = await transition(page, '.editor-header button.icon-btn');
  expect(t.property).toBe('transform');
  expect(parseFloat(t.duration) * 1000).toBeGreaterThanOrEqual(90);
  expect(parseFloat(t.duration) * 1000).toBeLessThanOrEqual(140);
  expect(t.timing).toBe('ease-out');
  for (const sel of SELECTORS) {
    const el = page.locator(sel).first();
    if (!(await el.count())) continue;
    const { property } = await transition(page, sel);
    expect(property.split(',').map((p) => p.trim()).filter((p) => p !== 'transform' && p !== 'opacity' && p !== 'all'), sel).toEqual([]);
    expect(property, sel).not.toBe('all');
  }
});

test('Hover hebt die Taste ab und fährt dabei, statt zu springen', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const btn = page.locator('.editor-header button.icon-btn').first();
  await btn.hover();
  // Kurz nach dem Hover ist die Taste noch unterwegs, danach um 1 px angehoben
  const y = () => btn.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m42);
  await expect.poll(y).toBe(-1);
});

test('prefers-reduced-motion schaltet die Übergänge ab', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await newProject(page, 'Post 4:5');
  const t = await transition(page, '.editor-header button.icon-btn');
  expect(parseFloat(t.duration)).toBe(0);
});

import { expect, test } from '@playwright/test';
import { elements, newProject, openLayers } from './fixtures';

const tab = (page: import('@playwright/test').Page, name: string) => page.getByRole('tab', { name, exact: true });

test('Fach links: Bibliothek ist Standard, Klick wechselt, AddBar bleibt darüber', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await expect(tab(page, 'Bibliothek')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('complementary', { name: 'Bibliothek' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Ebenen' })).toHaveCount(0);
  await openLayers(page);
  await expect(page.getByRole('list', { name: 'Ebenen' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Bibliothek' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Text hinzufügen' })).toBeVisible();
  await tab(page, 'Bibliothek').click();
  await expect(page.getByRole('complementary', { name: 'Bibliothek' })).toBeVisible();
});

test('Reiter per Tastatur: Pfeile, Home, Ende; nur der gewählte ist tabbar, das versteckte Fach nicht', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const lib = tab(page, 'Bibliothek');
  const lay = tab(page, 'Ebenen');
  await expect(lib).toHaveAttribute('tabindex', '0');
  await expect(lay).toHaveAttribute('tabindex', '-1');
  await lib.focus();
  await page.keyboard.press('ArrowRight');
  await expect(lay).toBeFocused();
  await expect(lay).toHaveAttribute('aria-selected', 'true');
  await expect(lib).toHaveAttribute('aria-selected', 'false');
  await page.keyboard.press('Home');
  await expect(lib).toBeFocused();
  await expect(lib).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(lay).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowRight'); // Umlauf
  await expect(lib).toHaveAttribute('aria-selected', 'true');
  // Fach der Ebenen ist versteckt: nichts darin ist tabbar
  const hidden = page.locator('[role=tabpanel][hidden]');
  await expect(hidden).toHaveCount(1);
  await expect(hidden.locator('button:visible')).toHaveCount(0);
  await expect(lib).toHaveAttribute('aria-controls', /.+/);
  await expect(page.locator('.left-tabpanel:not([hidden])')).toHaveAccessibleName('Bibliothek');
});

test('Auswahl in Ebenen wählt auf der Leinwand, der Reiter bleibt', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await page.getByRole('button', { name: 'Text hinzufügen' }).click();
  await expect.poll(() => elements(page)).toHaveLength(1);
  await page.keyboard.press('Escape');
  await openLayers(page);
  const name = (await elements(page))[0]!.name;
  await page.getByRole('list', { name: 'Ebenen' }).getByRole('button', { name, exact: true }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
  await expect(tab(page, 'Ebenen')).toHaveAttribute('aria-selected', 'true');
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.transformerNodes())).toBe(1);
});

test('Reiterwechsel animiert nur transform und opacity, bei reduzierter Bewegung gar nicht', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await openLayers(page);
  const anim = () => page.locator('.left-tabpanel:not([hidden])').evaluate((e) => {
    const s = getComputedStyle(e);
    return [s.animationName, s.animationDuration];
  });
  const [name] = await anim();
  expect(name).not.toBe('none');
  const kf = await page.evaluate((n) => [...document.styleSheets].flatMap((s) => [...s.cssRules]).filter((r) => r instanceof CSSKeyframesRule && r.name === n).flatMap((r) => [...(r as CSSKeyframesRule).cssRules].flatMap((k) => [...(k as CSSKeyframeRule).style])), name);
  expect([...new Set(kf)].sort()).toEqual(['opacity', 'transform']);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect((await anim())[0]).toBe('none');
});

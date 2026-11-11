import { expect, test, type Page } from '@playwright/test';
import { addPhoto, addScrim, channelBtn, elements, newProject, openLayers, png, selectCta } from './fixtures';

/** Jeder Knopf (auch im geschlossenen Dialog/Popover) hat einen Namen; ohne sichtbaren Text trägt er data-tip. */
async function audit(page: Page, what: string) {
  const r = await page.evaluate(() => {
    const name = (e: Element) => {
      const ids = e.getAttribute('aria-labelledby');
      const byRef = ids ? ids.split(/\s+/).map((i) => document.getElementById(i)?.textContent?.trim() ?? '').join('') : '';
      return (e.getAttribute('aria-label') ?? '').trim() || byRef || (e.textContent ?? '').trim();
    };
    const buttons = [...document.querySelectorAll('button')];
    return {
      count: buttons.length,
      unnamed: buttons.filter((b) => !name(b)).map((b) => b.outerHTML.slice(0, 90)),
      noTip: buttons.filter((b) => !(b.textContent ?? '').trim() && !b.hasAttribute('data-tip')).map((b) => b.outerHTML.slice(0, 90)),
      sizes: [...new Set([...document.querySelectorAll('svg.tabler-icon')].filter((s) => s.getBoundingClientRect().width > 0).map((s) => {
        const b = s.getBoundingClientRect();
        return `${b.width}x${b.height}`;
      }))],
      titles: document.querySelectorAll('[title]').length,
    };
  });
  expect(r.count, what).toBeGreaterThan(5);
  expect(r.unnamed, `${what}: Knopf ohne Namen`).toEqual([]);
  expect(r.noTip, `${what}: Icon-Knopf ohne data-tip`).toEqual([]);
  // Chevrons der Zahlenfeld-Pfeilknöpfe (16 px) sind bewusst kleiner und hier ausgenommen (Phase 2.10.1)
  expect(r.sizes, `${what}: Icon-Grössen`).toEqual(['18x18']);
  expect(r.titles, `${what}: title-Attribut`).toBe(0);
}

test('Startseite: kein title-Attribut, Knöpfe benannt', async ({ page }) => {
  await page.goto('');
  await expect(page.getByRole('button', { name: 'Post 4:5' })).toBeVisible();
  const titles = await page.evaluate(() => document.querySelectorAll('[title]').length);
  expect(titles).toBe(0);
  const unnamed = await page.evaluate(() =>
    [...document.querySelectorAll('button')].filter((b) => !(b.getAttribute('aria-label') || (b.textContent ?? '').trim())).length,
  );
  expect(unnamed).toBe(0);
});

test('Editor: Namen, data-tip, 18-px-Icons, kein title (Foto, Text, Tag, Scribble)', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await page.getByRole('button', { name: 'Text hinzufügen' }).click();
  await page.evaluate(() => window.__bbzbTest.insertTag('cta'));
  await page.evaluate(() => window.__bbzbTest.insertBrand('scribble-01'));
  await addPhoto(page, png(800, 600));
  await expect.poll(async () => (await elements(page)).length).toBe(4);
  const els = await elements(page);
  for (const e of els) {
    await page.evaluate((i) => window.__bbzbTest.select(i), e.id);
    await audit(page, e.type);
  }
});

test('Editor: auch mit offenem Popover, Export-Dialog und Meldung', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await page.getByRole('button', { name: 'Slide hinzufügen', exact: true }).click();
  await expect(page.locator('#slide-layouts')).toBeVisible();
  await audit(page, 'Popover Slide hinzufügen');
  await page.keyboard.press('Escape');
  await selectCta(page);
  await channelBtn(page, 'LinkedIn').click();
  await expect(page.locator('.notice button[aria-label="Schliessen"]')).toBeVisible();
  await audit(page, 'Meldung');
  await page.getByRole('button', { name: 'Exportieren' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await audit(page, 'Export-Dialog');
});

test('Meldung: Tooltip am rechten Rand bleibt im Fenster und verdeckt das X nicht', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await selectCta(page);
  await channelBtn(page, 'LinkedIn').click();
  const x = page.locator('.notice button[aria-label="Schliessen"]');
  await x.hover();
  const tip = page.locator('.tooltip');
  await expect.poll(() => tip.evaluate((e) => e.matches(':popover-open'))).toBe(true);
  const t = (await tip.boundingBox())!;
  const b = (await x.boundingBox())!;
  const vp = page.viewportSize()!;
  expect(t.x >= 0 && t.x + t.width <= vp.width && t.y >= 0 && t.y + t.height <= vp.height).toBe(true);
  expect(t.x < b.x + b.width && t.x + t.width > b.x && t.y < b.y + b.height && t.y + t.height > b.y).toBe(false);
});

test('Die Ebenenliste füllt das Fach und scrollt in sich, die Seite nicht', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await openLayers(page);
  for (let i = 0; i < 20; i++) await page.getByRole('button', { name: 'Text hinzufügen' }).click();
  const r = await page.locator('.layer-list').evaluate((l) => ({
    scrolls: l.scrollHeight > l.clientHeight,
    page: document.documentElement.scrollHeight > document.documentElement.clientHeight,
  }));
  expect(r).toEqual({ scrolls: true, page: false });
});

test('Erklärtexte hängen als Beschreibung am Knopf (Screenreader), nicht nur im Tooltip', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await page.getByRole('button', { name: 'Text hinzufügen' }).click();
  await addPhoto(page, png(800, 600));
  await addScrim(page, 'Unten');
  await expect(page.getByRole('slider', { name: 'Reichweite' })).toHaveAccessibleDescription(/\S/);
  await expect(page.getByRole('button', { name: 'Sicherheitszonen' })).toHaveAccessibleDescription(/Instagram überdeckt/);
  await openLayers(page);
  await expect(page.locator('.layer-name').first()).toHaveAccessibleDescription(/F2 benennt um\. Alt \+ Pfeiltaste/);
  await expect(page.locator('.slide-tile').first()).toHaveAccessibleDescription(/Alt \+ Pfeiltaste verschiebt/);
});

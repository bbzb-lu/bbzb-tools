import { expect, test, type Page } from '@playwright/test';
import { tagFillOf } from '../src/plugins/elements/tag/layout';
import { colors, tagBox } from '../src/tokens';
import { elements, newProject } from './fixtures';

const insert = (page: Page, variant: string) => page.evaluate((v) => window.__bbzbTest.insertTag(v), variant);
const tag = async (page: Page) => (await elements(page))[0]!;
type P = { text: string; dept?: string; color?: string };
const props = async (page: Page) => (await tag(page)).props as P;
const shot = '.superpowers/sdd/2026-10-26-phase-2-6-tags-und-standorte/screens';

test('Standort-Tag: Fachbereich zeigen ist ein Undo-Schritt, Standortwechsel entfernt unpassenden Fachbereich, BBZB hat keinen', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await insert(page, 'schul');
  await expect.poll(() => elements(page)).toHaveLength(1);
  expect((await props(page)).text).toBe('BBZB');
  // BBZB: kein Fachbereich-Schalter
  await expect(page.getByRole('switch', { name: 'Fachbereich zeigen' })).toHaveCount(0);

  await page.getByLabel('Standort', { exact: true }).selectOption('Bahnhof');
  const group = page.getByRole('switch', { name: 'Fachbereich zeigen' });
  await group.click();
  await expect(group).toHaveAttribute('aria-checked', 'true');
  await expect.poll(async () => (await props(page)).dept).toBe('Automobiltechnik');
  expect((await tag(page)).height).toBe(tagBox.schulDept.height);
  await page.getByLabel('Fachbereich', { exact: true }).selectOption('Zimmerleute');
  await expect.poll(async () => (await props(page)).dept).toBe('Zimmerleute');
  await page.screenshot({ path: `${shot}/task-4-standort-fachbereich.png` });

  // Heimbach führt «Zimmerleute» nicht: Fachbereich fällt weg, Höhe 62, Schalter aus
  // langer Fachbereich: Breite folgt der längeren Zeile
  const wShort = (await tag(page)).width;
  await page.getByLabel('Fachbereich', { exact: true }).selectOption('Fahrzeugbau und Strassentransport');
  await expect.poll(async () => (await tag(page)).width).toBeGreaterThan(wShort);
  await page.getByLabel('Fachbereich', { exact: true }).selectOption('Zimmerleute');
  await expect.poll(async () => (await tag(page)).width).toBe(wShort);
  await page.getByLabel('Standort', { exact: true }).selectOption('Heimbach');
  await expect.poll(async () => (await props(page)).dept).toBeUndefined();
  expect((await tag(page)).height).toBe(62);
  await expect(page.getByLabel('Fachbereich', { exact: true })).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await props(page)).dept).toBe('Zimmerleute');
  expect((await tag(page)).height).toBe(tagBox.schulDept.height);

  // Schalter aus: ein Undo-Schritt bringt den Fachbereich zurück
  await group.click();
  await expect(group).toHaveAttribute('aria-checked', 'false');
  await expect.poll(async () => (await props(page)).dept).toBeUndefined();
  expect((await tag(page)).height).toBe(62);
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await props(page)).dept).toBe('Zimmerleute');

  // zurück auf BBZB: Schalter verschwindet, Fachbereich weg
  await page.getByLabel('Standort', { exact: true }).selectOption('BBZB');
  await expect.poll(async () => (await props(page)).dept).toBeUndefined();
  await expect(page.getByRole('switch', { name: 'Fachbereich zeigen' })).toHaveCount(0);
});

test('Fachbereich-Tag und freier Tag aus der Bibliothek: Fachbereich setzt Text und Standort, Farbe ändern, Text bleibt nicht leer', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await page.getByRole('tab', { name: 'Tags' }).click();
  const names = await page.locator('.library-row').allTextContents();
  expect(names.map((n) => n.trim())).toEqual(['Standort', 'Fachbereich', 'Frei', 'Ort', 'CTA']);
  await page.screenshot({ path: `${shot}/task-4-bibliothek.png` });

  await page.getByRole('button', { name: 'Fachbereich', exact: true }).click();
  await expect.poll(() => elements(page)).toHaveLength(1);
  expect(await props(page)).toEqual({ variant: 'fach', text: 'Automobiltechnik', color: 'Bahnhof' });
  const w0 = (await tag(page)).width;
  // Bautechnik gibt es zweimal: die Gruppe entscheidet über den Standort
  await page.locator('select[aria-label="Fachbereich"]').selectOption('Dagmersellen|Bautechnik');
  await expect.poll(async () => (await props(page)).color).toBe('Dagmersellen');
  expect((await props(page)).text).toBe('Bautechnik');
  expect((await tag(page)).width).not.toBe(w0);
  await page.screenshot({ path: `${shot}/task-4-fach-inspector.png` });

  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Frei', exact: true }).click();
  await expect.poll(() => elements(page)).toHaveLength(2);
  const frei = async () => (await elements(page))[1]!.props as P;
  expect(await frei()).toEqual({ variant: 'frei', text: 'Text', color: 'blau' });
  await page.getByLabel('Farbe', { exact: true }).selectOption('Weggismatt');
  await expect.poll(async () => (await frei()).color).toBe('Weggismatt');
  const input = page.getByLabel('Text', { exact: true });
  await input.fill('Neu am BBZB');
  await expect.poll(async () => (await frei()).text).toBe('Neu am BBZB');
  // Tippen = eine Geste: ein Undo-Schritt bringt den Text vor dem Tippen zurück, die Breite folgt
  await input.blur();
  const wBefore = (await elements(page))[1]!.width;
  await input.focus();
  await input.selectText();
  await input.pressSequentially('Lang genug fuer breiter');
  await expect.poll(async () => (await frei()).text).toBe('Lang genug fuer breiter');
  expect((await elements(page))[1]!.width).toBeGreaterThan(wBefore);
  await input.blur();
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await frei()).text).toBe('Neu am BBZB');
  expect((await elements(page))[1]!.width).toBe(wBefore);
  await input.fill('');
  expect((await frei()).text).toBe('Neu am BBZB');
  await page.screenshot({ path: `${shot}/task-4-frei-inspector.png` });
});

const rgbOf = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;

test('Bibliothek: Chipfarbe der Tags entspricht dem eingefügten Tag im Modus «Fixe Akzentfarbe», Liste läuft bei 1280 px nicht über', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await newProject(page, 'Post 4:5');
  await page.getByRole('tab', { name: 'Tags' }).click();
  const list = page.locator('.library-list');
  for (const [name, variant] of [['Standort', 'schul'], ['Fachbereich', 'fach'], ['Frei', 'frei'], ['CTA', 'cta']] as const) {
    const chip = page.getByRole('button', { name, exact: true }).locator('.library-chip');
    await insert(page, variant);
    const els = await elements(page);
    const inserted = els[els.length - 1]!.props as Parameters<typeof tagFillOf>[0];
    await expect(chip).toHaveCSS('background-color', rgbOf(tagFillOf(inserted, colors.orange)));
  }
  expect(await list.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
  await page.screenshot({ path: `${shot}/task-4-bibliothek-chips.png` });
});

test('Tag-Inspector: Text des Schalters ist klickbar, Farbwahl mit deutschen Namen, nichts abgeschnitten', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await insert(page, 'schul');
  const location = page.getByLabel('Standort', { exact: true });
  await expect(location.locator('option', { hasText: 'Ohne Standort' })).toHaveCount(1);
  await location.selectOption('Bahnhof');
  const sw = page.getByRole('switch', { name: 'Fachbereich zeigen' });
  await page.getByText('Fachbereich zeigen').click();
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await page.getByText('Fachbereich zeigen').click();
  await expect(sw).toHaveAttribute('aria-checked', 'false');

  await page.keyboard.press('Escape');
  await insert(page, 'frei');
  const fill = page.getByLabel('Farbe', { exact: true });
  expect(await fill.locator('option').allTextContents()).toEqual(['Blau', 'Orange', 'Warmweiss', 'Blauschwarz', 'Akzent', 'Bahnhof', 'Heimbach', 'Weggismatt', 'Dagmersellen', 'BM']);
  for (const v of ['Warmweiss', 'Akzent', 'Dagmersellen']) {
    await fill.selectOption({ label: v });
    expect(await fill.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
  }
  await expect.poll(async () => ((await elements(page))[1]!.props as P).color).toBe('Dagmersellen');
});

test('Standort-Tag: «Fachbereich zeigen» hat dieselbe Schriftgrösse wie die Zeilenbeschriftungen', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await insert(page, 'schul');
  await page.getByLabel('Standort', { exact: true }).selectOption('Bahnhof');
  const size = (l: ReturnType<Page['locator']>) => l.evaluate((e) => getComputedStyle(e).fontSize);
  const legend = await size(page.locator('legend', { hasText: 'Standort' }));
  await expect(page.getByRole('switch', { name: 'Fachbereich zeigen' })).toBeVisible();
  expect(await size(page.locator('.kit-switch-text', { hasText: 'Fachbereich zeigen' }))).toBe(legend);
});

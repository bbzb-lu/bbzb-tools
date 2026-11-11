import { expect, test, type Page } from '@playwright/test';
import type { Project } from '../src/model/types';
import { dropPng, elements, exportPng, frames, gradientPng, newProject } from './fixtures';

const SHOTS = '.superpowers/sdd/2026-10-21-phase-2b-layouts-und-hilfen/screens';
const project = (page: Page) => page.evaluate(() => window.__bbzbTest.project());
const tiles = (page: Page) => page.getByRole('list', { name: 'Slides' }).getByRole('button');
// Werte wie src/tokens.ts (safeZones)
const ZONES = { post: { top: 0, right: 33.75, bottom: 0, left: 33.75 }, story: { top: 250, right: 0, bottom: 340, left: 0 } };

/** Carousel anlegen, Titel-Foto füllen, ein altes Foto ohne Korn und Look simulieren, freien Text und Scribble an den Rand setzen. */
async function prepare(page: Page, format: 'Post 4:5' | 'Story 9:16', name: string) {
  await newProject(page, format, 'Carousel');
  await page.getByLabel('Projektname').fill(name);
  await page.getByLabel('Projektname').press('Enter');
  const { height } = (await project(page)).format;
  await dropPng(page, 540, height / 2, gradientPng(1200, 800));
  await expect.poll(async () => (await elements(page)).some((e) => e.role === 'foto' && 'assetId' in (e.props as object))).toBe(true);
  const foto = (await elements(page)).find((e) => e.role === 'foto' && 'assetId' in (e.props as object))!;
  const props = { ...(foto.props as Record<string, unknown>) };
  delete props.grain;
  delete props.look;
  await page.evaluate(([id, p]) => window.__bbzbTest.patch(id as string, { props: p }), [foto.id, props] as const);
  // freies Scribble ganz unten auf Slide 2 (Vollbild), freier Text ganz oben auf Slide 1
  await page.evaluate((h) => window.__bbzbTest.insertBrand('scribble-02', { x: 1080 + 540, y: h - 40 }), height);
  await page.getByRole('button', { name: 'Slide 1', exact: true }).click();
  await page.getByRole('button', { name: 'Text hinzufügen' }).click();
  const text = (await elements(page)).at(-1)!;
  await page.evaluate((id) => window.__bbzbTest.patch(id, { x: 0, y: 0 }), text.id);
  return { original: await project(page), fotoId: foto.id, textId: text.id };
}

/** Nichts ausserhalb der Slides, Text und Tags ausserhalb der Safe Zones. */
function expectInside(p: Project) {
  const { width: W, height: H } = p.format;
  const z = ZONES[p.format.id as 'post' | 'story'];
  for (const id of p.order) {
    const e = p.elements[id]!;
    const cx = e.x + e.width / 2;
    const cy = e.y + e.height / 2;
    expect(cx, e.name).toBeGreaterThan(0);
    expect(cx, e.name).toBeLessThan(p.slides.length * W);
    expect(cy, e.name).toBeGreaterThan(0);
    expect(cy, e.name).toBeLessThan(H);
    if (e.type !== 'text' && e.type !== 'tag') continue;
    const i = Math.floor(cx / W);
    expect(e.y, e.name).toBeGreaterThanOrEqual(z.top - 0.01);
    expect(e.y + e.height, e.name).toBeLessThanOrEqual(H - z.bottom + 0.01);
    expect(e.x, e.name).toBeGreaterThanOrEqual(i * W + z.left - 0.01);
    expect(e.x + e.width, e.name).toBeLessThanOrEqual((i + 1) * W - z.right + 0.01);
  }
}

async function copyAndCheck(page: Page, from: { original: Project; fotoId: string; textId: string }, button: string, copyName: string, to: 'post' | 'story') {
  const name = from.original.name;
  await page.getByRole('button', { name: 'Übersicht' }).click();
  await page.getByRole('button', { name: `«${name}» ${button}`, exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(`«${copyName}» ist angelegt.`);
  await expect(page.getByRole('listitem')).toHaveCount(2);
  await page.screenshot({ path: `${SHOTS}/task-8-start-${to}.png` });

  // Original unverändert (tiefer Vergleich)
  await page.getByRole('button', { name: `«${name}» öffnen`, exact: true }).click();
  await expect(tiles(page)).toHaveCount(6);
  expect(await project(page)).toEqual(from.original);
  await page.getByRole('button', { name: 'Übersicht' }).click();

  await page.getByRole('button', { name: `«${copyName}» öffnen`, exact: true }).click();
  await expect(tiles(page)).toHaveCount(6);
  const c = await project(page);
  expect(c.id).not.toBe(from.original.id);
  expect(c.format.id).toBe(to);
  expect(c.channel).toBe(from.original.channel);
  const suffix = to === 'story' ? '-story' : '';
  const base = (l?: string) => l?.replace(/-story$/, '');
  expect(c.slides.map((s) => s.layout)).toEqual(from.original.slides.map((s) => `${base(s.layout)}${suffix}`));
  expect(c.order).toEqual(from.original.order);
  expectInside(c);
  // Korn und Look bleiben, wie sie waren: altes Foto ohne, Platzhalter mit
  expect(c.elements[from.fotoId]!.props).not.toHaveProperty('grain');
  expect(c.elements[from.fotoId]!.props).not.toHaveProperty('look');
  for (const e of Object.values(c.elements).filter((e) => e.type === 'photo' && e.id !== from.fotoId))
    expect(e.props, e.name).toMatchObject({ grain: true, look: true });
  // Titel-Foto füllt die neue Slide
  expect(c.elements[from.fotoId]).toMatchObject({ x: 0, y: 0, width: 1080, height: c.format.height });

  // Hinweis: Slide 1 (freier Text) und Slide 2 (freies Scribble) sind markiert, die übrigen nicht
  expect(c.slides.map((s) => !!s.review)).toEqual([true, true, false, false, false, false]);
  await expect(page.getByRole('button', { name: 'Slide 1, bitte prüfen' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Slide 2, bitte prüfen' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bitte prüfen' })).toBeVisible();
  await frames(page);
  await page.screenshot({ path: `${SHOTS}/task-8-hinweis-${to}.png` });
  await page.getByLabel('Eigenschaften').getByRole('button', { name: 'Geprüft' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Bitte prüfen' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Slide 1', level: 2, exact: true })).toBeFocused(); // Fokus geht nicht verloren
  await expect(page.getByRole('button', { name: 'Slide 1', exact: true })).toBeVisible();
  await page.keyboard.press('Control+z');
  await expect(page.getByRole('button', { name: 'Slide 1, bitte prüfen' })).toBeVisible();

  const pngs = await exportPng(page);
  expect(pngs).toHaveLength(6);
  for (const p of pngs) expect([p.width, p.height]).toEqual([1080, c.format.height]);
}

test('Post → Story: neues Projekt, Original unverändert, nichts ausserhalb, Hinweis, Export', async ({ page }) => {
  const from = await prepare(page, 'Post 4:5', 'Sporttag');
  await copyAndCheck(page, from, 'als Story kopieren', 'Sporttag (Story 9:16)', 'story');
});

test('Story → Post: neues Projekt, Original unverändert, nichts ausserhalb, Hinweis, Export', async ({ page }) => {
  const from = await prepare(page, 'Story 9:16', 'Projektwoche');
  await copyAndCheck(page, from, 'als Post kopieren', 'Projektwoche (Post 4:5)', 'post');
});

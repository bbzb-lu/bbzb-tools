import { expect, test, type Page } from '@playwright/test';
import { bbzbsocial, elements, newProject, toScreen, addSlide } from './fixtures';

const screens = '.superpowers/sdd/2026-10-21-phase-2a-look-und-inhalte/screens';
const library = (page: Page) => page.getByRole('complementary', { name: 'Bibliothek' });
const tab = (page: Page, name: string) => library(page).getByRole('tab', { name });
const item = (page: Page, name: string) => library(page).getByRole('button', { name, exact: true });
const center = (e: { x: number; y: number; width: number; height: number }) => [e.x + e.width / 2, e.y + e.height / 2];

/** Bibliothekseintrag auf den Weltpunkt (wx, wy) ziehen (HTML-Drag-and-drop wie mit der Maus). */
async function dragTo(page: Page, name: string, wx: number, wy: number) {
  const target = page.locator('.canvas-scroll');
  const box = (await target.boundingBox())!;
  const p = await toScreen(page, wx, wy);
  await item(page, name).dragTo(target, { targetPosition: { x: p.x - box.x, y: p.y - box.y } });
}

test('Klick setzt mittig auf die aktuelle Slide, Ziehen an den Ablagepunkt, auch bei Zoom', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await item(page, 'Scribble 1').click();
  await expect.poll(() => elements(page)).toHaveLength(1);
  expect(center((await elements(page))[0]!)).toEqual([540, 675]);
  expect((await elements(page))[0]!.props).toMatchObject({ brandId: 'scribble-01', color: 'akzent' });

  // zweite Slide ist aktuell: Klick setzt dort mittig
  await addSlide(page);
  await tab(page, 'Icons').click();
  await expect(library(page).locator('.library-grid img')).toHaveCount(5);
  await library(page).screenshot({ path: `${screens}/task-9-icons.png`, animations: 'disabled' });
  await item(page, 'Velo').click();
  await expect.poll(() => elements(page)).toHaveLength(2);
  expect(center((await elements(page))[1]!)).toEqual([1620, 675]);

  await page.getByRole('button', { name: 'Vergrössern' }).click();
  await page.getByRole('button', { name: 'Vergrössern' }).click();
  await expect(page.locator('.zoom-value')).toHaveText('156 %');
  await dragTo(page, 'Berg', 1300, 400);
  await expect.poll(() => elements(page)).toHaveLength(3);
  const [x, y] = center((await elements(page))[2]!);
  expect(Math.abs(x! - 1300)).toBeLessThan(2);
  expect(Math.abs(y! - 400)).toBeLessThan(2);

  await tab(page, 'Tags').click();
  await dragTo(page, 'CTA', 1500, 1100);
  await expect.poll(() => elements(page)).toHaveLength(4);
  const tag = (await elements(page))[3]!;
  expect(tag.type).toBe('tag');
  const [tx, ty] = center(tag);
  expect(Math.abs(tx! - 1500)).toBeLessThan(2);
  expect(Math.abs(ty! - 1100)).toBeLessThan(2);

  // ein Undo-Schritt je Einfügen
  await page.keyboard.press('Control+z');
  await expect.poll(() => elements(page)).toHaveLength(3);
});

test('Zwei Klicks auf dieselbe Kachel: zweites Element 40 px rechts unten, Hinweis unter den Tabs, Kachelrand dunkler als --line', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await expect(library(page).locator('.muted.hint')).toHaveText('Klicken oder auf die Slide ziehen.');
  await item(page, 'Scribble 1').click();
  await item(page, 'Scribble 1').click();
  await expect.poll(() => elements(page)).toHaveLength(2);
  const [a, b] = (await elements(page)).map(center);
  expect([b![0]! - a![0]!, b![1]! - a![1]!]).toEqual([40, 40]);
  await page.mouse.move(0, 0); // Hover färbt den Rand in Tinte
  const border = await item(page, 'Scribble 1').evaluate((e) => getComputedStyle(e).borderTopColor);
  const line = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ink-soft').trim());
  expect(border).toBe(`rgb(${[1, 3, 5].map((i) => parseInt(line.slice(i, i + 2), 16)).join(', ')})`);
});

test('Tastatur: Pfeile wechseln den Tab, Enter und Leertaste fügen mittig ein', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await tab(page, 'Scribbles').focus();
  await page.keyboard.press('ArrowRight');
  await expect(tab(page, 'Icons')).toBeFocused();
  await expect(tab(page, 'Icons')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(tab(page, 'Doodles')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(tab(page, 'Scribbles')).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(tab(page, 'Tags')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Tab');
  await expect(item(page, 'Standort')).toBeFocused();
  await library(page).screenshot({ path: `${screens}/task-9-tags-fokus.png`, animations: 'disabled' });
  await page.keyboard.press('Enter');
  await expect.poll(() => elements(page)).toHaveLength(1);
  await item(page, 'Ort').focus();
  await page.keyboard.press(' ');
  await expect.poll(() => elements(page)).toHaveLength(2);
  // der zweite Klick liegt auf belegter Stelle und weicht aus
  expect((await elements(page)).map(center)).toEqual([[540, 675], [580, 715]]);

  // zurück über Freier Tag, Fachbereich-Tag und Standort-Tag zum Tab
  for (let i = 0; i < 4; i++) await page.keyboard.press('Shift+Tab');
  await expect(tab(page, 'Tags')).toBeFocused();
});

test('Bibliothek nur Scribbles, Icons, Tags und Doodles (Hintergrund, Korn und Verläufe stellt man an der Slide ein)', async ({ page }) => {
  await newProject(page, 'Post 4:5', 'Carousel');
  const names = () => library(page).getByRole('tab').allTextContents();
  expect(await names()).toEqual(['Scribbles', 'Icons', 'Tags', 'Doodles']);
  await expect(page.getByRole('button', { name: 'Fläche hinzufügen' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Slide 5', exact: true }).click(); // Collage: Foto mit Rahmen auf blauem Hintergrund mit Korn
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.pendingEffects())).toBe(0);
  await page.screenshot({ path: '.superpowers/sdd/2026-10-22-phase-2-1-nachbesserungen/screens/task-3-editor-collage.png', animations: 'disabled' });
});

test('Die letzten Scribbles sind erreichbar: die Liste scrollt', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const panel = library(page).getByRole('tabpanel');
  expect(await panel.evaluate((p) => p.scrollHeight > p.clientHeight)).toBe(true);
  await item(page, 'Scribble 12').click();
  await expect.poll(() => elements(page)).toHaveLength(1);
  expect((await elements(page))[0]!.props).toMatchObject({ brandId: 'scribble-12' });
  expect(await panel.evaluate((p) => p.scrollTop)).toBeGreaterThan(0);
});

test('Kaputtes Manifest: übrige Markenbilder bleiben, Meldung erklärt es', async ({ page }) => {
  await page.goto('');
  await page.evaluate(() => window.__bbzbTest.breakManifest());
  await page.getByRole('button', { name: 'Post 4:5' }).click();
  await page.keyboard.press('Escape'); // Layout-Wahl zum Start schliessen
  await expect(library(page).getByText('Nicht alle Scribbles und Icons sind da.')).toBeVisible();
  await expect(library(page).getByText('Die Datei zu «Scribble 2» fehlt (scribbles/Scribble_02.png).')).toBeVisible();
  await expect(item(page, 'Scribble 2')).toHaveCount(0);
  await item(page, 'Scribble 3').click();
  await expect.poll(() => elements(page)).toHaveLength(1);
});

test('Markenbild fehlt im Projekt: eigene Meldung im Editor und beim Export', async ({ page }) => {
  const project = {
    schemaVersion: 1, id: 'p-brand', name: 'Ohne Scribble', format: { id: 'post', width: 1080, height: 1350 }, createdAt: 0, updatedAt: 0,
    slides: [{ id: 's1', background: 'warmweiss' }],
    elements: {
      e1: {
        id: 'e1', type: 'brand', name: 'Scribble 1', x: 100, y: 100, width: 300, height: 300,
        rotation: 0, opacity: 1, visible: true, locked: false, props: { brandId: 'gibt-es-nicht', color: 'orange' },
      },
    },
    order: ['e1'],
    assets: {},
  };
  await page.goto('');
  await page.locator('input[type=file]').setInputFiles({ name: 'test.bbzbsocial', mimeType: 'application/zip', buffer: bbzbsocial(project) });
  await page.getByRole('button', { name: '«Ohne Scribble» öffnen' }).click();
  const text = 'Ein Scribble oder Icon fehlt. Lösche es und füge es aus der Bibliothek neu ein.';
  await expect(page.getByRole('alert').filter({ hasText: text })).toBeVisible();
  await page.getByRole('button', { name: 'Schliessen' }).click();
  await page.getByRole('button', { name: 'Exportieren' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'ZIP herunterladen' }).click();
  await expect(dialog.getByRole('alert')).toHaveText(text);
});

test('Pin im Ort-Tag fehlt: gleiche Meldung im Editor', async ({ page }) => {
  await page.goto('');
  await page.evaluate(() => window.__bbzbTest.breakManifest(['icon-map-pin']));
  await page.getByRole('button', { name: 'Post 4:5' }).click();
  await page.keyboard.press('Escape'); // Layout-Wahl zum Start schliessen
  await tab(page, 'Tags').click();
  await item(page, 'Ort').click();
  await expect(page.getByRole('alert').filter({ hasText: 'Ein Scribble oder Icon fehlt. Lösche es und füge es aus der Bibliothek neu ein.' })).toBeVisible();
});

test('Kategorien als Texttabs, vollständig lesbar, Kacheln mit Tooltip statt title', async ({ page }) => {
  const SHOTS = process.env.SHOTS;
  for (const [w, h] of [[1536, 864], [1280, 720]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await newProject(page, 'Post 4:5');
    const boxes = await Promise.all(['Scribbles', 'Icons', 'Tags', 'Doodles'].map(async (n) => {
      const t = tab(page, n);
      await expect(t.locator('.tabler-icon')).toHaveCount(0);
      expect(await t.evaluate((e) => e.scrollWidth <= e.clientWidth), `${n} ${w}px`).toBe(true);
      return (await t.boundingBox())!;
    }));
    expect(boxes.every((b) => Math.abs(b.y - boxes[0]!.y) <= 1), `eine Zeile bei ${w}px`).toBe(true);
    // Scribble-PNGs werden nacheinander dekodiert (thumbnail.ts): bei vielen parallelen Workern dauert das länger als 5 s.
    await expect.poll(() => library(page).locator('.library-tile img').count(), { timeout: 20_000 }).toBe(await library(page).locator('.library-tile').count());
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/task-6-${w}.png` });
  }
  await expect(library(page).locator('[title]')).toHaveCount(0);
  const tile = library(page).locator('.library-tile').first();
  const name = (await tile.getAttribute('aria-label'))!;
  const open = () => page.locator('.tooltip').evaluate((e) => e.matches(':popover-open'));
  await tile.hover();
  await expect.poll(open).toBe(true);
  await expect(page.locator('.tooltip')).toContainText(name);
  await page.mouse.move(0, 0);
  await expect.poll(open).toBe(false);
  await tab(page, 'Scribbles').focus();
  await page.keyboard.press('Tab');
  await expect(tile).toBeFocused();
  await expect.poll(open).toBe(true);
  await expect(page.locator('.tooltip')).toContainText(name);
});

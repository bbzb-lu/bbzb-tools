import { createHash } from 'node:crypto';
import { expect, type Page } from '@playwright/test';
import { bbzbsocial, view } from './fixtures';
import { alphaPng } from './photoProject';

const asset = alphaPng(400, 400, [15, 27, 38], () => 255);
const sha = createHash('sha256').update(asset).digest('hex');
const photo = (id: string, x: number) => ({
  id, type: 'photo', name: `Foto ${id}`, x, y: 100, width: 400, height: 400, rotation: 0, opacity: 1, visible: true, locked: false,
  props: { assetId: sha, crop: { x: 0, y: 0, scale: 1 }, grain: false, look: false },
});

/** Eine Slide (aus dem anderen Format, also «Bitte prüfen») mit zwei Fotos e0 und e1 nebeneinander. */
export async function openReviewProject(page: Page, name: string, review = true) {
  const project = {
    schemaVersion: 1, id: name, name, createdAt: 0, updatedAt: 0,
    format: { id: 'post', width: 1080, height: 1350 },
    slides: [{ id: 's1', background: 'blau', ...(review && { review: true }) }],
    elements: { e0: photo('e0', 100), e1: photo('e1', 580) },
    order: ['e0', 'e1'],
    assets: { [sha]: { mime: 'image/png', width: 400, height: 400, name: 'foto.png' } },
  };
  await page.goto('');
  await page.locator('input[type=file]').setInputFiles({ name: 'x.bbzbsocial', mimeType: 'application/zip', buffer: bbzbsocial(project, { [sha]: asset }) });
  await page.getByRole('button', { name: `«${name}» öffnen`, exact: true }).click();
  await expect(page.getByLabel('Projektname')).toHaveValue(name);
  await view(page);
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.contentIds().length)).toBe(3);
}

/** Es steht genau eine Leiste, und es ist diese. */
export async function only(page: Page, name: string | RegExp) {
  await expect(page.locator('.context-bar')).toHaveCount(1);
  await expect(page.locator('.context-bar')).toHaveAttribute('aria-label', name);
}
export const select = (page: Page, ...ids: string[]) => page.evaluate((ids) => window.__bbzbTest.selectIds(ids), ids);
/** Bildschirmfoto nach `SHOTS`, wenn gesetzt; wartet das Einblenden der Leiste ab. */
export async function shot(page: Page, name: string) {
  if (!process.env.SHOTS) return;
  await page.locator('.context-bar').evaluate((e) => Promise.all(e.getAnimations().map((a) => a.finished)));
  await page.screenshot({ path: `${process.env.SHOTS}/${name}.png` });
}

/** Dauerhafte Live-Region der Kontextleisten (eine für alle). */
export const live = (page: Page) => page.locator('#context-live');
/** Markiert die Region; `same` prüft, dass es noch derselbe Knoten ist (also schon vor dem Text da war). */
export const markLive = (page: Page) => live(page).evaluate((e) => void ((e as HTMLElement).dataset.mark = '1'));
export const sameLive = (page: Page) => expect(live(page)).toHaveAttribute('data-mark', '1');

import { expect, test, type Page } from '@playwright/test';
import { elements, frames, newProject } from './fixtures';

const FONT = 80;

/** Ecke unten rechts ohne Shift ziehen (proportional) und loslassen. */
async function dragCorner(page: Page, dx: number, dy: number, live?: () => Promise<void>) {
  const h = await page.evaluate(() => window.__bbzbTest.anchorScreen('bottom-right'));
  await page.mouse.move(h.x, h.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(h.x + (dx * i) / 8, h.y + (dy * i) / 8);
  await frames(page);
  if (live) await live();
  await page.mouse.up();
  await frames(page);
}

/** Ein Text und ein Tag nebeneinander auf Slide 1, beide gewählt. */
async function textAndTag(page: Page) {
  await newProject(page, 'Post 4:5');
  await page.getByRole('button', { name: 'Text hinzufügen' }).click();
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__bbzbTest.insertTag('cta', { x: 200, y: 700 }));
  const text = (await elements(page)).find((e) => e.type === 'text')!;
  await page.evaluate(([id, f]) => window.__bbzbTest.patch(id as string, { x: 200, y: 200, width: 600, props: { ...(window.__bbzbTest.elements().find((e) => e.id === id)!.props as object), fontSize: f } }), [text.id, FONT] as const);
  await page.evaluate((id) => window.__bbzbTest.patch(id, { height: window.__bbzbTest.textHeight(id) }), text.id); // Höhe wie im Editor: gemessen
  const tag = (await elements(page)).find((e) => e.type === 'tag')!;
  await page.evaluate((ids) => window.__bbzbTest.selectIds(ids), [text.id, tag.id]);
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.transformerNodes())).toBe(2);
  return { text, tag };
}

test('Gruppe verkleinert: Text skaliert die Schriftgrösse mit, Tag behält Breite und Höhe', async ({ page }) => {
  const { text, tag } = await textAndTag(page);
  const before = (await elements(page)).find((e) => e.id === tag.id)!;
  // mitten in der Geste: der Inhalt des Tags ist nicht verzerrt (Gruppe skaliert, innerer Knoten gleicht aus)
  await dragCorner(page, -150, -150, async () => {
    const s = await page.evaluate((id) => window.__bbzbTest.nodeScale(id), tag.id);
    expect(s.x).toBeLessThan(1);
    const c = await page.evaluate((id) => window.__bbzbTest.contentScale(id), tag.id);
    expect([c.x, c.y]).toEqual([expect.closeTo(1, 3), expect.closeTo(1, 3)]);
  });
  await expect.poll(async () => (await elements(page)).find((e) => e.id === text.id)!.width).toBeLessThan(600);
  const all = await elements(page);
  const t = all.find((e) => e.id === text.id)!;
  const g = all.find((e) => e.id === tag.id)!;
  const k = t.width / 600;
  expect(k).toBeLessThan(1);
  expect((t.props as { fontSize: number }).fontSize).toBe(Math.round(FONT * k));
  expect(t.height).toBe(await page.evaluate((id) => window.__bbzbTest.textHeight(id), t.id));
  expect([g.width, g.height]).toEqual([before.width, before.height]);
});

test('Einzelner Text am Seitenanker: Schriftgrösse bleibt', async ({ page }) => {
  const { text } = await textAndTag(page);
  await page.evaluate((id) => window.__bbzbTest.select(id), text.id);
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.transformerNodes())).toBe(1);
  const h = await page.evaluate(() => window.__bbzbTest.anchorScreen('middle-right'));
  await page.mouse.move(h.x, h.y);
  await page.mouse.down();
  await page.mouse.move(h.x - 100, h.y, { steps: 6 });
  await page.mouse.up();
  await frames(page);
  const t = (await elements(page)).find((e) => e.id === text.id) as { width: number; props: { fontSize: number } };
  expect(t.width).toBeLessThan(600);
  expect(t.props.fontSize).toBe(FONT);
});

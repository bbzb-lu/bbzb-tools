import { expect, test } from '@playwright/test';
import { addPhoto, elements, newProject, png } from './fixtures';

/** Abschnitte im Inspector haben mehr Luft: mindestens 1.25 rem (20 px) zwischen dem Ende eines Abschnitts und der Linie des nächsten. */
for (const size of [{ width: 1536, height: 864 }, { width: 1280, height: 720 }]) {
  test(`Inspector: Abstand zwischen Abschnitten (${size.width}x${size.height}), kein Seitenscroll`, async ({ page }) => {
    await page.setViewportSize(size);
    await newProject(page, 'Post 4:5');
    await addPhoto(page, png(800, 600));
    await expect.poll(async () => (await elements(page)).length).toBe(1);
    const id = (await elements(page))[0]!.id;
    await page.evaluate((i) => window.__bbzbTest.select(i), id);
    await expect(page.getByRole('heading', { name: 'Maske', level: 3 })).toBeVisible();
    const gaps = await page.locator('.inspector').evaluate((root) => {
      const sections = [...root.querySelectorAll<HTMLElement>(':scope > .section')];
      return sections.slice(1).map((s, i) => {
        const prev = sections[i]!;
        const last = Math.max(...[...prev.children].filter((c) => !(c as HTMLElement).hidden).map((c) => c.getBoundingClientRect().bottom));
        return s.getBoundingClientRect().top - last;
      });
    });
    expect(gaps.length).toBeGreaterThanOrEqual(4);
    for (const g of gaps) expect(g).toBeGreaterThanOrEqual(20);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  });
}

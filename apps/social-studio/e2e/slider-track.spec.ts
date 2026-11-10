import { expect, test } from '@playwright/test';
import { addPhoto, elements, newProject, png } from './fixtures';

/** Entwurf: die ganze Bahn ist Tinte, nur Mitte-Regler (Helligkeit, Kontrast, Wärme) füllen in Akzent bis zum Griff. */
test('Reglerbahn: Tinte, Mitte-Regler füllen in Akzent', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addPhoto(page, png(800, 600));
  await expect.poll(async () => (await elements(page)).length).toBe(1);
  await page.evaluate((i) => window.__bbzbTest.select(i), (await elements(page))[0]!.id);
  await expect(page.getByRole('heading', { name: 'Maske', level: 3 })).toBeVisible();
  const colours = await page.evaluate(() => {
    const probe = (v: string) => { const d = document.createElement('i'); d.style.color = `var(${v})`; document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c; };
    const bg = (sel: string) => getComputedStyle(document.querySelector(sel)!).backgroundImage;
    return { ink: probe('--ink'), accent: probe('--accent'), disabled: probe('--ink-disabled'), plain: bg('.slider:not(.slider-center) .slider-input'), centre: bg('.slider-center .slider-input') };
  });
  expect(colours.plain).toContain(colours.ink);
  expect(colours.plain).not.toContain(colours.accent);
  expect(colours.plain).not.toContain(colours.disabled);
  expect(colours.centre).toContain(colours.accent);
  expect(colours.centre).toContain(colours.ink);
});

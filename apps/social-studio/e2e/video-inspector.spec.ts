import { expect, test } from '@playwright/test';
import { addPhoto, elements, newProject, png } from './fixtures';
import { addVideo, twoTone } from './video';

test.beforeAll(twoTone);

/** Am Video ist «Bild» ein eingerückter Unterabschnitt am Ende von «Video»; sein Auf/Zu gilt getrennt vom «Bild» am Foto. */
test('Video: «Bild» liegt eingerückt in «Video», nach Vorschau und Ton, auf/zu getrennt vom Foto', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const vid = await addVideo(page); // klappt alle Abschnitte auf
  const panel = page.getByLabel('Eigenschaften');
  const video = panel.getByRole('region', { name: 'Video', exact: true });
  const bild = video.getByRole('region', { name: 'Bild', exact: true });
  await expect(bild).toBeVisible();
  await expect(panel.getByRole('region', { name: 'Bild', exact: true })).toHaveCount(1); // kein zweites «Bild» daneben
  await expect(bild).toHaveClass(/nested/);
  for (const name of ['Video ersetzen', 'Ausschnitt bearbeiten', 'BBZB-Look']) await expect(bild.getByRole('button', { name, exact: true })).toBeVisible();
  // Reihenfolge in «Video»: Vorschaubilder, Bereichsregler, Zahlenfelder, Vorschau und Ton, dann «Bild»
  const order = await video.evaluate((v) => {
    const all = [...v.querySelectorAll('.video-thumbs, .range, .video-times, button, section')];
    const at = (pred: (e: Element) => boolean) => all.findIndex(pred);
    return [
      at((e) => e.classList.contains('video-thumbs')),
      at((e) => e.classList.contains('range')),
      at((e) => e.classList.contains('video-times')),
      at((e) => e.textContent?.trim() === 'Vorschau'),
      at((e) => e.textContent?.trim() === 'Ton'),
      at((e) => e.matches('section.nested')),
    ];
  });
  expect(order.every((v) => v >= 0), String(order)).toBe(true);
  expect([...order].sort((a, b) => a - b)).toEqual(order);
  // Auf/Zu getrennt: «Bild» am Video zu, «Bild» am Foto auf, zurück zum Video: bleibt zu
  const toggle = bild.getByRole('button', { name: 'Bild', exact: true });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await addPhoto(page, png(800, 600));
  await expect.poll(async () => (await elements(page)).length).toBe(2);
  await page.evaluate((i) => window.__bbzbTest.select(i), (await elements(page))[1]!.id);
  const photoBild = panel.getByRole('button', { name: 'Bild', exact: true });
  if ((await photoBild.getAttribute('aria-expanded')) === 'false') await photoBild.click();
  await expect(photoBild).toHaveAttribute('aria-expanded', 'true');
  await expect(panel.getByRole('region', { name: 'Video', exact: true })).toHaveCount(0); // am Foto steht «Bild» auf oberster Ebene
  await page.evaluate((i) => window.__bbzbTest.select(i), vid);
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});

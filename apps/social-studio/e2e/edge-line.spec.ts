import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';
import { newProject } from './fixtures';

/** Die Unterlage reicht bis an den Rand des Hauptviewports: links und rechts keine Linie in anderer Farbe. */
const BACKDROPS = [['Grau', 'grau'], ['Dunkel', 'dunkel'], ['Grün', 'gruen'], ['Blau', 'blau']] as const;

/** Farbe einer CSS-Variable als [r, g, b] (der Browser löst sie auf). */
const cssRgb = (page: import('@playwright/test').Page, v: string) => page.evaluate((name) => {
  const c = document.createElement('canvas').getContext('2d')!;
  c.fillStyle = '#000';
  c.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  c.fillRect(0, 0, 1, 1);
  const [r, g, b] = c.getImageData(0, 0, 1, 1).data;
  return [r!, g!, b!];
}, v);

for (const size of [{ width: 1536, height: 864 }, { width: 1280, height: 720 }]) {
  test(`Hauptviewport: Randspalten haben die Unterlagenfarbe, daneben beginnt das Panel (${size.width}x${size.height})`, async ({ page }) => {
    await page.setViewportSize(size);
    await newProject(page, 'Post 4:5');
    for (const [name, key] of BACKDROPS) {
      await page.getByRole('button', { name: /^Unterlage/ }).click();
      const pop = page.getByRole('dialog', { name: 'Unterlage' });
      await pop.getByRole('radio', { name }).check();
      await page.keyboard.press('Escape');
      await expect(pop).toBeHidden();
      const box = (await page.locator('.canvas-scroll').boundingBox())!;
      const x0 = Math.round(box.x);
      const x1 = Math.round(box.x + box.width);
      // Spalten: letzte zwei im Viewport links und rechts, dazu die erste im rechten Panel; Zeile unterhalb des Lineals
      const png = PNG.sync.read(await page.screenshot({ clip: { x: x0, y: box.y + 60, width: x1 - x0 + 1, height: 1 } }));
      const px = (x: number) => Array.from(png.data.subarray(x * 4, x * 4 + 3));
      const unterlage = await cssRgb(page, `--unterlage-${key}`);
      const paper = await cssRgb(page, '--table'); // rechts beginnt der Rand um die Inspector-Karte in Tischfarbe
      for (const x of [0, 1, x1 - x0 - 2, x1 - x0 - 1]) expect(px(x), `${name}: Spalte ${x}`).toEqual(unterlage);
      expect(px(x1 - x0), `${name}: erste Spalte des rechten Panels`).toEqual(paper);
    }
  });
}

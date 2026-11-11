import { expect, test, type Page } from '@playwright/test';
import { elements, newProject } from './fixtures';

const xy = async (page: Page) => {
  const e = (await elements(page))[0]!;
  return { x: e.x, y: e.y };
};

async function mount(page: Page, x = 0, y = 0) {
  await newProject(page, 'Post 4:5');
  await page.getByRole('button', { name: 'Text hinzufügen' }).click();
  await expect.poll(() => elements(page)).toHaveLength(1);
  const id = (await elements(page))[0]!.id;
  await page.evaluate(([i, px, py]) => window.__bbzbTest.patch(i as string, { x: px as number, y: py as number }), [id, x, y]);
  await page.evaluate(() => window.__bbzbTest.mountSliders(true));
  await page.mouse.click(5, 5); // Fokus weg vom Editor-Feld, History-Stand = Ausgangswert
}

test('Knob: Pfeile, Bild auf/ab, Pos1, Ende, Werte als aria', async ({ page }) => {
  await mount(page);
  const k = page.getByRole('slider', { name: 'Stärke' });
  await expect(k).toHaveAttribute('aria-valuemin', '-1000');
  await expect(k).toHaveAttribute('aria-valuemax', '1000');
  await expect(k).toHaveAttribute('aria-valuenow', '0');
  await k.focus();
  await page.keyboard.press('ArrowUp');
  await expect.poll(async () => (await xy(page)).x).toBe(1);
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowDown');
  await expect.poll(async () => (await xy(page)).x).toBe(-1);
  await page.keyboard.press('PageUp');
  await expect.poll(async () => (await xy(page)).x).toBe(9);
  await page.keyboard.press('End');
  await expect(k).toHaveAttribute('aria-valuenow', '1000');
  await expect(k).toHaveAttribute('aria-valuetext', '1000 %');
  await page.keyboard.press('Home');
  await expect(k).toHaveAttribute('aria-valuenow', '-1000');
});

test('Knob: senkrechtes Ziehen ändert den Wert, eine Geste = ein Undo-Schritt, Doppelklick setzt Standard', async ({ page }) => {
  await mount(page);
  const k = page.getByRole('slider', { name: 'Stärke' });
  const b = (await k.boundingBox())!;
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (const dy of [-10, -20, -30]) await page.mouse.move(cx, cy + dy); // nach oben = grösser
  await page.mouse.up();
  await expect.poll(async () => (await xy(page)).x).toBe(400); // 30 px von 150 px über 2000
  await page.mouse.click(5, 5);
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await xy(page)).x).toBe(0); // alle drei Bewegungen in einem Schritt
  await page.keyboard.press('Control+y');
  await expect.poll(async () => (await xy(page)).x).toBe(400);
  await page.mouse.dblclick(cx, cy);
  await expect.poll(async () => (await xy(page)).x).toBe(0);
});

test('RangeSlider: Tastatur je Griff, Start nie über Ende, Ziehen ein Undo-Schritt', async ({ page }) => {
  await mount(page, 0, 100); // Start 100, Ende 2000
  const s = page.getByRole('slider', { name: 'Start' });
  const e = page.getByRole('slider', { name: 'Ende' });
  await expect(s).toHaveAttribute('aria-valuenow', '100');
  await expect(e).toHaveAttribute('aria-valuenow', '2000');
  await s.focus();
  await page.keyboard.press('ArrowRight');
  await expect(s).toHaveAttribute('aria-valuenow', '101');
  await page.keyboard.press('End');
  await expect(s).toHaveAttribute('aria-valuenow', '1999'); // höchstens Ende minus Schritt
  await expect(e).toHaveAttribute('aria-valuenow', '2000');
  await page.keyboard.press('Home');
  await expect(s).toHaveAttribute('aria-valuenow', '0');
  await e.focus();
  await page.keyboard.press('Home');
  await expect(e).toHaveAttribute('aria-valuenow', '1'); // mindestens Start plus Schritt
  await page.keyboard.press('End');
  await expect(e).toHaveAttribute('aria-valuenow', '4000');
  // Ziehen: Start-Griff weit über das Ende hinaus
  await page.mouse.click(5, 5);
  const before = await xy(page);
  const sb = (await s.boundingBox())!;
  const eb = (await e.boundingBox())!;
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
  await page.mouse.down();
  await page.mouse.move(sb.x + 40, sb.y + sb.height / 2);
  await page.mouse.move(eb.x + eb.width + 80, sb.y + sb.height / 2);
  await page.mouse.up();
  await expect(s).toHaveAttribute('aria-valuenow', '3999');
  expect((await xy(page)).y).toBeLessThan((await xy(page)).x + 2000);
  await page.mouse.click(5, 5);
  await page.keyboard.press('Control+z');
  await expect.poll(() => xy(page)).toEqual(before);
});

test('Slider: Mitte-Variante mit Beschriftungen, Pfeile, Doppelklick auf 0; Kurz-Variante ist kürzer', async ({ page }) => {
  await mount(page);
  const c = page.getByRole('slider', { name: 'Helligkeit' });
  await expect(page.getByText('dunkel')).toBeVisible();
  await expect(page.getByText('hell', { exact: true })).toBeVisible();
  await c.focus();
  await page.keyboard.press('End');
  await expect(c).toHaveValue('100');
  await page.keyboard.press('Home');
  await expect(c).toHaveValue('-100');
  const box = (await c.boundingBox())!;
  await page.mouse.dblclick(box.x + 5, box.y + box.height / 2);
  await expect(c).toHaveValue('0');
  const long = (await page.getByRole('slider', { name: 'Lang' }).boundingBox())!;
  const short = (await page.getByRole('slider', { name: 'Kurz' }).boundingBox())!;
  expect(short.width).toBeLessThan(long.width);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/task-4-kit.png`, clip: { x: page.viewportSize()!.width - 360, y: 20, width: 340, height: 520 } });
});

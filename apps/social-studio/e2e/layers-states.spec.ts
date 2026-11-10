import { expect, test, type Page } from '@playwright/test';
import { bbzbsocial, openLayers, view } from './fixtures';

const layers = (page: Page) => page.getByRole('list', { name: 'Ebenen' });
const row = (page: Page, name: string) => layers(page).getByRole('listitem').filter({ has: page.getByRole('button', { name, exact: true }) });
const css = (page: Page, sel: string, prop: string) => page.locator(sel).first().evaluate((e, p) => getComputedStyle(e).getPropertyValue(p), prop);

/** Altes Projekt: ein gesperrtes, ein ausgeblendetes und ein halb transparentes Element (alle Texte, kein Medium nötig). */
function project(): Buffer {
  const text = (id: string, name: string, y: number, extra: object) => ({
    id, type: 'text', name, x: 72, y, width: 936, height: 200, rotation: 0, opacity: 1, visible: true, locked: false,
    props: { text: name, style: 'kommentar', color: 'warmweiss', fontSize: 80, align: 'left' }, ...extra,
  });
  return bbzbsocial({
    schemaVersion: 1, id: 'zustaende', name: 'Zustände', createdAt: 0, updatedAt: 0,
    format: { id: 'post', width: 1080, height: 1350 },
    slides: [{ id: 's1', background: 'blau' }],
    elements: {
      a: text('a', 'Normal', 100, {}),
      b: text('b', 'Gesperrt', 400, { locked: true }),
      c: text('c', 'Versteckt', 700, { visible: false }),
      d: text('d', 'Halbtransparent', 1000, { opacity: 0.5 }),
    },
    order: ['a', 'b', 'c', 'd'],
    assets: {},
  });
}

test('Ebenen-Reiter zeigt gesperrt, ausgeblendet und halb transparent als Zustand, nie als Deckkraft', async ({ page }) => {
  await page.goto('');
  await page.locator('input[type=file]').setInputFiles({ name: 'x.bbzb', mimeType: 'application/zip', buffer: project() });
  await page.getByRole('button', { name: '«Zustände» öffnen', exact: true }).click();
  await view(page);
  await openLayers(page);

  await expect(row(page, 'Gesperrt').getByRole('button', { name: 'Entsperren' })).toHaveAttribute('aria-pressed', 'true');
  await expect(row(page, 'Gesperrt').locator('.tabler-icon-lock')).toHaveCount(1);
  await expect(row(page, 'Versteckt').getByRole('button', { name: 'Einblenden' })).toHaveAttribute('aria-pressed', 'true');
  await expect(row(page, 'Versteckt').locator('.tabler-icon-eye-off')).toHaveCount(1);
  for (const n of ['Normal', 'Halbtransparent']) {
    await expect(row(page, n).getByRole('button', { name: 'Ausblenden' })).toHaveAttribute('aria-pressed', 'false');
    await expect(row(page, n).getByRole('button', { name: 'Sperren' })).toHaveAttribute('aria-pressed', 'false');
    await expect(row(page, n).locator('.tabler-icon-lock-open')).toHaveCount(1);
  }

  // Ausgeblendet: Name in ink-disabled, Zeile voll deckend; die halb transparente Ebene sieht in der Liste normal aus
  const disabled = await page.evaluate(() => {
    const s = document.createElement('span');
    s.style.color = 'var(--ink-disabled)';
    document.body.append(s);
    const c = getComputedStyle(s).color;
    s.remove();
    return c;
  });
  const nameColor = (n: string) => row(page, n).locator('.layer-name').evaluate((e) => getComputedStyle(e).color);
  expect(await nameColor('Versteckt')).toBe(disabled);
  expect(await nameColor('Normal')).not.toBe(disabled);
  expect(await nameColor('Halbtransparent')).toBe(await nameColor('Normal'));
  for (const n of ['Normal', 'Gesperrt', 'Versteckt', 'Halbtransparent']) {
    expect(await row(page, n).evaluate((e) => [getComputedStyle(e).opacity, getComputedStyle(e.querySelector('.layer-name')!).opacity])).toEqual(['1', '1']);
  }

  // Gewählte Zeile: Tinte invers; auch die ausgeblendete bleibt lesbar
  await row(page, 'Versteckt').getByRole('button', { name: 'Versteckt', exact: true }).click();
  const [bg, fg] = await row(page, 'Versteckt').evaluate((e) => [getComputedStyle(e).backgroundColor, getComputedStyle(e.querySelector('.layer-name')!).color]);
  expect(bg).not.toBe(await css(page, 'body', 'background-color'));
  expect(fg).not.toBe(bg);
  expect(fg).not.toBe(disabled);

  // Schalten wirkt: Sperren hebt sich auf
  await row(page, 'Gesperrt').getByRole('button', { name: 'Entsperren' }).click();
  await expect(row(page, 'Gesperrt').getByRole('button', { name: 'Sperren' })).toHaveAttribute('aria-pressed', 'false');
  await expect(row(page, 'Gesperrt').locator('.tabler-icon-lock-open')).toHaveCount(1);
});

test('Lange Namen werden nicht auf wenige Zeichen gekürzt (1280 × 720)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('');
  await page.locator('input[type=file]').setInputFiles({ name: 'x.bbzb', mimeType: 'application/zip', buffer: project() });
  await page.getByRole('button', { name: '«Zustände» öffnen', exact: true }).click();
  await view(page);
  await openLayers(page);
  const b = await row(page, 'Halbtransparent').locator('.layer-name').evaluate((e) => ({ clipped: e.scrollWidth > e.clientWidth, w: e.clientWidth }));
  expect(b.clipped).toBe(false);
  expect(b.w).toBeGreaterThan(110);
});

/** Kontrast aus berechneten Stilen: Hintergrund der Taste über der Zeile über der Seite zusammengesetzt, Text gegen diesen Grund. */
async function contrast(page: Page, name: string, btn: 'name' | 'Einblenden' | 'Ausblenden' | 'Sperren' | 'Entsperren') {
  const loc = btn === 'name' ? row(page, name).locator('.layer-name') : row(page, name).getByRole('button', { name: btn });
  await loc.hover();
  return loc.evaluate((el) => {
    // color-mix liefert «color(srgb …)»: über ein Canvas-Pixel auf RGBA normieren
    const px = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
    const rgba = (c: string) => {
      px.clearRect(0, 0, 1, 1);
      px.fillStyle = c;
      px.fillRect(0, 0, 1, 1);
      const d = px.getImageData(0, 0, 1, 1).data;
      return [d[0]!, d[1]!, d[2]!, d[3]! / 255];
    };
    const over = (top: number[], bottom: number[]) => {
      const a = top[3] ?? 1;
      return [0, 1, 2].map((i) => top[i]! * a + bottom[i]! * (1 - a));
    };
    let bg = [255, 255, 255];
    const chain: Element[] = [];
    for (let e: Element | null = el; e; e = e.parentElement) chain.unshift(e);
    for (const e of chain) bg = over(rgba(getComputedStyle(e).backgroundColor), bg);
    const fg = over(rgba(getComputedStyle(el).color), bg);
    const lum = (c: number[]) => c.map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i]!, 0);
    const [hi, lo] = [lum(fg), lum(bg)].sort((x, y) => y - x);
    return (hi! + 0.05) / (lo! + 0.05);
  });
}

test('Hover und Auswahl: Name, Auge und Schloss bleiben lesbar (Name 4.5:1, Icons 3:1), auch ausgeblendet und gesperrt', async ({ page }) => {
  await page.goto('');
  await page.locator('input[type=file]').setInputFiles({ name: 'x.bbzb', mimeType: 'application/zip', buffer: project() });
  await page.getByRole('button', { name: '«Zustände» öffnen', exact: true }).click();
  await view(page);
  await openLayers(page);
  const eyeOf = (n: string) => (n === 'Versteckt' ? 'Einblenden' : 'Ausblenden') as 'Einblenden' | 'Ausblenden';
  const lockOf = (n: string) => (n === 'Gesperrt' ? 'Entsperren' : 'Sperren') as 'Entsperren' | 'Sperren';
  for (const selected of [false, true]) {
    for (const n of ['Normal', 'Gesperrt', 'Versteckt', 'Halbtransparent']) {
      if (selected) await row(page, n).getByRole('button', { name: n, exact: true }).click();
      expect(await contrast(page, n, 'name'), `${n} Name, gewählt ${selected}`).toBeGreaterThanOrEqual(4.5);
      expect(await contrast(page, n, eyeOf(n)), `${n} Auge, gewählt ${selected}`).toBeGreaterThanOrEqual(3);
      expect(await contrast(page, n, lockOf(n)), `${n} Schloss, gewählt ${selected}`).toBeGreaterThanOrEqual(3);
    }
  }
});

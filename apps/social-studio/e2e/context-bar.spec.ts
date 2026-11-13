import { expect, test, type Page } from '@playwright/test';
import { toScreen } from './fixtures';
import { alphaPng, openPhoto } from './photoProject';

// Echte Bildlaufleisten wie unter Windows (Playwright blendet sie sonst aus)
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

const BOX = { x: 140, y: 275, width: 800, height: 800 };
const bar = (page: Page) => page.getByRole('group', { name: 'Maske', exact: true });
const toggle = (page: Page) => page.getByRole('button', { name: 'Maske bearbeiten' });

async function open(page: Page, name: string, box = BOX) {
  await openPhoto(page, name, box, { crop: { x: 0, y: 0, scale: 1 } }, alphaPng(1000, 1000, [15, 27, 38], () => 255), [box.x + 400, box.y + box.height / 2]);
  const c = await toScreen(page, box.x + 400, box.y + box.height / 2);
  await page.mouse.click(c.x, c.y);
  await expect(toggle(page)).toBeVisible();
}

test('Leiste im Maskenmodus: über den Inspektor, Pinsel synchron, «Fertig» und Esc beenden', async ({ page }) => {
  await open(page, 'Leiste Maske');
  await expect(bar(page)).toHaveCount(0);
  await toggle(page).click();
  await expect(bar(page)).toBeVisible();
  await expect(bar(page)).not.toContainText('Esc');
  // Pinsel: Leiste und Inspektor teilen Grösse, Härte und Modus
  const insp = page.locator('section.section', { has: page.getByRole('heading', { name: 'Maske', exact: true }) });
  await bar(page).getByRole('spinbutton', { name: 'Grösse' }).fill('77');
  await bar(page).getByRole('spinbutton', { name: 'Grösse' }).press('Enter');
  await expect(insp.getByRole('slider', { name: 'Grösse' })).toHaveValue('77');
  await insp.getByRole('slider', { name: 'Härte' }).fill('20');
  await expect(bar(page).getByRole('slider', { name: 'Härte' })).toHaveValue('20');
  await bar(page).getByRole('radio', { name: 'Einblenden' }).check();
  await expect(insp.getByRole('radio', { name: 'Einblenden' })).toBeChecked();
  await insp.getByRole('radio', { name: 'Ausblenden' }).check();
  await expect(bar(page).getByRole('radio', { name: 'Ausblenden' })).toBeChecked();
  // Inspektor: Pinselwerte, Umkehren usw. stehen eingerückt unter «Maske bearbeiten»
  const nested = insp.locator('.mask-nested');
  const tx = (await toggle(page).boundingBox())!.x;
  for (const l of [nested.getByRole('slider', { name: 'Grösse' }), nested.getByRole('button', { name: 'Maske umkehren' }), nested.getByRole('radio', { name: 'Ausblenden' })])
    expect((await l.boundingBox())!.x).toBeGreaterThanOrEqual(tx + 8);
  // Fokus bleibt, die Leiste ist per Tab erreichbar, «Fertig» zuletzt
  expect(await bar(page).evaluate((e) => e.contains(document.activeElement))).toBe(false);
  const last = bar(page).locator('button, input').last();
  await expect(last).toHaveText('Fertig');
  await expect(bar(page).getByRole('radio', { name: 'Einblenden' })).toHaveAccessibleDescription('Taste X wechselt.'); // Kürzel auch in der Leiste
  // Ansicht: Leiste und Inspektor teilen sie
  await bar(page).getByRole('radio', { name: 'Ergebnis' }).check();
  await expect(insp.getByRole('radio', { name: 'Ergebnis' })).toBeChecked();
  await insp.getByRole('radio', { name: 'Rote Folie' }).check();
  await expect(bar(page).getByRole('radio', { name: 'Rote Folie' })).toBeChecked();
  await bar(page).getByRole('button', { name: 'Fertig' }).click();
  await expect(bar(page)).toHaveCount(0);
  expect(await page.evaluate(() => window.__bbzbTest.ui().maskEditId)).toBeNull();
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
  await toggle(page).click();
  await expect(bar(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(bar(page)).toHaveCount(0);
});

test('Leiste im Maskenmodus: über das Rechtsklickmenü', async ({ page }) => {
  await open(page, 'Leiste Menü');
  const c = await toScreen(page, 540, 675);
  await page.mouse.click(c.x, c.y, { button: 'right' });
  await page.getByRole('menu').getByRole('menuitem', { name: 'Maske bearbeiten', exact: true }).click();
  await expect(bar(page)).toBeVisible();
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
});

const measure = (page: Page) =>
  page.evaluate(() => {
    const r = (e: Element | null) => (e ? (({ left, top, right, bottom }) => ({ left, top, right, bottom }))(e.getBoundingClientRect()) : null);
    const scroll = document.querySelector<HTMLElement>('.canvas-scroll')!;
    const s = scroll.getBoundingClientRect();
    const v = window.__bbzbTest.view();
    const st = document.querySelector('.konvajs-content')!.getBoundingClientRect();
    const e = window.__bbzbTest.project().elements.e0!;
    return {
      stage: r(document.querySelector('.konvajs-content')),
      view: v,
      frame: { left: st.left + v.x + e.x * v.scale, top: st.top + v.y + e.y * v.scale, right: st.left + v.x + (e.x + e.width) * v.scale, bottom: st.top + v.y + (e.y + e.height) * v.scale },
      bar: r(document.querySelector('.context-bar')),
      scrollbarTop: s.top + scroll.clientTop + scroll.clientHeight,
      scrollbarH: scroll.offsetHeight - scroll.clientHeight - scroll.clientTop,
    };
  });
type Rect = { left: number; top: number; right: number; bottom: number };
const meets = (a: Rect, b: Rect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

for (const size of [{ width: 1280, height: 720 }, { width: 1536, height: 864 }]) {
  test(`Maskenleiste ${size.width} × ${size.height}: über der Bildlaufleiste, Leinwand unverändert, Foto frei`, async ({ page }) => {
    await page.setViewportSize(size);
    await open(page, 'Leiste Mass');
    const before = await measure(page);
    await toggle(page).click();
    await expect(bar(page)).toBeVisible();
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const m = await measure(page);
    expect([m.stage, m.view]).toEqual([before.stage, before.view]);
    expect(m.scrollbarH).toBeGreaterThanOrEqual(12);
    expect(m.bar!.bottom).toBeLessThanOrEqual(m.scrollbarTop - 12 + 0.5);
    expect(meets(m.bar!, m.frame)).toBe(false);
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/mask-bar-${size.width}.png` });
    expect(m.bar!.bottom - m.bar!.top).toBeLessThan(80); // eine Zeile (Beschriftung der Regler über der Bahn)
    await page.keyboard.press('Escape');
    expect((await measure(page)).stage).toEqual(before.stage);
  });
}

test('Maskenleiste: ein Strich über die Leiste malt weiter, die Leiste fängt ihn nicht ab', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await open(page, 'Leiste Strich');
  await toggle(page).click();
  await expect(bar(page)).toBeVisible();
  const h0 = await page.evaluate(() => window.__bbzbTest.history());
  const r = (await measure(page)).bar!;
  const barMid = { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 };
  const a = { x: barMid.x - 80, y: 240 };
  const b = { x: barMid.x + 80, y: 240 };
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(barMid.x, barMid.y, { steps: 10 });
  expect(await bar(page).evaluate((e) => getComputedStyle(e).pointerEvents)).toBe('none'); // während des Strichs keine Hover-Wirkung
  await page.mouse.move(b.x, b.y, { steps: 10 });
  await page.mouse.up();
  expect(await bar(page).evaluate((e) => getComputedStyle(e).pointerEvents)).toBe('auto');
  // Strich beginnt knapp neben der Leiste (ausserhalb) und malt
  // Der Hinweg liegt links (Maske x < 350), der Rückweg von der Leiste rechts davon: dort ist gemalt, also lief der Strich über die Leiste hinweg weiter
  const paintedRight = () =>
    page.evaluate(async () => {
      const pts: [number, number][] = [];
      for (let y = 0; y < 1000; y += 25) for (let x = 450; x < 1000; x += 25) pts.push([x, y]);
      const r = await window.__bbzbTest.maskValues('e0', pts);
      return r!.values.filter((v) => v !== 255).length;
    });
  await expect.poll(paintedRight).toBeGreaterThan(5);
  expect(await page.evaluate(() => window.__bbzbTest.history())).toBe(h0 + 1); // ein Strich, ein Undo-Schritt
  // ein Druck auf die Leiste malt nichts und lässt den Modus an
  await page.mouse.click(barMid.x, barMid.y - 2);
  await expect(bar(page)).toBeVisible();
});

test('Maskenleiste 1024 × 640: alle Bedienelemente liegen ganz im sichtbaren Bereich der Leinwand', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 640 });
  await open(page, 'Leiste klein');
  await toggle(page).click();
  await expect(bar(page)).toBeVisible();
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const canvas = (await page.locator('.canvas-scroll').boundingBox())!;
  const items = bar(page).locator('button, input, legend:visible, .context-bar-title');
  const n = await items.count();
  expect(n).toBeGreaterThanOrEqual(7); // Titel, 2 + 2 Optionen, 2 Regler mit Zahlfeld, Fertig
  for (let i = 0; i < n; i++) {
    const b = await items.nth(i).boundingBox();
    if (!b) continue; // Radios hinter der Beschriftung haben eine Fläche, ausgeblendete Legenden nicht
    expect.soft(b.x, `Element ${i} links`).toBeGreaterThanOrEqual(canvas.x);
    expect.soft(b.y, `Element ${i} oben`).toBeGreaterThanOrEqual(canvas.y);
    expect.soft(b.x + b.width, `Element ${i} rechts`).toBeLessThanOrEqual(canvas.x + canvas.width);
    expect.soft(b.y + b.height, `Element ${i} unten`).toBeLessThanOrEqual(canvas.y + canvas.height);
  }
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/task-8-brush-1024.png` });
});

// 125 % Skalierung entspricht 1024 px bzw. 1280 px geteilt durch 1,25
for (const [width, height] of [[1024, 640], [1280, 720], [820, 512], [1024, 576]] as const) {
  test(`Pinselwahl im Inspector ${width} × ${height}: Ausblenden | Einblenden und Ansicht nicht abgeschnitten`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await open(page, 'Passt');
    await toggle(page).click();
    await expect(bar(page)).toBeVisible();
    const fit = await page.locator('.inspector').evaluate((insp) => {
      const edge = insp.getBoundingClientRect().left + insp.clientWidth;
      return [...insp.querySelectorAll<HTMLElement>('.mask-nested fieldset > .segmented')].map((s) => ({
        right: Math.round(s.getBoundingClientRect().right),
        width: Math.round(s.getBoundingClientRect().width),
        edge: Math.round(edge),
        clipped: [...s.querySelectorAll('span')].some((l) => l.scrollWidth > l.clientWidth),
      }));
    });
    expect(fit).toHaveLength(2);
    for (const f of fit) {
      expect(f.right).toBeLessThanOrEqual(f.edge);
      expect(f.width).toBeGreaterThanOrEqual(200); // Beschriftung steht darüber: die Wahl bekommt die ganze Spalte, nicht den Rest neben der Beschriftung
      expect(f.clipped).toBe(false);
    }
  });
}

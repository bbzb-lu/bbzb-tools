import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { newProject } from './fixtures';

/**
 * Gleitende Auswahlfläche und rollende Zahl (Phase 4c.2 P2): bewegt wird nur transform und opacity, mit reduzierter Bewegung gar nichts.
 * Die Tests hängen nicht an der Zeit: `Element.animate` wird vorab aufgezeichnet, der Endstand steht sofort im Stil.
 */
const tab = (page: Page, name: string) => page.getByRole('tab', { name, exact: true });
const panel = (page: Page) => page.getByLabel('Eigenschaften');

type Call = { cls: string; props: string[] };
async function record(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __calls: Call[] };
    w.__calls = [];
    const orig = Element.prototype.animate;
    Element.prototype.animate = function (this: Element, kf: Keyframe[], o?: KeyframeAnimationOptions | number) {
      w.__calls.push({ cls: `${this.className} ${this.tagName}`, props: [...new Set(kf.flatMap((k) => Object.keys(k)).filter((k) => k !== 'offset' && k !== 'easing'))] });
      return orig.call(this, kf, o);
    };
  });
}
const calls = (page: Page, cls: string) => page.evaluate((c) => (window as unknown as { __calls: Call[] }).__calls.filter((x) => x.cls.includes(c)), cls);

/** Lage der Fläche im Rahmen gegenüber dem gewählten Element. */
const placed = (page: Page, host: string, item: string) =>
  page.locator(host).first().evaluate((hostEl, i) => {
    const bar = hostEl.querySelector<HTMLElement>(':scope > .slide-hl')!;
    const sel = hostEl.querySelector<HTMLElement>(i)!;
    const m = new DOMMatrix(getComputedStyle(bar).transform);
    const br = bar.getBoundingClientRect();
    const sr = sel.getBoundingClientRect();
    return { dx: Math.abs(br.left - sr.left), dy: Math.abs(br.top - sr.top), dw: Math.abs(br.width - sr.width), shown: getComputedStyle(bar).display !== 'none', m41: m.m41 };
  }, item);

test('Reiter links: die Fläche gleitet per transform zum neuen Reiter und endet exakt darauf', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await expect.poll(() => placed(page, '.left-tabs', "[aria-selected='true']")).toMatchObject({ shown: true, dx: 0 });
  await record(page);
  const anims = await page.evaluate(async () => {
    document.querySelectorAll<HTMLElement>('.left-tabs [role=tab]')[1]!.click();
    await new Promise(requestAnimationFrame); // Render des Stores; die Animation (220 ms) läuft noch
    return document.getAnimations().filter((a) => (a.effect as KeyframeEffect).target?.closest('.slide-hl')).length;
  });
  expect(anims).toBeGreaterThan(0);
  const c = await calls(page, 'slide-hl');
  expect(c.length).toBeGreaterThan(0);
  for (const x of c) expect(x.props).toEqual(['transform']);
  await expect(tab(page, 'Ebenen')).toHaveAttribute('aria-selected', 'true');
  await expect.poll(() => placed(page, '.left-tabs', "[aria-selected='true']")).toMatchObject({ dx: 0, dy: 0, dw: 0 });
  // zurück per Tastatur (Home) gleitet ebenso
  await tab(page, 'Ebenen').focus();
  await page.keyboard.press('Home');
  await expect.poll(() => placed(page, '.left-tabs', "[aria-selected='true']")).toMatchObject({ dx: 0, dw: 0 });
  expect((await calls(page, 'slide-hl')).length).toBeGreaterThan(c.length);
});

test('Kategorie-Reiter: die Linie gleitet, endet unter dem gewählten Reiter', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await record(page);
  await page.getByRole('tab', { name: 'Doodles', exact: true }).click();
  await expect.poll(() => placed(page, '.library-tabs', "[aria-selected='true']")).toMatchObject({ dx: 0, dw: 0 });
  const c = await calls(page, 'slide-hl');
  expect(c.length).toBeGreaterThan(0);
  expect(c[0]!.props).toEqual(['transform']);
});

test('Umschalter: die Fläche gleitet zur neuen Option, die Wahl steht sofort am Radio', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await page.getByRole('button', { name: 'Text hinzufügen' }).click();
  const group = panel(page).getByRole('group', { name: 'Ausrichtung' });
  await expect(group.getByRole('radio', { name: 'Links' })).toBeChecked();
  await record(page);
  await group.getByRole('radio', { name: 'Mitte' }).check({ force: true });
  await expect(group.getByRole('radio', { name: 'Mitte' })).toBeChecked(); // sofort, ohne auf die Fläche zu warten
  expect((await calls(page, 'slide-hl')).length).toBeGreaterThan(0);
  const h = 'fieldset:has(> legend:text-is("Ausrichtung")) .segmented';
  await expect.poll(() => placed(page, h, 'label:has(input:checked)')).toMatchObject({ dx: 0, dy: 0, dw: 0 });
});

test.describe('reduzierte Bewegung', () => {
  test.use({ reducedMotion: 'reduce' });
  test('keine Animation: Fläche steht sofort am Ziel, Zahl rollt nicht', async ({ page }) => {
    await newProject(page, 'Post 4:5');
    await record(page);
    await tab(page, 'Ebenen').click();
    expect(await page.evaluate(() => document.getAnimations().filter((a) => (a.effect as KeyframeEffect).target?.closest('.slide-hl')).length)).toBe(0);
    await expect.poll(() => placed(page, '.left-tabs', "[aria-selected='true']")).toMatchObject({ dx: 0, dw: 0 });
    await tab(page, 'Bibliothek').click();
    await page.getByRole('button', { name: 'Text hinzufügen' }).click();
    const o = panel(page).getByRole('slider', { name: 'Deckkraft' });
    await o.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(panel(page).getByRole('spinbutton', { name: 'Deckkraft' })).toHaveValue('99');
    expect(await calls(page, '')).toEqual([]);
  });
});

const ghost = (page: Page) => panel(page).locator('.roll-wrap:has(input[aria-label="Deckkraft"]) .roll-ghost');

test('Zahl am Regler rollt (nur die Ziffern, nur transform und opacity), zeigt immer den Wert; im Feld selbst nicht', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await page.getByRole('button', { name: 'Text hinzufügen' }).click();
  const slider = panel(page).getByRole('slider', { name: 'Deckkraft' });
  const num = panel(page).getByRole('spinbutton', { name: 'Deckkraft' });
  await slider.focus();
  await record(page);
  await page.keyboard.press('ArrowLeft');
  await expect(num).toHaveValue('99');
  await expect.poll(async () => (await calls(page, 'roll-ghost')).length).toBe(1); // die Rolle startet im nächsten Bild
  const c = await calls(page, 'roll-ghost');
  expect(c[0]!.props.sort()).toEqual(['opacity', 'transform']);
  expect(await calls(page, 'INPUT')).toEqual([]); // das Feld selbst (Rahmen) bewegt sich nie
  // schnell hintereinander: höchstens ein Start je Bild; der Wert stimmt
  const before = (await calls(page, 'roll-ghost')).length;
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowLeft');
  await expect(num).toHaveValue('94');
  expect((await calls(page, 'roll-ghost')).length - before).toBeLessThanOrEqual(5);
  // Tippen im Feld: keine Animation. Erst zwei Bilder warten: die Rolle des letzten Pfeils startet im nächsten Bild
  await page.evaluate(() => new Promise(requestAnimationFrame));
  await page.evaluate(() => new Promise(requestAnimationFrame));
  const n = (await calls(page, 'roll-ghost')).length;
  await num.fill('50');
  await num.press('Enter');
  await expect(num).toHaveValue('50');
  expect((await calls(page, 'roll-ghost')).length).toBe(n);
});

test('Ziehen am Regler: jeder neue Wert rollt, Feld bleibt zu jedem Zeitpunkt stehen, Ruhe voll sichtbar', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await page.getByRole('button', { name: 'Text hinzufügen' }).click();
  const slider = panel(page).getByRole('slider', { name: 'Deckkraft' });
  const num = panel(page).getByRole('spinbutton', { name: 'Deckkraft' });
  const b = (await slider.boundingBox())!;
  await record(page);
  const rect = () => num.evaluate((e) => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; });
  const rest = await rect();
  await page.mouse.move(b.x + b.width - 6, b.y + b.height / 2);
  await page.mouse.down();
  const seen: number[][] = [];
  const values = new Set<string>();
  for (let i = 0; i < 40; i++) {
    await page.mouse.move(b.x + b.width - 6 - (i * (b.width - 20)) / 40, b.y + b.height / 2);
    await page.waitForTimeout(15);
    seen.push(await rect());
    values.add(await num.inputValue());
  }
  const during = await num.evaluate((e) => { const c = getComputedStyle(e); return { t: c.transform, o: c.opacity }; });
  await page.mouse.up();
  expect(values.size).toBeGreaterThanOrEqual(10);
  for (const r of seen) expect(r).toEqual(rest);
  expect(during).toEqual({ t: 'none', o: '1' });
  expect((await calls(page, 'roll-ghost')).length).toBeGreaterThanOrEqual(10);
  expect(await calls(page, 'INPUT')).toEqual([]);
  await expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0);
  await expect.poll(() => panel(page).locator('.roll-wrap.rolling').count()).toBe(0);
  expect(await ghost(page).evaluate((e) => e.textContent)).toBe(''); // Kopie zählt in Ruhe nicht
  expect(await num.evaluate((e) => { const c = getComputedStyle(e); return [c.transform, c.opacity]; })).toEqual(['none', '1']);
  await expect(num).not.toHaveValue('100');
  expect(await panel(page).getByText(await num.inputValue(), { exact: true }).count()).toBeLessThanOrEqual(1);
});

test('Zahl mitten im Rollen: die Ziffern sind abgesenkt und blass, das Feld steht', async ({ page }, testInfo) => {
  await newProject(page, 'Post 4:5');
  await page.getByRole('button', { name: 'Text hinzufügen' }).click();
  const num = panel(page).getByRole('spinbutton', { name: 'Deckkraft' });
  await panel(page).getByRole('slider', { name: 'Deckkraft' }).focus();
  await page.keyboard.press('ArrowLeft');
  await page.evaluate(() => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = 40; }));
  const g = await ghost(page).evaluate((e) => { const c = getComputedStyle(e); return { d: c.display, o: parseFloat(c.opacity), m: new DOMMatrix(c.transform).m42, text: e.textContent }; });
  expect(g.d).not.toBe('none');
  expect(g.o).toBeLessThan(1);
  expect(g.m).toBeGreaterThan(0);
  expect(g.text).toBe('99');
  const b = (await num.boundingBox())!;
  await page.screenshot({ path: testInfo.outputPath('p2-zahl-mid.png'), clip: { x: b.x - 120, y: b.y - 14, width: b.width + 160, height: b.height + 28 } });
});

/** Klicken und alle Animationen im selben Zug anhalten (nach dem Render), damit sie nicht schon zu Ende gelaufen sind. */
async function clickAndPause(page: Page, click: () => void) {
  const n = await page.evaluate(async (src) => {
    new Function(`(${src})()`)();
    await new Promise(requestAnimationFrame);
    const all = document.getAnimations().filter((a) => (a.effect as KeyframeEffect).target?.closest('.slide-hl'));
    all.forEach((a) => a.pause());
    return all.length;
  }, click.toString());
  expect(n).toBeGreaterThan(0);
}

/** Bildfolge mitten im Gleiten: Animationen anhalten, auf eine Zeit setzen, das Rechteck fotografieren. */
async function frames(page: Page, host: string, shots: (n: string) => string, name: string, times = [0, 60, 110, 170]) {
  const paper = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--paper').trim());
  const [pr, pg, pb] = [1, 3, 5].map((i) => parseInt(paper.slice(i, i + 2), 16));
  const out: { t: number; paperOutside: number; paperInside: number }[] = [];
  for (const t of times) {
    await page.evaluate((ms) => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = ms; }), t);
    const hostBox = (await page.locator(host).first().boundingBox())!;
    const bar = await page.locator(host).first().locator('> .slide-hl').evaluate((e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right }; });
    const buf = await page.screenshot({ clip: hostBox });
    const png = PNG.sync.read(buf);
    const k = png.width / hostBox.width;
    let outside = 0;
    let inside = 0;
    for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) {
      const i = (y * png.width + x) * 4;
      if (png.data[i] === pr && png.data[i + 1] === pg && png.data[i + 2] === pb) {
        const px = hostBox.x + x / k;
        if (px >= bar.l - 1 && px <= bar.r + 1) inside++; else outside++;
      }
    }
    out.push({ t, paperOutside: outside, paperInside: inside });
    if (t >= 60 && t <= 170) expect(inside, `Schrift in der Fläche t=${t}`).toBeGreaterThan(0);
    await page.screenshot({ path: shots(`p2-${name}-${t}.png`), clip: { ...hostBox, x: hostBox.x - 8, y: hostBox.y - 8, width: hostBox.width + 16, height: hostBox.height + 16 } });
  }
  return out;
}

test('Lesbarkeit mitten im Gleiten: Papierschrift steht nie ausserhalb der Fläche (Reiter, Umschalter)', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1536, height: 864 });
  await newProject(page, 'Post 4:5');
  await clickAndPause(page, () => document.querySelectorAll<HTMLElement>('.left-tabs [role=tab]')[1]!.click());
  for (const f of await frames(page, '.left-tabs', (n) => testInfo.outputPath(n), 'tabs')) expect(f.paperOutside, `Reiter t=${f.t}`).toBe(0);
  await page.getByRole('button', { name: 'Text hinzufügen' }).click();
  const seg = 'fieldset:has(> legend:text-is("Ausrichtung")) .segmented';
  await clickAndPause(page, () => [...document.querySelectorAll('fieldset')].find((f) => f.querySelector(':scope > legend')?.textContent === 'Ausrichtung')!.querySelectorAll('input')[2]!.click());
  for (const f of await frames(page, seg, (n) => testInfo.outputPath(n), 'segmented')) expect(f.paperOutside, `Umschalter t=${f.t}`).toBe(0);
});

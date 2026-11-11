import { expect, test, type Page } from '@playwright/test';
import { addPhoto, elements, frames, newProject, openSection, png, toScreen } from './fixtures';

/** Schatten über und unter einer Slide, wenn ein Klick dort den Slide-Hintergrund wählt. Nur Ansicht. */
const W = 1080;
const H = 1350;
const glows = (page: Page, i: number) => page.locator(`.slide-glow[data-slide="${i}"]`);
/** Deckkraft und senkrechte Skalierung aller Schatten, nach Slide gruppiert ([oben, unten] je Slide). */
const glowStates = (page: Page) =>
  page.evaluate(() => {
    const out: { o: number; s: number }[][] = [];
    for (const g of document.querySelectorAll<HTMLElement>('.slide-glow')) {
      const c = getComputedStyle(g);
      (out[Number(g.dataset.slide)] ??= []).push({ o: Number(c.opacity), s: new DOMMatrix(c.transform).d });
    }
    return out;
  });
const opacities = async (page: Page) => (await glowStates(page)).map((o) => o.map((g) => g.o));
/** Slides mit vollem Schatten (Deckkraft und Höhe ganz). */
const lit = async (page: Page) => (await glowStates(page)).flatMap((o, i) => (o.every((g) => g.o > 0.95 && g.s > 0.99) ? [i] : []));
/** Slides mit zurückgezogenem Schatten: sichtbar, aber schwächer und kürzer als voll. */
const near = async (page: Page) => (await glowStates(page)).flatMap((o, i) => (o.every((g) => g.o > 0.2 && g.o < 0.6 && g.s > 0.45 && g.s < 0.6) ? [i] : []));
const dark = async (page: Page) => (await opacities(page)).every((o) => o.every((v) => v < 0.05));
/** Bildschirmpunkt unter Slide i (Mitte der Slide, 10 px unter der Kante); scrollt die Slide-Mitte bei Bedarf in die Ansicht. */
const below = async (page: Page, i: number) => {
  const box = (await page.locator('.canvas-scroll').boundingBox())!;
  let p = await toScreen(page, (i + 0.5) * W, H);
  const dx = p.x < box.x + 40 || p.x > box.x + box.width - 60 ? p.x - (box.x + box.width / 2) : 0;
  const dy = p.y + 10 > box.y + box.height - 40 ? p.y - (box.y + box.height / 2) : 0;
  if (dx || dy) {
    await page.locator('.canvas-scroll').evaluate((el, [dx, dy]) => ((el.scrollLeft += dx!), (el.scrollTop += dy!)), [dx, dy]);
    await frames(page);
    p = await toScreen(page, (i + 0.5) * W, H);
  }
  return { x: p.x, y: p.y + 10 };
};

test('Unter Slide 2 hovern: ihr Schatten oben und unten erscheint voll, auf dem Inhalt zieht er sich zurück, daneben verschwindet er', async ({ page }) => {
  await newProject(page, 'Post 4:5', 'Carousel');
  await frames(page);
  await expect(glows(page, 1)).toHaveCount(2);
  expect(await glows(page, 1).first().getAttribute('aria-hidden')).toBeNull(); // die Ebene als Ganzes ist aria-hidden
  await expect(page.locator('.slide-glows')).toHaveAttribute('aria-hidden', 'true');
  const p = await below(page, 1);
  await page.mouse.move(p.x, p.y);
  await expect.poll(() => lit(page)).toEqual([1]);
  const o = await opacities(page);
  o.forEach((v, i) => i !== 1 && expect(v, `Slide ${i + 1}`).toEqual([0, 0]));
  // über dem Slide-Inhalt: ein Klick bearbeitet jetzt den Inhalt, der Schatten zieht sich zurück, bleibt aber sichtbar
  const c = await toScreen(page, 1.5 * W, H / 2);
  await page.mouse.move(c.x, c.y, { steps: 4 });
  await expect.poll(() => near(page)).toEqual([1]);
  expect(await lit(page)).toEqual([]);
  (await opacities(page)).forEach((v, i) => i !== 1 && expect(v, `Slide ${i + 1}`).toEqual([0, 0]));
  // zurück, dann in die Spalte von Slide 3: der alte Schatten geht, der neue kommt
  await page.mouse.move(p.x, p.y);
  await expect.poll(() => lit(page)).toEqual([1]);
  const q = await below(page, 2);
  await page.mouse.move(q.x, q.y, { steps: 3 });
  await expect.poll(() => lit(page)).toEqual([2]);
  // links neben Slide 1 (Arbeitsfläche ohne Slide) und ausserhalb der Leinwand: kein Schatten
  await page.mouse.move(5, 300);
  await expect.poll(() => dark(page)).toBe(true);
});

test('Klick unter Slide 3 (Panorama) wählt ihren Hintergrund, auch nach Slide 2; Klick auf Inhalt wählt das Element', async ({ page }) => {
  await newProject(page, 'Post 4:5', 'Carousel');
  await frames(page);
  const panel = page.getByLabel('Eigenschaften');
  for (const i of [1, 2, 3]) {
    const p = await below(page, i);
    await page.mouse.click(p.x, p.y);
    await expect(panel.getByRole('heading', { level: 2 })).toHaveText(`Slide ${i + 1}`);
    await expect(panel.getByRole('button', { name: 'Hintergrund' })).toBeVisible();
    expect(await page.evaluate(() => window.__bbzbTest.selected())).toBeNull();
  }
  await openSection(page, 'Hintergrund');
  // Inhalt: ein Text auf der sichtbaren Slide 4 wird gewählt
  const text = (await elements(page)).find((e) => e.type === 'text' && e.x >= 3 * W && e.x < 4 * W && !e.locked)!;
  const c = await toScreen(page, text.x + text.width / 2, text.y + text.height / 2);
  await page.mouse.click(c.x, c.y);
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.selected())).toBe(text.id);
});

test('Kein Schatten beim Ziehen, im Ausschnittmodus und beim Text-Bearbeiten', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addPhoto(page, png(400, 300));
  await expect.poll(() => elements(page)).toHaveLength(1);
  const p = await below(page, 0);
  await page.mouse.move(p.x, p.y);
  await expect.poll(() => lit(page)).toEqual([0]);
  // gedrückt (Aufziehrahmen von unten)
  await page.mouse.down();
  await page.mouse.move(p.x + 10, p.y + 2, { steps: 2 });
  await expect.poll(() => dark(page)).toBe(true);
  await page.mouse.up();
  await page.evaluate((id) => window.__bbzbTest.select(id), (await elements(page))[0]!.id);
  await openSection(page, 'Bild');
  await page.getByRole('button', { name: 'Ausschnitt bearbeiten' }).click();
  await expect(page.getByRole('group', { name: 'Ausschnitt' })).toBeVisible();
  await page.mouse.move(p.x, p.y + 4, { steps: 2 });
  await page.waitForTimeout(400);
  expect(await dark(page)).toBe(true);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Text hinzufügen' }).click();
  const t = (await elements(page)).find((e) => e.type === 'text')!;
  const c = await toScreen(page, t.x + t.width / 2, t.y + t.height / 2);
  await page.mouse.dblclick(c.x, c.y);
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.ui().textEditId)).not.toBeNull();
  await page.mouse.move(p.x - 4, p.y, { steps: 2 });
  await page.waitForTimeout(400);
  expect(await dark(page)).toBe(true);
});

test('Nur transform und opacity animieren; Reduced Motion schaltet ohne Animation', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const props = await page.locator('.slide-glow').first().evaluate((e) => getComputedStyle(e).transitionProperty);
  expect(props.split(', ').sort()).toEqual(['opacity', 'transform']);
  const durations = () => page.locator('.slide-glow').first().evaluate((e) => getComputedStyle(e).transitionDuration.split(', ').map(parseFloat));
  expect(Math.min(...(await durations()))).toBeGreaterThan(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await durations()).toEqual([0]);
  const p = await below(page, 0);
  await page.mouse.move(p.x, p.y);
  await frames(page); // ein Bild für den gebündelten pointermove, eins für den Stil: ohne Übergang schon am Ziel
  expect(await lit(page)).toEqual([0]);
  expect(await page.evaluate(() => document.getAnimations().filter((a) => (a.effect as KeyframeEffect).target?.closest('.slide-glows')).length)).toBe(0);
});

test('Vergrössert und waagrecht gescrollt deckt der Schatten genau die Slide-Spalte', async ({ page }) => {
  await newProject(page, 'Post 4:5', 'Carousel');
  await page.keyboard.press('Control+Equal'); // Strg + Plus
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.ui().zoom)).toBeGreaterThan(1);
  await page.locator('.canvas-scroll').evaluate((e) => (e.scrollLeft += 137));
  await frames(page);
  // Slide 1 ist links teils verdeckt; die nächste ganz sichtbare nehmen
  const box = (await page.locator('.canvas-scroll').boundingBox())!;
  let i = 0;
  while ((await toScreen(page, i * W, 0)).x < box.x) i++;
  const p = await below(page, i);
  await page.mouse.move(p.x, p.y);
  await expect.poll(() => lit(page)).toEqual([i]);
  const tl = await toScreen(page, i * W, 0);
  const br = await toScreen(page, (i + 1) * W, H);
  const [top, bottom] = await glows(page, i).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON() as DOMRect));
  for (const r of [top!, bottom!]) {
    expect(Math.abs(r.left - tl.x)).toBeLessThan(1.5);
    expect(Math.abs(r.right - br.x)).toBeLessThan(1.5);
  }
  expect(Math.abs(top!.bottom - tl.y)).toBeLessThan(1.5);
  expect(Math.abs(bottom!.top - br.y)).toBeLessThan(1.5);
});

test('Struktur: der Schatten liegt ausserhalb der Konva-Stage, nie in der exportierten Ebene «content»', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  expect(await page.locator('.konvajs-content .slide-glow').count()).toBe(0);
  expect(await page.evaluate(() => window.__bbzbTest.contentNames().some((n) => n.includes('glow')))).toBe(false);
});

/** React-Commits zählen: ein minimaler DevTools-Hook, den react-dom beim Laden findet (auch im Produktions-Build). */
const countCommits = () => {
  const w = window as unknown as { __commits: number; __REACT_DEVTOOLS_GLOBAL_HOOK__: object };
  w.__commits = 0;
  w.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    renderers: new Map(),
    inject: () => 1,
    checkDCE: () => {},
    onScheduleFiberRoot: () => {},
    onCommitFiberRoot: () => void w.__commits++,
    onCommitFiberUnmount: () => {},
    onPostCommitFiberRoot: () => {},
  };
};

test('200 Mausbewegungen über, unter und auf den Slides: kein React-Commit, kein Store-Schreiben', async ({ page }) => {
  await page.addInitScript(countCommits);
  await newProject(page, 'Post 4:5', 'Carousel');
  await frames(page);
  const commits = () => page.evaluate(() => (window as unknown as { __commits: number }).__commits);
  expect(await commits(), 'Hook zählt').toBeGreaterThan(0);
  const a = await below(page, 1);
  const top = await toScreen(page, 0, 0);
  await page.mouse.move(a.x, a.y);
  await expect.poll(() => lit(page)).toEqual([1]);
  const before = await commits();
  await page.evaluate(() => {
    const w = window as unknown as { refs: unknown[] };
    w.refs = [window.__bbzbTest.project(), window.__bbzbTest.ui()];
  });
  for (let i = 0; i < 200; i++) {
    const t = i / 199;
    // quer durch drei Spalten, unter, auf und über den Slides
    const y = i % 40 < 20 ? a.y : i % 40 < 30 ? top.y + 50 : top.y - 8;
    await page.mouse.move(a.x - 300 + 600 * t, y);
  }
  await frames(page);
  expect(await commits(), 'React-Commits während der Bewegungen').toBe(before);
  expect(await page.evaluate(() => (window as unknown as { refs: unknown[] }).refs[0] === window.__bbzbTest.project())).toBe(true);
  const ui = await page.evaluate(() => window.__bbzbTest.ui());
  expect(ui).toEqual(await page.evaluate(() => (window as unknown as { refs: unknown[] }).refs[1]));
});

test('Meldung und Tooltip blenden den Schatten nicht aus, Effekt-Menü und Kontextmenü schon', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const p = await below(page, 0);
  const hover = async (dy: number) => {
    await page.mouse.move(p.x, p.y + dy);
    await frames(page);
  };
  // Info-Meldung: eine Datei, die der Editor nicht kennt
  const dataTransfer = await page.evaluateHandle(() => {
    const dt = new DataTransfer();
    dt.items.add(new File(['x'], 'notiz.txt', { type: 'text/plain' }));
    return dt;
  });
  await page.locator('.canvas-scroll').dispatchEvent('drop', { dataTransfer, clientX: p.x, clientY: p.y - 100 });
  await expect(page.getByText('Diese Datei kann ich nicht verwenden', { exact: false })).toBeVisible();
  await hover(0);
  await expect.poll(() => lit(page)).toEqual([0]);
  // offener Tooltip (z. B. vom Tastaturfokus)
  await page.locator('.tooltip').evaluate((e: HTMLElement) => e.showPopover());
  await hover(2);
  await expect.poll(() => lit(page)).toEqual([0]);
  await page.locator('.tooltip').evaluate((e: HTMLElement) => e.hidePopover());
  // Effekt-Menü offen: der Klick schliesst erst das Menü
  await page.mouse.move(5, 300);
  await page.getByRole('button', { name: 'Effekt hinzufügen', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: /^Korn/ })).toBeVisible();
  await hover(0);
  await page.waitForTimeout(300);
  expect(await dark(page)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menuitem', { name: /^Korn/ })).toBeHidden();
  // Kontextmenü offen
  await page.mouse.click(p.x, p.y, { button: 'right' });
  await expect(page.getByRole('menu', { name: 'Kontextmenü' })).toBeVisible();
  await hover(3);
  await page.waitForTimeout(300);
  expect(await dark(page)).toBe(true);
});

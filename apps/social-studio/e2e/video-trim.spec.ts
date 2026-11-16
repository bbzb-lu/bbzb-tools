import { expect, test, type Page } from '@playwright/test';
import { addEffect, addSlide, elements, newProject } from './fixtures';
import { addVideo, probe, settled } from './video';

type Vid = { start: number; end: number; sound: boolean; duration: number };
const vid = async (page: Page) => ((await elements(page))[0]!.props as { video: Vid }).video;
const stats = (page: Page) => page.evaluate(() => window.__bbzbTest.preview());

/** Mittelfarbe eines Vorschaubilds im Inspector (0 = erstes, 1 = letztes). */
const thumb = (page: Page, i: number) =>
  page.evaluate((i) => {
    const c = document.querySelectorAll<HTMLCanvasElement>('.video-thumb')[i]!;
    const d = c.getContext('2d')!.getImageData(c.width / 2, c.height / 2, 1, 1).data;
    return { r: d[0]!, b: d[2]! };
  }, i);
const red = (c: { r: number; b: number }) => c.r > c.b + 60;
const blue = (c: { r: number; b: number }) => c.b > c.r + 60;

/** Bildschirmpunkt des Griffs `name` im Bereichsregler beim Wert `v` (Griffmitte läuft von w/2 bis Bahnbreite − w/2, w = Griffbreite). */
async function at(page: Page, name: string, v: number) {
  const handle = page.getByRole('slider', { name, exact: true });
  const track = (await page.locator('.range-track').boundingBox())!;
  const w = (await handle.boundingBox())!.width;
  const max = Number(await page.getByRole('slider', { name: 'Ende', exact: true }).getAttribute('aria-valuemax'));
  return { x: track.x + w / 2 + ((track.width - w) * v) / max, y: track.y + track.height / 2 };
}

/** Regler ziehen in 20 Schritten; `during` läuft bei gedrückter Maus am Ziel. */
async function drag(page: Page, name: string, from: number, to: number, during?: () => Promise<void>) {
  const a = await at(page, name, from);
  const b = await at(page, name, to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= 20; i++) await page.mouse.move(a.x + ((b.x - a.x) * i) / 20, a.y);
  await during?.();
  await page.mouse.up();
}

test('Start und Ende ziehen: Vorschaubilder folgen live, Store und Leinwand erst beim Loslassen, ein Undo-Schritt je Geste', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const id = await addVideo(page);
  const v0 = await vid(page);
  expect(v0).toMatchObject({ start: 0, sound: false });
  await expect.poll(async () => red(await thumb(page, 0))).toBe(true);
  await expect.poll(async () => blue(await thumb(page, 1))).toBe(true);

  await drag(page, 'Start', 0, 3, async () => {
    // während des Ziehens: Vorschaubild schon blau, Store und Leinwand noch beim alten Start
    await expect.poll(async () => blue(await thumb(page, 0))).toBe(true);
    expect((await vid(page)).start).toBe(0);
    expect(red((await probe(page, id))!)).toBe(true);
  });
  await expect.poll(async () => (await vid(page)).start).toBeCloseTo(v0.end - 1, 1); // Mindestlänge 1 s
  await settled(page);
  await expect.poll(async () => blue((await probe(page, id))!)).toBe(true);

  await page.getByRole('button', { name: 'Rückgängig' }).click();
  expect((await vid(page)).start).toBe(0);
  await expect.poll(async () => red(await thumb(page, 0))).toBe(true);

  await drag(page, 'Ende', v0.end, 1.5);
  await expect.poll(async () => (await vid(page)).end).toBeCloseTo(1.5, 1);
  await expect.poll(async () => red(await thumb(page, 1))).toBe(true);
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  expect((await vid(page)).end).toBe(v0.end);
});

test('Ton-Schalter setzt sound, Tastatur und Beschriftungen', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addVideo(page);
  const ton = page.getByLabel('Eigenschaften').getByRole('button', { name: 'Ton', exact: true });
  await expect(ton).toHaveAttribute('aria-pressed', 'false');
  await ton.click();
  await expect(ton).toHaveAttribute('aria-pressed', 'true');
  expect((await vid(page)).sound).toBe(true);
  // per Tastatur fokussiert löst die Leertaste aus (nach einem Mausklick schwenkt sie die Ansicht)
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(ton).toBeFocused();
  await page.keyboard.press('Space');
  await expect.poll(async () => (await vid(page)).sound).toBe(false);

  await expect(page.getByRole('img', { name: 'Erstes Bild bei 0.0 Sekunden' })).toBeVisible();
  await expect(page.getByRole('img', { name: /^Letztes Bild bei \d\.\d Sekunden$/ })).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: 'Start' })).toHaveValue('0.0'); // Zehntel immer sichtbar
  const start = page.getByRole('slider', { name: 'Start', exact: true });
  await expect(start).toHaveAttribute('aria-valuetext', '0.0 Sekunden');
  // Pfeiltaste: ein Schritt 0.1 s, beim Loslassen geschrieben
  await start.focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await vid(page)).start).toBeCloseTo(0.5, 5);
  // Zahlenfeld mit Zehnteln
  const field = page.getByRole('spinbutton', { name: 'Ende' });
  await field.fill('2.5');
  await field.press('Enter');
  await expect.poll(async () => (await vid(page)).end).toBe(2.5);
  // Tab erreicht die Vorschau, Enter startet und stoppt sie
  const play = page.getByLabel('Eigenschaften').getByRole('button', { name: 'Vorschau', exact: true });
  await ton.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(play).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Eigenschaften').getByRole('button', { name: 'Stopp', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(play).toBeVisible();
  await expect.poll(async () => (await stats(page)).open).toBe(0);
});

/** Wartet, bis die Vorschau Bilder zeichnet; danach darf sich nach dem Stopp nichts mehr ändern. */
async function running(page: Page) {
  const f0 = (await stats(page)).frames;
  await expect.poll(async () => (await stats(page)).frames).toBeGreaterThan(f0 + 5);
}
async function stopped(page: Page) {
  await expect.poll(async () => (await stats(page)).open).toBe(0);
  const f = (await stats(page)).frames;
  await page.waitForTimeout(400);
  expect((await stats(page)).frames).toBe(f);
}

test('Vorschau: Schleife wechselt die Farbe, Undo/Redo unberührt; Stopp, Auswahl- und Slidewechsel beenden sie', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const id = await addVideo(page);
  await page.getByLabel('Eigenschaften').getByRole('button', { name: 'Ton', exact: true }).click(); // ein Undo-Schritt vor dem Abspielen
  const before = await page.evaluate(() => JSON.stringify(window.__bbzbTest.project().elements));
  await page.getByLabel('Eigenschaften').getByRole('button', { name: 'Vorschau', exact: true }).click();
  await running(page);
  // Schleife über 0 bis 4 s: Rot, Blau und wieder Rot
  const seen: string[] = [];
  await expect
    .poll(async () => {
      const p = await probe(page, id);
      const c = p && red(p) ? 'r' : p && blue(p) ? 'b' : '';
      if (c && seen.at(-1) !== c) seen.push(c);
      return seen.join('');
    }, { timeout: 12_000, intervals: [100] })
    .toMatch(/rbr|brb/);
  expect(await page.evaluate(() => JSON.stringify(window.__bbzbTest.project().elements))).toBe(before);
  // Undo/Redo während der Vorschau: betrifft nur den Ton-Schritt, die Vorschau läuft weiter
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  expect((await vid(page)).sound).toBe(false);
  await running(page);
  await page.getByRole('button', { name: 'Wiederholen' }).click();
  expect((await vid(page)).sound).toBe(true);
  await page.getByLabel('Eigenschaften').getByRole('button', { name: 'Stopp', exact: true }).click();
  await stopped(page);

  // Auswahlwechsel
  await page.getByLabel('Eigenschaften').getByRole('button', { name: 'Vorschau', exact: true }).click();
  await running(page);
  await page.evaluate(() => window.__bbzbTest.selectIds([]));
  await stopped(page);

  // Slidewechsel
  await addSlide(page);
  await page.getByRole('button', { name: /^Slide 1(,|$)/ }).click();
  await page.evaluate((id) => window.__bbzbTest.select(id), id);
  await page.getByLabel('Eigenschaften').getByRole('button', { name: 'Vorschau', exact: true }).click();
  await running(page);
  await page.getByRole('button', { name: 'Slide 2', exact: true }).click();
  await stopped(page);
  // Vorschau-Knoten ist weg, die Leinwand zeigt wieder das Startbild
  await expect.poll(async () => red((await probe(page, id))!)).toBe(true);
});

test('Element löschen beendet die Vorschau', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addVideo(page);
  await page.getByLabel('Eigenschaften').getByRole('button', { name: 'Vorschau', exact: true }).click();
  await running(page);
  await page.keyboard.press('Delete');
  await expect.poll(() => elements(page)).toHaveLength(0);
  await stopped(page);
});

test('4× CPU-Drosselung: Ziehen am Start-Regler bleibt flüssig, kein Store-Schreiben je Bewegung', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addVideo(page);
  await addEffect(page, 'Korn'); // Effekt-Canvas wie im Alltag
  await settled(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.evaluate(() => {
    const w = window as unknown as { frames_: number[]; lag_: number[]; stop_: boolean };
    Object.assign(w, { frames_: [], lag_: [], stop_: false });
    const tick = (t: number) => {
      w.frames_.push(t);
      if (!w.stop_) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    // Wartezeit jeder Mausbewegung, bis der Hauptthread sie annimmt
    window.addEventListener('pointermove', (e) => w.lag_.push(performance.now() - e.timeStamp), { capture: true });
  });
  const a = await at(page, 'Start', 0);
  const b = await at(page, 'Start', 3);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  const s0 = (await vid(page)).start;
  for (let i = 1; i <= 60; i++) await page.mouse.move(a.x + ((b.x - a.x) * i) / 60, a.y);
  expect((await vid(page)).start).toBe(s0); // noch kein Store-Schreiben
  const { frames_, lag_ } = await page.evaluate(() => {
    const w = window as unknown as { frames_: number[]; lag_: number[]; stop_: boolean };
    w.stop_ = true;
    return { frames_: w.frames_, lag_: w.lag_ };
  });
  await page.mouse.up();
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const q = (xs: number[]) => {
    const s = [...xs].sort((x, y) => x - y);
    return { median: s[Math.floor(s.length / 2)]!, p95: s[Math.floor(s.length * 0.95)]!, max: s.at(-1)! };
  };
  const d = q(frames_.slice(1).map((v, i) => v - frames_[i]!));
  const lag = q(lag_);
  console.log(`4× Drosselung, Start-Regler ziehen: Bildabstand Median ${d.median.toFixed(1)} ms, p95 ${d.p95.toFixed(1)} ms, max ${d.max.toFixed(1)} ms; Eingabe-Wartezeit Median ${lag.median.toFixed(1)} ms, p95 ${lag.p95.toFixed(1)} ms, max ${lag.max.toFixed(1)} ms`);
  expect(blue(await thumb(page, 0))).toBe(true);
  expect(d.p95).toBeLessThan(50);
  expect(lag.p95).toBeLessThan(50);
  await expect.poll(async () => (await vid(page)).start).toBeGreaterThan(2.5);
});

test('Effekt scheitert in der Vorschau: Vorschau stoppt mit Meldung; ausgeblendetes Element stoppt sie ebenfalls', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  const id = await addVideo(page);
  await page.getByLabel('Eigenschaften').getByRole('button', { name: 'Vorschau', exact: true }).click();
  await running(page);
  // Look liest das Bild zurück: Rücklesen scheitert (z. B. Speicherdruck)
  await page.evaluate(() => {
    const w = window as unknown as { __gid?: typeof CanvasRenderingContext2D.prototype.getImageData };
    w.__gid = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = () => {
      throw new Error('Rücklesen gescheitert');
    };
  });
  await stopped(page);
  await page.evaluate(() => {
    CanvasRenderingContext2D.prototype.getImageData = (window as unknown as { __gid: typeof CanvasRenderingContext2D.prototype.getImageData }).__gid;
  });
  await expect(page.getByLabel('Eigenschaften').getByRole('button', { name: 'Vorschau', exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Ein Effekt');

  await page.getByLabel('Eigenschaften').getByRole('button', { name: 'Vorschau', exact: true }).click();
  await running(page);
  await page.evaluate((id) => window.__bbzbTest.patch(id, { visible: false }), id);
  await stopped(page);
});

import { expect, test, type Page } from '@playwright/test';
import { addEffect, newProject } from './fixtures';
import { addVideo } from './video';

/**
 * Rollende Zahl, Bild für Bild: ein Abtaster liest in jedem Bild den Stand, der gleich gemalt wird (ResizeObserver, nach allen rAF-Rückrufen und
 * dem Layout, vor dem Malen). In keinem gemalten Bild dürfen zwei Zahlen stehen, und die rollende Kopie zeigt immer den aktuellen Wert.
 */
type Frame = { value: string; ink: boolean; ghost: boolean; text: string; opacity: number; dy: number; rolling: boolean };
const panel = (page: Page) => page.getByLabel('Eigenschaften');

async function startSampler(page: Page, wrap: string) {
  await page.evaluate((sel) => {
    const w = window as unknown as { __frames: Frame[]; __stop: () => void };
    w.__frames = [];
    const dummy = document.body.appendChild(document.createElement('div'));
    dummy.style.cssText = 'position:fixed;left:0;top:0;height:1px;width:1px;pointer-events:none';
    const sample = () => {
      const host = document.querySelector<HTMLElement>(sel)!;
      const input = host.querySelector('input')!;
      const g = host.querySelector<HTMLElement>('.roll-ghost')!;
      const gc = getComputedStyle(g);
      w.__frames.push({
        value: input.value, ink: getComputedStyle(input).color !== 'rgba(0, 0, 0, 0)', ghost: gc.display !== 'none', text: g.textContent ?? '',
        opacity: parseFloat(gc.opacity), dy: new DOMMatrix(gc.transform).m42, rolling: host.classList.contains('rolling'),
      });
    };
    const ro = new ResizeObserver(sample);
    ro.observe(dummy);
    let on = true;
    let n = 1;
    // erster rAF-Rückruf jedes Bildes ändert die Grösse: der ResizeObserver meldet sich nach allen rAF-Rückrufen, vor dem Malen
    const tick = () => {
      if (!on) return;
      dummy.style.width = `${(n = 3 - n)}px`;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    w.__stop = () => ((on = false), ro.disconnect(), dummy.remove());
  }, wrap);
}
const stopSampler = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __frames: Frame[]; __stop: () => void };
    w.__stop();
    return w.__frames;
  });

/** Kein gemaltes Bild mit zwei Zahlen; die Kopie zeigt immer den Wert im Feld; ein neuer Wert erscheint nie zuerst ruhig und springt dann nach unten. */
function check(frames: Frame[]) {
  expect(frames.length).toBeGreaterThan(10);
  let changes = 0;
  frames.forEach((f, i) => {
    const where = `Bild ${i}: ${JSON.stringify(f)}`;
    expect(f.ink && f.ghost && f.text !== '', where).toBe(false);
    if (f.ghost) expect(f.text, where).toBe(f.value);
    expect(f.rolling, where).toBe(f.ghost);
    const prev = frames[i - 1];
    if (prev && prev.value !== f.value) {
      changes++;
      expect(f.ghost, `neuer Wert ohne Rollen, ${where}`).toBe(true);
    }
  });
  expect(changes).toBeGreaterThan(0);
  const last = frames.at(-1)!;
  expect([last.ink, last.ghost, last.text]).toEqual([true, false, '']);
}

async function settle(page: Page) {
  await expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

const OPACITY = '.roll-wrap:has(input[aria-label="Deckkraft"])';

test('Regler Deckkraft: Tastenschritte und Ziehen zeigen in keinem Bild zwei Zahlen', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await page.getByRole('button', { name: 'Text hinzufügen' }).click();
  const slider = panel(page).getByRole('slider', { name: 'Deckkraft' });
  await slider.focus();
  await startSampler(page, OPACITY);
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(150);
  }
  await settle(page);
  check(await stopSampler(page));

  // schwaches Gerät: React-Effekte und Bilder geraten am ehesten so aus dem Takt
  await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const b = (await slider.boundingBox())!;
  await page.mouse.move(b.x + b.width - 6, b.y + b.height / 2);
  await page.mouse.down();
  await startSampler(page, OPACITY);
  const t0 = Date.now();
  for (let i = 0; Date.now() - t0 < 600; i++) {
    await page.mouse.move(b.x + b.width - 6 - ((i % 60) * (b.width - 20)) / 60, b.y + b.height / 2);
    await page.waitForTimeout(10);
  }
  await page.mouse.up();
  await settle(page);
  check(await stopSampler(page));
});

test('Drehregler Korn: die Zahl selbst rollt, es gibt nie eine zweite', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await addEffect(page, 'Korn');
  const knob = panel(page).getByRole('slider', { name: 'Korn Stärke', exact: true });
  await knob.focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowUp');
  await settle(page);
  await expect(knob).toHaveAttribute('aria-valuenow', '44');
  expect(await page.locator('.knob .knob-value').count()).toBe(1);
  expect(await page.locator('.knob .roll-ghost').count()).toBe(0);
  await expect(page.locator('.knob-value')).toHaveText('44');
});

test.describe('Video', () => {
  test('Zeitfelder Start: Pfeiltasten am Bereichsregler zeigen in keinem Bild zwei Zahlen', async ({ page }) => {
    await newProject(page, 'Post 4:5');
    await addVideo(page);
    const start = panel(page).getByRole('slider', { name: 'Start' });
    await start.focus();
    await startSampler(page, '.roll-wrap:has(input[aria-label="Start"])');
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(150);
    }
    await settle(page);
    check(await stopSampler(page));
  });
});

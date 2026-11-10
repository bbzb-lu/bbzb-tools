import { createHash } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { bbzbsocial, gradientPng, openLayers, view, openAllSections } from './fixtures';

// Phase 4c: es gibt keinen Erweiterten Modus mehr. Was bisher nur dort stand, ist ohne Moduswechsel erreichbar.
const layers = (page: Page) => page.getByRole('list', { name: 'Ebenen' });
const row = (page: Page, name: string) => layers(page).getByRole('listitem').filter({ has: page.getByRole('button', { name, exact: true }) });
const field = (page: Page, name: string) => page.getByRole('spinbutton', { name });
const ADJUST = { brightness: 20, contrast: -10, saturation: 30, warmth: -40 };

/** Ein Foto mit Bildreglern und halber Deckkraft, ein gesperrter und ein ausgeblendeter Text. */
function project(): Buffer {
  const asset = gradientPng(400, 300);
  const id = createHash('sha256').update(asset).digest('hex');
  const text = (tid: string, name: string, y: number, extra: object) => ({
    id: tid, type: 'text', name, x: 72, y, width: 936, height: 200, rotation: 0, opacity: 1, visible: true, locked: false,
    props: { text: name, style: 'kommentar', color: 'warmweiss', fontSize: 80, align: 'left' }, ...extra,
  });
  return bbzbsocial(
    {
      schemaVersion: 1, id: 'ohne-modus', name: 'Ohne Modus', createdAt: 0, updatedAt: 0,
      format: { id: 'post', width: 1080, height: 1350 },
      slides: [{ id: 's1', background: 'blau' }],
      elements: {
        e0: {
          id: 'e0', type: 'photo', name: 'Foto', x: 0, y: 0, width: 1080, height: 800, rotation: 0, opacity: 0.5, visible: true, locked: false,
          props: { assetId: id, crop: { x: 0, y: 0, scale: 1 }, grain: false, look: false, adjust: ADJUST },
        },
        t1: text('t1', 'Gesperrt', 900, { locked: true }),
        t2: text('t2', 'Versteckt', 1100, { visible: false }),
      },
      order: ['e0', 't1', 't2'],
      assets: { [id]: { mime: 'image/png', width: 400, height: 300, name: 'foto.png' } },
    },
    { [id]: asset },
  );
}

test('Projekt mit gesperrtem, ausgeblendetem und halb transparentem Element öffnet ohne Modus, Werte bleiben', async ({ page }) => {
  await page.goto('');
  await page.locator('input[type=file]').setInputFiles({ name: 'x.bbzbsocial', mimeType: 'application/zip', buffer: project() });
  await page.getByRole('button', { name: '«Ohne Modus» öffnen', exact: true }).click();
  await view(page);
  await expect(page.getByRole('switch', { name: /Erweitert/ })).toHaveCount(0);

  // Ebenen-Panel ohne Moduswechsel: Schloss und Auge zeigen den Zustand aus der Datei
  await openLayers(page);
  await expect(layers(page)).toBeVisible();
  await expect(row(page, 'Gesperrt').getByRole('button', { name: 'Entsperren' })).toHaveAttribute('aria-pressed', 'true');
  await expect(row(page, 'Versteckt').getByRole('button', { name: 'Einblenden' })).toHaveAttribute('aria-pressed', 'true');
  await expect(row(page, 'Foto').getByRole('button', { name: 'Sperren' })).toHaveAttribute('aria-pressed', 'false');

  // Inspector: Deckkraft und Bildregler mit den Werten aus der Datei
  await row(page, 'Foto').getByRole('button', { name: 'Foto', exact: true }).click();
  await openAllSections(page); // Bildregler liegen unter «Bild» › «Erweitert»
  await expect(field(page, 'Deckkraft')).toHaveValue('50');
  await expect(field(page, 'Helligkeit')).toHaveValue('20');
  await expect(field(page, 'Kontrast')).toHaveValue('-10');
  await expect(field(page, 'Sättigung')).toHaveValue('30');
  await expect(field(page, 'Wärme')).toHaveValue('-40');

  // Sperren über das Ebenen-Panel, ein Undo-Schritt
  await row(page, 'Foto').getByRole('button', { name: 'Sperren' }).click();
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.project().elements.e0!.locked)).toBe(true);
  await page.keyboard.press('Control+z');
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.project().elements.e0!.locked)).toBe(false);
  const p = await page.evaluate(() => window.__bbzbTest.project());
  expect(p.elements.e0).toMatchObject({ opacity: 0.5, props: { adjust: ADJUST } });
  expect(p.elements.t1!.locked).toBe(true);
  expect(p.elements.t2!.visible).toBe(false);
  if (process.env.SHOTS)
    for (const [width, height] of [[1280, 720], [1536, 864]] as const) {
      await page.setViewportSize({ width, height });
      await page.screenshot({ path: `${process.env.SHOTS}/task-5-${width}-foto-ebenen.png` });
    }
});

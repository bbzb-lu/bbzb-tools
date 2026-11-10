import { expect, test, type Page } from '@playwright/test';
import { newProject } from './fixtures';

// Die UI-Schriften (woff2 aus @bbzb/ui, die Export-Schriften sind ttf/otf) sind nur Zierde: fehlen sie, bleibt der Editor bedienbar und der Export frei.
async function expectEditorUsable(page: Page): Promise<void> {
  await newProject(page, 'Post 4:5');
  await expect(page.getByText(/Schrift.*fehl/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Exportieren' }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'ZIP herunterladen' })).toBeEnabled();
}

test('UI-Schriften brechen ab: Editor erscheint, Export bleibt frei', async ({ page }) => {
  let aborted = 0;
  await page.route('**/*.woff2', (r) => {
    aborted++;
    return r.abort();
  });
  await expectEditorUsable(page);
  expect(aborted).toBeGreaterThan(0);
});

test('UI-Schriften hängen: Editor erscheint trotzdem nach kurzer Wartezeit', async ({ page }) => {
  await page.route('**/*.woff2', () => new Promise<void>(() => {})); // nie beantwortet
  await page.goto('', { waitUntil: 'commit' }); // «load» wartet auf die hängende Schrift
  await expect(page.getByRole('button', { name: 'Post 4:5' })).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: 'Post 4:5' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByText(/Schrift.*fehl/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Exportieren' }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'ZIP herunterladen' })).toBeEnabled();
});

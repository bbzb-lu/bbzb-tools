import { expect, test } from '@playwright/test';
import { elements, newProject } from './fixtures';

// Die Wortmarke führt aus dem Studio auf die Startseite der Suite: eine Änderung kurz davor darf nicht verloren gehen.
test('Wortmarke direkt nach einer Änderung: Name und neues Element sind beim Wiederöffnen da', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await page.getByLabel('Projektname').fill('Weg über die Wortmarke');
  await page.getByLabel('Projektname').press('Enter');
  await page.getByRole('button', { name: 'Text hinzufügen' }).click();
  // sofort weg, ohne die Pause des Autosave (500 ms) abzuwarten
  await page.getByRole('link', { name: 'BBZB Tools, Social Studio, zur Startseite' }).click();
  await expect(page).toHaveURL(/:8788\/$/);
  await page.goto('');
  await page.getByRole('button', { name: '«Weg über die Wortmarke» öffnen', exact: true }).click();
  await expect(page.getByLabel('Projektname')).toHaveValue('Weg über die Wortmarke');
  expect((await elements(page)).map((e) => e.type)).toEqual(['text']);
});

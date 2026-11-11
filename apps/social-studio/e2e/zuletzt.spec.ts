import { expect, test } from '@playwright/test';
import { newProject } from './fixtures';

test('Startseite «Zuletzt bearbeitet»: gespeichertes Projekt erscheint und öffnet direkt im Studio', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await page.getByLabel('Projektname').fill('Infotag Herbst');
  await page.getByLabel('Projektname').press('Enter');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('bbzb-tools.zuletzt'))).toContain('Infotag Herbst');
  await page.goto('/');
  const eintrag = page.getByRole('region', { name: 'Zuletzt bearbeitet' }).getByRole('link', { name: /Infotag Herbst/ });
  await expect(eintrag).toContainText('Social Studio');
  await eintrag.click();
  await expect(page.getByLabel('Projektname')).toHaveValue('Infotag Herbst');
  await expect(page).toHaveURL(/\/social-studio\/$/); // Parameter ist weg, Neuladen öffnet die Übersicht
});

test('Link auf ein gelöschtes Projekt: Hinweis, Übersicht, Eintrag verschwindet', async ({ page }) => {
  await page.goto('');
  await page.evaluate(() => localStorage.setItem('bbzb-tools.zuletzt', JSON.stringify([{ tool: 'social-studio', id: 'weg', name: 'Alt', geaendert: 1 }])));
  await page.goto('?projekt=weg');
  await expect(page.getByText('Dieses Projekt gibt es nicht mehr.')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('bbzb-tools.zuletzt'))).toBe('[]');
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Zuletzt bearbeitet' })).toHaveCount(0);
});

test('Projekt löschen entfernt es aus «Zuletzt»', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await page.getByLabel('Projektname').fill('Weg damit');
  await page.getByLabel('Projektname').press('Enter');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('bbzb-tools.zuletzt'))).toContain('Weg damit');
  await page.getByRole('button', { name: 'Übersicht' }).click();
  await page.getByRole('button', { name: '«Weg damit» löschen', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Löschen', exact: true }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('bbzb-tools.zuletzt'))).toBe('[]');
});

test('Feedback im Kopf öffnet das Formular mit «Social Studio» in neuem Tab', async ({ page }) => {
  await page.goto('');
  const link = page.getByRole('link', { name: /Feedback geben/ });
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('href', /^https:\/\/forms\.cloud\.microsoft\/.*=%22Social%20Studio%22$/);
});

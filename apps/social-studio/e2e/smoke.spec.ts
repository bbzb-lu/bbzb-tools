import { expect, test } from '@playwright/test';

test('App lädt mit CSP und ohne Konsolenfehler', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const res = await page.goto('');
  // Genau 'self' und die Hosts des KI-Modells (Phase 4b): jeder weitere Host muss eine bewusste Änderung sein.
  const csp = res!.headers()['content-security-policy']!.split(';').map((d) => d.trim());
  expect(csp.filter((d) => d.startsWith('connect-src'))).toEqual(["connect-src 'self' https://huggingface.co https://*.hf.co"]);
  await expect(page.getByRole('heading', { level: 1, name: 'Social Studio' })).toBeVisible();
  expect(errors).toEqual([]);
});

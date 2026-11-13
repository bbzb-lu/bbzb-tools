import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';
import { tools } from './apps/startseite/src/tools';

const port = process.env.PW_PORT ?? '8788';
const base = `http://localhost:${port}/`;

export default defineConfig({
  // Testvideos des Studios einmal vor dem Lauf erzeugen (vorhandene bleiben)
  globalSetup: './scripts/test-videos.ts',
  // CI: Spur und Bild bei Fehlern, landen im Bericht (Artefakt)
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  // Windows-Runner ist langsam: ein zweiter Versuch, Wackler stehen im Bericht als «flaky»
  retries: process.env.CI ? 1 : 0,
  webServer: {
    timeout: 180_000,
    command: 'node scripts/build.mjs --mode test && npx wrangler pages dev dist --port ' + port,
    url: base,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'suite', testDir: 'e2e', use: { baseURL: base, channel: 'msedge' } },
    // nur Tools mit eigenem e2e-Ordner, damit die Konfiguration auch vor dem Umzug läuft
    ...tools
      .filter((t) => existsSync(`apps/${t.id}/e2e`))
      .map((t) => ({ name: t.id, testDir: `apps/${t.id}/e2e`, use: { baseURL: `${base}${t.id}/`, channel: 'msedge' } })),
  ],
});

import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';
import { tools } from './apps/startseite/src/tools';

const base = 'http://localhost:8788/';

export default defineConfig({
  webServer: {
    timeout: 180_000,
    command: 'npm run build && npx wrangler pages dev dist --port 8788',
    url: 'http://localhost:8788',
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

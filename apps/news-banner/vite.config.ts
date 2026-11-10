import { dirname } from 'node:path';
import { createRequire } from 'node:module';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// npm-Workspaces legen Pakete in den Hauptordner, darum den Ordner der Tabler-Icons auflösen statt '/node_modules/…' anzunehmen.
const tablerOutline = dirname(createRequire(import.meta.url).resolve('@tabler/icons/outline/brand-teams.svg'));

export default defineConfig({
  base: '/news-banner/',
  plugins: [react()],
  resolve: { alias: { '@tabler-outline': tablerOutline } },
  build: {
    outDir: '../../dist/news-banner',
    emptyOutDir: false, // das Leeren macht scripts/build.mjs
  },
  test: { exclude: ['e2e/**', 'node_modules/**', '.superpowers/**'] },
});

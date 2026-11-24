import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/mensa-bahnhof/',
  plugins: [react()],
  build: {
    outDir: '../../dist/mensa-bahnhof',
    emptyOutDir: false, // das Leeren macht scripts/build.mjs
  },
  test: { exclude: ['e2e/**', 'node_modules/**'] },
});

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/news-banner/',
  plugins: [react()],
  build: {
    outDir: '../../dist/news-banner',
    emptyOutDir: false, // das Leeren macht scripts/build.mjs
  },
  test: { exclude: ['e2e/**', 'node_modules/**', '.superpowers/**'] },
});

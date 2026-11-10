import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/',
  plugins: [react()],
  build: {
    outDir: '../../dist',
    emptyOutDir: false, // das Leeren macht scripts/build.mjs
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        datenschutz: resolve(import.meta.dirname, 'datenschutz/index.html'),
      },
    },
  },
  test: { exclude: ['e2e/**', 'node_modules/**'] },
});

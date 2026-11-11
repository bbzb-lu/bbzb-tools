import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/sharepoint/',
  plugins: [react()],
  build: {
    outDir: '../../dist/sharepoint',
    emptyOutDir: false, // das Leeren macht scripts/build.mjs
  },
  test: { exclude: ['e2e/**', 'node_modules/**'] },
});

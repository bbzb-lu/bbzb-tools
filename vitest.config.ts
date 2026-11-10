import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['apps/*', 'packages/*'],
    exclude: ['**/e2e/**', '**/node_modules/**'],
  },
});

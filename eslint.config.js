import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', '**/dist', 'coverage', 'playwright-report', 'test-results', '.superpowers', '.wrangler', 'embeds'] }, // Embeds: altes Vanilla-JS ohne Build, geprüft per Playwright (embeds/AGENTS.md)
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
);

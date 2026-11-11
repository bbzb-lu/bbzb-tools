import { describe, expect, it } from 'vitest';
import { pick } from './e2e-projects.mjs';

const ids = ['news-banner', 'sharepoint', 'social-studio'];

describe('pick', () => {
  it('nur ein Tool geändert: Suite und dieses Tool', () => {
    expect(pick(['apps/news-banner/src/App.tsx'], ids)).toEqual(['suite', 'news-banner']);
  });
  it('Gemeinsames geändert: alle', () => {
    for (const f of ['packages/ui/src/Button.tsx', 'apps/startseite/src/Start.tsx', 'playwright.config.ts', 'package-lock.json', 'e2e/suite.spec.ts'])
      expect(pick(['apps/social-studio/src/x.ts', f], ids)).toBeNull();
  });
  it('nur Notizen: nur die Suite', () => {
    expect(pick(['apps/social-studio/AGENTS.md', 'docs/deployment.md'], ids)).toEqual(['suite']);
  });
  it('Vorlage oder Tool ohne e2e: nur die Suite', () => {
    expect(pick(['apps/_vorlage/src/App.tsx'], ids)).toEqual(['suite']);
  });
  it('Embeds geändert: Suite und SharePoint-Übersicht', () => {
    expect(pick(['embeds/sudoku/script.js', 'embeds/_shared/icons/x.png'], ids)).toEqual(['suite', 'sharepoint']);
  });
});

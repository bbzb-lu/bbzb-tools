import { describe, expect, it } from 'vitest';
import { tools } from './tools';

describe('tools', () => {
  it('jedes Tool hat eindeutige ID und Pfad /<id>/', () => {
    expect(new Set(tools.map((t) => t.id)).size).toBe(tools.length);
    for (const t of tools) expect(t.pfad).toBe(`/${t.id}/`);
  });
  it('Satz kurz, ohne Halbgeviertstrich und ohne ß', () => {
    for (const t of tools) {
      expect(t.satz.length).toBeLessThanOrEqual(90);
      expect(t.satz).not.toMatch(/[–ßẞ]/);
    }
  });
  it('News-Banner ist eingetragen und Beta', () => {
    expect(tools.find((t) => t.id === 'news-banner')).toMatchObject({ name: 'News-Banner', beta: true });
  });
  it('Social Studio ist eingetragen und Beta', () => {
    expect(tools.find((t) => t.id === 'social-studio')).toMatchObject({ name: 'Social Studio', beta: true });
  });
});

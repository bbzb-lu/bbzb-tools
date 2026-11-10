import { describe, expect, it, vi } from 'vitest';
import { layouts } from '../../core/registries';
import { project } from '../../model/fixtures';
import { addLayoutSlides, layoutOnSlide } from '../../model/layout';
import type { Element, Project } from '../../model/types';
import { contentRules } from '../../ui/layoutActions';
import { registerPlugins } from '..';

// Ohne Browser messen: feste Breite und Höhe
vi.mock('../elements/tag/measure', async (orig) => ({ ...(await orig<typeof import('../elements/tag/measure')>()), measureLabel: () => 100 }));
vi.mock('../elements/text/measure', async (orig) => ({ ...(await orig<typeof import('../elements/text/measure')>()), measureTextHeight: () => 100 }));

const schulTags = (p: Project): Element[] => p.order.map((id) => p.elements[id]!).filter((e) => (e.props as { variant?: string }).variant === 'schul');

describe('Schul-Tag aus einem Layout (echte Presets und Regeln)', () => {
  it('neue Slide mit «Abschluss»: der Schul-Tag zeigt den zuletzt gewählten Standort', () => {
    registerPlugins();
    const p: Project = { ...project(1), lastTagLocation: 'Heimbach' };
    addLayoutSlides(p, layouts.get('abschluss'), 1, contentRules);
    expect(schulTags(p).map((e) => (e.props as { text: string }).text)).toEqual(['Heimbach']);
  });

  it('neues Layout auf einer Slide mit Tag «Bahnhof»: Bahnhof bleibt, auch wenn zuletzt Dagmersellen gewählt war', () => {
    registerPlugins();
    const p: Project = project(1);
    addLayoutSlides(p, layouts.get('abschluss'), 1, contentRules);
    p.slides.splice(0, 1);
    for (const e of Object.values(p.elements)) e.x -= 1080;
    p.lastTagLocation = 'Dagmersellen';
    layoutOnSlide(p, layouts.get('titel'), 0, contentRules);
    expect(schulTags(p).map((e) => (e.props as { text: string }).text)).toEqual(['Bahnhof']);
    // nochmals dasselbe Layout: der Tag ist jetzt vom Layout «titel» und trotzdem bleibt Bahnhof
    layoutOnSlide(p, layouts.get('titel'), 0, contentRules);
    expect(schulTags(p).map((e) => (e.props as { text: string }).text)).toEqual(['Bahnhof']);
  });
});

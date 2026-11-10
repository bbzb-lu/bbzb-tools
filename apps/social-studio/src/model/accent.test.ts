import { describe, expect, it } from 'vitest';
import { akzent, colors, locationColors, locations, onAccent } from '../tokens';
import { accentFor, resolveColor } from './accent';
import { removeElement } from './elements';
import { el, project } from './fixtures';
import type { Element, Project } from './types';

const W = 1080;
/** Schul-Tag mit dem Standort `text` auf Slide `slide`. */
const schul = (id: string, text: string, slide: number) =>
  el({ id, type: 'tag', x: slide * W + 100, width: 300, height: 62, props: { variant: 'schul', text } });
const at = (slide: number): Pick<Element, 'x' | 'width'> => ({ x: slide * W + 400, width: 200 });
const standort = (p: Project, extra: Partial<Project> = {}): Project => ({ ...p, accentMode: 'standort', ...extra });

describe('accentFor', () => {
  it('Modus fehlt oder fix: Orange, auch mit Schul-Tag', () => {
    const p = project(1, [schul('t', 'Heimbach', 0)]);
    expect(accentFor(p, at(0))).toBe(colors.orange);
    expect(accentFor({ ...p, accentMode: 'fix' }, at(0))).toBe(colors.orange);
  });

  it('standort: Schul-Tag der eigenen Slide, sonst lastTagLocation', () => {
    const p = standort(project(2, [schul('t', 'Heimbach', 0)]), { lastTagLocation: 'Bahnhof' });
    expect(accentFor(p, at(0))).toBe('#4C5EBD');
    expect(accentFor(p, at(1))).toBe('#008C7E');
  });

  it('standort ohne Schul-Tag und ohne lastTagLocation: Orange', () => {
    expect(accentFor(standort(project(2)), at(1))).toBe(colors.orange);
  });

  it('zwei Schul-Tags auf einer Slide: der erste in der Ebenenreihenfolge (unten)', () => {
    const p = standort(project(1, [schul('a', 'Bahnhof', 0), schul('b', 'Heimbach', 0)]));
    expect(accentFor(p, at(0))).toBe(locationColors.Bahnhof.fill);
    p.order.reverse();
    expect(accentFor(p, at(0))).toBe(locationColors.Heimbach.fill);
  });

  it('Panorama: Standort der ersten Slide der Gruppe', () => {
    const p = standort(project(3, [schul('t', 'Dagmersellen', 0), schul('u', 'Heimbach', 2)]));
    p.slides[0]!.link = 'L';
    p.slides[1]!.link = 'L';
    expect(accentFor(p, at(1))).toBe('#D81E3A');
    expect(accentFor(p, at(2))).toBe('#4C5EBD');
    // Schul-Tag nur auf der zweiten Slide der Gruppe: zählt nicht, es gilt lastTagLocation
    const q = standort(project(2, [schul('t', 'Heimbach', 1)]), { lastTagLocation: 'Bahnhof' });
    q.slides[0]!.link = 'L';
    q.slides[1]!.link = 'L';
    expect(accentFor(q, at(0))).toBe(locationColors.Bahnhof.fill);
    expect(accentFor(q, at(1))).toBe(locationColors.Bahnhof.fill);
  });

  it('Schul-Tag mit unbekanntem Standort: Orange (nicht lastTagLocation)', () => {
    const p = standort(project(1, [schul('t', 'Mond', 0)]), { lastTagLocation: 'Bahnhof' });
    expect(accentFor(p, at(0))).toBe(colors.orange);
    expect(accentFor(standort(project(1), { lastTagLocation: 'Mond' }), at(0))).toBe(colors.orange);
  });

  it('Schul-Tag gelöscht: fällt auf lastTagLocation zurück', () => {
    const p = standort(project(1, [schul('t', 'Heimbach', 0)]), { lastTagLocation: 'Weggismatt' });
    removeElement(p, 't');
    expect(accentFor(p, at(0))).toBe('#FF4E00');
  });

  it('Ort-Tag, CTA und ausgeblendeter Schul-Tag bestimmen den Standort nicht', () => {
    const p = standort(
      project(1, [
        el({ id: 'o', type: 'tag', x: 10, props: { variant: 'ort', text: 'Heimbach' } }),
        el({ id: 'c', type: 'tag', x: 10, props: { variant: 'cta', text: 'Heimbach' } }),
        { ...schul('h', 'Heimbach', 0), visible: false },
      ]),
      { lastTagLocation: 'Bahnhof' },
    );
    expect(accentFor(p, at(0))).toBe(locationColors.Bahnhof.fill);
  });

  it('Standort BBZB und BM haben eigene Akzentfarben', () => {
    expect(accentFor(standort(project(1, [schul('t', 'BBZB', 0)])), at(0))).toBe('#009FE2');
    expect(accentFor(standort(project(1, [schul('t', 'BM', 0)])), at(0))).toBe('#D84FC3');
  });

  it('sichtbarer Fachbereich- und freier Tag vor dem Standort-Tag ändern den Akzent nicht', () => {
    const tag = (id: string, variant: string, text: string) => el({ id, type: 'tag', x: 100, width: 300, height: 62, props: { variant, text, color: 'Weggismatt' } });
    const p = standort(project(1, [tag('f', 'fach', 'Bautechnik'), tag('r', 'frei', 'Neu'), schul('s', 'Heimbach', 0)]));
    expect(accentFor(p, at(0))).toBe(locationColors.Heimbach.fill);
  });

  it('Element ausserhalb der Leinwand nimmt die nächste Slide', () => {
    const p = standort(project(2, [schul('t', 'Heimbach', 1)]));
    expect(accentFor(p, { x: 5000, width: 100 })).toBe(locationColors.Heimbach.fill);
  });
});

describe('resolveColor', () => {
  it('Palettenfarbe bleibt, Akzent wird aufgelöst', () => {
    expect(resolveColor('blau', '#8ED8F8')).toBe(colors.blau);
    expect(resolveColor('orange', '#8ED8F8')).toBe(colors.orange);
    expect(resolveColor(akzent, '#8ED8F8')).toBe('#8ED8F8');
  });
});

/** WCAG-2-Kontrast zweier Hexfarben. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x! + 0.05) / (y! + 0.05);
}

describe('onAccent', () => {
  it('BBZB-Blau blauschwarz, Heimbach, Orange und Bahnhof warmweiss (Marke)', () => {
    expect(onAccent('#009FE2')).toBe('blauschwarz');
    expect(onAccent('#4C5EBD')).toBe('warmweiss');
    expect(onAccent('#FF4E00')).toBe('warmweiss');
    expect(onAccent('#008C7E')).toBe('warmweiss');
    expect(onAccent('#D81E3A')).toBe('warmweiss');
    expect(onAccent(colors.blauschwarz)).toBe('warmweiss');
  });

  it('locationColors.text ist die Wahl von onAccent', () => {
    for (const l of locations) expect(locationColors[l].text).toBe(onAccent(locationColors[l].fill));
  });

  it('Schrift auf jeder Standortfarbe erreicht Kontrast für grosse Schrift (3:1), Heimbach und Dagmersellen 4.5:1', () => {
    const c = (l: (typeof locations)[number]) => contrast(locationColors[l].fill, colors[locationColors[l].text]);
    for (const l of locations) expect(c(l)).toBeGreaterThanOrEqual(3);
    expect(c('Heimbach')).toBeGreaterThanOrEqual(4.5);
    expect(c('Dagmersellen')).toBeGreaterThanOrEqual(4.5);
    // Grenze dokumentiert: Warmweiss auf Orange (3.13) und Bahnhof (3.92) bleibt unter 4.5, ist aber die Markenwahl (PSD)
    expect(contrast(colors.orange, colors.warmweiss)).toBeLessThan(4.5);
    // BBZB-Blau mit Warmweiss wäre unlesbar
    expect(contrast(locationColors.BBZB.fill, colors.warmweiss)).toBeLessThan(3);
  });
});

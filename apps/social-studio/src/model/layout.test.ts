import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import type { LayoutPreset } from '../core/types';
import { el, project } from './fixtures';
import { addLayoutSlides, applyLayout, instantiateLayout, layoutOnSlide, slideAfter, type ContentRules } from './layout';
import { H, deko, drei, panorama, rules, titel, voll, type P } from './layout-fixtures';
import { LIMIT_TEXT, MAX_SLIDES, ModelError } from './slides';
import type { Element, Project } from './types';

describe('instantiateLayout', () => {
  it('eine Slide: globale Koordinaten ab Slide-Index, neue Ids, Rolle und Standardfelder', () => {
    const els = instantiateLayout(project(3), titel, 2);
    expect(els).toHaveLength(2);
    expect(els[0]).toMatchObject({ type: 'photo', role: 'foto', name: 'Foto', x: 2160, y: 0, width: 1080, height: 1350, rotation: 0, opacity: 1, visible: true, locked: false });
    expect(els[1]).toMatchObject({ role: 'schulTag', x: 2160 + 685, y: 72 });
    expect(new Set(els.map((e) => e.id)).size).toBe(2);
    expect(els[0]!.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('zwei Slides (Panorama): Foto über der Naht, Elemente der rechten Slide richtig versetzt', () => {
    const els = instantiateLayout(project(3), panorama, 1);
    expect(els[0]).toMatchObject({ x: 1080, width: 2160 });
    expect(els[0]!.x + els[0]!.width / 2).toBe(2160); // Mitte genau auf der Naht zwischen Slide 2 und 3
    expect(els[1]).toMatchObject({ x: 1080 + 1727 });
  });

  it('fit ergänzt pro Typ; anchorRight hält den rechten Rand', () => {
    const els = instantiateLayout(project(1), titel, 0, (e) => (e.type === 'tag' ? { ...e, width: 300 } : { ...e, props: { ...(e.props as object), grain: true } }));
    expect(els[0]!.props).toEqual({ grain: true });
    expect(els[1]).toMatchObject({ x: 685 + 323 - 300, width: 300 });
  });

  it('Layoutdaten bleiben unverändert (tiefe Kopie)', () => {
    const [photo] = instantiateLayout(project(1), titel, 0);
    (photo!.props as Record<string, unknown>).x = 1;
    expect(titel.elements[0]!.props).toEqual({});
  });

  it('zu wenige Slides, falscher Index oder anderes Format: Fehler', () => {
    expect(() => instantiateLayout(project(1), panorama, 0)).toThrow(ModelError);
    expect(() => instantiateLayout(project(2), titel, 2)).toThrow(ModelError);
    expect(() => instantiateLayout(project(2), titel, -1)).toThrow(ModelError);
    expect(() => instantiateLayout(project(1), { ...titel, format: 'story' }, 0)).toThrow(ModelError);
  });
});

const photo = (id: string, o: Partial<Element> = {}) => el({ id, type: 'photo', x: 100, width: 500, height: 400, props: { assetId: H, look: false }, ...o });
const text = (id: string, t: string, o: Partial<Element> = {}) => el({ id, type: 'text', x: 100, props: { text: t, style: 'titel' }, ...o });
const ids = (p: Project) => p.order;

describe('applyLayout (Inhalte wandern in die Platzhalter, Entscheid Task 0)', () => {
  it('leere Slide: Platzhalter, Hintergrund und Layout-Id der Slide', () => {
    const p = project(2, [el({ id: 'nachbar', x: 1200 })]);
    const r = produce(p, (d) => void applyLayout(d, voll, 0, rules));
    expect(r.slides[0]).toMatchObject({ background: 'blau', layout: 'voll' });
    expect(r.slides[1]!.layout).toBeUndefined();
    expect(r.order).toHaveLength(5);
    expect(r.order[0]).toBe('nachbar');
    expect(r.order.slice(1).map((id) => r.elements[id]!.role)).toEqual(['foto', 'titel', 'kommentar', 'schulTag']);
    expect(r.elements[r.order[2]!]!.height).toBe(50); // fit
  });

  it('setzt das Korn der Slides aus dem Layout; ohne Angabe aus', () => {
    const p = produce(project(3), (d) => void Object.assign(d.slides[2]!, { grain: true }));
    const r = produce(p, (d) => void applyLayout(d, { ...panorama, grain: true }, 0, rules));
    expect(r.slides.slice(0, 2).map((s) => s.grain)).toEqual([true, true]);
    expect(r.slides[2]).toMatchObject({ grain: true }); // andere Slide unberührt
    expect(produce(r, (d) => void applyLayout(d, voll, 1, rules)).slides[1]!.grain).toBeUndefined();
  });

  it('Korn-Stärke (4c.1): Layout mit Korn behält die gewählte Stärke, Layout ohne Korn löscht sie mit', () => {
    const p = produce(project(2), (d) => void Object.assign(d.slides[0]!, { grain: true, grainStrength: 70 }));
    expect(produce(p, (d) => void applyLayout(d, { ...voll, grain: true }, 0, rules)).slides[0]).toMatchObject({ grain: true, grainStrength: 70 });
    const off = produce(p, (d) => void applyLayout(d, voll, 0, rules)).slides[0]!;
    expect(off).not.toHaveProperty('grain');
    expect(off).not.toHaveProperty('grainStrength');
  });

  it('Layoutwechsel behält die Verläufe der Slide (Layouts setzen keine, Phase 2.8)', () => {
    const scrims = [{ side: 'unten' as const, strength: 'stark' as const }];
    const p = produce(project(1), (d) => void (d.slides[0]!.scrims = scrims));
    expect(produce(p, (d) => void applyLayout(d, voll, 0, rules)).slides[0]!.scrims).toEqual(scrims);
  });

  it('Foto und Texte ziehen um, Freies bleibt, nichts mit Inhalt geht verloren', () => {
    const p = project(2, [
      photo('bild', { role: 'foto' }),
      el({ id: 'funkeln', type: 'brand', role: 'funkeln' }), // Deko, aber die Slide kennt ihr Layout nicht: bleibt (R8)
      photo('leer', { role: 'sticker', props: {} }), // leerer Platzhalter
      text('k', 'Mein Kommentar', { role: 'kommentar' }),
      text('frei', 'Mein Titel'),
      el({ id: 'scribble', type: 'brand', x: 300 }),
      el({ id: 'nachbar', type: 'text', x: 1200, props: { text: 'Slide 2' } }),
    ]);
    let out: string[] = [];
    const r = produce(p, (d) => void (out = applyLayout(d, voll, 0, rules)));
    expect(r.elements.funkeln).toEqual(p.elements.funkeln);
    expect(r.elements.leer).toBeUndefined();
    expect(r.elements.bild).toMatchObject({ role: 'foto', name: 'Foto', x: 0, y: 0, width: 1080, height: 1350, props: { assetId: H, look: false, crop: 'cover' } });
    expect(r.elements.k).toMatchObject({ role: 'kommentar', x: 72, y: 1050, height: 50, props: { text: 'Mein Kommentar', style: 'kommentar' } });
    expect(r.elements.frei).toMatchObject({ role: 'titel', x: 60, props: { text: 'Mein Titel', style: 'titel' } }); // freier Text füllt den freien Platzhalter
    expect(r.elements.scribble).toEqual(p.elements.scribble);
    expect(r.elements.nachbar).toEqual(p.elements.nachbar);
    // Reihenfolge der Layoutdaten, Freies bleibt darüber
    const tag = out.find((id) => r.elements[id]!.role === 'schulTag')!;
    expect(ids(r)).toEqual(['bild', 'frei', 'k', tag, 'funkeln', 'scribble', 'nachbar']);
    expect(out).toEqual(['bild', 'frei', 'k', tag]);
  });

  it('was keinen Platz findet, bleibt frei liegen, über dem Layout', () => {
    const p = project(1, [text('k1', 'Eins', { role: 'kommentar' }), text('k2', 'Zwei', { role: 'kommentar', y: 700 }), photo('sticker', { role: 'sticker' }), el({ id: 'ort', type: 'tag', role: 'ortTag', props: { variant: 'ort', text: 'Luzern' } })]);
    const r = produce(p, (d) => void applyLayout(d, voll, 0, rules));
    expect(r.elements.k1).toMatchObject({ role: 'kommentar', y: 1050 });
    expect(r.elements.k2).toEqual(p.elements.k2);
    expect(r.elements.sticker).toEqual(p.elements.sticker); // kein Sticker-Platzhalter: bleibt, auch wenn der Foto-Platzhalter frei ist
    expect(r.elements.ort).toEqual(p.elements.ort); // anderer Tag passt nicht in den Schul-Tag
    expect(ids(r).slice(-3)).toEqual(['k2', 'sticker', 'ort']);
  });

  it('gleiche Rollen (duplizierte Platzhalter) nach Reihenfolge, Rest bleibt frei', () => {
    const p = project(1, ['a', 'b', 'c', 'd'].map((id, i) => photo(id, { role: 'foto', y: i * 10 })));
    const r = produce(p, (d) => void applyLayout(d, drei, 0, rules));
    expect(['a', 'b', 'c'].map((id) => r.elements[id]!.y)).toEqual([100, 500, 900]);
    expect(r.elements.d).toEqual(p.elements.d);
    expect(ids(r)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('gesperrte Elemente bleiben unberührt', () => {
    const p = project(1, [photo('fest', { role: 'foto', locked: true }), el({ id: 'deko', type: 'brand', role: 'funkeln', locked: true })]);
    const r = produce(p, (d) => void applyLayout(d, voll, 0, rules));
    expect(r.elements.fest).toEqual(p.elements.fest);
    expect(r.elements.deko).toEqual(p.elements.deko);
  });

  it('Panorama: sieht das Panorama-Foto (Mitte auf der Naht) und den Inhalt beider Slides, nicht die dritte', () => {
    const p = project(3, [photo('pano', { role: 'foto', x: 0, width: 2160 }), text('rechts', 'Rechts', { role: 'kommentar', x: 1500 }), text('drei', 'Drei', { role: 'kommentar', x: 2200 })]);
    const r = produce(p, (d) => void applyLayout(d, panorama, 0, rules));
    expect(r.elements.pano).toMatchObject({ x: 0, width: 2160, props: { crop: 'cover' } });
    expect(r.elements.rechts).toMatchObject({ x: 1727 });
    expect(r.elements.rechts!.props).toEqual({ text: 'Rechts' }); // Stil kommt vom Layout, nur der Text zieht um
    expect(r.elements.drei).toEqual(p.elements.drei);
    expect(r.slides.map((s) => s.layout)).toEqual(['panorama', 'panorama', undefined]);
    // Layout auf die rechte Panorama-Slide: das Panorama-Foto gehört zur linken und bleibt
    const r2 = produce(p, (d) => void applyLayout(d, voll, 1, rules));
    expect(r2.elements.pano).toEqual(p.elements.pano);
    expect(r2.elements.rechts).toMatchObject({ x: 1080 + 72 });
  });

  it('wirft bei fehlenden Slides, ohne etwas zu ändern', () => {
    const p = project(1, [photo('bild', { role: 'foto' })]);
    expect(() => produce(p, (d) => void applyLayout(d, panorama, 0, rules))).toThrow(ModelError);
  });
});

describe('Ruling R8: Unverändertes aus dem bisherigen Layout wird ersetzt, alles andere bleibt', () => {
  /** Slide 0 mit dem Layout «deko», wie frisch eingesetzt. */
  const fresh = () => produce(project(2), (d) => void applyLayout(d, deko, 0, rules));
  const byRole = (p: Project, role: string) => p.order.map((id) => p.elements[id]!).filter((e) => e.role === role);

  it('unveränderte Deko und Beispieltexte fallen weg, nichts stapelt sich', () => {
    const r = produce(fresh(), (d) => void applyLayout(d, drei, 0, rules));
    expect(r.order.map((id) => r.elements[id]!.role)).toEqual(['foto', 'foto', 'foto']);
    // gleiches Layout erneut: gleich viele Elemente
    const again = produce(fresh(), (d) => void applyLayout(d, deko, 0, rules));
    expect(again.order).toHaveLength(deko.elements.length);
  });

  it('geänderter Beispieltext, verschobene oder umgefärbte Deko und Kopien bleiben', () => {
    const p = produce(fresh(), (d) => {
      const [k] = byRole(d, 'kommentar');
      (k!.props as P).text = 'Mein Kommentar';
      const [pfeil] = byRole(d, 'scribble');
      const kopie = { ...JSON.parse(JSON.stringify(pfeil)), id: 'kopie', x: pfeil!.x + 40, y: pfeil!.y + 40 };
      d.elements.kopie = kopie;
      d.order.push('kopie');
      byRole(d, 'funkeln')[0]!.opacity = 0.5;
    });
    const r = produce(p, (d) => void applyLayout(d, drei, 0, rules));
    const kept = r.order.map((id) => r.elements[id]!);
    expect(kept.map((e) => e.role)).toEqual(['funkeln', 'foto', 'foto', 'foto', 'kommentar', 'scribble']); // Layout an der Stelle des ersten ersetzten Elements
    expect(kept.find((e) => e.role === 'kommentar')!.props).toMatchObject({ text: 'Mein Kommentar' });
    expect(r.elements.kopie).toEqual(p.elements.kopie);
    expect(byRole(r, 'titel')).toHaveLength(0); // Beispieltitel unverändert: ersetzt
    // geänderter Kommentar zieht in den Kommentar-Platzhalter, wenn es einen gibt
    const v = produce(p, (d) => void applyLayout(d, voll, 0, rules));
    expect(byRole(v, 'kommentar')).toHaveLength(1);
    expect(byRole(v, 'kommentar')[0]!.props).toMatchObject({ text: 'Mein Kommentar' });
    expect(byRole(v, 'scribble').map((e) => e.id)).toEqual(['kopie']);
  });

  it('ohne Slide.layout (alte Slides) fällt nur der leere Foto-Platzhalter weg', () => {
    const p = produce(fresh(), (d) => void delete d.slides[0]!.layout);
    const r = produce(p, (d) => void applyLayout(d, drei, 0, rules));
    expect(r.order.filter((id) => !p.elements[id])).toHaveLength(3);
    expect(r.order).toHaveLength(p.order.length - 1 + 3); // leerer Platzhalter weg, Rest bleibt
  });

  it('ausgeblendetes Foto bleibt ausgeblendet und halb durchsichtig', () => {
    const p = project(1, [photo('bild', { role: 'foto', visible: false, opacity: 0.4 })]);
    const r = produce(p, (d) => void applyLayout(d, voll, 0, rules));
    expect(r.elements.bild).toMatchObject({ visible: false, opacity: 0.4, width: 1080 });
  });

  it('take bekommt den Platzhalter des bisherigen Layouts (gleiche Rolle) als Vergleich, ein freies Element keinen', () => {
    const seen: [string, Element | undefined][] = [];
    const spy: ContentRules = { ...rules, take: (into, from, p, base) => (seen.push([from.id, base]), rules.take(into, from, p)) };
    const p = produce(project(1, [photo('bild', { role: 'foto' })]), (d) => void (d.slides[0]!.layout = 'voll'));
    produce(p, (d) => void applyLayout(d, titel, 0, spy));
    expect(seen).toEqual([['bild', expect.objectContaining({ type: 'photo', role: 'foto', x: 0, width: 1080 })]]);
    seen.length = 0;
    produce(project(1, [photo('frei')]), (d) => void applyLayout(d, titel, 0, spy));
    expect(seen).toEqual([['frei', undefined]]);
  });

  it('Layout kommt an die Stelle des ersten ersetzten Elements: freies Element ganz unten bleibt unten', () => {
    const p = produce(project(1, [el({ id: 'grund', type: 'brand', width: 1080, height: 1350 })]), (d) => {
      const ids = applyLayout(d, voll, 0, rules);
      d.order = ['grund', ...ids];
    });
    const r = produce(p, (d) => void applyLayout(d, drei, 0, rules));
    expect(r.order[0]).toBe('grund');
  });

  it('nichts ersetzt oder umgezogen: Layout kommt unter die freien Elemente der Slide, nicht zuoberst', () => {
    const p = project(2, [el({ id: 'nachbar', x: 1200 }), el({ id: 'pfeil', type: 'brand', x: 300 }), el({ id: 'oben', x: 1300 })]);
    const r = produce(p, (d) => void applyLayout(d, voll, 0, rules));
    expect(r.order[0]).toBe('nachbar');
    expect(r.order.slice(1, 5).map((id) => r.elements[id]!.role)).toEqual(['foto', 'titel', 'kommentar', 'schulTag']);
    expect(r.order.slice(5)).toEqual(['pfeil', 'oben']);
  });
});

describe('addLayoutSlides und layoutOnSlide', () => {
  it('neue Slides nehmen nichts auf, auch nicht ein Element rechts ausserhalb', () => {
    const p = project(1, [text('weit', 'Abgestellt', { x: 5000 })]);
    const r = produce(p, (d) => void addLayoutSlides(d, voll, 1, rules));
    expect(r.elements.weit).toEqual(p.elements.weit);
    expect(r.order).toHaveLength(5);
  });

  it('fügt so viele Slides ein, wie das Layout braucht, und verschiebt spätere Elemente', () => {
    const p = project(2, [el({ id: 'rechts', x: 1200 })]);
    const r = produce(p, (d) => void addLayoutSlides(d, panorama, 1, rules));
    expect(r.slides).toHaveLength(4);
    expect(r.slides.map((s) => s.layout)).toEqual([undefined, 'panorama', 'panorama', undefined]);
    expect(r.elements.rechts!.x).toBe(1200 + 2160);
    expect(r.order).toHaveLength(3);
  });

  it('Grenze 20 Slides: klare Meldung, nichts geändert', () => {
    const p = project(MAX_SLIDES - 1);
    expect(() => produce(p, (d) => void addLayoutSlides(d, panorama, 1, rules))).toThrow(`${LIMIT_TEXT} «Panorama» braucht 2 Slides.`);
    expect(produce(p, (d) => void addLayoutSlides(d, voll, 1, rules)).slides).toHaveLength(MAX_SLIDES);
  });

  it('zwei Slides auf der aktuellen Slide: rechts eine Slide dazu, ausser die nächste gehört schon zu diesem Layout', () => {
    const p = project(2, [text('n', 'Nächste', { role: 'kommentar', x: 1200 })]);
    const r = produce(p, (d) => void layoutOnSlide(d, panorama, 0, rules));
    expect(r.slides).toHaveLength(3);
    expect(r.elements.n).toMatchObject({ x: 1200 + 1080, props: { text: 'Nächste' } }); // nächste Slide unberührt
    const again = produce(r, (d) => void layoutOnSlide(d, panorama, 0, rules));
    expect(again.slides).toHaveLength(3);
    expect(again.order).toHaveLength(r.order.length);
    const one = produce(p, (d) => void layoutOnSlide(d, voll, 1, rules));
    expect(one.slides).toHaveLength(2);
    expect(one.elements.n).toMatchObject({ role: 'kommentar', x: 1080 + 72 });
  });
});

describe('slideAfter (Panorama nicht teilen)', () => {
  const lay = (ids: (string | undefined)[]) => produce(project(ids.length), (d) => ids.forEach((l, i) => void (l && (d.slides[i]!.layout = l))));

  it('ohne mehrteiliges Layout: rechts der Slide', () => {
    const p = lay(['voll', undefined, 'voll']);
    expect([0, 1, 2].map((i) => slideAfter(p, i, rules.layout))).toEqual([1, 2, 3]);
  });

  it('linke oder rechte Hälfte eines Panoramas: nach dem Panorama; Panoramas nebeneinander von links gezählt', () => {
    const p = lay(['voll', 'panorama', 'panorama', 'panorama', 'panorama', 'panorama']);
    expect([0, 1, 2, 3, 4, 5].map((i) => slideAfter(p, i, rules.layout))).toEqual([1, 3, 3, 5, 5, 6]);
  });

  it('unbekanntes Layout oder anderes Format zählt nicht', () => {
    const p = lay(['weg', 'weg']);
    expect(slideAfter(p, 0, rules.layout)).toBe(1);
    const story = produce(lay(['panorama', 'panorama']), (d) => void (d.format.id = 'story'));
    expect(slideAfter(story, 0, rules.layout)).toBe(1);
  });

  it('Layout mit zwei Slides auf der linken Panorama-Hälfte: Panorama bleibt ganz, keine Slide dazwischen', () => {
    const zwei: LayoutPreset = { ...panorama, id: 'zwei', label: 'Zwei', elements: [panorama.elements[1]!] };
    const p = produce(project(3, [text('nach', 'Danach', { x: 2200 })]), (d) => void addLayoutSlides(d, panorama, 0, rules));
    const r = produce(p, (d) => void layoutOnSlide(d, zwei, 0, rules));
    expect(r.slides).toHaveLength(p.slides.length);
    expect(r.slides.map((s) => s.layout)).toEqual(['zwei', 'zwei', undefined, undefined, undefined]);
    expect(r.elements.nach).toEqual(p.elements.nach);
  });
});

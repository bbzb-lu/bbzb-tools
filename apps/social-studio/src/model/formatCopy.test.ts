import { describe, expect, it } from 'vitest';
import type { LayoutPreset } from '../core/types';
import { el, project } from './fixtures';
import { copyToFormat, type CopyRules } from './formatCopy';
import { elementBounds } from './geometry';
import type { Element, Project } from './types';

const STORY = { id: 'story', label: 'Story 9:16', width: 1080, height: 1920 };
const POST = { id: 'post', label: 'Post 4:5', width: 1080, height: 1350 };

const titel: LayoutPreset = {
  id: 'titel', label: 'Titel', family: 'titel', format: 'post', slides: 1, background: 'blau',
  elements: [
    { type: 'photo', role: 'foto', name: 'Foto', x: 0, y: 0, width: 1080, height: 1350, props: {} },
    { type: 'text', role: 'titel', name: 'Titel', x: 59, y: 161, width: 949, height: 100, props: {} },
    { type: 'text', role: 'kommentar', name: 'Kommentar', x: 72, y: 1057, width: 936, height: 100, props: {} },
    { type: 'tag', role: 'schulTag', name: 'Schul-Tag', x: 685, y: 72, width: 323, height: 62, anchorRight: true, props: {} },
  ],
};
const titelStory: LayoutPreset = {
  ...titel, id: 'titel-story', format: 'story',
  elements: titel.elements.map((e) => (e.role === 'foto' ? { ...e, height: 1920 } : { ...e, y: e.y + 240 })),
};
const panorama: LayoutPreset = {
  id: 'panorama', label: 'Panorama', family: 'panorama', format: 'post', slides: 2, background: 'blau',
  elements: [
    { type: 'photo', role: 'foto', name: 'Foto', x: 0, y: 0, width: 2160, height: 1350, props: {} },
    { type: 'brand', role: 'scribble', name: 'Pfeil', x: 870, y: 612, width: 420, height: 191, props: {} },
  ],
};
const panoramaStory: LayoutPreset = {
  ...panorama, id: 'panorama-story', format: 'story',
  elements: panorama.elements.map((e) => (e.role === 'foto' ? { ...e, height: 1920 } : { ...e, y: e.y + 240 })),
};
const all = [titel, titelStory, panorama, panoramaStory];

const rules: CopyRules = {
  layout: (id) => all.find((l) => l.id === id),
  variant: (of, format) => all.find((l) => l.format === format && l.family === of.family),
  // wie ElementType.afterTransform: Box übernehmen, beim Foto den Ausschnitt neu einpassen (hier markiert)
  labels: [STORY.label, POST.label],
  resize: (e, box) => ({ ...e, ...box, props: { ...(e.props as object), refit: true } }),
};

const H = 'a'.repeat(64);
const photo = (o: Partial<Element> = {}) => el({ id: 'f', type: 'photo', role: 'foto', width: 1080, height: 1350, props: { assetId: H, crop: { x: 0, y: 0, scale: 1 } }, ...o });

const post = (n: number, elements: Element[], layouts: (string | undefined)[] = []): Project => {
  const p = { ...project(n, elements), name: 'Sporttag', channel: 'linkedin' as const, assets: { [H]: { mime: 'image/jpeg', width: 10, height: 10, name: 'a.jpg' } } };
  layouts.forEach((l, i) => void (l && (p.slides[i]!.layout = l)));
  return p;
};

describe('copyToFormat', () => {
  it('neues Projekt im anderen Format, Original unverändert, Kanal, Assets und Slides bleiben', () => {
    const p = post(2, [photo()], ['titel']);
    p.slides[1]!.background = 'blauschwarz';
    p.slides[1]!.scrims = [{ side: 'unten', strength: 'mittel' }];
    Object.assign(p.slides[1]!, { grain: true, grainStrength: 70 });
    const before = structuredClone(p);
    const c = copyToFormat(p, STORY, rules, 7);
    expect(p).toEqual(before);
    expect(c.id).not.toBe(p.id);
    expect(c.name).toBe('Sporttag (Story 9:16)');
    expect(c.format).toEqual({ id: 'story', width: 1080, height: 1920 });
    expect([c.createdAt, c.updatedAt]).toEqual([7, 7]);
    expect(c.channel).toBe('linkedin');
    expect(c.assets).toEqual(p.assets);
    expect(c.slides.map((s) => s.background)).toEqual(['warmweiss', 'blauschwarz']);
    expect(c.slides.map((s) => s.scrims)).toEqual([undefined, [{ side: 'unten', strength: 'mittel' }]]);
    expect(c.slides[1]).toMatchObject({ grain: true, grainStrength: 70 }); // Korn-Stärke (4c.1) kommt mit
    expect(c.order).toEqual(p.order);
  });

  it('Platzhalter-Inhalte wandern in die Story-Variante, Props bleiben, keine Prüfung nötig', () => {
    const p = post(1, [
      photo({ props: { assetId: H, crop: { x: 0, y: 0, scale: 1 }, scrim: { side: 'links', strength: 'mittel', reach: 80 } } }), // ohne Korn und Look, eigener Verlauf
      el({ id: 't', type: 'text', role: 'titel', x: 59, y: 161, width: 949, height: 380, props: { text: 'Eigener Titel', color: 'orange' } }),
      el({ id: 'g', type: 'tag', role: 'schulTag', x: 708, y: 72, width: 300, height: 62, props: { text: 'Sursee' } }),
    ], ['titel']);
    const c = copyToFormat(p, STORY, rules);
    expect(c.slides[0]).toMatchObject({ layout: 'titel-story' });
    expect(c.slides[0]!.review).toBeUndefined();
    expect(c.elements.f).toMatchObject({ x: 0, y: 0, width: 1080, height: 1920, props: { assetId: H, refit: true, scrim: { side: 'links', strength: 'mittel', reach: 80 } } });
    expect(c.elements.f!.props).not.toHaveProperty('grain');
    expect(c.elements.f!.props).not.toHaveProperty('look');
    expect(c.elements.t).toMatchObject({ x: 59, y: 401, width: 949, height: 380, props: { text: 'Eigener Titel', color: 'orange' } });
    // rechtsbündiger Tag: Abstand zum Platzhalter bleibt
    expect(c.elements.g).toMatchObject({ x: 708, y: 312, width: 300 });
  });

  it('freie Elemente: relativ zur Slide-Mitte, in die Safe Zone geschoben, Slide «Bitte prüfen»', () => {
    const p = post(2, [
      el({ id: 'a', type: 'text', x: 1080 + 100, y: 1200, width: 500, height: 100 }), // unten: 1485..1585 läge in der Zone
      el({ id: 'b', type: 'brand', x: 1080 + 100, y: 600, width: 100, height: 100 }), // Mitte bleibt Mitte
    ]);
    const c = copyToFormat(p, STORY, rules);
    expect(c.elements.a).toMatchObject({ x: 1180, y: 1920 - 340 - 100 });
    expect(c.elements.b).toMatchObject({ x: 1180, y: 600 + 285 });
    expect(c.slides.map((s) => s.review)).toEqual([undefined, true]);
  });

  it('Fachbereich- und freie Tags behalten ihre Props beim Format kopieren', () => {
    const tag = (id: string, props: object) => el({ id, type: 'tag', x: 100, y: 300, width: 300, height: 62, props });
    const fach = { variant: 'fach', text: 'Bautechnik', dept: 'Bautechnik', color: 'Heimbach' };
    const frei = { variant: 'frei', text: 'Neu', color: 'orange' };
    const c = copyToFormat(post(1, [tag('f', fach), tag('r', frei)]), STORY, rules);
    expect(c.elements.f!.props).toEqual(fach);
    expect(c.elements.r!.props).toEqual(frei);
  });

  it('Story → Post: oben aus der Story wird nicht abgeschnitten, Profilraster links und rechts', () => {
    const story = { ...post(1, [el({ id: 'a', type: 'text', x: 0, y: 260, width: 400, height: 100 })]), format: { id: 'story', width: 1080, height: 1920 } };
    const c = copyToFormat(story, POST, rules);
    expect(c.format.id).toBe('post');
    expect(c.elements.a).toMatchObject({ x: 33.75, y: 0 });
    expect(c.slides[0]!.review).toBe(true);
  });

  it('nichts landet ausserhalb der Slide; freies Foto über die ganze Slide bleibt randabfallend', () => {
    const p = post(1, [
      el({ id: 'out', type: 'brand', x: 200, y: 1300, width: 200, height: 300 }), // ragt unten hinaus
      el({ id: 'big', type: 'photo', x: 0, y: 0, width: 1080, height: 1350, props: {} }), // freies Foto, ganze Slide
    ]);
    const c = copyToFormat(p, STORY, rules);
    const b = elementBounds(c.elements.out!);
    expect(b.y).toBeGreaterThanOrEqual(250);
    expect(b.y + b.height).toBeLessThanOrEqual(1580);
    // freies Foto über die ganze Slide (Phase 1, «Leer») bleibt randabfallend, ohne Hinweis
    expect(c.elements.big).toMatchObject({ x: 0, y: 0, width: 1080, height: 1920, props: { refit: true } });
    expect(c.slides[0]!.review).toBe(true); // wegen «out»
    const only = copyToFormat(post(2, [el({ id: 'v', type: 'photo', x: 1080, y: -135, width: 1080, height: 1620, props: {} })]), STORY, rules);
    expect(only.elements.v).toMatchObject({ x: 1080, y: -192, width: 1080, height: 2304 });
    expect(only.slides.map((s) => s.review)).toEqual([undefined, undefined]);
    const back = copyToFormat(c, POST, rules);
    expect(back.elements.big).toMatchObject({ x: 0, y: 0, width: 1080, height: 1350 });
  });

  it('freies Foto über die ganze Slide, auch mit Überstand, bleibt randabfallend (Post → Story), gedreht nicht', () => {
    const p = post(1, [
      el({ id: 'fl', type: 'photo', x: 0, y: 0, width: 1080, height: 1350, props: {} }),
      el({ id: 'vl', type: 'photo', x: -10, y: -10, width: 1100, height: 1370, props: {} }),
      el({ id: 'rot', type: 'photo', x: 0, y: 0, width: 1080, height: 1350, rotation: 90, props: {} }),
    ]);
    const c = copyToFormat(p, STORY, rules);
    expect(c.elements.fl).toMatchObject({ x: 0, y: 0, width: 1080, height: 1920 });
    expect(c.elements.vl).toMatchObject({ x: -10, y: -10 * 1920 / 1350, width: 1100, height: 1370 * 1920 / 1350 });
    expect(c.elements.rot).not.toMatchObject({ height: 1920 });
  });

  it('zu grosses freies Element (nicht randabfallend) deckt die Safe Zone ganz, Slide prüfen', () => {
    const p = post(2, [
      el({ id: 'ph', type: 'photo', x: 40, y: -25, width: 1000, height: 1400, props: {} }), // schmaler als die Slide
      el({ id: 'tx', type: 'text', x: 1080 + 90, y: 0, width: 900, height: 1400 }),
    ]);
    const c = copyToFormat(p, STORY, rules);
    expect(c.elements.ph).toMatchObject({ x: 40, y: 250, width: 1000, height: 1400 });
    expect(c.elements.ph!.props).not.toHaveProperty('refit');
    expect(c.elements.tx).toMatchObject({ x: 1170, y: 250, height: 1400 });
    expect(c.slides.map((s) => s.review)).toEqual([true, true]);
  });

  it('Name: nur eine bekannte Format-Endung wird ersetzt, eigene Klammern bleiben', () => {
    expect(copyToFormat({ ...post(1, []), name: 'Plan (Version 1:2)' }, STORY, rules).name).toBe('Plan (Version 1:2) (Story 9:16)');
    expect(copyToFormat({ ...post(1, []), name: 'Plan (Story 9:16)' }, POST, rules).name).toBe('Plan (Post 4:5)');
  });

  it('sehr breites Element über der Naht: Mitte bleibt im Slide-Streifen', () => {
    const p = post(2, [el({ id: 'w', type: 'brand', x: -2000, y: 100, width: 3200, height: 100 })]); // Mitte bei −400
    const c = copyToFormat(p, STORY, rules);
    const b = elementBounds(c.elements.w!);
    expect(b.x + b.width / 2).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width / 2).toBeLessThanOrEqual(1080);
  });

  it('Hin und zurück Post → Story → Post: Platzhalter wie vorher, Name ohne doppelte Endung', () => {
    const p = post(1, [
      photo(),
      el({ id: 't', type: 'text', role: 'titel', x: 59, y: 161, width: 949, height: 100, props: { text: 'Titel' } }),
      el({ id: 'g', type: 'tag', role: 'schulTag', x: 708, y: 72, width: 300, height: 62, props: { text: 'Sursee' } }),
    ], ['titel']);
    const story = copyToFormat(p, STORY, rules);
    const back = copyToFormat(story, POST, rules);
    expect(story.name).toBe('Sporttag (Story 9:16)');
    expect(back.name).toBe('Sporttag (Post 4:5)');
    expect(back.slides[0]).toMatchObject({ layout: 'titel' });
    expect(back.slides[0]!.review).toBeUndefined();
    for (const id of ['f', 't', 'g']) {
      const { x, y, width, height } = p.elements[id]!;
      expect(back.elements[id]).toMatchObject({ x, y, width, height });
    }
  });

  it('über die Naht ragendes freies Element bleibt waagrecht, wo es ist', () => {
    const p = post(2, [el({ id: 's', type: 'brand', x: 900, y: 100, width: 300, height: 100 })]);
    const c = copyToFormat(p, STORY, rules);
    expect(c.elements.s).toMatchObject({ x: 900, y: 385 });
  });

  it('Panorama: Foto über beide Slides, Scribble über der Naht, beide Slides tragen die Variante', () => {
    const p = post(2, [
      photo({ width: 2160 }),
      el({ id: 'p', type: 'brand', role: 'scribble', x: 870, y: 612, width: 420, height: 191 }),
    ], ['panorama', 'panorama']);
    const c = copyToFormat(p, STORY, rules);
    expect(c.slides.map((s) => s.layout)).toEqual(['panorama-story', 'panorama-story']);
    expect(c.elements.f).toMatchObject({ x: 0, y: 0, width: 2160, height: 1920 });
    expect(c.elements.p).toMatchObject({ x: 870, y: 852 });
    expect(c.slides.map((s) => s.review)).toEqual([undefined, undefined]);
  });

  it('Rolle ohne Platzhalter oder doppelt: frei behandelt, Slide prüfen; Panorama ohne zweite Slide: Hinweis entfernt', () => {
    const p = post(3, [
      el({ id: 'k', type: 'text', role: 'kommentar', x: 2160 + 72, y: 1000, width: 936, height: 100 }),
      photo({ id: 'f1' }),
      photo({ id: 'f2' }), // zweites Foto mit Rolle foto: Titel hat nur einen Fotorahmen
    ], ['titel', 'panorama', 'panorama']);
    const c = copyToFormat(p, STORY, rules);
    expect(c.slides.map((s) => s.layout)).toEqual(['titel-story', 'panorama-story', 'panorama-story']);
    // Panorama ab Slide 2 geht über Slide 3; der Kommentar hat dort keinen Platzhalter
    expect(c.elements.k).toMatchObject({ x: 2160 + 72, y: 1000 + 285 });
    expect(c.elements.f1).toMatchObject({ height: 1920 });
    expect(c.elements.f2).toMatchObject({ y: 0, height: 1920 }); // ganze Slide: bleibt randabfallend
    expect(c.slides.map((s) => s.review)).toEqual([undefined, undefined, true]);

    const lone = copyToFormat(post(1, [], ['panorama']), STORY, rules);
    expect(lone.slides[0]!.layout).toBeUndefined();
  });

  it('vom Platzhalter weggeschobener Text landet nicht in der Safe Zone', () => {
    const p = post(1, [el({ id: 'k', type: 'text', role: 'kommentar', x: 72, y: 1250, width: 936, height: 100 })], ['titel']);
    const c = copyToFormat(p, STORY, rules);
    expect(c.elements.k).toMatchObject({ y: 1580 - 100 });
    expect(c.slides[0]!.review).toBe(true);
  });

  it('Verknüpfung bleibt; gelöste Panorama-Hälfte davor wird nicht mit der Gruppe dahinter gepaart', () => {
    const p = post(3, [photo({ x: 1080, width: 2160 })], ['panorama', 'panorama', 'panorama']);
    p.slides[1]!.link = p.slides[2]!.link = 'k';
    const c = copyToFormat(p, STORY, rules);
    expect(c.slides.map((s) => s.link)).toEqual([undefined, 'k', 'k']);
    expect(c.slides.map((s) => s.layout)).toEqual([undefined, 'panorama-story', 'panorama-story']);
    expect(c.elements.f).toMatchObject({ x: 1080, width: 2160, height: 1920 });
  });
});


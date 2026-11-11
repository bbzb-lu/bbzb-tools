import { describe, expect, it } from 'vitest';
import { elementTypes, formats, layouts } from '../../core/registries';
import { elementBounds } from '../../model/geometry';
import type { Element } from '../../model/types';
import { registerPlugins } from '..';
import { photoFrame, safeZones, tagBox, textMetrics } from '../../tokens';
import { parseLayout } from './index';
import { photoType } from '../elements/photo';
import { scrimsOf } from '../elements/photo/schema';
import { scrimSteps } from '../effects/scrim';

const valid = {
  id: 'test',
  label: 'Test',
  format: 'post',
  slides: 2,
  background: 'blau',
  elements: [{ type: 'photo', role: 'foto', name: 'Foto', x: 0, y: 0, width: 2160, height: 1350, props: {} }],
};

describe('Layoutdaten', () => {
  it('gültige Daten werden zum Preset', () => {
    registerPlugins();
    expect(parseLayout('./presets/test.json', valid)).toEqual(valid);
  });

  it.each([
    ['unbekannter Elementtyp', { ...valid, elements: [{ ...valid.elements[0], type: 'video' }] }],
    ['Breite 0', { ...valid, elements: [{ ...valid.elements[0], width: 0 }] }],
    ['Farbe ausserhalb der Palette', { ...valid, background: 'rot' }],
    ['keine Slide', { ...valid, slides: 0 }],
    ['ohne Rolle', { ...valid, elements: [{ ...valid.elements[0], role: undefined }] }],
  ])('%s: Fehler mit Dateiname', (_, data) => {
    registerPlugins();
    expect(() => parseLayout('./presets/kaputt.json', data)).toThrow(/kaputt\.json/);
  });

  it('jedes registrierte Layout: Props passen zum Elementtyp, Elemente liegen auf seinen Slides', () => {
    registerPlugins();
    for (const preset of layouts.all()) {
      for (const s of preset.elements) {
        const t = elementTypes.get(s.type);
        // Foto ergänzt seine Props selbst (Ausschnitt, Korn, Look); Text und Tag messen nur die Grösse.
        const props = s.type === 'photo' ? t.fromLayout!({ ...s, props: s.props } as unknown as Element).props : s.props;
        expect(t.propsSchema.safeParse(props).success, `${preset.id}: ${s.name}`).toBe(true);
        // Mitte auf den Slides des Layouts: ein Vorzeichenfehler in den Daten fällt auf
        const f = formats.get(preset.format);
        expect(s.x + s.width / 2, `${preset.id}: ${s.name}`).toBeLessThanOrEqual(preset.slides * f.width);
        expect(s.x + s.width / 2, `${preset.id}: ${s.name}`).toBeGreaterThanOrEqual(0);
        expect(s.y + s.height / 2, `${preset.id}: ${s.name}`).toBeGreaterThanOrEqual(0);
        expect(s.y + s.height / 2, `${preset.id}: ${s.name}`).toBeLessThanOrEqual(f.height);
      }
    }
  });

  it('kein Element ragt über die Slides des Layouts hinaus (sonst Streifen auf der Nachbarslide); unten darf es überstehen', () => {
    registerPlugins();
    for (const preset of layouts.all()) {
      for (const s of preset.elements) {
        const b = elementBounds({ ...s, rotation: s.rotation ?? 0 } as unknown as Element);
        expect(b.x, `${preset.id}: ${s.name}`).toBeGreaterThanOrEqual(-0.5);
        expect(b.x + b.width, `${preset.id}: ${s.name}`).toBeLessThanOrEqual(preset.slides * formats.get(preset.format).width + 0.5);
      }
    }
  });

  it('die 8 Layouts im Format 4:5, je mit Schlüssel für die Story-Variante (Ruling R6)', () => {
    registerPlugins();
    const post = layouts.all().filter((l) => l.format === 'post');
    expect(post.map((l) => l.id).sort()).toEqual(['abschluss', 'collage', 'dreiFotos', 'leer', 'panorama', 'querformat', 'titel', 'vollbild']);
    for (const l of post) expect(l.family, l.id).toBe(l.id);
    expect(layouts.get('panorama').slides).toBe(2);
    expect(layouts.get('leer').elements).toEqual([]);
  });

  it('jedes Layout auch als Story 9:16, verbunden über die Familie (Ruling R6)', () => {
    registerPlugins();
    const post = layouts.all().filter((l) => l.format === 'post');
    const story = layouts.all().filter((l) => l.format === 'story');
    expect(story.map((l) => l.family).sort()).toEqual(post.map((l) => l.family).sort());
    for (const s of story) {
      const p = post.find((l) => l.family === s.family)!;
      const slide = (l: typeof s) => [l.label, l.slides, l.background, l.grain, l.elements.map((e) => [e.role, (e.props as { frame?: boolean }).frame, (e.props as { scrim?: unknown }).scrim])];
      expect(slide(s), s.id).toEqual(slide(p));
    }
  });

  it('Story: Texte, Tags, Scribbles und Fotos ohne Randanschnitt liegen in der Sicherheitszone (oben 250, unten 340)', () => {
    registerPlugins();
    const zone = safeZones.story!;
    for (const preset of layouts.all().filter((l) => l.format === 'story')) {
      const f = formats.get(preset.format);
      for (const s of preset.elements) {
        const p = s.props as { text?: string; style?: 'titel' | 'kommentar'; fontSize?: number; lineHeight?: number };
        // Texthöhe wie Konva: Zeilen × Grösse × Zeilenabstand (die Beispieltexte brechen nicht selbst um)
        const height = s.type === 'text' ? p.text!.split('\n').length * p.fontSize! * textMetrics(p.style!, p.fontSize!, p.lineHeight).lineHeight : s.height;
        const b = elementBounds({ ...s, height, rotation: s.rotation ?? 0 } as unknown as Element);
        // Anschnitt erlaubt: Foto, das bis an den oberen oder unteren Slide-Rand reicht (Vollbild, Freisteller)
        const bleeds = s.type === 'photo' && (b.y <= 0 || b.y + b.height >= f.height);
        if (bleeds) continue;
        expect(b.y, `${preset.id}: ${s.name} oben`).toBeGreaterThanOrEqual(zone.top);
        expect(b.y + b.height, `${preset.id}: ${s.name} unten`).toBeLessThanOrEqual(f.height - zone.bottom);
        expect(b.x, `${preset.id}: ${s.name} links`).toBeGreaterThanOrEqual(0);
        expect(b.x + b.width, `${preset.id}: ${s.name} rechts`).toBeLessThanOrEqual(preset.slides * f.width);
      }
    }
  });

  it('Hintergrund und Korn sind Slide-Eigenschaften wie in der PSD, der Verlauf gehört zum Foto (Entscheid Phase 2.3)', () => {
    registerPlugins();
    const fields = (id: string) => {
      const l = layouts.get(id);
      return [l.background, l.grain, l.elements.filter((e) => e.type === 'photo').map((e) => (e.props as { scrim?: unknown }).scrim)];
    };
    expect(['collage', 'dreiFotos', 'titel', 'vollbild'].map(fields)).toEqual([
      ['blau', true, [undefined, undefined]],
      ['blau', true, [undefined, undefined, undefined, undefined]],
      ['blau', undefined, [{ side: 'oben', strength: 'leicht' }]],
      ['warmweiss', undefined, [{ side: 'unten', strength: 'stark' }]],
    ]);
    for (const l of layouts.all()) expect(l.elements.map((e) => e.type).filter((t) => !['photo', 'text', 'tag', 'brand'].includes(t)), l.id).toEqual([]);
  });

  it('Presets behalten das alte scrim; als Liste gelesen ergibt es denselben einen Verlauf (R8, Phase 2.5)', () => {
    registerPlugins();
    for (const id of ['titel', 'titel-story', 'vollbild', 'vollbild-story']) {
      const photo = layouts.get(id).elements.find((e) => e.type === 'photo')!;
      const props = photoType.propsSchema.parse({ crop: { x: 0, y: 0, scale: 1 }, ...photo.props });
      expect(props.scrims, id).toBeUndefined();
      expect(scrimsOf(props), id).toEqual([props.scrim]);
      expect(scrimSteps(props), id).toHaveLength(1);
    }
  });

  it('Collage: das Foto trägt den Rahmen aussen (frameOutside), Box = Bildbereich wie in Beispiel_05, äussere Fläche wie die alte Box (Ruling R2)', () => {
    registerPlugins();
    // alte Box (Phase 2.4): Aussenkante des Rahmens, Bildbereich 24 px eingerückt; Drehung um die linke obere Ecke der Box
    const OLD = { x: 128.98, width: 781.8, height: 940.8, rotation: -2.5 };
    for (const [id, oldY] of [['collage', 222.07], ['collage-story', 462.07]] as const) {
      const framed = layouts.get(id).elements.filter((e) => (e.props as { frame?: boolean }).frame);
      expect(framed, id).toEqual([expect.objectContaining({ role: 'foto', props: { frame: true, frameOutside: true }, rotation: OLD.rotation })]);
      const f = framed[0]!;
      const { left, top, right, bottom } = photoFrame.inset;
      const a = (OLD.rotation * Math.PI) / 180;
      // Ecken der äusseren Fläche (Box + Rand ringsum, mit Drehung um die neue Ecke) = Ecken der alten Box
      const corners = (x: number, y: number, w: number, h: number, ox: number, oy: number) =>
        [[0, 0], [w, 0], [w, h], [0, h]].map(([u, v]) => [ox + (x + u!) * Math.cos(a) - (y + v!) * Math.sin(a), oy + (x + u!) * Math.sin(a) + (y + v!) * Math.cos(a)]);
      const outer = corners(-left, -top, f.width + left + right, f.height + top + bottom, f.x, f.y);
      const old = corners(0, 0, OLD.width, OLD.height, OLD.x, oldY);
      outer.forEach((c, i) => c.forEach((v, k) => expect(v, `${id} Ecke ${i}`).toBeCloseTo(old[i]![k]!, 9)));
      // Bildbereich 733.8 × 892.8 mit der Ecke bei x 154, wie vorher das Foto ohne Rahmen
      expect([f.width, f.height]).toEqual([733.8, 892.8].map((v) => expect.closeTo(v, 6)));
      expect(f.x).toBeCloseTo(154, 1);
    }
  });

  it('Korn ausdrücklich: Fotos bekommen Korn und Look (Ruling R10)', () => {
    registerPlugins();
    for (const preset of layouts.all()) {
      for (const s of preset.elements) {
        if (s.type === 'photo') expect(elementTypes.get('photo').fromLayout!({ ...s, props: s.props } as unknown as Element).props).toMatchObject({ grain: true, look: true });
      }
    }
  });

  it('CTA mit dem Instagram-Standard «LINK IN BIO» (Kanalwechsel: Ruling R4)', () => {
    registerPlugins();
    const cta = layouts.get('abschluss').elements.find((e) => e.role === 'cta');
    expect(cta).toMatchObject({ type: 'tag', props: { variant: 'cta', text: tagBox.cta.defaultText } });
  });
});

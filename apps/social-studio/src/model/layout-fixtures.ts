import type { LayoutPreset } from '../core/types';
import type { ContentRules } from './layout';

export const titel: LayoutPreset = {
  id: 'titel',
  label: 'Titel',
  format: 'post',
  slides: 1,
  background: 'warmweiss',
  elements: [
    { type: 'photo', role: 'foto', name: 'Foto', x: 0, y: 0, width: 1080, height: 1350, props: {} },
    { type: 'tag', role: 'schulTag', name: 'Schul-Tag', x: 685, y: 72, width: 323, height: 62, anchorRight: true, props: { variant: 'schul', text: 'Bahnhof' } },
  ],
};

export const panorama: LayoutPreset = {
  id: 'panorama',
  label: 'Panorama',
  format: 'post',
  slides: 2,
  background: 'warmweiss',
  elements: [
    { type: 'photo', role: 'foto', name: 'Foto', x: 0, y: 0, width: 2160, height: 1350, props: {} },
    { type: 'text', role: 'kommentar', name: 'Kommentar rechts', x: 1727, y: 96, width: 361, height: 126, props: { text: 'Golf' } },
  ],
};

export type P = Record<string, unknown>;
export const H = 'a'.repeat(64);
/** Regeln wie die Elementtypen, ohne Messen: Text misst 50 hoch, Fotos mit Bild, Texte und Tags sind Inhalt. */
export const rules: ContentRules = {
  fit: (e) => (e.type === 'text' ? { ...e, height: 50 } : e),
  hasContent: (e) => e.type === 'text' || e.type === 'tag' || (e.type === 'photo' && !!(e.props as P).assetId),
  take: (into, from) => {
    const a = into.props as P;
    const b = from.props as P;
    if (into.type === 'photo') return b.assetId ? { ...into, props: { ...b, crop: 'cover' } } : undefined;
    if (into.type === 'tag' && a.variant !== b.variant) return undefined;
    return { ...into, props: { ...a, text: b.text } };
  },
  layout: (id) => [voll, drei, titel, panorama, deko].find((l) => l.id === id),
  isEmpty: (e) => e.type === 'photo' && !(e.props as P).assetId,
};

export const voll: LayoutPreset = {
  id: 'voll',
  label: 'Voll',
  format: 'post',
  slides: 1,
  background: 'blau',
  elements: [
    { type: 'photo', role: 'foto', name: 'Foto', x: 0, y: 0, width: 1080, height: 1350, props: {} },
    { type: 'text', role: 'titel', name: 'Titel', x: 60, y: 160, width: 940, height: 100, props: { text: 'Titel', style: 'titel' } },
    { type: 'text', role: 'kommentar', name: 'Kommentar', x: 72, y: 1050, width: 936, height: 100, props: { text: 'Kommentar', style: 'kommentar' } },
    { type: 'tag', role: 'schulTag', name: 'Schul-Tag', x: 685, y: 72, width: 323, height: 62, props: { variant: 'schul', text: 'Bahnhof' } },
  ],
};
export const deko: LayoutPreset = {
  ...voll,
  id: 'deko',
  elements: [
    { type: 'brand', role: 'funkeln', name: 'Funkeln', x: 800, y: 100, width: 200, height: 150, props: { assetId: 'scribble-01', color: 'orange' } },
    ...voll.elements,
    { type: 'brand', role: 'scribble', name: 'Pfeil', x: 500, y: 600, width: 300, height: 140, props: { assetId: 'scribble-05', color: 'orange' } },
  ],
};
export const drei: LayoutPreset = {
  ...voll,
  id: 'drei',
  elements: [0, 1, 2].map((i) => ({ type: 'photo', role: 'foto', name: `Foto ${i}`, x: 100, y: 100 + i * 400, width: 600, height: 300, props: {} })),
};

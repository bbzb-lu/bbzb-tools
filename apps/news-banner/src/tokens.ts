/** Alle Masse und Farben des Banners. Quelle: docs/reference/*.psd (1920×1080). */
export const canvas = { w: 1920, h: 1080 } as const;

export type Audience = 'le' | 'lp' | 'beide';
export type Kind = 'info' | 'stoerung';
export type Theme = 'dark' | 'light';

/** «Beide» nutzt die Vorlage der Lernenden (Entscheid Alexej). */
export const themeOf = (a: Audience): Theme => (a === 'lp' ? 'light' : 'dark');

type Rgb = readonly [number, number, number];

/** Verlauf von oben nach unten: [y in px, RGB], in der PSD gemessen. */
export const gradients: Record<Theme, readonly (readonly [number, Rgb])[]> = {
  dark: [[0, [84, 120, 181]], [300, [66, 103, 169]], [540, [50, 88, 159]], [800, [33, 72, 147]], [1079, [16, 56, 136]]],
  light: [[0, [255, 255, 255]], [300, [221, 228, 241]], [540, [190, 204, 228]], [800, [158, 179, 214]], [1079, [129, 155, 200]]],
};

/** Banner-Zone (rot gestrichelt) und Sperrzonen (gelb) der PSD. Sperrzonen: Schätzung, gegen PSD prüfen. */
export const zones = {
  banner: { x: 0, y: 378, w: 1920, h: 266 },
  blocked: [{ x: 20, y: 28, w: 245, h: 1032 }, { x: 1652, y: 28, w: 244, h: 1032 }],
} as const;

/** Farben der Punkte in der Mitte (nur für die Orientierung in der Oberfläche, die Punkte selbst sind Bilder). */
export const badgeColor: Record<Kind, string> = { info: '#4565CF', stoerung: '#E34343' };

export const badge = { cx: 960, cy: { info: 449, stoerung: 453 }, w: 121, h: 122 } as const;

/** Plätze der Icons (Mitte und grösste Fläche für den sichtbaren Inhalt). Aus den PSD-Ebenen: Banner-Zone 266 px hoch. */
export const slots = {
  left: { cx: 610, cy: 512, w: 340, h: 262 },
  right: { cx: 1290, cy: 512, w: 340, h: 262 },
  bottom: { cx: 960, cy: 585, w: 150, h: 100 },
} as const;
export type Slot = keyof typeof slots;

/** Strich der Icons (PSD: «WIDTH 1.5px») und Farben je Vorlage. Effekt: weicher Schein plus Relief, Werte nach Augenmass gegen die PSD. */
export const iconStyle = {
  stroke: 1.5,
  color: { dark: '#FFFFFF', light: '#4565CF' } as Record<Theme, string>,
  glow: { dark: { alpha: 0.6, blur: 20 }, light: { alpha: 0.5, blur: 20 } } as Record<Theme, { alpha: number; blur: number }>,
  relief: { shade: 'rgba(15,35,90,0.32)', light: 'rgba(255,255,255,0.55)', offset: 3, blur: 2.5 },
  /** Auflösung, in der ein Icon vor dem Einpassen gezeichnet wird. */
  raster: 512,
  /** Eigene Bilder: längste Kante höchstens so gross (schwache Geräte). */
  maxImage: 4096,
  /** Transparenzprüfung eigener Bilder: Kante des verkleinerten Prüfbilds, Alpha unter dem Grenzwert zählt als durchsichtig, ab diesem Anteil gilt das Bild als durchsichtig. */
  transparency: { probe: 256, alpha: 250, share: 0.01 },
} as const;

/** Hilfslinien der Vorschau (nie im Export). */
export const guideColors = { banner: '#FF0000', blocked: '#F5B400', activeOuter: '#FFFFFF', activeInner: '#232323' } as const;

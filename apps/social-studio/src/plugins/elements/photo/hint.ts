import { colors, photoFrame, placeholderStyle as ph, type ColorToken } from '../../../tokens';

const rgb = (c: ColorToken) => [1, 3, 5].map((i) => parseInt(colors[c].slice(i, i + 2), 16));
const lum = (v: number[]) => v.map((x) => (x /= 255) <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4).reduce((s, x, i) => s + x * [0.2126, 0.7152, 0.0722][i]!, 0);

/** Farbe unter der Platzhalterfläche: der Rahmen (deckend), sonst der Slide-Hintergrund. */
export const baseOf = (bg: ColorToken, framed: boolean): ColorToken => (framed ? photoFrame.color : bg);

/** WCAG-Kontrast des Hinweistexts `text` zur Platzhalterfläche (Füllfarbe mit fillAlpha über `under`). */
export function hintContrast(text: ColorToken, under: ColorToken) {
  const fill = rgb(ph.color), base = rgb(under);
  const surface = lum(base.map((b, i) => fill[i]! * ph.fillAlpha + b * (1 - ph.fillAlpha)));
  const t = lum(rgb(text));
  return (Math.max(t, surface) + 0.05) / (Math.min(t, surface) + 0.05);
}

/** Hinweisfarbe: Blauschwarz oder Warmweiss, je nach besserem Kontrast zur Fläche. */
export const hintColor = (under: ColorToken): ColorToken => (hintContrast('blauschwarz', under) >= hintContrast('warmweiss', under) ? 'blauschwarz' : 'warmweiss');

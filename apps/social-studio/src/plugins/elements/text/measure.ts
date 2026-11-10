import Konva from 'konva';
import { textMetrics, textStyles } from '../../../tokens';
import type { TextProps } from './schema';

// Braveold bildet Ligaturen (st, ct, f + Kleinbuchstabe), die PSD hat sie aus. Canvas 2D kann Ligaturen nicht abschalten,
// ein ZWNJ trennt sie. Nur im gezeichneten Text, nie im Dokument; Kerning bleibt (in Edge gemessen).
// Nur bei Laufweite 0: sonst zeichnet Konva je Zeichen (keine Ligatur) und gäbe jedem ZWNJ eine Laufweite dazu.
const noLigatures = (text: string) => text.replace(/([cfs])(?=\p{Ll})/gu, '$1\u200C');

/** Gemeinsame Konva-Text-Einstellungen für Darstellung und Messung. */
export function textConfig(p: TextProps, width: number) {
  const { lineHeight, letterSpacing } = textMetrics(p.style, p.fontSize, p.lineHeight, p.tracking);
  return {
    text: p.style === 'kommentar' && letterSpacing === 0 ? noLigatures(p.text) : p.text,
    width,
    fontFamily: textStyles[p.style].family,
    fontSize: p.fontSize,
    letterSpacing,
    lineHeight,
    align: p.align,
    wrap: 'word',
  } as const;
}

/** Erst nach dem Laden der Schriften aufrufen, sonst stimmen die Umbrüche nicht. */
export function measureTextHeight(p: TextProps, width: number): number {
  return new Konva.Text(textConfig(p, width)).height();
}

import type { Anchor, EditorContext } from '../../../core/types';
import { addElement, channelOf, nextName } from '../../../model/elements';
import { ctaText, departments, type Channel } from '../../../tokens';
import { tagBoxWidth, tagHeightOf } from './layout';
import { measureLabel, tagTextConfig } from './measure';
import { type TagProps } from './schema';

export const variantNames = { schul: 'Standort-Tag', fach: 'Fachbereich-Tag', frei: 'Freier Tag', ort: 'Ort-Tag', cta: 'CTA' } as const;

/** Kurze Namen in der Bibliothek; Ebenen heissen nach variantNames. */
export const libraryLabels = { schul: 'Standort', fach: 'Fachbereich', frei: 'Frei', ort: 'Ort', cta: 'CTA' } as const;

/** CTA-Text für den Kanal: nur der Standardtext des anderen Kanals wird getauscht, eigener Text bleibt (Ruling R4). */
export function ctaFor(text: string, channel: Channel): string {
  const isDefault = Object.values(ctaText).some((t) => t.toLowerCase() === text.toLowerCase());
  return isDefault ? ctaText[channel] : text;
}

/** Breite der Box für diese Props; wartet vorher auf die Schrift, sonst stimmt die Messung nicht. */
export async function tagWidthReady(p: TagProps): Promise<number> {
  const c = tagTextConfig(p);
  try {
    await document.fonts.load(`${c.fontSize}px "${c.fontFamily}"`, c.text);
  } catch {
    // Schrift fehlt: Fallbackschrift, der Export meldet es
  }
  return tagBoxWidth(p, measureLabel(p));
}

/** Tag einfügen: ohne `at` mittig auf die aktuelle Slide, sonst mit der Mitte bei `at` (globale Koordinaten). */
export async function insertTag(variant: TagProps['variant'], ctx: EditorContext, at?: Anchor): Promise<void> {
  // Ein neuer Standort-Tag startet mit «BBZB»; nur Layout-Platzhalter nehmen lastTagLocation (fromLayout).
  const props: TagProps =
    variant === 'schul' ? { variant, text: 'BBZB' }
    : variant === 'fach' ? { variant, text: departments.Bahnhof[0]!, color: 'Bahnhof' }
    : variant === 'frei' ? { variant, text: 'Text', color: 'blau' }
    : { variant, text: variant === 'cta' ? ctaText[channelOf(ctx.project)] : 'Luzern' };
  const width = await tagWidthReady(props);
  const { width: W, height: H } = ctx.project.format;
  const center = (typeof at === 'function' ? at() : at) ?? { x: ctx.currentSlide * W + W / 2, y: H / 2 };
  const height = tagHeightOf(props);
  const id = crypto.randomUUID();
  ctx.apply((d) =>
    addElement(d, {
      id,
      type: 'tag',
      name: nextName(d, variantNames[variant]),
      x: center.x - width / 2,
      y: center.y - height / 2,
      width,
      height,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      props,
    }),
  );
  ctx.select(id);
}

import Konva from 'konva';
import { useEffect, useState } from 'react';
import { effects } from '../core/registries';
import { useUi } from '../store/ui';

/** Name des Rohbild-Knotens, solange die Effekt-Canvas noch rechnet; der Export wartet darauf. */
export const EFFECT_PENDING_NODE = 'effect-pending';
export const EFFECT_FAILED = 'Ein Effekt (z. B. Korn) konnte nicht berechnet werden. Lade die Seite neu.';

/** Fehlermeldung einmal zeigen, nicht je Element. */
export function effectFailed(): void {
  const { notice, setNotice } = useUi.getState();
  if (notice?.text !== EFFECT_FAILED) setNotice({ kind: 'error', text: EFFECT_FAILED });
}

export type EffectStep = { id: string; params: unknown };

// Längste Seite der Effekt-Canvas: genug für Fotos bis 4096 px, begrenzt den Speicher je Element (4096 × 4096 × 4 B = 64 MB).
// shortcut: Canvas in Slide-Pixeln (= Export), über Zoom 100 % wirkt ein Foto mit Effekt im Editor weicher; bei Klagen mit Zoom × devicePixelRatio rechnen (Speicher!)
export const EFFECT_MAX = 4096;
// Vorschau, solange ein Regler bewegt wird: etwa ein Sechstel der Pixel einer Slide, danach einmal in voller Auflösung.
export const PREVIEW_MAX = 540;
/** Video-Vorschau (Inspector): gezeichnete Bilder und offene Video-Elemente, für e2e; liegt hier, weil der Test-Hook keine Plugins importiert. */
export const previewStats = { frames: 0, open: 0, composites: 0 };

/**
 * Canvas in Elementgrösse (Slide-Pixel = Export-Pixel), Grundbild von `draw`, darauf die aktiven Effekte der Reihe nach.
 * Editor und Export zeigen dieselbe Canvas. `clip` (Foto mit Maske): Effekte nur, wo das Grundbild deckt; ausgeblendete Flächen bleiben durchsichtig.
 */
export async function composite(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void, steps: EffectStep[], max: number, clip = false) {
  previewStats.composites++;
  const scale = Math.min(1, max / Math.max(width, height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(width * scale));
  c.height = Math.max(1, Math.round(height * scale));
  const ctx = c.getContext('2d')!;
  try {
    draw(ctx);
    // Deckkraft des Grundbilds merken und am Ende zurücksetzen (Verlauf und Korn malen sonst über ausgeblendete Flächen;
    // ein zweites Zeichnen mit «destination-in» würde weiche Kanten quadrieren)
    const alpha = clip ? ctx.getImageData(0, 0, c.width, c.height).data : undefined;
    for (const s of steps) await effects.get(s.id).apply(ctx, s.params, scale);
    if (alpha) {
      const out = ctx.getImageData(0, 0, c.width, c.height);
      for (let i = 3; i < alpha.length; i += 4) out.data[i] = alpha[i]!;
      ctx.putImageData(out, 0, 0);
    }
    return c;
  } catch (e) {
    Konva.Util.releaseCanvas(c);
    throw e;
  }
}

/**
 * Effekt-Canvas eines Elements. `baseKey` beschreibt alle Eingaben von `draw` (null: noch nicht bereit, z. B. Bild lädt);
 * gerechnet wird nur bei neuem Schlüssel, höchstens einmal je Bild, nie pro Frame. Ohne aktive Effekte: keine Canvas, `pending` false.
 * Während ein Regler bewegt wird (`ui.sliding`), entsteht eine Vorschau in kleiner Auflösung, beim Loslassen die volle.
 * Ändern sich nur Effektwerte, bleibt bis dahin die alte Canvas sichtbar (kein Aufblitzen des Rohbilds).
 */
export function useEffectCanvas(
  baseKey: string | null,
  width: number,
  height: number,
  steps: EffectStep[],
  draw: (ctx: CanvasRenderingContext2D) => void,
  clip = false,
): { canvas?: HTMLCanvasElement; pending: boolean } {
  const active = steps.filter((s) => effects.get(s.id).active(s.params));
  const base = baseKey !== null && active.length > 0 ? `${baseKey} ${width}x${height}` : null;
  const key = base !== null ? `${base} ${JSON.stringify(active)}` : null;
  const sliding = useUi((s) => s.sliding);
  const [state, setState] = useState<{ base: string; key: string; preview: boolean; canvas?: HTMLCanvasElement }>();
  const current = state?.key === key && (sliding || !state.preview);
  useEffect(() => {
    // Effekte aus (z. B. Korn abgeschaltet): alte Canvas freigeben, sie hält bis 64 MB
    const old = key === null ? state?.canvas : undefined;
    if (old) {
      const frame = requestAnimationFrame(() => {
        Konva.Util.releaseCanvas(old);
        setState(undefined);
      });
      return () => cancelAnimationFrame(frame);
    }
    if (key === null || base === null || current) return;
    const preview = sliding;
    let live = true;
    // ein Bild abwarten: mehrere Änderungen im selben Bild rechnen nur einmal
    const frame = requestAnimationFrame(() =>
      composite(width, height, draw, active, preview ? PREVIEW_MAX : EFFECT_MAX, clip).then(
        (canvas) => (live ? setState({ base, key, preview, canvas }) : Konva.Util.releaseCanvas(canvas)),
        (e) => {
          console.error(e);
          if (!live) return;
          setState({ base, key, preview: false });
          effectFailed();
        },
      ),
    );
    return () => {
      live = false;
      cancelAnimationFrame(frame);
    };
    // `key` enthält alle Eingaben von draw, active und clip; `sliding` mit: Loslassen während einer Vorschau-Rechnung bricht sie ab und rechnet voll
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, current, sliding]);
  if (key === null) return { pending: false };
  // Fehlgeschlagen: Rohbild ohne Effekt, der Export wartet nicht.
  if (current) return { canvas: state!.canvas, pending: false };
  return { canvas: state?.base === base ? state.canvas : undefined, pending: true };
}

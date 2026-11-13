import Konva from 'konva';
import { useEffect, useState } from 'react';
import { Image as KImage, Rect } from 'react-konva';
import { scrimParams, type Scrim } from '../model/scrim';
import type { Slide } from '../model/types';
import { grainOpacity } from '../model/grain';
import { colors, type ColorToken } from '../tokens';
import { useUi } from '../store/ui';
import { composite, EFFECT_PENDING_NODE, effectFailed, PREVIEW_MAX, type EffectStep } from './effects';

type Box = { x: number; width: number; height: number };

// Gleiche Farbe, Grösse, Verläufe und Korn ergeben dieselben Pixel: eine Canvas für alle diese Slides (je bis 8 MB), freigegeben mit der letzten.
const shared = new Map<string, { refs: number; canvas: Promise<HTMLCanvasElement> }>();

/** Effektschritte der Slide: erst die Verläufe (nie gespiegelt), dann das Korn, wie am Foto. */
const slideSteps = (scrims: Scrim[], grain: number): EffectStep[] => [
  ...scrims.map((s) => ({ id: 'scrim', params: scrimParams(s) })),
  ...(grain > 0 ? [{ id: 'grain', params: { opacity: grain } }] : []),
];

function useBackgroundCanvas(color: ColorToken, width: number, height: number, steps: EffectStep[]) {
  const key = steps.length ? `${color} ${width}x${height} ${JSON.stringify(steps)}` : null;
  const sliding = useUi((s) => s.sliding);
  const [state, setState] = useState<{ key: string; preview: boolean; canvas?: HTMLCanvasElement }>();
  // Neuer Schlüssel: alte Canvas vergessen, sie wird mit dem letzten Nutzer freigegeben (0 × 0) und darf nie mehr gezeichnet werden
  if (state && state.key !== key) setState(undefined);
  // Wie useEffectCanvas: neu gerechnet wird während einer Regler-Geste (z. B. Korn-Stärke) als Vorschau, nach dem Loslassen voll.
  // Eine fertige volle Canvas bleibt, wenn ein anderer Regler bewegt wird.
  const current = state?.key === key && (sliding || !state.preview);
  const preview = current ? state.preview : sliding;
  useEffect(() => {
    if (key === null) return;
    const id = `${key} ${preview ? 'vorschau' : 'voll'}`;
    let entry = shared.get(id);
    if (!entry) {
      const draw = (ctx: CanvasRenderingContext2D) => {
        ctx.fillStyle = colors[color];
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      };
      entry = { refs: 0, canvas: composite(width, height, draw, steps, preview ? PREVIEW_MAX : Math.max(width, height)) };
      shared.set(id, entry);
    }
    const own = entry;
    own.refs++;
    let live = true;
    own.canvas.then(
      (canvas) => live && setState({ key, preview, canvas }),
      (e) => {
        console.error(e);
        if (shared.get(id) === own) shared.delete(id); // nächster Versuch rechnet neu
        if (!live) return;
        setState({ key, preview: false });
        effectFailed();
      },
    );
    return () => {
      live = false;
      own.refs--;
      // ein Bild warten: StrictMode und schnelles Hin und Her nutzen die Canvas weiter
      requestAnimationFrame(() => {
        if (own.refs > 0 || shared.get(id) !== own) return;
        shared.delete(id);
        own.canvas.then(Konva.Util.releaseCanvas, () => {});
      });
    };
    // `key` enthält Farbe, Grösse und alle Schritte
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, preview]);
  if (key === null) return { pending: false };
  // Fehlgeschlagen: Hintergrund ohne Verlauf und Korn, der Export wartet nicht.
  if (current) return { canvas: state.canvas, pending: false };
  // Nach dem Loslassen bleibt die Vorschau stehen (wie useEffectCanvas), bis die volle fertig ist; der Export wartet weiter (pending)
  return { canvas: state?.key === key ? state.canvas : undefined, pending: true };
}

/** Hintergrund einer Slide, mit Verläufen und Korn als geteilte Effekt-Canvas (Editor und Export zeigen dieselbe). Fängt keine Klicks. */
export function SlideBackground({ slide, x, width, height }: { slide: Slide } & Box) {
  const color = slide.background;
  const fx = useBackgroundCanvas(color, width, height, slideSteps(slide.scrims ?? [], slide.grain ? grainOpacity(slide.grainStrength, 'flaeche') : 0));
  return fx.canvas ? (
    <KImage name={fx.pending ? EFFECT_PENDING_NODE : undefined} image={fx.canvas} x={x} width={width} height={height} listening={false} />
  ) : (
    <Rect name={fx.pending ? EFFECT_PENDING_NODE : undefined} x={x} width={width} height={height} fill={colors[color]} listening={false} />
  );
}

import { Layer, Rect, Shape } from 'react-konva';
import { useDoc } from '../store/document';
import { useUi } from '../store/ui';
import { theme } from '../ui/theme';

/** Schreibmatte nach Entwurf, in Bildschirm-px (enger als im Entwurf: oben bleibt nur der Rand PAD): Teilstriche alle 1/20 Slide-Breite (lang jeden fünften), Passermarken 14 px schräg vor jeder Ecke. */
const MAT = { ticks: 20, longEvery: 5, top: 22, long: 14, short: 6, line: 1.5, cross: 14, arm: 10, minGap: 4 };

/**
 * Nur Ansicht, nicht in «content», nie im Export: Haarlinie aussen um die Slides (auch auf gleichfarbiger Unterlage
 * bleibt die Kante sichtbar) und die Schreibmatte (Lineal oben, Passermarken an den Ecken der Arbeitsfläche).
 */
export function SlideEdgeLayer({ scale }: { scale: number }) {
  const { width, height } = useDoc((s) => s.project!.format);
  const slides = useDoc((s) => s.project!.slides.length);
  const light = useUi((s) => s.stageBackdrop === 'grau');
  const o = 0.5 / scale; // 1 Bildschirm-px direkt ausserhalb der Kante
  const k = 1 / scale; // Bildschirm-px in Weltkoordinaten: Striche bleiben bei jedem Zoom gleich dick
  const step = width / MAT.ticks;
  return (
    <Layer name="slide-edge" listening={false}>
      <Rect x={-o} y={-o} width={slides * width + 2 * o} height={height + 2 * o} stroke={light ? theme.ink : theme.paper} strokeWidth={1} strokeScaleEnabled={false} />
      <Shape
        name="mat"
        sceneFunc={(ctx) => {
          // Auf grauer Unterlage dunkel wie im Entwurf, auf dunklen Unterlagen hell
          ctx.fillStyle = light ? theme['ink-soft'] : theme['paper-shade'];
          const shorts = step * scale >= MAT.minGap; // weit herausgezoomt nur die langen Striche
          for (let i = 0; i < slides * MAT.ticks; i++) {
            const long = i % MAT.longEvery === 0;
            if (!long && !shorts) continue;
            const h = (long ? MAT.long : MAT.short) * k;
            ctx.fillRect(i * step - (MAT.line / 2) * k, -(MAT.top - MAT.long) * k - h, MAT.line * k, h);
          }
          ctx.fillStyle = light ? theme.ink : theme.paper;
          const d = MAT.cross * k;
          for (const [x, y] of [[-d, -d], [slides * width + d, -d], [-d, height + d], [slides * width + d, height + d]] as const) {
            ctx.fillRect(x - MAT.arm * k, y - (MAT.line / 2) * k, 2 * MAT.arm * k, MAT.line * k);
            ctx.fillRect(x - (MAT.line / 2) * k, y - MAT.arm * k, MAT.line * k, 2 * MAT.arm * k);
          }
        }}
      />
    </Layer>
  );
}

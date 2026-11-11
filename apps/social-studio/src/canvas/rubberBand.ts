import Konva from 'konva';
import type { Rect } from '../model/types';
import { colors } from '../tokens';

const MIN_DRAG = 4;
const orange = (alpha: number) => `rgba(${[1, 3, 5].map((i) => parseInt(colors.orange.slice(i, i + 2), 16)).join(',')},${alpha})`;

/**
 * Aufziehrahmen: der Aufruf mit dem pointerdown startet die Geste. Der Rahmen wird nur imperativ in Konva gezeichnet
 * (kein Store, kein Render); `onDone` bekommt beim Loslassen das Rechteck in globalen Koordinaten, `null` bei weniger als 4 px Zug.
 */
export function rubberBand(stage: Konva.Stage, layer: Konva.Layer, onDone: (rect: Rect | null) => void): (e: PointerEvent) => void {
  const global = (e: PointerEvent) => {
    const r = stage.container().getBoundingClientRect();
    return { x: (e.clientX - r.left - stage.x()) / stage.scaleX(), y: (e.clientY - r.top - stage.y()) / stage.scaleY() };
  };
  return (down) => {
    const start = global(down);
    const box = { x: down.clientX, y: down.clientY };
    let rect: Konva.Rect | null = null;
    let last: Rect | null = null;
    const end = new AbortController();
    const finish = (done: boolean) => {
      end.abort();
      rect?.destroy();
      layer.batchDraw();
      onDone(done ? last : null);
    };
    window.addEventListener(
      'pointermove',
      (e) => {
        if (!rect && Math.hypot(e.clientX - box.x, e.clientY - box.y) < MIN_DRAG) return;
        const p = global(e);
        last = { x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), width: Math.abs(p.x - start.x), height: Math.abs(p.y - start.y) };
        rect ??= new Konva.Rect({ name: 'rubber', stroke: colors.orange, fill: orange(0.1), strokeWidth: 1, strokeScaleEnabled: false, listening: false });
        if (!rect.getParent()) layer.add(rect);
        rect.setAttrs(last);
        layer.batchDraw();
      },
      { signal: end.signal },
    );
    window.addEventListener('pointerup', () => finish(true), { signal: end.signal });
    window.addEventListener('pointercancel', () => finish(false), { signal: end.signal });
  };
}

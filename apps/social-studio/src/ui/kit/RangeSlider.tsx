import { useRef, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { useSliderGesture } from '../sliderGesture';
import { keyValue, moveHandle } from './sliderMath';

/** Bereichsregler (Start und Ende) mit Klammern als Griffe. Start bleibt immer mindestens einen Schritt vor Ende. Eine Geste = ein Undo-Schritt. */
export function RangeSlider({ start, end, min, max, step = 1, onChange, format, labels = { start: 'Start', end: 'Ende' } }: {
  start: number;
  end: number;
  min: number;
  max: number;
  step?: number;
  onChange(start: number, end: number): void;
  /** Text für Screenreader (aria-valuetext), z. B. «2.5 Sekunden». */
  format?: (v: number) => string;
  /** Namen der beiden Griffe (aria-label). */
  labels?: { start: string; end: string };
}) {
  const gesture = useSliderGesture();
  const track = useRef<HTMLDivElement>(null);
  const grab = useRef<number>(0); // Abstand Zeiger zu Griffmitte beim Anfassen
  const pct = (v: number) => (max > min ? ((v - min) / (max - min)) * 100 : 0);
  const move = (which: 'start' | 'end', v: number) => {
    const [s, e] = moveHandle(which, v, start, end, min, max, step);
    if (s !== start || e !== end) onChange(s, e);
  };
  const handle = (which: 'start' | 'end') => {
    const v = which === 'start' ? start : end;
    return (
      <div
        role="slider"
        tabIndex={0}
        className={`range-handle range-${which}`}
        aria-label={labels[which]}
        aria-valuemin={which === 'start' ? min : start + step}
        aria-valuemax={which === 'start' ? end - step : max}
        aria-valuenow={v}
        aria-valuetext={format?.(v)}
        style={{ '--p': pct(v) } as CSSProperties}
        {...gesture}
        onPointerDown={(e: PointerEvent<HTMLDivElement>) => {
          gesture.onPointerDown();
          e.currentTarget.setPointerCapture(e.pointerId);
          const r = e.currentTarget.getBoundingClientRect();
          grab.current = e.clientX - (r.left + r.width / 2);
        }}
        onPointerMove={(e: PointerEvent<HTMLDivElement>) => {
          if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
          const r = track.current!.getBoundingClientRect();
          const w = e.currentTarget.offsetWidth; // Griffmitte läuft von w/2 bis Breite − w/2
          const f = (e.clientX - grab.current - r.left - w / 2) / (r.width - w);
          move(which, min + Math.min(1, Math.max(0, f)) * (max - min));
        }}
        onKeyDown={(e: KeyboardEvent) => {
          const n = keyValue(e.key, v, min, max, step);
          if (n === null) return;
          e.preventDefault();
          gesture.onKeyDown(e);
          move(which, n);
        }}
      />
    );
  };
  return (
    <div className="range">
      <div className="range-track slider-ticks" ref={track} style={{ '--ps': pct(start), '--pe': pct(end) } as CSSProperties}>
        <span className="range-rail" />
        <span className="range-fill" />
        {handle('start')}
        {handle('end')}
      </div>
    </div>
  );
}

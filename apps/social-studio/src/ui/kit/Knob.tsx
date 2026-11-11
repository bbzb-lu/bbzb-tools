import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { useSliderGesture } from '../sliderGesture';
import { useRoll } from './useRoll';
import { dragValue, keyValue, knobAngle } from './sliderMath';

// Rasten im Entwurf: 9 Punkte von −135° bis +135°; bis zum Wert in Tinte, darüber gedämpft
const TICKS = Array.from({ length: 9 }, (_, k) => -135 + k * 33.75);

/**
 * Drehregler (nur Korn): Beschriftung und Zahl links, runder Knopf mit Rasten rechts wie im Entwurf. Senkrecht ziehen, Pfeile,
 * Pos1/Ende, Doppelklick = Standard. Eine Geste = ein Undo-Schritt. Die Einheit steht nur in `aria-valuetext`; `name` = zugänglicher Name.
 */
export function Knob({ label, name = label, value, min, max, step = 1, onChange, unit, defaultValue }: {
  label: string;
  name?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange(v: number): void;
  unit?: string;
  defaultValue?: number;
}) {
  const gesture = useSliderGesture();
  const num = useRef<HTMLSpanElement>(null);
  useRoll(num, value);
  const drag = useRef<{ y: number; v: number } | null>(null);
  const set = (v: number) => v !== value && onChange(v);
  const angle = knobAngle(value, min, max);
  return (
    <div className="knob">
      <span className="knob-label">{label}</span>
      <span className="knob-value" ref={num} aria-hidden="true">{value}</span>
      <div
        role="slider"
        tabIndex={0}
        className="knob-dial"
        aria-label={name}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${value}${unit ? ` ${unit}` : ''}`}
        style={{ '--angle': `${angle}deg` } as React.CSSProperties}
        {...gesture}
        onPointerDown={(e: PointerEvent<HTMLDivElement>) => {
          gesture.onPointerDown();
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { y: e.clientY, v: value };
        }}
        onPointerMove={(e: PointerEvent<HTMLDivElement>) => drag.current && set(dragValue(drag.current.v, e.clientY - drag.current.y, min, max, step))}
        onPointerUp={() => {
          drag.current = null;
          gesture.onPointerUp();
        }}
        onKeyDown={(e: KeyboardEvent) => {
          const n = keyValue(e.key, value, min, max, step);
          if (n === null) return;
          e.preventDefault();
          gesture.onKeyDown(e);
          set(n);
        }}
        onDoubleClick={() => defaultValue !== undefined && set(defaultValue)}
      >
        {TICKS.map((a) => (
          <span key={a} className={`knob-tick${a <= angle ? ' on' : ''}`} style={{ '--a': `${a}deg` } as React.CSSProperties} />
        ))}
        <span className="knob-body" />
        <span className="knob-mark" />
      </div>
    </div>
  );
}

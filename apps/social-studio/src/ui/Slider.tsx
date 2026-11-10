import type { CSSProperties } from 'react';
import { NumberField } from './NumberField';
import { useSliderGesture } from './sliderGesture';

/** Füllanteil der Bahn in Prozent (0 bis 100, begrenzt); bei leerem Bereich (min = max) oder NaN 0. */
export function fillPercent(value: number, min: number, max: number): number {
  const p = ((value - min) / (max - min)) * 100;
  if (!(max > min) || Number.isNaN(p)) return 0;
  return Math.min(100, Math.max(0, p));
}

/**
 * Der Regler des Editors: Bahn mit Füllung und Skalenstrichen, eckiger Griff mit Akzentstrich (eigenes Element über dem nativen Regler), Zahlenfeld mit Einheit rechts, Doppelklick setzt `defaultValue`.
 * Eine Zieh- oder Tastengeste = ein Undo-Schritt (useSliderGesture); Zahlenfeld und Zurücksetzen sind je ein Schritt.
 */
export function Slider({ label, tip, value, min, max, step = 1, defaultValue, format, unit, disabled, variant = 'long', center, onChange }: {
  label: string;
  /** Tooltip am Regler. */
  tip?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** Doppelklick auf den Regler setzt diesen Wert. Ohne Angabe gibt es kein Zurücksetzen. */
  defaultValue?: number;
  /** Text für Screenreader (aria-valuetext); Standard: Wert mit Einheit. */
  format?: (v: number) => string;
  /** Einheit rechts neben dem Zahlenfeld, z. B. «%». */
  unit?: string;
  disabled?: boolean;
  /** «short»: kürzere Bahn (Zahlenfeld rückt näher). */
  variant?: 'long' | 'short';
  /** Nullstelle in der Mitte: Füllung läuft von der Mitte zum Griff, Beschriftungen an beiden Enden. */
  center?: { low: string; high: string };
  onChange(v: number): void;
}) {
  const gesture = useSliderGesture();
  const at = fillPercent(value, min, max);
  const zero = fillPercent(0, min, max);
  const text = (format ?? ((v: number) => `${String(v).replace('-', '−')}${unit ? ` ${unit}` : ''}`))(value);
  return (
    <fieldset className={`choice slider slider-${variant}${center ? ' slider-center' : ''}`} data-tip={tip}>
      <legend>{label}</legend>
      <span className="slider-row">
        <span className="slider-track slider-ticks">
          <input
            type="range"
            className="slider-input"
            style={{ '--lo': center ? Math.min(zero, at) : 0, '--hi': center ? Math.max(zero, at) : at } as CSSProperties}
            aria-label={label}
            aria-valuetext={text}
            aria-description={tip}
            min={min}
            max={max}
            step={step}
            value={value}
            disabled={disabled}
            {...gesture}
            onChange={(e) => onChange(e.target.valueAsNumber)}
            onDoubleClick={() => defaultValue !== undefined && value !== defaultValue && onChange(defaultValue)}
          />
          {/* Griff des Entwurfs als eigenes Element: in jedem Browser gleich (der Griff des Browsers ist unsichtbar, siehe slider.css) */}
          <span className="slider-thumb" aria-hidden="true" style={{ '--at': at } as CSSProperties} />
          {center && (
            <span className="slider-ends" aria-hidden="true">
              <span>{center.low}</span>
              <span>{center.high}</span>
            </span>
          )}
        </span>
        <span className="slider-field">
          <NumberField label={label} value={value} min={min} max={max} step={step} disabled={disabled} roll onCommit={onChange} />
          <span className="slider-unit" aria-hidden="true">{unit}</span>
        </span>
      </span>
    </fieldset>
  );
}

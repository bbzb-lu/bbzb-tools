import { useId, useRef } from 'react';
import { SlideHighlight } from './SlideHighlight';
import { useSlidingHighlight } from './slide';

/** Segmentierte Auswahl (Radiogruppe): eine Wahl = ein onChange. */
export function Segmented<T extends string>({ legend, value, options, onChange, hint, disabled }: {
  legend: string;
  value: T;
  options: [T, string][];
  onChange(v: T): void;
  /** Erklärung unter der Auswahl, hängt als Beschreibung an jeder Option. */
  hint?: string;
  disabled?: boolean;
}) {
  const name = useId();
  const hintId = `${name}-hint`;
  const host = useRef<HTMLDivElement>(null);
  useSlidingHighlight(host, 'label:has(input:checked)');
  return (
    <fieldset className="choice">
      <legend>{legend}</legend>
      <div className="segmented" ref={host}>
        {options.map(([v, label]) => (
          <label key={v}>
            <input type="radio" name={name} aria-describedby={hint ? hintId : undefined} checked={value === v} disabled={disabled} onChange={() => onChange(v)} />
            <span>{label}</span>
          </label>
        ))}
        <SlideHighlight cls="segmented">
          {options.map(([v, label]) => (
            <label key={v}>
              <span className={value === v ? 'sel' : undefined} data-t={label} />
            </label>
          ))}
        </SlideHighlight>
      </div>
      {hint && <p id={hintId} className="hint muted">{hint}</p>}
    </fieldset>
  );
}

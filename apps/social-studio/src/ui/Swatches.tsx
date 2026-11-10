import { useId } from 'react';
import { akzent, colors, type ColorToken, type PaletteColor } from '../tokens';

const names: Record<ColorToken, string> = {
  blau: 'Blau',
  orange: 'Orange',
  warmweiss: 'Warmweiss',
  blauschwarz: 'Blauschwarz',
};

/**
 * Native Radiogruppe: Pfeiltasten und Screenreader ohne eigenen Code. `accent` (aufgelöster Hexwert) gibt es nur im
 * standortabhängigen Projekt und zeigt die Kachel «Akzent»; ohne sie gilt der Wert «akzent» als Orange (fixer Modus).
 */
export function Swatches({ legend, value, accent, onChange }: {
  legend: string;
  value: PaletteColor;
  accent?: string;
  onChange(c: ColorToken | typeof akzent): void;
}) {
  const name = useId();
  return (
    <fieldset className="choice">
      <legend>{legend}</legend>
      <div className="swatches">
        {accent !== undefined && (
          <label className="swatch swatch-accent" style={{ background: accent }} data-tip="Akzent">
            <input type="radio" name={name} aria-label="Akzent" checked={value === akzent} onChange={() => onChange(akzent)} />
          </label>
        )}
        {(Object.keys(colors) as ColorToken[]).map((c) => (
          <label key={c} className="swatch" style={{ background: colors[c] }} data-tip={names[c]}>
            <input type="radio" name={name} aria-label={names[c]} checked={value === c || (c === 'orange' && value === akzent && accent === undefined)} onChange={() => onChange(c)} />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

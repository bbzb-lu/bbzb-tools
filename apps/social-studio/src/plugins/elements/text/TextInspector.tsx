import { useAccentTile } from '../../../canvas/accent';
import { renameForStyle } from '../../../model/elements';
import type { Element } from '../../../model/types';
import { apply } from '../../../store/document';
import { textAdjust, textStyles } from '../../../tokens';
import { Segmented } from '@bbzb/ui';
import { OpacitySlider } from '../../../ui/OpacitySlider';
import { Section } from '../../../ui/Section';
import { Slider } from '../../../ui/Slider';
import { Swatches } from '../../../ui/Swatches';
import { measureTextHeight } from './measure';
import type { TextProps } from './schema';

const MIN = 8;
const MAX = 600;

/** Ein apply: Props ändern, Höhe neu messen, bei Stilwechsel den automatischen Ebenennamen mitnehmen. */
function setProps(id: string, patch: Partial<TextProps>) {
  apply((d) => {
    const e = d.elements[id] as Element<TextProps>;
    const from = e.props.style;
    Object.assign(e.props, patch);
    e.height = measureTextHeight(e.props, e.width);
    if (patch.style) e.name = renameForStyle(e.name, from, patch.style);
  });
}

export function TextInspector({ el }: { el: Element<TextProps> }) {
  const { id, props } = el;
  const accent = useAccentTile(el);
  const lineHeight = props.lineHeight ?? 100;
  const tracking = props.tracking ?? 0;
  const base = Math.round(textStyles[props.style].letterSpacingEm * 1000);
  const setSize = (v: number) => {
    if (v !== props.fontSize) setProps(id, { fontSize: v });
  };

  return (
    <Section heading="Darstellung" id="darstellung-text" collapsible defaultOpen>
      <p className="muted hint">Doppelklick auf der Leinwand bearbeitet den Text.</p>
      <OpacitySlider el={el} />
      <Swatches legend="Farbe" accent={accent} value={props.color} onChange={(color) => setProps(id, { color })} />
      <Segmented
        legend="Stil"
        value={props.style}
        options={[['titel', 'Titel'], ['kommentar', 'Kommentar']]}
        onChange={(style) => setProps(id, { style, fontSize: textStyles[style].defaultSize, lineHeight: undefined, tracking: undefined })}
      />
      <Slider
        label="Grösse"
        value={props.fontSize}
        min={MIN}
        max={MAX}
        defaultValue={textStyles[props.style].defaultSize}
        onChange={setSize}
      />
      <Slider
        label="Zeilenabstand"
        value={lineHeight}
        {...textAdjust.lineHeight}
        defaultValue={100}
        unit="%"
        onChange={(v) => v !== lineHeight && setProps(id, { lineHeight: v })}
      />
      {/* Anzeige = Stilwert + Abweichung in 1/1000 em (wie bisher); gespeichert wird nur die Abweichung */}
      <Slider
        label="Laufweite"
        value={base + tracking}
        min={base + textAdjust.tracking.min}
        max={base + textAdjust.tracking.max}
        defaultValue={base}
        onChange={(v) => v - base !== tracking && setProps(id, { tracking: v - base })}
      />
      <Segmented
        legend="Ausrichtung"
        value={props.align}
        options={[['left', 'Links'], ['center', 'Mitte'], ['right', 'Rechts']]}
        onChange={(align) => setProps(id, { align })}
      />
    </Section>
  );
}

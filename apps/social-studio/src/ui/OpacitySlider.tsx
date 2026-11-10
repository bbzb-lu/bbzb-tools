import type { Element } from '../model/types';
import { patchElement } from './actions';
import { Slider } from './Slider';

/** Deckkraft des Elements. Sperren und Ausblenden stehen im Ebenen-Panel. */
export function OpacitySlider({ el }: { el: Element }) {
  return (
    <Slider
      label="Deckkraft"
      value={Math.round(el.opacity * 100)}
      min={0}
      max={100}
      defaultValue={100}
      unit="%"
      disabled={el.locked}
      onChange={(v) => patchElement(el.id, { opacity: v / 100 })}
    />
  );
}

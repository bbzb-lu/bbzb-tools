import { IconFlipHorizontal } from '@tabler/icons-react';
import { useAccentTile } from '../../../canvas/accent';
import type { Element } from '../../../model/types';
import { apply } from '../../../store/document';
import { OpacitySlider } from '../../../ui/OpacitySlider';
import { Section } from '../../../ui/Section';
import { Swatches } from '../../../ui/Swatches';
import type { BrandProps } from './schema';

/** Jede Änderung ein apply = ein Undo-Schritt. */
const setProps = (id: string, patch: Partial<BrandProps>) =>
  apply((d) => void Object.assign((d.elements[id] as Element<BrandProps>).props, patch));

/** Spiegeln steht in der Zeile «Ebene» neben Duplizieren und Löschen. */
export function BrandLayerActions({ el }: { el: Element<BrandProps> }) {
  const flip = el.props.flipX ?? false;
  return (
    <button type="button" className="icon-btn" aria-label="Spiegeln" data-tip="Spiegeln" aria-pressed={flip} onClick={() => setProps(el.id, { flipX: !flip })}>
      <IconFlipHorizontal aria-hidden="true" />
    </button>
  );
}

export function BrandInspector({ el }: { el: Element<BrandProps> }) {
  const accent = useAccentTile(el);
  return (
    <Section heading="Darstellung" collapsible defaultOpen>
      <OpacitySlider el={el} />
      <Swatches legend="Farbe" accent={accent} value={el.props.color} onChange={(color) => setProps(el.id, { color })} />
    </Section>
  );
}

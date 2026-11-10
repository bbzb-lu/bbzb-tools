import { IconFrame, IconGrain } from '@tabler/icons-react';
import type { Element } from '../../../model/types';
import type { Scrim } from '../../../model/scrim';
import { apply } from '../../../store/document';
import { EffectRow, EffectsSection, openSections, type EffectEntry } from '../../../ui/EffectsSection';
import { addScrim, GrainKnob, scrimEntry, scrimRows } from '../../../ui/SlideEffects';
import { grainDefault } from '../../../model/grain';
import { toggleFrame } from './frame';
import { frameOf, grainOf, isVideo, scrimsOf, type PhotoProps } from './schema';
import { setProps } from './setProps';

/** Verläufe: immer die ganze Liste als `scrims`, ein altes Einzelfeld `scrim` fällt im selben apply weg (ein Undo-Schritt). */
const setScrims = (id: string, next: Scrim[]) =>
  apply((d) => {
    const props = (d.elements[id] as Element<PhotoProps>).props;
    delete props.scrim;
    if (next.length) props.scrims = next;
    else delete props.scrims;
  });

/** Korn aus: die Stärke fällt mit weg, neu hinzugefügt gilt wieder der Standard (ein Undo-Schritt). */
const removeGrain = (id: string) =>
  apply((d) => {
    const props = (d.elements[id] as Element<PhotoProps>).props;
    props.grain = false;
    delete props.grainStrength;
  });

/**
 * «Effekte» am Foto: Rahmen (nicht am Video), Korn und Verläufe über «+». Beim leeren Platzhalter (`empty`) nur der Rahmen:
 * er gehört zum Layout, Korn und Verläufe kommen mit dem Bild.
 */
export function PhotoEffects({ el, empty = false }: { el: Element<PhotoProps>; empty?: boolean }) {
  const vid = isVideo(el.props);
  const frame = frameOf(el.props);
  const grain = !empty && grainOf(el.props);
  const scrims = empty ? [] : scrimsOf(el.props);
  const set = (next: Scrim[]) => setScrims(el.id, next);
  const entries: EffectEntry[] = [
    ...(vid ? [] : [{ id: 'rahmen', label: 'Rahmen', hint: 'Rand ums Foto', active: frame }]),
    ...(empty ? [] : [{ id: 'korn', label: 'Korn', hint: 'Filmkörnung', active: grain }, scrimEntry(scrims)]),
  ];
  const add = (id: string) => {
    if (id === 'verlauf') return addScrim(scrims, set);
    if (id === 'rahmen') toggleFrame(el.id);
    else setProps(el.id, { grain: true });
    openSections('Effekte', `effekt-${id}`);
  };
  const rows = [
    !vid && frame && (
      <EffectRow key="rahmen" id="effekt-rahmen" icon={<IconFrame aria-hidden="true" />} label="Rahmen" onRemove={() => toggleFrame(el.id)}>
        <p className="muted hint">Warmweisser Rand mit Schatten um das Foto.</p>
      </EffectRow>
    ),
    grain && (
      <EffectRow key="korn" id="effekt-korn" icon={<IconGrain aria-hidden="true" />} label="Korn" onRemove={() => removeGrain(el.id)}>
        <GrainKnob value={el.props.grainStrength ?? grainDefault.foto} defaultValue={grainDefault.foto} onChange={(v) => setProps(el.id, { grainStrength: v })} />
      </EffectRow>
    ),
    ...scrimRows(scrims, set),
  ].filter(Boolean);
  return (
    <EffectsSection entries={entries} onAdd={add}>
      {rows.length ? rows : undefined}
    </EffectsSection>
  );
}

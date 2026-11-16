import { IconContrast, IconGrain } from '@tabler/icons-react';
import type { Scrim, ScrimSide } from '../model/scrim';
import { grainDefault } from '../model/grain';
import { useDoc } from '../store/document';
import { useUi } from '../store/ui';
import { scrim } from '../tokens';
import { tryApply } from './actions';
import { EffectRow, EffectsSection, openSections, type EffectEntry } from './EffectsSection';
import { Knob } from './kit/Knob';
import { ScrimFields, SIDE } from './ScrimFields';

/** Neue Verläufe nehmen die erste freie Seite in dieser Reihenfolge; gewechselt wird in der Zeile. */
const ORDER: ScrimSide[] = ['unten', 'oben', 'links', 'rechts', 'untenLinks', 'untenRechts', 'obenLinks', 'obenRechts'];

/** Eintrag «Verlauf» der Effekt-Auswahl (Slide und Foto): mehrfach, höchstens `scrim.max`. */
export const scrimEntry = (scrims: Scrim[]): EffectEntry => ({
  id: 'verlauf', icon: <IconContrast aria-hidden="true" />, label: 'Verlauf', hint: 'Dunkler Rand', active: scrims.length > 0, multi: true, limit: scrims.length >= scrim.max ? `Höchstens ${scrim.max} Verläufe` : undefined,
});

/** Neuer Verlauf an der ersten freien Seite, aufgeklappt; `set` bekommt die ganze Liste (ein Undo-Schritt). */
export function addScrim(scrims: Scrim[], set: (next: Scrim[]) => void) {
  const side = ORDER.find((o) => !scrims.some((s) => s.side === o));
  if (!side || scrims.length >= scrim.max) return;
  set([...scrims, { side, strength: 'mittel' }]);
  openSections('Effekte', `effekt-verlauf-${scrims.length}`);
}

/** Je Verlauf eine Zeile mit Seite, Farbe, Stärke und Reichweite. */
export const scrimRows = (scrims: Scrim[], set: (next: Scrim[]) => void) =>
  scrims.map((s, k) => (
    <EffectRow key={`verlauf-${k}`} id={`effekt-verlauf-${k}`} icon={<IconContrast aria-hidden="true" />} label={`Verlauf ${SIDE[s.side][0]}`} onRemove={() => {
      set(scrims.filter((_, n) => n !== k));
      useUi.getState().shiftSections('effekt-verlauf-', k, scrims.length);
    }}>
      <ScrimFields scrim={s} taken={scrims.map((o) => o.side)} onChange={(patch) => set(scrims.map((o, n) => (n === k ? { ...o, ...patch } : o)))} />
    </EffectRow>
  ));

/** Korn-Stärke (Slide und Foto): Drehregler 0 bis 100 % Overlay, Doppelklick = Standard, eine Geste = ein Undo-Schritt. */
export const GrainKnob = (p: { value: number; defaultValue: number; onChange(v: number): void }) => <Knob label="Stärke" name="Korn Stärke" min={0} max={100} unit="%" {...p} />;

/** Effekte der Slide: Korn (einmal) und Verlauf (bis `scrim.max`). */
export function SlideEffects({ index: i }: { index: number }) {
  const slide = useDoc((s) => s.project!.slides[i]!);
  const scrims = slide.scrims ?? [];
  const set = (next: Scrim[]) =>
    tryApply((d) => {
      const s = d.slides[i]!;
      if (next.length) s.scrims = next;
      else delete s.scrims; // fehlt = keine, wie eine neue Slide
    });
  const entries: EffectEntry[] = [{ id: 'korn', icon: <IconGrain aria-hidden="true" />, label: 'Korn', hint: 'Filmkörnung', active: !!slide.grain }, scrimEntry(scrims)];
  const add = (id: string) => {
    if (id !== 'korn') return addScrim(scrims, set);
    tryApply((d) => void (d.slides[i]!.grain = true));
    openSections('Effekte', 'effekt-korn');
  };
  const rows = [
    slide.grain && (
      <EffectRow
        key="korn"
        id="effekt-korn"
        icon={<IconGrain aria-hidden="true" />}
        label="Korn"
        onRemove={() =>
          tryApply((d) => {
            d.slides[i]!.grain = false;
            delete d.slides[i]!.grainStrength; // neu hinzugefügt = wieder Standard
          })
        }
      >
        <GrainKnob value={slide.grainStrength ?? grainDefault.flaeche} defaultValue={grainDefault.flaeche} onChange={(v) => tryApply((d) => void (d.slides[i]!.grainStrength = v))} />
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

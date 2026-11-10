import { IconArrowDown, IconArrowDownLeft, IconArrowDownRight, IconArrowLeft, IconArrowRight, IconArrowUp, IconArrowUpLeft, IconArrowUpRight } from '@tabler/icons-react';
import type { Icon } from '@tabler/icons-react';
import { useId } from 'react';
import type { Scrim, ScrimSide } from '../model/scrim';
import { scrim as scrimTokens } from '../tokens';
import { Segmented } from './kit/Segmented';
import { Slider } from './Slider';

export const SIDE: Record<ScrimSide, [string, Icon]> = {
  obenLinks: ['Oben links', IconArrowUpLeft],
  oben: ['Oben', IconArrowUp],
  obenRechts: ['Oben rechts', IconArrowUpRight],
  links: ['Links', IconArrowLeft],
  rechts: ['Rechts', IconArrowRight],
  untenLinks: ['Unten links', IconArrowDownLeft],
  unten: ['Unten', IconArrowDown],
  untenRechts: ['Unten rechts', IconArrowDownRight],
};
const STRENGTHS: [Scrim['strength'], string][] = [['leicht', 'Leicht'], ['mittel', 'Mittel'], ['stark', 'Stark']];

/** Farbe, Stärke, Reichweite eines Verlaufs; mit `taken` zusätzlich die Seite zum Wechseln (belegte sind gesperrt). */
export function ScrimFields({ scrim, taken, onChange }: { scrim: Scrim; taken?: ScrimSide[]; onChange(patch: Partial<Scrim>): void }) {
  const reach = scrim.reach ?? scrimTokens.reach.default;
  const sideId = useId();
  return (
    <>
      {taken && (
        <div className="choice">
          <label htmlFor={sideId}>Seite</label>
          <select id={sideId} value={scrim.side} onChange={(e) => onChange({ side: e.target.value as ScrimSide })}>
            {(Object.keys(SIDE) as ScrimSide[]).map((side) => (
              <option key={side} value={side} disabled={side !== scrim.side && taken.includes(side)}>
                {SIDE[side][0]}
              </option>
            ))}
          </select>
        </div>
      )}
      <Segmented legend="Farbe" value={scrim.light ? 'hell' : 'dunkel'} options={[['dunkel', 'Dunkel'], ['hell', 'Hell']]} onChange={(v) => onChange({ light: v === 'hell' || undefined })} />
      <Segmented legend="Stärke" value={scrim.strength} options={STRENGTHS} onChange={(v) => onChange({ strength: v })} />
      <Slider
        label="Reichweite"
        tip="Wie weit der Verlauf hineinreicht."
        value={reach}
        min={scrimTokens.reach.min}
        max={scrimTokens.reach.max}
        defaultValue={scrimTokens.reach.default}
        unit="%"
        onChange={(v) => v !== reach && onChange({ reach: v })}
      />
    </>
  );
}

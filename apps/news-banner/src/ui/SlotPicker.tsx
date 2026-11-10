import { iconSvg, type IconRef } from '../icons/catalog';
import type { Kind, Slot } from '../tokens';
import { Switch } from '@bbzb/ui';

const names: Record<Slot, string> = { left: 'Links', right: 'Rechts', bottom: 'Unten' };

function Preview({ icon }: { icon: IconRef }) {
  const ref = icon.kind === 'image' ? ({ kind: 'lucide', name: 'image' } as const) : icon;
  return <span className="slot-icon" aria-hidden="true" dangerouslySetInnerHTML={{ __html: iconSvg(ref, 'currentColor', 28) }} />;
}

/** Übersicht wie das Banner: links Icon, Mitte Punkt, rechts Icon, darunter das optionale Icon. Wählt, welcher Platz bearbeitet wird. */
export function SlotPicker({ icons, slot, kind, bottomOn, onSlot, onBottomOn }: {
  icons: Record<Slot, IconRef>;
  slot: Slot;
  kind: Kind;
  bottomOn: boolean;
  onSlot(s: Slot): void;
  onBottomOn(v: boolean): void;
}) {
  const tile = (s: Slot) => (
    <button type="button" className="slot-tile" aria-pressed={slot === s} aria-label={`Icon ${names[s].toLowerCase()} bearbeiten`} onClick={() => onSlot(s)}>
      <Preview icon={icons[s]} />
      <span>{names[s]}</span>
    </button>
  );
  return (
    <div className="slots" role="group" aria-label="Welches Icon bearbeiten?">
      <div className="slots-row">
        {tile('left')}
        <img className="slot-dot" src={`${import.meta.env.BASE_URL}badges/${kind}.png`} alt="" />
        {tile('right')}
      </div>
      <div className="slots-bottom">
        <button type="button" className="slot-tile" aria-pressed={slot === 'bottom'} aria-label="Icon unten bearbeiten" onClick={() => onSlot('bottom')}>
          {bottomOn ? <Preview icon={icons.bottom} /> : <span className="slot-icon slot-off" aria-hidden="true" />}
          <span>Unten</span>
        </button>
        <span className="switch-field"><span aria-hidden="true">Zeigen</span><Switch label="Icon unten zeigen" checked={bottomOn} onChange={onBottomOn} /></span>
      </div>
    </div>
  );
}

import { IconBrush, IconEye, IconEyeOff, IconMask, IconPhotoCheck } from '@tabler/icons-react';
import { useUi } from '../../../store/ui';
import { brush } from '../../../tokens';
import { KEYS, keysAttr } from '../../../ui/keys';
import { Slider } from '../../../ui/Slider';

/** Knopf «Maske bearbeiten»: öffnet und schliesst den Pinselmodus am Foto `id`; `busy` (Tooltip) sperrt ihn, z. B. während des Freistellens. */
export function MaskEditButton({ id, busy }: { id: string; busy?: string }) {
  const active = useUi((s) => s.maskEditId === id);
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-disabled={busy !== undefined}
      data-tip={busy ?? 'Mit dem Pinsel ausblenden oder einblenden'}
      onClick={() => busy === undefined && useUi.getState().setMaskEditId(active ? null : id)}
    >
      <IconBrush aria-hidden="true" />
      Maske bearbeiten
    </button>
  );
}

/** Pinselwerte im Pinselmodus: Ausblenden/Einblenden (X), Grösse ([ ] − +), Härte und Ansicht (Folie oder Ergebnis). Ändern nur die Ansicht, nie das Dokument. */
export function BrushControls() {
  const b = useUi((s) => s.brush);
  const set = useUi((s) => s.setBrush);
  const view = useUi((s) => s.maskView);
  const show = (v: typeof view, label: string, tip: string, Icon: typeof IconEye) => (
    <button type="button" aria-pressed={view === v} data-tip={tip} onClick={() => useUi.getState().setMaskView(v)}>
      <Icon aria-hidden="true" />
      {label}
    </button>
  );
  const mode = (m: 'hide' | 'show', label: string, Icon: typeof IconEye) => (
    <button type="button" aria-pressed={b.mode === m} data-tip={label} data-keys={keysAttr(KEYS.brushSwap)} onClick={() => set({ mode: m })}>
      <Icon aria-hidden="true" />
      {label}
    </button>
  );
  return (
    <>
      <div className="tool-grid" role="group" aria-label="Pinsel">
        {mode('hide', 'Ausblenden', IconEyeOff)}
        {mode('show', 'Einblenden', IconEye)}
      </div>
      <Slider
        label="Grösse"
        tip="Kleiner: [ oder −, grösser: ] oder +"
        unit="px"
        value={b.size}
        min={brush.size.min}
        max={brush.size.max}
        defaultValue={brush.size.default}
        onChange={(size) => set({ size })}
      />
      <Slider label="Härte" tip="Weich bis hart" unit="%" value={b.hardness} min={0} max={100} defaultValue={brush.hardness.default} onChange={(hardness) => set({ hardness })} />
      <div className="tool-grid" role="group" aria-label="Ansicht">
        {show('folie', 'Rote Folie', 'Ausgeblendetes rot zeigen', IconMask)}
        {show('ergebnis', 'Ergebnis', 'Foto mit Maske zeigen, Effekte erst nach dem Beenden', IconPhotoCheck)}
      </div>
      <p className="muted hint">Mal auf dem Foto. {view === 'folie' ? 'Rot' : 'Durchsichtig'} ist ausgeblendet. Esc beendet.</p>
    </>
  );
}

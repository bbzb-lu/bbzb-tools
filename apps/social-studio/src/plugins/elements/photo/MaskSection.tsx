import { IconArrowsExchange, IconBlur, IconRestore } from '@tabler/icons-react';
import { useState } from 'react';
import type { Element } from '../../../model/types';
import { useUi } from '../../../store/ui';
import { mask as tokens } from '../../../tokens';
import { Section } from '../../../ui/Section';
import { Slider } from '../../../ui/Slider';
import { BrushControls, MaskEditButton } from './BrushControls';
import { CutoutControls } from './CutoutControls';
import { AI_RUNNING } from './cutoutOps';
import { invertMaskOf, resetMaskOf, softenMaskOf } from './maskOps';
import { maskOf, type PhotoProps } from './schema';

/**
 * Abschnitt «Maske» am Foto (nicht am Video): Hintergrund entfernen, Pinsel (Steuerung erst im Pinselmodus), Umkehren, Zurücksetzen, Weich zeichnen. Pinselwerte sind
 * Ansicht, die Knöpfe ändern die Maske. Während des Freistellens an diesem Foto sind die übrigen Maskenknöpfe gesperrt.
 */
export function MaskSection({ el }: { el: Element<PhotoProps> }) {
  const masking = useUi((s) => s.maskEditId === el.id);
  const [soft, setSoft] = useState<number>(tokens.soften.default);
  const has = maskOf(el.props) !== undefined;
  const busy = useUi((s) => s.ai?.id === el.id) ? AI_RUNNING : undefined;
  // aria-disabled statt disabled: Fokus und Tooltip bleiben
  const act = (run: () => void, tip: string, enabled = true) => {
    const ok = enabled && !busy;
    return { 'aria-disabled': !ok, 'data-tip': busy ?? (enabled ? tip : 'Noch keine Maske'), onClick: () => ok && run() };
  };
  return (
    <Section heading="Maske" collapsible>
      <CutoutControls id={el.id} props={el.props} />
      <MaskEditButton id={el.id} busy={busy} />
      <div className={masking ? 'mask-nested' : 'mask-flat'}>
        {masking && <BrushControls />}
        <div className="mask-sep" aria-hidden="true" />
        <div className="tool-grid">
          <button type="button" aria-label="Maske umkehren" {...act(() => void invertMaskOf(el.id), 'Ausgeblendetes zeigen, Sichtbares ausblenden')}>
            <IconArrowsExchange aria-hidden="true" />
            Umkehren
          </button>
          <button type="button" aria-label="Maske zurücksetzen" {...act(() => resetMaskOf(el.id), 'Foto wieder ganz zeigen', has)}>
            <IconRestore aria-hidden="true" />
            Zurücksetzen
          </button>
        </div>
        <Slider label="Weiche Kante" tip="Wie weit die Kanten auslaufen" min={tokens.soften.min} max={tokens.soften.max} value={soft} defaultValue={tokens.soften.default} onChange={setSoft} />
        <button type="button" {...act(() => void softenMaskOf(el.id, soft), 'Kanten der Maske weich machen', has)}>
          <IconBlur aria-hidden="true" />
          Maske weich zeichnen
        </button>
      </div>
    </Section>
  );
}

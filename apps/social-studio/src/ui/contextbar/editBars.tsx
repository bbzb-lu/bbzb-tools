import { IconBrush, IconCrop, IconTypography } from '@tabler/icons-react';
import { barRank } from '../../core/registries';
import type { ContextBarState } from '../../core/types';
import { useUi } from '../../store/ui';
import { brush as tokens } from '../../tokens';
import { ContextBar } from '../ContextBar';
import { Segmented } from '@bbzb/ui';
import { Slider } from '../Slider';

function CropBar() {
  const id = useUi((s) => s.cropEditId)!;
  return <ContextBar ids={[id]} label="Ausschnitt" icon={<IconCrop aria-hidden="true" />} hint="Ziehen verschiebt das Bild, das Mausrad zoomt. Esc beendet." onDone={() => useUi.getState().setCropEditId(null)} />;
}

function MaskBar() {
  const id = useUi((s) => s.maskEditId)!;
  const b = useUi((s) => s.brush);
  const set = useUi((s) => s.setBrush);
  return (
    <ContextBar ids={[id]} label="Maske" icon={<IconBrush aria-hidden="true" />} onDone={() => useUi.getState().setMaskEditId(null)}>
      <Segmented legend="Modus" value={b.mode} options={[['hide', 'Ausblenden'], ['show', 'Einblenden']]} onChange={(mode) => set({ mode })} />
      <Slider label="Grösse" tip="Kleiner: [ oder −, grösser: ] oder +" variant="short" unit="px" value={b.size} min={tokens.size.min} max={tokens.size.max} defaultValue={tokens.size.default} onChange={(size) => set({ size })} />
      <Slider label="Härte" variant="short" unit="%" value={b.hardness} min={0} max={100} defaultValue={tokens.hardness.default} onChange={(hardness) => set({ hardness })} />
    </ContextBar>
  );
}

/** «Fertig» nimmt denselben Weg wie ein Klick daneben: das Textfeld verliert den Fokus und übernimmt. */
const finishText = () => {
  const ta = document.querySelector<HTMLTextAreaElement>('.text-edit');
  if (ta) ta.blur();
  else useUi.getState().setTextEditId(null);
};

function TextBar() {
  const id = useUi((s) => s.textEditId)!;
  return <ContextBar ids={[id]} label="Text" icon={<IconTypography aria-hidden="true" />} hint="Strg + Enter übernimmt, Esc verwirft" onDone={finishText} />;
}

const ui = useUi.getState;

/** Bearbeitungsmodi am Element: Ausschnitt, Maske, Text. */
export const editBars: ContextBarState[] = [
  { id: 'crop', rank: barRank.crop, active: () => !!ui().cropEditId, Bar: CropBar },
  { id: 'mask', rank: barRank.mask, active: () => !!ui().maskEditId, Bar: MaskBar },
  { id: 'text', rank: barRank.text, active: () => !!ui().textEditId, Bar: TextBar },
];

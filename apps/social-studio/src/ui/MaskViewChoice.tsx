import { Segmented } from '@bbzb/ui';
import { useUi } from '../store/ui';

/** Ansicht im Pinselmodus: «Rote Folie» (Ausgeblendetes rot) oder «Ergebnis» (Foto mit Maske und Effekten, gerechnet am Strichende). Inspector und Kontextleiste teilen sie. */
export function MaskViewChoice() {
  const view = useUi((s) => s.maskView);
  return <Segmented legend="Ansicht" value={view} options={[['folie', 'Rote Folie'], ['ergebnis', 'Ergebnis']]} onChange={(v) => useUi.getState().setMaskView(v)} />;
}

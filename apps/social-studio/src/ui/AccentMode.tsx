import { apply, useDoc } from '../store/document';
import { Segmented } from '@bbzb/ui';

/** Akzentfarbe des Projekts: fix Orange oder die Farbe des Schulhauses. Eine Wahl = ein apply = ein Undo-Schritt. */
export function AccentMode() {
  const mode = useDoc((s) => s.project!.accentMode ?? 'fix');
  return (
    <div className="accent-section">
      <Segmented
        legend="Akzentfarbe"
        value={mode}
        options={[['fix', 'Fixe Akzentfarbe'], ['standort', 'Standortabhängig']]}
        onChange={(m) => apply((d) => void (d.accentMode = m))}
      />
      <p className="muted hint">Standortabhängig: Schul-Tag, CTA, Scribbles und Icons folgen dem gewählten Schulhaus.</p>
    </div>
  );
}

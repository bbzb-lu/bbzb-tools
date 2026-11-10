import { apply, useDoc } from '../store/document';
import { exportQuality, type ExportQuality } from '../tokens';
import { Segmented } from '@bbzb/ui';

const LABELS: [ExportQuality, string][] = [['klein', 'Klein'], ['standard', 'Standard'], ['hoch', 'Hoch']];

/** Exportqualität des Projekts: Video-Bitrate und JPEG-Qualität. Eine Wahl = ein apply = ein Undo-Schritt. */
export function ExportQualityChoice() {
  const q = useDoc((s) => s.project!.exportQuality ?? 'standard');
  const { bitrate, jpeg } = exportQuality[q];
  return (
    <div className="accent-section">
      <Segmented legend="Exportqualität" value={q} options={LABELS} onChange={(v) => apply((d) => void (d.exportQuality = v))} />
      <p className="muted hint">
        Video etwa {Math.round((bitrate * 60) / 8 / 1e6)} MB pro Minute, JPEG {Math.round(jpeg * 100)} %. Höher heisst schärfer, aber grössere Dateien.
      </p>
    </div>
  );
}

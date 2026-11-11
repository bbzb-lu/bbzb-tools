import { IconInfoCircle, IconLayersSelected, IconSticker2, IconWand, IconX } from '@tabler/icons-react';
import { useDoc } from '../../../store/document';
import { useUi } from '../../../store/ui';
import { cutout } from '../../../tokens';
import { AI_RUNNING, cancelRemoveBackground, removeBackground } from './cutoutOps';
import { maskOf, type PhotoProps } from './schema';
import { NO_MASK, NO_TITLE, copyAsSticker, copyBehindTitle, titleOf } from './stickerOps';

/**
 * «Hintergrund entfernen» zuoberst im Abschnitt «Maske». Während des Laufs an diesem Foto steht darüber eine Statuszeile und der Knopf
 * wird zu «Abbrechen»: derselbe Knopf, damit der Fokus beim Start und am Ende nicht verloren geht.
 */
export function CutoutControls({ id, props }: { id: string; props: PhotoProps }) {
  const hasTitle = useDoc((s) => titleOf(s.project, id) !== undefined);
  const ai = useUi((s) => s.ai);
  const running = ai?.id === id;
  const other = ai !== undefined && !running;
  // Gründe in der Reihenfolge, die der Nutzer zuerst beheben muss; aria-disabled statt disabled, damit Fokus und Tooltip bleiben
  const why = (needs: boolean, tip: string, reason: string) => {
    const block = running ? AI_RUNNING : !needs ? reason : undefined;
    return { 'aria-disabled': block !== undefined, 'data-tip': block ?? tip };
  };
  const masked = maskOf(props) !== undefined;
  const reason = running ? AI_RUNNING : !masked ? NO_MASK : !hasTitle ? NO_TITLE : undefined;
  const phase = !running ? '' : ai.phase === 'download' ? `Modell wird geladen, einmalig ca. ${cutout.model.downloadMB} MB` : 'Foto wird freigestellt …';
  return (
    <>
      {/* Angesagt wird über die gemeinsame Live-Region der Kontextleisten (eine Ansage, auch wenn etwas anderes gewählt ist) */}
      {running && (
        <p className="muted hint">
          {phase}
          {ai.phase === 'download' && `, ${Math.round(ai.fraction * 100)} %`}
        </p>
      )}
      {running && ai.phase === 'download' && (
        <span className="ai-bar" aria-hidden="true">
          <span style={{ width: `${Math.round(ai.fraction * 100)}%` }} />
        </span>
      )}
      {running ? (
        // detail > 1: der zweite Klick eines Doppelklicks auf «Hintergrund entfernen» bricht nicht gleich wieder ab
        <button type="button" className="mask-main" data-tip="Freistellen abbrechen, das Foto bleibt, wie es war" onClick={(e) => e.detail < 2 && cancelRemoveBackground()}>
          <IconX aria-hidden="true" />
          Abbrechen
        </button>
      ) : (
        <button
          type="button"
          className="mask-main"
          aria-disabled={other}
          data-tip={other ? 'Eine Freistellung läuft schon' : 'Motiv erkennen und den Hintergrund ausblenden'}
          onClick={() => !other && void removeBackground(id)}
        >
          <IconWand aria-hidden="true" />
          Hintergrund entfernen
        </button>
      )}
      <button type="button" {...why(masked, 'Freigestelltes Foto als eigene Ebene zum Verschieben kopieren', NO_MASK)} onClick={() => masked && !running && copyAsSticker(id)}>
        <IconSticker2 aria-hidden="true" />
        Als Sticker kopieren
      </button>
      <button
        type="button"
        {...why(masked && hasTitle, 'Das Motiv als Kopie direkt über den Titel legen', masked ? NO_TITLE : NO_MASK)}
        onClick={() => masked && hasTitle && !running && copyBehindTitle(id)}
      >
        <IconLayersSelected aria-hidden="true" />
        Motiv vor Titel
      </button>
      {/* Grund sichtbar unter den gesperrten Knöpfen (wie im Entwurf), zusätzlich zum Tooltip */}
      {reason && (
        <p className="muted hint reason">
          <IconInfoCircle aria-hidden="true" />
          {reason}
        </p>
      )}
    </>
  );
}

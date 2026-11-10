import { IconMovie, IconPlayerPlay, IconPlayerStop, IconVolume, IconVolumeOff, IconWand, IconX } from '@tabler/icons-react';
import { barRank } from '../../../core/registries';
import type { ContextBarState } from '../../../core/types';
import type { Element } from '../../../model/types';
import { useDoc } from '../../../store/document';
import { useUi, type AiRun } from '../../../store/ui';
import { cutout, video } from '../../../tokens';
import { ContextBar } from '../../../ui/ContextBar';
import { cancelRemoveBackground } from './cutoutOps';
import { isVideo, type PhotoProps } from './schema';
import { startPreview, stopPreview, usePlaying } from './usePreview';
import { saveVideo } from './VideoSection';

/** KI läuft (Freistellen): dieselben Daten wie die Statuszeile im Abschnitt «Maske» (`ui.ai`). Bleibt stehen, auch wenn etwas anderes gewählt ist. */
const aiText = (ai: AiRun) => (ai.phase === 'download' ? `Modell wird geladen, einmalig ca. ${cutout.model.downloadMB} MB` : 'Hintergrund wird entfernt');

function AiBar() {
  const ai = useUi((s) => s.ai)!;
  // angesagt über die gemeinsame Live-Region der Leisten (announce), hier nur sichtbar
  return (
    <ContextBar ids={[ai.id]} label="Freistellen" icon={<IconWand aria-hidden="true" />} hint={aiText(ai)}>
      {/* Balken nur beim Laden des Modells (beim Rechnen kommt kein Fortschritt); er folgt dem Store, der nur bei neuem Prozent schreibt */}
      {ai.phase === 'download' && (
        <span className="context-bar-progress" aria-hidden="true">
          <span style={{ transform: `scaleX(${ai.fraction})` }} />
        </span>
      )}
      <button type="button" data-tip="Freistellen abbrechen, das Foto bleibt, wie es war" onClick={cancelRemoveBackground}>
        <IconX aria-hidden="true" />
        Abbrechen
      </button>
    </ContextBar>
  );
}

const selectedVideo = (): Element<PhotoProps> | undefined => {
  const id = useUi.getState().selectedId;
  const el = id ? useDoc.getState().project?.elements[id] : undefined;
  return el?.type === 'photo' && isVideo(el.props as PhotoProps) ? (el as Element<PhotoProps>) : undefined;
};

/** Genau ein Video gewählt: Vorschau, Ton und Länge des Ausschnitts wie im Abschnitt «Video». */
function VideoBar() {
  const id = useUi((s) => s.selectedId)!;
  const vid = useDoc((s) => (s.project?.elements[id]?.props as PhotoProps | undefined)?.video);
  const playing = usePlaying(id);
  if (!vid) return null;
  const length = vid.end - vid.start;
  return (
    <ContextBar
      ids={[id]}
      label="Video"
      icon={<IconMovie aria-hidden="true" />}
      hint={`${length.toFixed(1).replace('.', ',')} s${length > video.maxSlideSeconds ? `. Der Export kürzt auf ${video.maxSlideSeconds} s` : ''}`}
    >
      <button type="button" data-tip={playing ? 'Vorschau anhalten' : 'Gekürztes Stück in Schleife abspielen'} onClick={() => (playing ? stopPreview(id) : startPreview(id))}>
        {playing ? <IconPlayerStop aria-hidden="true" /> : <IconPlayerPlay aria-hidden="true" />}
        {playing ? 'Stopp' : 'Vorschau'}
      </button>
      <button type="button" aria-pressed={vid.sound} data-tip="Ton im Export und in der Vorschau" onClick={() => saveVideo(id, { ...vid, sound: !vid.sound })}>
        {vid.sound ? <IconVolume aria-hidden="true" /> : <IconVolumeOff aria-hidden="true" />}
        Ton
      </button>
    </ContextBar>
  );
}

export const aiBar: ContextBarState = { id: 'ai', rank: barRank.ai, active: () => !!useUi.getState().ai, announce: () => aiText(useUi.getState().ai!), Bar: AiBar };
export const videoBar: ContextBarState = { id: 'video', rank: barRank.video, active: () => !!selectedVideo(), Bar: VideoBar };

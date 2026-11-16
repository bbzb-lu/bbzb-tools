import { AiMissingError, AiNetworkError } from '../../../ai/segmentClient';
import { hasSubject, maskFromAlpha } from '../../../ai/toMask';
import { aiTools } from '../../../core/registries';
import { maskSize } from '../../../model/mask';
import type { Element } from '../../../model/types';
import { opfsAssetStore } from '../../../storage/assets';
import { useDoc } from '../../../store/document';
import { useUi } from '../../../store/ui';
import { cutout } from '../../../tokens';
import { errorText } from '../../../ui/errors';
import { AI_DROPPED, setMaskFromAi } from './maskOps';
import { isVideo, maskOf, type PhotoProps } from './schema';

export const NO_SUBJECT = 'Kein Motiv gefunden. Die Maske bleibt, wie sie war.';
export const AI_NETWORK = `Modell nicht erreichbar. Prüf die Verbindung oder frag die IT, ob ${new URL(cutout.model.host).host} und ${cutout.model.storageHost} freigegeben sind.`;
export const AI_MISSING = 'Das KI-Modell wurde nicht gefunden. Das liegt an der App, nicht an deinem Netz. Bitte melde es über das Feedback-Formular.';
/** Grund für gesperrte Maskenknöpfe und Menüeinträge des Fotos, das gerade freigestellt wird. */
export const AI_RUNNING = 'Die Freistellung läuft noch';
export const AI_FAILED = 'Das Freistellen hat nicht geklappt. Versuch es nochmals.';

const photoOf = (id: string) => useDoc.getState().project?.elements[id] as Element<PhotoProps> | undefined;
let ctl: AbortController | undefined;

/** Bricht den laufenden Lauf ab: das Foto bleibt unberührt, keine Meldung. */
export const cancelRemoveBackground = (): void => ctl?.abort();

/**
 * Hintergrund des Fotos `id` entfernen: Originalbild aus OPFS ans Werkzeug «freistellen», Alpha auf die Maskengrösse des Fotos,
 * als Maske schreiben (ein Undo-Schritt, ersetzt eine vorhandene). Höchstens ein Lauf zugleich; ein zweiter Aufruf tut nichts.
 * Wurde das Foto unterwegs gelöscht, ersetzt oder seine Maske geändert, wird das Ergebnis verworfen (Meldung).
 */
export async function removeBackground(id: string): Promise<void> {
  const ui = useUi.getState();
  const project = useDoc.getState().project;
  const el = photoOf(id);
  const assetId = el?.props.assetId;
  const meta = assetId && project?.assets[assetId];
  if (ui.ai || !el || !meta || isVideo(el.props)) return;
  const from = maskOf(el.props);
  const own = (ctl = new AbortController());
  // Foto gelöscht, ersetzt oder anderes Projekt: sofort abbrechen, sonst blockiert der Lauf alle anderen Fotos ohne «Abbrechen»
  const lost = () => useDoc.getState().project?.id !== project!.id || photoOf(id)?.props.assetId !== assetId;
  const off = useDoc.subscribe(() => lost() && own.abort());
  ui.setMaskEditId(null); // Striche während des Laufs würden das Ergebnis ohnehin verwerfen
  ui.setAi({ id, phase: 'download', fraction: 0 });
  try {
    const image = await opfsAssetStore().get(assetId);
    const alpha = await aiTools.get('freistellen').run(image, {
      signal: own.signal,
      // nur bei neuer Phase oder neuem Prozent in den Store (schwache Geräte)
      onProgress: ({ phase, fraction }) => {
        const cur = useUi.getState().ai;
        if (cur?.id === id && (cur.phase !== phase || Math.round(cur.fraction * 100) !== Math.round(fraction * 100)))
          useUi.getState().setAi({ id, phase, fraction });
      },
    });
    if (own.signal.aborted) return;
    // vor «Kein Motiv»: ein verworfenes Ergebnis meldet nie etwas anderes (setMaskFromAi prüft in der Kette nochmals)
    const cur = photoOf(id);
    if (!cur || maskOf(cur.props) !== from) return useUi.getState().setNotice({ kind: 'error', text: AI_DROPPED });
    const m = maskFromAlpha(alpha, maskSize(meta));
    if (!hasSubject(m)) return useUi.getState().setNotice({ kind: 'info', text: NO_SUBJECT });
    await setMaskFromAi(id, m, from);
  } catch (e) {
    if ((e as Error).name === 'AbortError') return;
    if (!(e instanceof AiNetworkError || e instanceof AiMissingError)) console.error(e);
    const text = e instanceof AiNetworkError ? AI_NETWORK : e instanceof AiMissingError ? AI_MISSING : errorText(e, AI_FAILED);
    useUi.getState().setNotice({ kind: 'error', text });
  } finally {
    off();
    if (ctl === own) ctl = undefined;
    useUi.getState().setAi(undefined);
  }
}

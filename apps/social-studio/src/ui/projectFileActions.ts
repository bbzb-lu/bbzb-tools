import { download } from '../export/download';
import { safeFileName } from '../export/fileName';
import { withReferencedAssets } from '../model/elements';
import { packProject, packsAsset } from '../projectFile/projectFile';
import { opfsAssetStore } from '../storage/assets';
import { useDoc } from '../store/document';
import { useUi } from '../store/ui';
import { errorText } from './errors';

let running = false; // Tastenwiederholung oder Knopf + Taste starten keinen zweiten Pack

/** Projektdatei sichern: Knopf und Strg + S. Fehler landen als Hinweis im UI. */
export async function saveProjectFile(): Promise<void> {
  const p = useDoc.getState().project;
  if (!p || running) return;
  running = true;
  try {
    const store = opfsAssetStore();
    const bytes = await packProject(p, (id) => store.get(id));
    download(new Blob([bytes as BlobPart], { type: 'application/zip' }), `${safeFileName(p.name)}.bbzbsocial`);
    // wie packProject: nur Assets, die ein Element noch zeigt
    if (Object.values(withReferencedAssets(p).assets).some((m) => !packsAsset(m))) {
      useUi.getState().setNotice({ kind: 'info', text: 'Videos sind nicht in der Projektdatei. Sichere sie separat.' });
    }
  } catch (e) {
    useUi.getState().setNotice({ kind: 'error', text: errorText(e, 'Die Projektdatei konnte nicht erstellt werden.') });
  } finally {
    running = false;
  }
}

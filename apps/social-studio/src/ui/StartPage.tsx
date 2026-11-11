import { IconCopy, IconFolderOpen, IconLock, IconPhoto, IconPlus, IconDeviceMobile, IconTrash } from '@tabler/icons-react';
import { Header, vergissZuletzt } from '@bbzb/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import './start.css';
import { elementTypes, formats } from '../core/registries';
import { ensureDoodlesFor } from '../brand/doodles';
import { ensureTablerFor } from '../brand/tabler';
import { copyToFormat } from '../model/formatCopy';
import { createProject, duplicateProject } from '../model/slides';
import { unpackProject } from '../projectFile/projectFile';
import { load } from '../store/document';
import { useUi } from '../store/ui';
import { opfsAssetStore } from '../storage/assets';
import { deleteProject, listProjects, loadProject, saveProject, type ProjectSummary } from '../storage/db';
import { collectGarbage } from '../storage/gc';
import { errorText } from './errors';
import { LicensesDialog } from './LicensesDialog';
import { copyRules, fontsLoaded } from './layoutActions';

const fail = (e: unknown, fallback: string) => useUi.getState().setNotice({ kind: 'error', text: errorText(e, fallback) });
const formatLabel = (id: string) => (formats.has(id) ? formats.get(id).label : id);
/** «Story 9:16» → «Story» für den Button «Als Story kopieren». */
const formatName = (label: string) => label.split(' ')[0];
const dateTime = (t: number) => new Date(t).toLocaleString('de-CH', { dateStyle: 'short', timeStyle: 'short' });

/** Kurzer Zweck unter dem Formatnamen; unbekannte Formate zeigen keine Zeile. */
const formatHint: Record<string, string> = { post: 'Für Feed und LinkedIn', story: 'Hochformat für Storys' };

const propsSchemaFor = (type: string) => (elementTypes.has(type) ? elementTypes.get(type).propsSchema : undefined);

export function StartPage() {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [toDelete, setToDelete] = useState<ProjectSummary | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  const refresh = useCallback(
    () => listProjects().then(setProjects, (e) => fail(e, 'Die Projekte konnten nicht geladen werden.')),
    [],
  );
  useEffect(() => void refresh(), [refresh]);

  const [creating, setCreating] = useState(false);
  const creatingNow = useRef(false); // Doppelklick: kein zweites Projekt, auch vor dem nächsten Render
  const create = async (formatId: string) => {
    if (creatingNow.current) return;
    creatingNow.current = true;
    setCreating(true);
    const date = new Date().toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const p = createProject({ name: `Projekt ${date}`, format: formats.get(formatId) });
    try {
      await saveProject(p); // sofort speichern, damit ein Neuladen das Projekt nicht verliert
      useUi.setState({ chooseLayoutOnStart: true }); // nur für neue Projekte, nicht beim Öffnen
      load(p);
    } catch (e) {
      fail(e, 'Das Projekt konnte nicht angelegt werden.');
      creatingNow.current = false;
      setCreating(false);
    }
  };

  const open = async (id: string) => {
    try {
      const p = await loadProject(id);
      if (p) {
        // vor dem ersten Zeichnen; gescheitert: Icons und Doodles zeigen Platzhalter und Meldung
        await Promise.all([ensureTablerFor(p).catch(() => undefined), ensureDoodlesFor(p).catch(() => undefined)]);
        load(p);
      } else {
        vergissZuletzt('social-studio', id);
        fail(null, 'Dieses Projekt gibt es nicht mehr.');
      }
    } catch (e) {
      fail(e, 'Das Projekt konnte nicht geöffnet werden.');
    }
  };

  // Link von der Startseite («Zuletzt»): /social-studio/?projekt=<id> öffnet direkt, der Parameter verschwindet
  useEffect(() => {
    const id = new URLSearchParams(location.search).get('projekt');
    if (!id) return;
    history.replaceState(null, '', location.pathname);
    void open(id); // nur beim ersten Anzeigen
  }, []);

  const importFile = async (file: File) => {
    try {
      // Erst alles prüfen, dann Bilder, zuletzt das Projekt: ein Fehler lässt die Liste unverändert.
      const { project, assets, droppedMasks } = await unpackProject(new Uint8Array(await file.arrayBuffer()), propsSchemaFor);
      const store = opfsAssetStore();
      for (const [id, data] of assets) {
        const stored = await store.put(new Blob([data as BlobPart], { type: project.assets[id]!.mime }));
        if (stored !== id) throw new Error('Asset-ID stimmt nicht');
      }
      await saveProject(project);
      await refresh();
      if (droppedMasks) useUi.getState().setNotice({ kind: 'info', text: droppedMasks === 1 ? 'Eine Maske in der Datei war defekt. Das Foto ist ohne Maske geöffnet.' : `${droppedMasks} Masken in der Datei waren defekt. Die Fotos sind ohne Maske geöffnet.` });
    } catch (e) {
      fail(e, 'Die Datei konnte nicht geöffnet werden.');
    }
  };

  const busy = useRef(false);
  const duplicate = async (id: string) => {
    if (busy.current) return;
    busy.current = true;
    try {
      const p = await loadProject(id);
      if (!p) throw new Error('Projekt fehlt');
      await saveProject(duplicateProject(p));
      await refresh();
    } catch (e) {
      fail(e, 'Das Projekt konnte nicht dupliziert werden.');
    } finally {
      busy.current = false;
    }
  };

  /** Neues Projekt im anderen Format (Entscheid Task 0), das Original bleibt unverändert. */
  const copyAs = async (id: string, formatId: string) => {
    if (busy.current) return;
    busy.current = true;
    try {
      const p = await loadProject(id);
      if (!p) throw new Error('Projekt fehlt');
      await fontsLoaded(); // Texthöhen messen erst mit geladenen Schriften richtig
      const copy = copyToFormat(p, formats.get(formatId), copyRules);
      await saveProject(copy);
      await refresh();
      const n = copy.slides.filter((s) => s.review).length;
      const check = n === 0 ? '' : n === 1 ? ' 1 Slide ist mit «Bitte prüfen» markiert.' : ` ${n} Slides sind mit «Bitte prüfen» markiert.`;
      useUi.getState().setNotice({ kind: 'info', text: `«${copy.name}» ist angelegt.${check}` });
    } catch (e) {
      fail(e, 'Die Kopie konnte nicht angelegt werden.');
    } finally {
      busy.current = false;
    }
  };

  const askDelete = (p: ProjectSummary) => {
    setToDelete(p);
    dialog.current?.showModal();
  };

  const confirmDelete = async () => {
    dialog.current?.close();
    if (!toDelete) return;
    try {
      await deleteProject(toDelete.id);
    } catch (e) {
      fail(e, 'Das Projekt konnte nicht gelöscht werden.');
    }
    await refresh();
    // Aufräumen ist nur Speicherpflege; ein Fehler kommt beim nächsten Lauf wieder dran.
    collectGarbage(opfsAssetStore()).catch(() => {});
  };

  return (
    <>
      <Header tool="Social Studio" feedback="Social Studio" />
      <main className="start">
        <h1 className="sr-only">Social Studio</h1>

        <section aria-labelledby="neu">
          <h2 id="neu">Neues Projekt</h2>
          <div className="format-tiles">
            {formats.all().map((f) => (
              <button key={f.id} type="button" className="format-tile" aria-label={`${f.label} anlegen`} aria-disabled={creating} onClick={() => !creating && create(f.id)}>
                <span className="format-preview" aria-hidden="true">
                  <span style={{ aspectRatio: `${f.width} / ${f.height}` }} />
                </span>
                <span className="format-name" aria-hidden="true">
                  <IconPlus />
                  {f.label} anlegen
                </span>
                {formatHint[f.id] && <span className="format-hint" aria-hidden="true">{formatHint[f.id]}</span>}
              </button>
            ))}
          </div>
          <button type="button" className="open-file" aria-disabled={creating} onClick={() => !creating && fileInput.current?.click()}>
            <IconFolderOpen aria-hidden="true" />
            Projektdatei öffnen
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".bbzbsocial"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void importFile(file);
            }}
          />
          <p className="local-hint muted">
            <IconLock aria-hidden="true" />
            Deine Fotos und Projekte bleiben in diesem Browser. Sichere wichtige Projekte als Projektdatei.
          </p>
        </section>

        <section aria-labelledby="liste">
          <h2 id="liste">Deine Projekte</h2>
          {projects?.length === 0 && <p className="muted">Noch keine Projekte.</p>}
          {projects && projects.length > 0 && (
            <ul className="project-list">
              {projects.map((p) => (
                <li key={p.id}>
                  <span className="project-title">
                    {p.name}
                  </span>
                  <span className="muted">
                    {formatLabel(p.formatId)} · zuletzt bearbeitet {dateTime(p.updatedAt)}
                  </span>
                  <span className="row-actions">
                    <button type="button" aria-label={`«${p.name}» öffnen`} aria-disabled={creating} onClick={() => !creating && open(p.id)}>
                      <IconFolderOpen aria-hidden="true" />
                      Öffnen
                    </button>
                    <button type="button" className="icon-btn" aria-label={`«${p.name}» duplizieren`} aria-disabled={creating} data-tip="Duplizieren" onClick={() => !creating && duplicate(p.id)}>
                      <IconCopy aria-hidden="true" />
                    </button>
                    {formats
                      .all()
                      .filter((f) => f.id !== p.formatId)
                      .map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          className="icon-btn"
                          aria-label={`«${p.name}» als ${formatName(f.label)} kopieren`}
                          aria-disabled={creating}
                          data-tip={`Als ${formatName(f.label)} kopieren`}
                          onClick={() => !creating && copyAs(p.id, f.id)}
                        >
                          {f.id === 'story' ? <IconDeviceMobile aria-hidden="true" /> : <IconPhoto aria-hidden="true" />}
                        </button>
                      ))}
                    <button type="button" className="icon-btn" aria-label={`«${p.name}» löschen`} aria-disabled={creating} data-tip="Löschen" onClick={() => !creating && askDelete(p)}>
                      <IconTrash aria-hidden="true" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer>
          <LicensesDialog />
        </footer>

        <dialog ref={dialog} aria-labelledby="loeschen-frage" className="confirm-dialog" onClose={() => setToDelete(null)}>
          <p id="loeschen-frage" className="confirm-text">«{toDelete?.name}» löschen? Das lässt sich nicht rückgängig machen.</p>
          <div className="actions">
            <button type="button" onClick={() => dialog.current?.close()}>
              Abbrechen
            </button>
            <button type="button" className="danger" onClick={confirmDelete}>
              Löschen
            </button>
          </div>
        </dialog>
      </main>
    </>
  );
}

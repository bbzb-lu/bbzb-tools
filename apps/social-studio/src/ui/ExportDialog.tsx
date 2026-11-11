import { IconDownload, IconInfoCircle, IconMovie, IconPhoto, IconX } from '@tabler/icons-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { getContentLayer } from '../canvas/contentLayer';
import { exporters } from '../core/registries';
import { download } from '../export/download';
import { isVideoSlide } from '../export/exportVideoSlide';
import { ExportError, exportZip, missingFontsText } from '../export/exportZip';
import { safeFileName } from '../export/fileName';
import { useDoc } from '../store/document';
import { useUi } from '../store/ui';
import { errorText } from './errors';
import { KEYS, keysAttr } from './keys';
import { Segmented } from '@bbzb/ui';
import { contentRules } from './layoutActions';

const Info = ({ children }: { children: string }) => (
  <p className="info-line">
    <IconInfoCircle aria-hidden="true" />
    {children}
  </p>
);

let sessionFormat = 'jpeg'; // gilt nur bis zum Neuladen

export function ExportDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  // Zeichenkette statt Array: Liste und Hinweis bleiben aktuell, auch wenn sich das Dokument bei offenem Dialog ändert
  const videoKey = useDoc((s) => s.project!.slides.map((_, i) => (isVideoSlide(s.project!, i) ? 'v' : '-')).join(''));
  const slideCount = videoKey.length;
  const missing = useUi((s) => s.missingFonts);
  const fontsReady = useUi((s) => s.fontsReady);
  const [format, setFormat] = useState(sessionFormat);
  const [progress, setProgress] = useState<string | null>(null);
  const [fraction, setFraction] = useState(0); // Anteil des ganzen Exports für den Balken
  const [error, setError] = useState<string | null>(null);
  const [empty, setEmpty] = useState(0); // leere Fotorahmen, beim Öffnen gezählt
  const [notice, setNotice] = useState<string | null>(null);
  const zipButton = useRef<HTMLButtonElement>(null);
  const abort = useRef<AbortController | null>(null);
  const busy = progress !== null;
  // Nach dem Abbruch: Fokus auf den Knopf, der gerade deaktiviert war (erst nach dem Rendern wieder aktiv)
  useEffect(() => {
    if (!busy && notice) zipButton.current?.focus();
  }, [busy, notice]);

  const open = () => {
    setError(null);
    setNotice(null);
    setEmpty(Object.values(useDoc.getState().project!.elements).filter((e) => e.visible && contentRules.isEmpty(e)).length);
    dialog.current?.showModal();
  };

  // Strg + E: gleiche Wirkung wie der Knopf. Beim Einhängen zählt ein alter Zähler nicht.
  const seen = useRef(useUi.getState().exportRequest);
  const request = useUi((s) => s.exportRequest);
  useEffect(() => {
    if (request !== seen.current) {
      seen.current = request;
      open();
    }
  });

  const run = async () => {
    const p = useDoc.getState().project!;
    const content = getContentLayer();
    setError(null);
    setNotice(null);
    const ctl = (abort.current = new AbortController());
    setProgress('Export wird vorbereitet …');
    setFraction(0);
    try {
      if (!content) throw new Error('Leinwand fehlt');
      const zip = await exportZip(content, p, exporters.get(format), (i, n, percent) => {
        setProgress(`Slide ${i} von ${n}${percent === undefined ? '' : `, ${Math.floor(percent / 5) * 5} %`}`);
        setFraction((i - 1 + (percent ?? 0) / 100) / n);
      }, ctl.signal);
      download(zip, `${safeFileName(p.name)}.zip`);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        setNotice('Export abgebrochen.');
        return; // finally räumt auf
      }
      if (!(e instanceof ExportError)) console.error(e);
      setError(errorText(e, 'Der Export hat nicht geklappt. Versuch es nochmals.'));
    } finally {
      abort.current = null;
      setProgress(null);
    }
  };

  const blocked = missing.length > 0 ? missingFontsText(missing) : null;

  return (
    <>
      <button type="button" className="primary" data-tip="Exportieren" data-keys={keysAttr(KEYS.export)} onClick={open}>
        <IconDownload aria-hidden="true" />
        Exportieren
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="export-titel"
        className="export-dialog"
        // Während des Exports offen lassen, sonst sieht man Fortschritt und Fehler nicht.
        onCancel={(e) => busy && e.preventDefault()}
      >
        <h2 id="export-titel">Exportieren</h2>
        <p className="export-count">{slideCount === 1 ? '1 Slide' : `${slideCount} Slides`}</p>
        <ol className="export-slides" aria-label="Slides">
          {Array.from({ length: slideCount }, (_, i) => (
            <li key={i}>
              <span className="slide-chip">
                <span aria-hidden="true">{i + 1}</span>
                {videoKey[i] === 'v' ? <IconMovie aria-hidden="true" /> : <IconPhoto aria-hidden="true" />}
              </span>
              <span className="sr-only">Slide {i + 1} </span>
              <span>{videoKey[i] === 'v' ? 'Video' : 'Bild'}</span>
            </li>
          ))}
        </ol>
        <Segmented legend="Format" value={format} disabled={busy} options={exporters.all().map((x): [string, string] => [x.id, x.label])} onChange={(v) => setFormat((sessionFormat = v))} />
        <div className="infos">
          {videoKey.includes('v') && (
            <>
              <Info>LinkedIn erlaubt keine Videos in einem Bildkarussell.</Info>
              <Info>JPEG oder PNG gilt nur für die Bild-Slides, Videos werden MP4.</Info>
            </>
          )}
          {/* Kein Sperren: ein leerer Rahmen exportiert als Hintergrund, vielleicht gewollt. */}
          {empty > 0 && <Info>{empty === 1 ? '1 Fotorahmen ist noch leer.' : `${empty} Fotorahmen sind noch leer.`}</Info>}
        </div>
        {(blocked ?? error) && <p role="alert">{blocked ?? error}</p>}
        <div className="export-state">
          <p role="status">{progress ?? notice}</p>
          {busy && (
            <div className="export-progress" aria-hidden="true">
              <span style={{ '--p': fraction } as CSSProperties} />
            </div>
          )}
        </div>
        <div className="actions">
          {busy && (
            <button type="button" onClick={() => abort.current?.abort()}>
              <IconX aria-hidden="true" />
              Abbrechen
            </button>
          )}
          <button type="button" disabled={busy} onClick={() => dialog.current?.close()}>
            Schliessen
          </button>
          <button ref={zipButton} type="button" className="primary" disabled={busy || !fontsReady || blocked !== null} onClick={run}>
            <IconDownload aria-hidden="true" />
            {fontsReady ? 'ZIP herunterladen' : 'Schriften werden geladen …'}
          </button>
        </div>
      </dialog>
    </>
  );
}

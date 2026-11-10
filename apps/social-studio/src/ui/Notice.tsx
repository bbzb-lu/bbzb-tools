import { useCallback, useEffect, useRef, useState } from 'react';
import { IconAlertTriangle, IconInfoCircle, IconX } from '@tabler/icons-react';
import { notice as noticeTokens } from '../tokens';
import { useUi, type Notice as NoticeData } from '../store/ui';

/** Unter die Kopfzeile, damit sie keinen Knopf verdeckt (ohne Kopfzeile, z. B. Startseite: Standardabstand der CSS). */
function place(el: HTMLElement) {
  const header = document.querySelector('.editor-header');
  if (header) el.style.setProperty('--notice-top', `${header.getBoundingClientRect().bottom}px`);
  else el.style.removeProperty('--notice-top');
}

/**
 * Schwebende Meldung oben mittig, unter der Kopfzeile. Als Popover in der Top-Layer, damit sie auch über einem offenen Dialog liegt
 * (ein z-index schafft das nicht). Info läuft nach `notice.infoMs` ab; Hover und Fokus halten sie offen, Fehler bleiben.
 * Der Kasten ist nur eingehängt, solange eine Meldung steht: sein Zustand (`held`) beginnt so bei jeder Meldung neu,
 * auch wenn der Knoten ohne pointerleave/blur verschwindet.
 */
export function Notice() {
  const notice = useUi((s) => s.notice);
  return notice ? <NoticeBox notice={notice} /> : null;
}

function NoticeBox({ notice }: { notice: NoticeData }) {
  const setNotice = useUi((s) => s.setNotice);
  const box = useRef<HTMLDivElement | null>(null);
  const [held, setHeld] = useState(false);
  // Beim Einhängen, noch vor dem ersten Bild: Popover öffnen, dann liest der Screenreader das `role="alert"` im sichtbaren Kasten vor.
  const attach = useCallback((el: HTMLDivElement | null) => {
    box.current = el;
    if (!el) return;
    place(el);
    el.showPopover();
  }, []);
  useEffect(() => {
    const onResize = () => box.current && place(box.current);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  useEffect(() => {
    if (notice.kind !== 'info' || held) return;
    const t = window.setTimeout(() => setNotice(null), noticeTokens.infoMs);
    return () => clearTimeout(t);
  }, [notice, held, setNotice]);
  return (
    <div
      ref={attach}
      popover="manual"
      className={`notice notice-${notice.kind}`}
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      {notice.kind === 'error' ? <IconAlertTriangle role="img" aria-label="Fehler" /> : <IconInfoCircle role="img" aria-label="Hinweis" />}
      <p role="alert">{notice.text}</p>
      <button type="button" className="icon-btn" aria-label="Schliessen" data-tip="Schliessen" onClick={() => setNotice(null)}>
        <IconX aria-hidden="true" />
      </button>
    </div>
  );
}

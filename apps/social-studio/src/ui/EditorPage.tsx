import { useEffect } from 'react';
import { CanvasView } from '../canvas/CanvasView';
import { fontsMissingText } from '../fonts';
import { useUi } from '../store/ui';
import { ContextMenu } from './ContextMenu';
import { Header } from './Header';
import { Inspector } from './Inspector';
import { LeftPanel } from './LeftPanel';
import { installSelectionSync } from './actions';
import { installGlobalContextMenu } from './globalContextMenu';
import { installShortcuts } from './shortcuts';
import { SlideBar } from './SlideBar';

export function EditorPage() {
  const missing = useUi((s) => s.missingFonts);
  // Text misst erst mit geladenen Schriften richtig.
  const fontsReady = useUi((s) => s.fontsReady);
  useEffect(installShortcuts, []);
  useEffect(installSelectionSync, []);
  useEffect(installGlobalContextMenu, []);
  useEffect(() => {
    // Datei neben der Leinwand abgelegt: nicht öffnen (würde den Editor verlassen). Die Leinwand nimmt ihre Drops selbst an.
    const stop = (e: DragEvent) => {
      if (e.defaultPrevented) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'none';
    };
    window.addEventListener('dragover', stop);
    window.addEventListener('drop', stop);
    return () => {
      window.removeEventListener('dragover', stop);
      window.removeEventListener('drop', stop);
    };
  }, []);
  useEffect(() => {
    // Alt + Pfeil blättert in Edge im Verlauf und würde den Editor verlassen; Kacheln und Buttonreihe verschieben Slides selbst.
    const guard = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) e.preventDefault();
    };
    window.addEventListener('keydown', guard);
    return () => window.removeEventListener('keydown', guard);
  }, []);
  return (
    <div className="editor">
      <Header />
      {missing.length > 0 && (
        <p className="banner" role="alert">
          {fontsMissingText(missing)} Export ist gesperrt. Lade die Seite neu.
        </p>
      )}
      <main className="workspace">
        <LeftPanel />
        <div className="stage-column">
          {fontsReady ? <CanvasView /> : <p className="muted loading" role="status">Schriften laden …</p>}
          <SlideBar />
        </div>
        <div className="side">
          <Inspector />
        </div>
      </main>
      <ContextMenu />
    </div>
  );
}

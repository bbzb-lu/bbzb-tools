import { IconMaximize, IconShieldExclamation, IconZoomIn, IconZoomOut } from '@tabler/icons-react';
import { useId } from 'react';
import { clampZoom, MAX_ZOOM, MIN_ZOOM } from '../canvas/zoom';
import { BACKDROPS, type Backdrop, useUi } from '../store/ui';
import { KEYS, keysAttr } from './keys';

const backdropNames: Record<Backdrop, string> = { grau: 'Grau', dunkel: 'Dunkel', gruen: 'Grün', blau: 'Blau' };
const backdropTip = 'Farbe der Arbeitsfläche, nur Ansicht. Kommt nicht in den Export.';

/** Ansicht in der Slide-Leiste: Sicherheitszonen, Zoom, Einpassen und Unterlage. Nichts davon kommt in den Export. */
export function ViewTools() {
  const zoom = useUi((s) => s.zoom);
  const zoomLive = useUi((s) => s.zoomLive);
  const zones = useUi((s) => s.safeZones);
  const backdrop = useUi((s) => s.stageBackdrop);
  const name = useId();
  // aria-disabled statt disabled: der Fokus bleibt am Button, wenn die Grenze erreicht ist.
  const zoomBy = (k: number) => {
    const to = clampZoom(zoom * k);
    if (to !== zoom) useUi.getState().setZoom(to, true);
  };
  return (
    <div className="view-tools">
      <button
        type="button"
        className="zone-toggle icon-btn"
        aria-label="Sicherheitszonen"
        aria-pressed={zones}
        aria-description="Zeigt, was Instagram überdeckt. Kommt nicht in den Export."
        data-tip="Sicherheitszonen"
        data-tip-text="Zeigt, was Instagram überdeckt. Kommt nicht in den Export."
        onClick={() => useUi.getState().setSafeZones(!zones)}
      >
        <IconShieldExclamation aria-hidden="true" />
      </button>
      <div className="zoom-bar" role="group" aria-label="Zoom">
        <button type="button" className="icon-btn" aria-label="Verkleinern" data-tip="Verkleinern" data-keys={keysAttr(KEYS.zoomOut)} aria-disabled={zoom <= MIN_ZOOM} onClick={() => zoomBy(1 / 1.25)}>
          <IconZoomOut aria-hidden="true" />
        </button>
        <span className="zoom-value">{Math.round(zoom * 100)} %</span>
        <button type="button" className="icon-btn" aria-label="Vergrössern" data-tip="Vergrössern" data-keys={keysAttr(KEYS.zoomIn)} aria-disabled={zoom >= MAX_ZOOM} onClick={() => zoomBy(1.25)}>
          <IconZoomIn aria-hidden="true" />
        </button>
        <button type="button" className="icon-btn" aria-label="Einpassen" data-tip="Einpassen" data-keys={keysAttr(KEYS.zoomFit)} onClick={() => useUi.getState().setZoom(1, true)}>
          <IconMaximize aria-hidden="true" />
        </button>
        <span className="sr-only" aria-live="polite">
          {zoomLive ? `Zoom ${Math.round(zoomLive * 100)} %` : ''}
        </span>
      </div>
      <button
        type="button"
        className="backdrop-btn icon-btn"
        aria-label={`Unterlage: ${backdropNames[backdrop]}`}
        aria-description={backdropTip}
        data-tip="Unterlage"
        data-tip-text={backdropTip}
        popoverTarget="stage-backdrop"
      >
        <span className="backdrop-chip" style={{ background: `var(--unterlage-${backdrop})` }} />
      </button>
      <div id="stage-backdrop" className="backdrop-popover" popover="auto" role="dialog" aria-label="Unterlage">
        <fieldset className="choice">
          <legend>Unterlage, nur Ansicht</legend>
          <div className="swatches">
            {BACKDROPS.map((b) => (
              <label key={b} className="swatch" style={{ background: `var(--unterlage-${b})` }} data-tip={backdropNames[b]}>
                <input type="radio" name={name} aria-label={backdropNames[b]} checked={backdrop === b} onChange={() => useUi.getState().setStageBackdrop(b)} />
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    </div>
  );
}

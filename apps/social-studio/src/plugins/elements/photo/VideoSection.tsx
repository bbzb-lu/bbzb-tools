import { IconPlayerPlay, IconPlayerStop, IconVolume, IconVolumeOff } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import { useVideoFrame } from '../../../canvas/useVideoFrame';
import { sourceRect } from '../../../model/crop';
import type { Element } from '../../../model/types';
import { apply, useDoc } from '../../../store/document';
import { useUi } from '../../../store/ui';
import { video } from '../../../tokens';
import { Section } from '../../../ui/Section';
import { NumberField } from '../../../ui/NumberField';
import { RangeSlider } from '../../../ui/kit/RangeSlider';
import { ImageSection } from './ImageSection';
import { imageArea, type PhotoProps, type VideoProps } from './schema';
import { sliderMax, thumbTimes, trim } from './trim';
import { startPreview, stopPreview, usePlaying } from './usePreview';

const DECODE = video.thumbWidth * 2;
const seconds = (v: number) => `${v.toFixed(1)} Sekunden`;

/** Ein apply; fehlt das Element schon (gelöscht, während der Regler lief) oder ändert sich nichts, nichts schreiben. */
export function saveVideo(id: string, next: VideoProps) {
  const cur = (useDoc.getState().project?.elements[id] as Element<PhotoProps> | undefined)?.props.video;
  if (!cur || (cur.start === next.start && cur.end === next.end && cur.sound === next.sound)) return;
  apply((d) => void ((d.elements[id] as Element<PhotoProps>).props.video = next));
}

/** Vorschaubild: der Ausschnitt des Elements aus dem Videobild, wie auf der Leinwand (ohne Effekte). */
function Thumb({ el, frame, label }: { el: Element<PhotoProps>; frame?: HTMLCanvasElement; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const meta = useDoc((s) => (el.props.assetId ? s.project?.assets[el.props.assetId] : undefined));
  const area = imageArea(el.props, el);
  const height = Math.max(1, Math.round((DECODE * area.height) / area.width));
  const { crop } = el.props;
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx || !frame || !meta) return;
    const f = sourceRect(crop, area, frame.width / meta.width, frame.height / meta.height);
    ctx.drawImage(frame, f.x, f.y, f.width, f.height, 0, 0, DECODE, height);
    // area ist aus el abgeleitet: crop und Box decken alle Eingaben ab
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame, meta, crop, area.width, area.height, height]);
  return <canvas ref={ref} className="video-thumb" role="img" aria-label={label} width={DECODE} height={height} style={{ width: video.thumbWidth }} />;
}

/**
 * Abschnitt «Video»: Start und Ende kürzen mit dem Bereichsregler oder den Zahlenfeldern (eine Geste = ein Undo-Schritt, geschrieben erst beim Loslassen; während des Ziehens
 * folgen nur die zwei Vorschaubilder), Ton an/aus, Vorschau auf der Leinwand. Die Vorschau endet bei Stopp, Auswahl-, Slide-,
 * Projektwechsel, beim Ausschnittmodus und wenn das Element verschwindet. Am Ende «Bild» als eingerückter Unterabschnitt.
 */
export function VideoSection({ el }: { el: Element<PhotoProps> }) {
  const vid = el.props.video!;
  const [draft, setDraft] = useState<VideoProps | null>(null);
  const shown = draft ?? vid;
  const slide = useUi((s) => s.currentSlide);
  const editing = useUi((s) => s.cropEditId === el.id);
  const playing = usePlaying(el.id);
  const [t0, t1] = thumbTimes(shown);
  const first = useVideoFrame(el.props.assetId, t0, DECODE);
  const last = useVideoFrame(el.props.assetId, t1, DECODE);
  const broken = first.error ?? last.error;

  // Geste zu Ende (Maus los, Taste los, Fokus weg): ein Schreiben, dann zeigt die Leinwand das neue Startbild.
  // Abbau mitten in der Geste (Auswahl wechselt): Entwurf ebenfalls schreiben.
  const pending = useRef<VideoProps | null>(null);
  useEffect(() => {
    const flush = () => {
      if (pending.current) saveVideo(el.id, pending.current);
      pending.current = null;
    };
    const off = useUi.subscribe((s, prev) => {
      if (!prev.sliding || s.sliding) return;
      flush();
      setDraft(null);
    });
    return () => {
      off();
      flush();
    };
  }, [el.id]);
  useEffect(() => () => stopPreview(el.id), [el.id, slide, editing]);

  const change = (which: 'start' | 'end', v: number) => {
    const next = trim(shown, which, v);
    if (next[which] === shown[which]) return;
    // Regler wird gezogen: nur Entwurf (kein Store-Schreiben je Mausbewegung); Zahlenfeld und Doppelklick schreiben sofort
    if (!useUi.getState().sliding) return saveVideo(el.id, next);
    pending.current = next;
    setDraft(next);
  };
  const max = sliderMax(vid.duration);
  return (
    <Section heading="Video" collapsible>
      <div className="video-thumbs">
        <Thumb el={el} frame={first.frame} label={`Erstes Bild bei ${seconds(t0)}`} />
        <Thumb el={el} frame={last.frame} label={`Letztes Bild bei ${seconds(t1)}`} />
        {/* sichtbare Zuordnung zu den Reglern; der Name der Bilder sagt es dem Screenreader schon */}
        <span aria-hidden="true">Start</span>
        <span aria-hidden="true">Ende</span>
      </div>
      <p className="muted hint">Ausschnitt: {(shown.end - shown.start).toFixed(1)} s</p>
      <RangeSlider start={shown.start} end={shown.end} min={0} max={max} step={0.1} format={seconds} onChange={(s, e) => (s !== shown.start ? change('start', s) : change('end', e))} />
      <div className="video-times">
        {(['start', 'end'] as const).map((which) => (
          <div key={which} className="video-time">
            <span aria-hidden="true">{which === 'start' ? 'Start' : 'Ende'}</span>
            <NumberField label={which === 'start' ? 'Start' : 'Ende'} value={shown[which]} min={0} max={max} step={0.1} roll onCommit={(v) => change(which, v)} />
            <span aria-hidden="true">s</span>
          </div>
        ))}
      </div>
      <div className="tool-grid">
        <button
          type="button"
          aria-disabled={broken ? true : undefined}
          data-tip={broken ?? (playing ? 'Vorschau anhalten' : 'Gekürztes Stück in Schleife abspielen')}
          onClick={() => !broken && (playing ? stopPreview(el.id) : startPreview(el.id))}
        >
          {playing ? <IconPlayerStop aria-hidden="true" /> : <IconPlayerPlay aria-hidden="true" />}
          {playing ? 'Stopp' : 'Vorschau'}
        </button>
        <button type="button" aria-pressed={vid.sound} data-tip="Ton im Export und in der Vorschau" onClick={() => saveVideo(el.id, { ...vid, sound: !vid.sound })}>
          {vid.sound ? <IconVolume aria-hidden="true" /> : <IconVolumeOff aria-hidden="true" />}
          Ton
        </button>
      </div>
      <ImageSection el={el} nested />
    </Section>
  );
}

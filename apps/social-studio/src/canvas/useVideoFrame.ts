import Konva from 'konva';
import { useEffect, useRef, useState } from 'react';
import { opfsAssetStore } from '../storage/assets';
import { useUi } from '../store/ui';
import { decodeWidth } from '../export/exportVideoSlide';
import { BROKEN_VIDEO, MISSING_VIDEO } from './images';

type Source = { dispose(): void; frame(t: number, width?: number): Promise<HTMLCanvasElement> };
type Entry = { users: number; source: Promise<Source> };

/** Geöffnete Videos je Asset, solange ein Element sie zeigt: Mediabunny liest die Datei nicht bei jedem Startbild neu ein. */
const open = new Map<string, Entry>();

class VideoMissing extends Error {}

async function openVideo(id: string): Promise<Source> {
  const blob = await opfsAssetStore()
    .get(id)
    .catch(() => {
      throw new VideoMissing(id);
    });
  const { Input, BlobSource, CanvasSink, MP4, QTFF } = await import('mediabunny');
  const input = new Input({ source: new BlobSource(blob), formats: [MP4, QTFF] });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error(`Video ${id} ohne Bildspur`);
    // Gleiche Grösse wie der Export (`decodeWidth`), Höhe folgt dem Seitenverhältnis (Drehung inklusive). Ohne Pool: jede Canvas gehört dem Aufrufer.
    // Je Breite ein Sink (Leinwand, Vorschaubilder im Inspector).
    const full = decodeWidth(track.displayWidth, track.displayHeight);
    const sinks = new Map<number, InstanceType<typeof CanvasSink>>();
    const first = await track.getFirstTimestamp();
    return {
      dispose: () => input.dispose(),
      async frame(t, width = full) {
        width = Math.min(width, full);
        let sink = sinks.get(width);
        if (!sink) sinks.set(width, (sink = new CanvasSink(track, { width })));
        const w = await sink.getCanvas(Math.max(t, first));
        if (!w) throw new Error(`Video ${id}: kein Bild bei ${t} s`);
        return w.canvas as HTMLCanvasElement;
      },
    };
  } catch (e) {
    input.dispose();
    throw e;
  }
}

function acquire(id: string): Entry {
  let e = open.get(id);
  if (!e) {
    const entry: Entry = { users: 0, source: openVideo(id) };
    // Fehler nicht behalten: nach erneutem Einfügen soll es wieder klappen
    entry.source.catch(() => open.get(id) === entry && open.delete(id));
    open.set(id, (e = entry));
  }
  e.users++;
  return e;
}

function release(id: string, e: Entry): void {
  if (--e.users > 0) return;
  if (open.get(id) === e) open.delete(id);
  e.source.then(
    (s) => s.dispose(),
    () => {},
  );
}

type State = { id: string; time: number; frame?: HTMLCanvasElement; error?: string };
/** Laufende Abfrage eines Elements: höchstens ein Dekodieren zugleich, danach nur der neuste Wunsch (kein Stau beim Ziehen). */
type Job = { entry: Entry; busy: boolean; want: number; width?: number; done(t: number, frame?: HTMLCanvasElement, err?: unknown): boolean };

function pump(j: Job): void {
  if (j.busy) return;
  const t = j.want;
  j.busy = true;
  const next = (shown: boolean) => {
    j.busy = false;
    if (shown && j.want !== t) pump(j);
  };
  j.entry.source
    .then((s) => s.frame(t, j.width))
    .then(
      (frame) => {
        const shown = j.done(t, frame);
        if (!shown) Konva.Util.releaseCanvas(frame);
        next(shown);
      },
      (err: unknown) => next(j.done(t, undefined, err)),
    );
}

/**
 * Bild eines Video-Assets bei `time` (Sekunden), höchstens `width` px breit (Standard `decodeWidth`), gleiches Seitenverhältnis wie das Asset.
 * Mediabunny läuft nur bei neuem Asset oder neuer Zeit, nie pro Render; ändert sich die Zeit schnell (Regler), dekodiert es nur
 * den jeweils neusten Wert. Bis das neue Bild da ist, bleibt das alte (`pending`); `time` ist die Zeit des gelieferten Bilds.
 * Fehlt die Datei oder lässt sie sich nicht dekodieren: `error` (Meldung, einmal angezeigt).
 */
export function useVideoFrame(id: string | undefined, time: number, width?: number): { frame?: HTMLCanvasElement; time?: number; error?: string; pending: boolean } {
  const [state, setState] = useState<State>();
  const job = useRef<Job>(undefined);
  useEffect(() => {
    if (id === undefined) return;
    const j: Job = {
      entry: acquire(id),
      busy: false,
      want: NaN,
      width,
      // false: Element zeigt ein anderes Asset oder ist weg; das Bild wird dann freigegeben
      done: (t, frame, err) => {
        if (job.current !== j) return false;
        if (frame) setState({ id, time: t, frame });
        else if (j.want === t) {
          console.error(err);
          const error = err instanceof VideoMissing ? MISSING_VIDEO : BROKEN_VIDEO;
          setState({ id, time: t, error });
          const { notice, setNotice } = useUi.getState();
          if (notice?.text !== error) setNotice({ kind: 'error', text: error });
        }
        return true;
      },
    };
    job.current = j;
    return () => {
      job.current = undefined;
      release(id, j.entry);
      setState(undefined); // Bild nicht bis zum Abbau behalten (Element ist kein Video mehr); der Effekt unten gibt die Canvas frei
    };
    // `width` ist je Aufrufer fest
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => {
    const j = job.current;
    if (!j) return;
    j.want = time;
    pump(j);
  }, [id, time]);
  // Ersetztes Bild freigeben, sobald das neue gezeichnet ist
  const shown = state?.frame;
  useEffect(() => () => void (shown && Konva.Util.releaseCanvas(shown)), [shown]);
  if (id === undefined || state?.id !== id) return { pending: id !== undefined };
  const pending = state.time !== time;
  return { frame: state.frame, time: state.frame && state.time, error: pending ? undefined : state.error, pending };
}

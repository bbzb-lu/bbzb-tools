import { video } from '../../../tokens';
import type { VideoProps } from './schema';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Neuer Start oder neues Ende: mindestens `video.minLength` Abstand, innerhalb 0 bis Dauer. */
export function trim(v: VideoProps, which: 'start' | 'end', value: number): VideoProps {
  return which === 'start'
    ? { ...v, start: clamp(value, 0, v.end - video.minLength) }
    : { ...v, end: clamp(value, v.start + video.minLength, v.duration) };
}

/** Obergrenze der Regler (Schritt 0.1 s): aufgerundet, damit der Griff das Ende der Datei erreicht; `trim` klemmt auf die Dauer. */
export const sliderMax = (duration: number) => Math.ceil(Math.round(duration * 1000) / 100) / 10;

/** Zeitpunkte der zwei Vorschaubilder: erstes Bild des Stücks und das letzte vor dem Ende. */
export const thumbTimes = (v: VideoProps): [number, number] => [v.start, Math.max(v.start, v.end - 1 / video.fps)];

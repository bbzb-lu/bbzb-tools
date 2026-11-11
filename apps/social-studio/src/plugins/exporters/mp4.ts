import Konva from 'konva';
import { composite, EFFECT_MAX } from '../../canvas/effects';
import { effects } from '../../core/registries';
import type { VideoExporter, VideoJob } from '../../core/types';
import { decodeWidth, frameCount, frameTime, soundSource, videoExportStats, videoOf, videosOn, type VideoTrim } from '../../export/exportVideoSlide';
import { ExportError } from '../../export/exportZip';
import { sourceRect } from '../../model/crop';
import type { Element, Project } from '../../model/types';
import { opfsAssetStore } from '../../storage/assets';
import { exportQuality, video } from '../../tokens';
import { imageArea, type PhotoProps } from '../elements/photo/schema';
import { photoSteps } from '../elements/photo/steps';
import { stopPreview } from '../elements/photo/usePreview';

export const NO_H264 = 'Edge kann auf diesem Gerät keine Videos erzeugen. Nimm ein anderes Gerät oder entferne die Videos.';
export const NO_AAC = 'Edge kann den Ton dieses Videos auf diesem Gerät nicht verarbeiten. Schalte den Ton aus.';

type Mb = typeof import('mediabunny');
const mb = (): Promise<Mb> => import('mediabunny');
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const bitrateOf = (p: Project) => exportQuality[p.exportQuality ?? 'standard'].bitrate;
const encoding = (p: Project) => ({ codec: 'avc', bitrate: bitrateOf(p), keyFrameInterval: video.keyFrameInterval }) as const;

async function openInput(m: Mb, e: Element) {
  const blob = await opfsAssetStore().get((e.props as PhotoProps).assetId!);
  return new m.Input({ source: new m.BlobSource(blob), formats: [m.MP4, m.QTFF] });
}

let warm: Promise<void> | undefined;
/** Erster Encode einer Sitzung dauert ~2 s (Encoder starten): einmal ein Bild kodieren, solange der Dialog «Export wird vorbereitet …» zeigt. */
async function warmUp(m: Mb, p: Project, width: number, height: number) {
  const c = Object.assign(document.createElement('canvas'), { width, height });
  const output = new m.Output({ format: new m.Mp4OutputFormat(), target: new m.BufferTarget() });
  try {
    const src = new m.CanvasSource(c, encoding(p));
    output.addVideoTrack(src, { frameRate: video.fps });
    await output.start();
    await src.add(0, 1 / video.fps);
    src.close();
    await output.finalize();
  } finally {
    if (output.state !== 'finalized') await output.cancel();
    Konva.Util.releaseCanvas(c);
  }
}

async function prepare(p: Project, slides: number[]): Promise<void> {
  stopPreview(); // Vorschau gehört nicht in den Export und kostet Rechenzeit
  if (slides.length === 0) return;
  const m = await mb();
  const { width, height } = p.format;
  if (!(await m.canEncodeVideo('avc', { width, height, bitrate: bitrateOf(p) }))) throw new ExportError(NO_H264);
  // Ton: AAC wird beim Kürzen kopiert, andere Codecs brauchen einen AAC-Encoder
  for (const e of new Set(slides.map((i) => soundSource(p, i)))) {
    if (!e) continue;
    const input = await openInput(m, e);
    try {
      const a = await input.getPrimaryAudioTrack();
      const config = a && { numberOfChannels: a.numberOfChannels, sampleRate: a.sampleRate };
      if (a && a.codec !== 'aac' && !(await m.canEncodeAudio('aac', config!))) throw new ExportError(NO_AAC);
    } finally {
      input.dispose();
    }
  }
  warm ??= warmUp(m, p, width, height).catch((e: unknown) => {
    warm = undefined;
    console.error(e);
    throw new ExportError(NO_H264);
  });
  await warm;
}

/**
 * Bilder eines Video-Elements je Frame: dekodiert (`decodeWidth`, wie das Startbild im Editor), Ausschnitt und Effekte wie PhotoNode
 * (`sourceRect`, `photoSteps`, `composite`). Ist das Video kürzer als die Slide, bleibt sein letztes Bild stehen.
 */
async function videoFrames(m: Mb, p: Project, e: Element, n: number) {
  const input = await openInput(m, e);
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error(`Video ${e.id} ohne Bildspur`);
    const props = e.props as PhotoProps;
    const meta = p.assets[props.assetId!]!;
    const area = imageArea(props, e);
    const steps = photoSteps(props).filter((s) => effects.get(s.id).active(s.params));
    const first = await track.getFirstTimestamp();
    const times: number[] = [];
    for (let k = 0; k < n && (k === 0 || frameTime(e, k) !== frameTime(e, k - 1)); k++) times.push(Math.max(frameTime(e, k), first));
    // Pool 2: Mediabunny verwendet die Canvases wieder, nie festhalten
    const sink = new m.CanvasSink(track, { width: decodeWidth(track.displayWidth, track.displayHeight), poolSize: 2 });
    const decoded = sink.canvasesAtTimestamps(times);
    let shown: HTMLCanvasElement | undefined;
    return {
      input,
      async at(k: number): Promise<HTMLCanvasElement> {
        if (k >= times.length && shown) return shown;
        const w = (await decoded.next()).value;
        if (!w) throw new Error(`Video ${e.id}: kein Bild bei ${times[k]} s`);
        const img = w.canvas as HTMLCanvasElement;
        const next = await composite(area.width, area.height, (ctx) => {
          const f = sourceRect(props.crop, area, img.width / meta.width, img.height / meta.height);
          ctx.drawImage(img, f.x, f.y, f.width, f.height, 0, 0, ctx.canvas.width, ctx.canvas.height);
        }, steps, EFFECT_MAX);
        if (shown) Konva.Util.releaseCanvas(shown);
        return (shown = next);
      },
      async close() {
        await decoded.return(undefined);
        if (shown) Konva.Util.releaseCanvas(shown);
        input.dispose();
      },
    };
  } catch (err) {
    input.dispose();
    throw err;
  }
}

/** Ton der Slide als «composable» Conversion: gekürzt, AAC kopiert (oder neu kodiert, wenn die Quelle kein AAC ist). */
async function soundTrack(m: Mb, input: InstanceType<Mb['Input']>, output: InstanceType<Mb['Output']>, v: VideoTrim) {
  if (!(await input.getPrimaryAudioTrack())) return undefined;
  const end = Math.min(v.end, v.start + video.maxSlideSeconds);
  const c = await m.Conversion.init({
    input, output, composable: true, showWarnings: false, trim: { start: v.start, end }, video: { discard: true }, audio: { codec: 'aac' },
  });
  if (c.utilizedTracks.length === 0) throw new ExportError(NO_AAC);
  return c;
}

async function encode({ project: p, index, render, onProgress, signal }: VideoJob): Promise<Uint8Array> {
  const m = await mb();
  const vids = videosOn(p, index);
  const n = frameCount(vids);
  const { width, height } = p.format;
  const out = Object.assign(document.createElement('canvas'), { width, height });
  const ctx = out.getContext('2d')!;
  const target = new m.BufferTarget();
  const output = new m.Output({ format: new m.Mp4OutputFormat({ fastStart: 'in-memory' }), target });
  const sources: Awaited<ReturnType<typeof videoFrames>>[] = [];
  let conversion: Awaited<ReturnType<typeof soundTrack>>;
  videoExportStats.open++;
  try {
    const src = new m.CanvasSource(out, encoding(p));
    output.addVideoTrack(src, { frameRate: video.fps });
    for (const e of vids) sources.push(await videoFrames(m, p, e, n));
    const sound = soundSource(p, index);
    if (sound) conversion = await soundTrack(m, sources[vids.indexOf(sound)]!.input, output, videoOf(sound)!);
    await output.start();
    const audio = conversion?.execute();
    audio?.catch(() => {}); // Fehler kommt unten beim Abwarten; bis dahin nicht als unbehandelt melden
    for (let k = 0; k < n; k++) {
      signal?.throwIfAborted();
      const frames = new Map<string, HTMLCanvasElement>();
      for (const [i, s] of sources.entries()) frames.set(vids[i]!.id, await s.at(k));
      const slide = render(frames);
      ctx.drawImage(slide, 0, 0);
      Konva.Util.releaseCanvas(slide);
      await src.add(k / video.fps, 1 / video.fps); // wartet auf den Encoder (Gegendruck)
      onProgress(Math.round(((k + 1) / n) * 100));
      if (k % 4 === 3) await frame(); // Oberfläche bleibt bedienbar
    }
    src.close();
    await audio;
    signal?.throwIfAborted();
    await output.finalize();
    return new Uint8Array(target.buffer!);
  } finally {
    // Abbruch oder Fehler: nichts offen lassen
    if (output.state !== 'finalized') {
      if (conversion && conversion.state !== 'done') await conversion.cancel().catch(() => {});
      await output.cancel().catch(() => {});
    }
    await Promise.all(sources.map((s) => s.close().catch(() => {})));
    Konva.Util.releaseCanvas(out);
    videoExportStats.open--;
  }
}

export const mp4Exporter: VideoExporter = { id: 'mp4', label: 'MP4', extension: 'mp4', prepare, encode };

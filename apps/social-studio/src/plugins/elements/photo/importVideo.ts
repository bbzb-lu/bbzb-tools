import { video } from '../../../tokens';
import type { VideoProps } from './schema';

export interface VideoProbe {
  duration: number;
  width: number;
  height: number;
  canDecode: boolean;
}

export class VideoImportError extends Error {
  constructor(text = 'Edge kann dieses Video nicht abspielen. Auf dem iPhone unter Einstellungen › Kamera › Formate «Kompatibel» wählen und neu aufnehmen, oder das Video umwandeln.') {
    super(text);
    this.name = 'VideoImportError';
  }
}

export const isVideoFile = (f: File): boolean => /^video\/(mp4|quicktime)$/.test(f.type) || /\.(mp4|mov)$/i.test(f.name);

/** Mediabunny nur hier und nur bei Bedarf geladen (eigener Chunk). Anzeigemasse berücksichtigen die Drehung. */
export async function probeVideo(file: File): Promise<VideoProbe> {
  const { Input, BlobSource, MP4, QTFF } = await import('mediabunny');
  const input = new Input({ source: new BlobSource(file), formats: [MP4, QTFF] });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new VideoImportError();
    return {
      duration: await input.computeDuration(),
      width: Math.round(track.displayWidth),
      height: Math.round(track.displayHeight),
      canDecode: await track.canDecode(),
    };
  } finally {
    input.dispose();
  }
}

export interface ImportedVideo {
  blob: Blob;
  mime: string;
  width: number;
  height: number;
  video: VideoProps;
  warning?: string;
}

export async function importVideo(file: File, probe: (f: File) => Promise<VideoProbe> = probeVideo): Promise<ImportedVideo> {
  let p: VideoProbe;
  try {
    p = await probe(file);
  } catch {
    throw new VideoImportError();
  }
  if (!p.canDecode || !(p.duration > 0) || !(p.width > 0) || !(p.height > 0)) throw new VideoImportError();
  if (p.duration < video.minLength) throw new VideoImportError(`Das Video ist kürzer als ${video.minLength} Sekunde.`);
  const big = p.duration > video.warnSeconds || file.size > video.warnBytes;
  return {
    blob: file,
    mime: /\.mov$/i.test(file.name) && !file.type ? 'video/quicktime' : file.type || 'video/mp4',
    width: p.width,
    height: p.height,
    video: { start: 0, end: Math.min(p.duration, video.maxSlideSeconds), sound: false, duration: p.duration },
    warning: big ? 'Grosses Video: Export und Vorschau werden langsam.' : undefined,
  };
}

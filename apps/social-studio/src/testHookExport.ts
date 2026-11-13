import { unzipSync } from 'fflate';
import Konva from 'konva';
import { EFFECT_PENDING_NODE, previewStats } from './canvas/effects';
import { getContentLayer } from './canvas/contentLayer';
import { effects, exporters } from './core/registries';
import { videoExportStats } from './export/exportVideoSlide';
import { exportZip, renderSlide } from './export/exportZip';
import { useDoc } from './store/document';

export type VideoProbe = { pixels: number[][]; duration: number; width: number; height: number; frames: number; audio: string | null; audioDuration: number | null };

/** RGB eines 5 × 5-Flecks je Punkt (relativ zur Canvas). */
const patches = (c: HTMLCanvasElement, pts: [number, number][]) => {
  const ctx = c.getContext('2d')!;
  return pts.map(([x, y]) => {
    const d = ctx.getImageData(Math.round(x * c.width) - 2, Math.round(y * c.height) - 2, 5, 5).data;
    return Array.from(d).filter((_, i) => i % 4 !== 3);
  });
};

const TEST_FOLDER = 'social-studio-export-test';
let slowGrainOrig: ReturnType<typeof effects.get>['apply'] | undefined;

/** Testhaken für Export, Ordner-Export und Video (Teil von `window.__bbzbTest`, Typen in testHook.ts). */
export const exportHooks: Pick<
  Window['__bbzbTest'],
  'preview' | 'slidePixels' | 'videoProbe' | 'runExport' | 'fakePicker' | 'folderFiles' | 'holdEffects' | 'slowGrain' | 'videoExportOpen'
> = {
  preview: () => ({ ...previewStats }),
  slidePixels: (index, pts) => {
    const c = renderSlide(getContentLayer()!, useDoc.getState().project!, index);
    try {
      return patches(c, pts);
    } finally {
      Konva.Util.releaseCanvas(c);
    }
  },
  videoProbe: async (b64, t, pts, width) => {
    const m = await import('mediabunny');
    const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
    const input = new m.Input({ source: new m.BufferSource(bytes), formats: [m.MP4, m.QTFF] });
    try {
      const v = (await input.getPrimaryVideoTrack())!;
      const a = await input.getPrimaryAudioTrack();
      const w = (await new m.CanvasSink(v, width ? { width } : {}).getCanvas(Math.max(t, await v.getFirstTimestamp())))!;
      return {
        pixels: patches(w.canvas as HTMLCanvasElement, pts),
        duration: await input.computeDuration(),
        width: v.displayWidth,
        height: v.displayHeight,
        frames: (await v.computePacketStats()).packetCount,
        audio: a?.codec ?? null,
        audioDuration: a ? await a.computeDuration() : null,
      };
    } finally {
      input.dispose();
    }
  },
  runExport: async (format, abortAt) => {
    const ctl = new AbortController();
    let progress = 0;
    try {
      const zip = await exportZip(getContentLayer()!, useDoc.getState().project!, exporters.get(format), (slide, __, percent) => {
        if (slide > 0) progress++; // 0 = Vorbereitung
        if (abortAt !== undefined && (percent ?? 0) >= abortAt) ctl.abort();
      }, ctl.signal);
      return { files: Object.keys(unzipSync(new Uint8Array(await zip.arrayBuffer()))), progress };
    } catch (e) {
      return { error: e instanceof Error ? `${e.name}: ${e.message}` : String(e), progress };
    }
  },
  fakePicker: (mode) => {
    const fail = (name: string) => () => Promise.reject(new DOMException('test', name));
    window.showDirectoryPicker =
      mode === 'abort' ? fail('AbortError') : mode === 'security' ? fail('SecurityError') : async () => (await navigator.storage.getDirectory()).getDirectoryHandle(TEST_FOLDER, { create: true });
  },
  folderFiles: async (clear) => {
    const root = await navigator.storage.getDirectory();
    const out: Record<string, string> = {};
    const dir = await root.getDirectoryHandle(TEST_FOLDER, { create: true });
    for await (const [sub, handle] of dir.entries()) {
      if (handle.kind !== 'directory') continue;
      for await (const [name, file] of (handle as FileSystemDirectoryHandle).entries()) {
        const bytes = await (await (file as FileSystemFileHandle).getFile()).arrayBuffer();
        out[`${sub}/${name}`] = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (b) => b.toString(16).padStart(2, '0')).join('');
      }
    }
    if (clear) await root.removeEntry(TEST_FOLDER, { recursive: true });
    return out;
  },
  holdEffects: (on) => {
    const layer = getContentLayer()!;
    if (on) layer.add(new Konva.Group({ name: EFFECT_PENDING_NODE, id: 'hold-effects' }));
    else layer.findOne('#hold-effects')?.destroy();
  },
  slowGrain: (ms) => {
    const g = effects.get('grain');
    const orig = (slowGrainOrig ??= g.apply);
    g.apply = async (ctx, p, scale) => (ms && scale >= 1 && (await new Promise((r) => setTimeout(r, ms))), orig(ctx, p, scale));
  },
  videoExportOpen: () => videoExportStats.open,
};

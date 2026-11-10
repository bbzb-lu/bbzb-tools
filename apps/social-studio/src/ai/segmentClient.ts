import type { AiTool } from '../core/types';

export type Device = 'webgpu' | 'wasm';
type Progress = { phase: 'download' | 'run'; fraction: number };
type Alpha = { width: number; height: number; alpha: Uint8ClampedArray };
export type ToWorker = { image: Blob; device: Device };
export type FromWorker =
  | ({ type: 'progress' } & Progress)
  | ({ type: 'done' } & Alpha)
  | { type: 'error'; network: boolean; message: string };

/** Es läuft schon ein Freistellen: höchstens ein Lauf zugleich. */
export class AiBusy extends Error {
  name = 'AiBusy';
}
/** Modell-Host nicht erreichbar (z. B. Netzsperre): die Oberfläche zeigt den Netzhinweis. */
export class AiNetworkError extends Error {
  name = 'AiNetworkError';
}

/**
 * Ein Worker je Lauf, danach beendet (gibt den Speicher des Modells frei, das Modell selbst liegt im Cache des Browsers).
 * Zuerst WebGPU; jeder Fehler ausser Netz führt zu einem neuen Worker mit WASM, und WASM bleibt für die Sitzung.
 */
export function createSegmentClient(makeWorker: () => Worker) {
  let busy = false;
  // Kippt bei jedem Nicht-Netz-Fehler, auch wenn die GPU unschuldig war: dann scheitert WASM gleich und meldet den echten Fehler.
  let gpuFailed = false;

  const once = (image: Blob, device: Device, opts: Parameters<AiTool['run']>[1]) =>
    new Promise<Alpha>((resolve, reject) => {
      const w = makeWorker();
      const end = () => {
        w.terminate();
        opts.signal.removeEventListener('abort', abort);
      };
      const abort = () => {
        end();
        reject(new DOMException('Freistellen abgebrochen', 'AbortError'));
      };
      opts.signal.addEventListener('abort', abort);
      w.onmessage = ({ data: m }: MessageEvent<FromWorker>) => {
        if (m.type === 'progress') return opts.onProgress({ phase: m.phase, fraction: m.fraction });
        end();
        if (m.type === 'done') resolve({ width: m.width, height: m.height, alpha: m.alpha });
        else reject(m.network ? new AiNetworkError(m.message) : new Error(m.message));
      };
      // Absturz im Worker (z. B. Speicherabbruch von onnxruntime) kommt nicht als Nachricht
      w.onerror = (e) => {
        end();
        reject(new Error(e.message || 'Worker abgestürzt'));
      };
      w.postMessage({ image, device } satisfies ToWorker);
    });

  return {
    async run(image: Blob, opts: Parameters<AiTool['run']>[1]): Promise<Alpha> {
      if (busy) throw new AiBusy('Freistellen läuft schon');
      if (opts.signal.aborted) throw new DOMException('Freistellen abgebrochen', 'AbortError');
      busy = true;
      try {
        if (!gpuFailed) {
          try {
            return await once(image, 'webgpu', opts);
          } catch (e) {
            if (e instanceof AiNetworkError || (e as Error).name === 'AbortError') throw e;
            gpuFailed = true;
          }
        }
        return await once(image, 'wasm', opts);
      } finally {
        busy = false;
      }
    },
  };
}

export const segmentClient = createSegmentClient(() => new Worker(new URL('./segmentWorker.ts', import.meta.url), { type: 'module' }));

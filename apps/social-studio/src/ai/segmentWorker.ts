/// <reference lib="webworker" />
import { AutoModel, AutoProcessor, env, RawImage, type Tensor } from '@huggingface/transformers';
// Laufzeit von onnxruntime auf der eigenen Herkunft statt vom CDN (transformers.js setzt sonst jsdelivr)
import wasmUrl from '@ort-dist/ort-wasm-simd-threaded.jsep.wasm?url';
import { cutout } from '../tokens';
import type { FromWorker, ToWorker } from './segmentClient';
import { alphaFromModel } from './toMask';

const { id, revision, host, inputSize, dtype, downloadMB } = cutout.model;
env.remoteHost = host;
env.allowLocalModels = false;
env.backends.onnx.wasm!.wasmPaths = { wasm: new URL(wasmUrl, self.location.href).href };

const post = (m: FromWorker, transfer: Transferable[] = []) => self.postMessage(m, transfer);

self.onmessage = async ({ data: { image, device } }: MessageEvent<ToWorker>) => {
  const files = new Map<string, { loaded: number; total: number }>();
  let loading = true;
  let last = -1;
  try {
    const progress_callback = (p: { status: string; file?: string; loaded?: number; total?: number }) => {
      if (p.status !== 'progress' || !p.file || !p.total) return;
      files.set(p.file, { loaded: p.loaded ?? 0, total: p.total });
      const all = [...files.values()];
      const sum = (k: 'loaded' | 'total') => all.reduce((s, f) => s + f[k], 0);
      // Nenner mindestens die Modellgrösse: die kleinen Konfigurationsdateien kommen zuerst und zeigen sonst kurz 100 %
      const percent = Math.floor((100 * sum('loaded')) / Math.max(sum('total'), downloadMB * 1e6));
      if (percent === last) return; // nur ganze Prozent melden, nicht jeden Datenblock
      last = percent;
      post({ type: 'progress', phase: 'download', fraction: Math.min(percent, 100) / 100 });
    };
    if (device === 'webgpu' && !('gpu' in navigator)) throw new Error('WebGPU fehlt');
    const [model, processor] = await Promise.all([
      AutoModel.from_pretrained(id, { revision, dtype, device, progress_callback }),
      AutoProcessor.from_pretrained(id, { revision, progress_callback }),
    ]);
    loading = false;
    post({ type: 'progress', phase: 'run', fraction: 0 });

    // Foto vor dem Modell auf die Eingabegrösse bringen (gequetscht); maskFromAlpha zieht x und y getrennt auf die Maske zurück
    const bitmap = await createImageBitmap(image);
    const ctx = new OffscreenCanvas(inputSize, inputSize).getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0, inputSize, inputSize);
    bitmap.close();
    const raw = new RawImage(ctx.getImageData(0, 0, inputSize, inputSize).data, inputSize, inputSize, 4).rgb();
    const { pixel_values } = await processor(raw);
    // ISNet ist in transformers.js kein bekannter Typ: Eingabename aus der Sitzung, Ausgabe roh (min-max statt sigmoid)
    const input = (model as unknown as { sessions: { model: { inputNames: string[] } } }).sessions.model.inputNames[0]!;
    const out = Object.values(await model({ [input]: pixel_values }))[0] as Tensor;
    const result = alphaFromModel(out.data as Float32Array, inputSize);
    await model.dispose();
    post({ type: 'done', ...result }, [result.alpha.buffer]);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    post({ type: 'error', network: loading && /fetch|network|locate file/i.test(message), message });
  }
};

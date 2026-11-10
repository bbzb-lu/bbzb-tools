import type { AiTool } from '../core/types';
import { AiBusy, AiNetworkError } from './segmentClient';

export type FakeMode = 'kreis' | 'leer' | 'netz';

/**
 * Ersatz für das Modell in e2e-Tests (nur über den Test-Hook, nie in `dist`): Kreis in der Mitte (Durchmesser = halbe kurze
 * Seite), leeres Ergebnis («kein Motiv») oder Netzfehler. `ms` Laufzeit, damit Tests Abbrechen und «läuft schon» prüfen können.
 */
export const fakeSegment = (mode: FakeMode, ms: number): AiTool['run'] => {
  let busy = false;
  return async (image, { signal, onProgress }) => {
    if (busy) throw new AiBusy('Freistellen läuft schon');
    busy = true;
    try {
      return await once(image, signal, onProgress);
    } finally {
      busy = false;
    }
  };

  async function once(image: Blob, signal: AbortSignal, onProgress: Parameters<AiTool['run']>[1]['onProgress']) {
    const bitmap = await createImageBitmap(image);
    const { width, height } = bitmap;
    bitmap.close();
    onProgress({ phase: 'download', fraction: 1 });
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, ms);
      const abort = () => (clearTimeout(t), reject(new DOMException('Freistellen abgebrochen', 'AbortError')));
      if (signal.aborted) abort();
      signal.addEventListener('abort', abort, { once: true });
    });
    if (mode === 'netz') throw new AiNetworkError('Failed to fetch');
    onProgress({ phase: 'run', fraction: 1 });
    const alpha = new Uint8ClampedArray(width * height);
    const r = Math.min(width, height) / 4;
    if (mode === 'kreis')
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) if ((x + 0.5 - width / 2) ** 2 + (y + 0.5 - height / 2) ** 2 <= r * r) alpha[y * width + x] = 255;
    return { width, height, alpha };
  }
};

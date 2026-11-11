import { describe, expect, it, vi } from 'vitest';
import { AiBusy, AiNetworkError, createSegmentClient, type FromWorker, type ToWorker } from './segmentClient';

/** Test-Worker: merkt sich Nachrichten, die Antworten schreibt der Test. */
class FakeWorker {
  onmessage: ((e: MessageEvent<FromWorker>) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  sent: ToWorker[] = [];
  terminated = false;
  postMessage(m: ToWorker) {
    this.sent.push(m);
  }
  terminate() {
    this.terminated = true;
  }
  reply(m: FromWorker) {
    this.onmessage?.({ data: m } as MessageEvent<FromWorker>);
  }
}

const setup = () => {
  const workers: FakeWorker[] = [];
  const client = createSegmentClient(() => {
    const w = new FakeWorker();
    workers.push(w);
    return w as unknown as Worker;
  });
  return { client, workers };
};
const opts = (onProgress = vi.fn(), signal = new AbortController().signal) => ({ signal, onProgress });
const result = { type: 'done' as const, width: 2, height: 1, alpha: new Uint8ClampedArray([0, 255]) };
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('segmentClient', () => {
  it('Fortschritt kommt an, Ergebnis kommt zurück, Worker wird danach beendet', async () => {
    const { client, workers } = setup();
    const onProgress = vi.fn();
    const p = client.run(new Blob(), opts(onProgress));
    await flush();
    expect(workers).toHaveLength(1);
    expect(workers[0]!.sent[0]!.device).toBe('webgpu');
    workers[0]!.reply({ type: 'progress', phase: 'download', fraction: 0.5 });
    workers[0]!.reply({ type: 'progress', phase: 'run', fraction: 0 });
    workers[0]!.reply(result);
    await expect(p).resolves.toEqual({ width: 2, height: 1, alpha: result.alpha });
    expect(onProgress.mock.calls).toEqual([[{ phase: 'download', fraction: 0.5 }], [{ phase: 'run', fraction: 0 }]]);
    expect(workers[0]!.terminated).toBe(true); // Speicher freigeben
  });

  it('Abbruch beendet den Worker und meldet AbortError, der nächste Lauf startet neu', async () => {
    const { client, workers } = setup();
    const ac = new AbortController();
    const p = client.run(new Blob(), opts(vi.fn(), ac.signal));
    await flush();
    ac.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
    expect(workers[0]!.terminated).toBe(true);
    const again = client.run(new Blob(), opts());
    await flush();
    expect(workers).toHaveLength(2);
    workers[1]!.reply(result);
    await expect(again).resolves.toMatchObject({ width: 2 });
  });

  it('schon abgebrochenes Signal: kein Worker, AbortError', async () => {
    const { client, workers } = setup();
    const ac = new AbortController();
    ac.abort();
    await expect(client.run(new Blob(), opts(vi.fn(), ac.signal))).rejects.toMatchObject({ name: 'AbortError' });
    expect(workers).toHaveLength(0);
  });

  it('zweiter paralleler Aufruf wirft AiBusy, der erste läuft weiter', async () => {
    const { client, workers } = setup();
    const p = client.run(new Blob(), opts());
    await expect(client.run(new Blob(), opts())).rejects.toBeInstanceOf(AiBusy);
    await flush();
    expect(workers).toHaveLength(1);
    workers[0]!.reply(result);
    await expect(p).resolves.toMatchObject({ width: 2 });
  });

  it('Fehler mit WebGPU (Meldung oder Absturz): neuer Worker mit WASM, danach gleich WASM', async () => {
    const { client, workers } = setup();
    const p = client.run(new Blob(), opts());
    await flush();
    workers[0]!.reply({ type: 'error', network: false, message: 'shader' });
    await flush();
    expect(workers[0]!.terminated).toBe(true);
    expect(workers[1]!.sent[0]!.device).toBe('wasm');
    workers[1]!.reply(result);
    await expect(p).resolves.toMatchObject({ width: 2 });

    const next = client.run(new Blob(), opts());
    await flush();
    expect(workers[2]!.sent[0]!.device).toBe('wasm');
    workers[2]!.reply(result);
    await next;

    const { client: c2, workers: w2 } = setup();
    const crash = c2.run(new Blob(), opts());
    await flush();
    w2[0]!.onerror?.({ message: 'abort' } as ErrorEvent);
    await flush();
    expect(w2[1]!.sent[0]!.device).toBe('wasm');
    w2[1]!.reply({ type: 'error', network: false, message: 'wasm kaputt' });
    await expect(crash).rejects.toThrow('wasm kaputt');
  });

  it('Modell-Host nicht erreichbar: AiNetworkError ohne WASM-Versuch, nächster Lauf versucht es neu', async () => {
    const { client, workers } = setup();
    const p = client.run(new Blob(), opts());
    await flush();
    workers[0]!.reply({ type: 'error', network: true, message: 'Failed to fetch' });
    await expect(p).rejects.toBeInstanceOf(AiNetworkError);
    expect(workers).toHaveLength(1);
    expect(workers[0]!.terminated).toBe(true);
    const again = client.run(new Blob(), opts());
    await flush();
    expect(workers[1]!.sent[0]!.device).toBe('webgpu');
    workers[1]!.reply(result);
    await again;
  });
});

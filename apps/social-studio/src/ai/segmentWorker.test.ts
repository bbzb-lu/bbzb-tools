import { expect, it, vi } from 'vitest';
import { cutout } from '../tokens';

const calls = vi.hoisted(() => [] as [string, string, Record<string, unknown>][]);
// Ersatz-Lader: merkt sich die Argumente und bricht ab, bevor ein Modell nötig wäre
vi.mock('@huggingface/transformers', () => {
  const loader = (kind: string) => ({
    from_pretrained: async (id: string, opts: Record<string, unknown>) => {
      calls.push([kind, id, opts]);
      throw new Error('Testlader');
    },
  });
  return { AutoModel: loader('model'), AutoProcessor: loader('processor'), env: { backends: { onnx: { wasm: {} } } }, RawImage: class {} };
});

it('Modellrevision ist ein fester Commit (40 Hex) und geht an Modell und Prozessor', async () => {
  expect(cutout.model.revision).toMatch(/^[0-9a-f]{40}$/);
  const posted: unknown[] = [];
  vi.stubGlobal('self', { location: { href: 'http://localhost/' }, postMessage: (m: unknown) => posted.push(m) });
  await import('./segmentWorker');
  const onmessage = (globalThis.self as unknown as { onmessage: (e: { data: unknown }) => Promise<void> }).onmessage;
  await onmessage({ data: { image: new Blob(), device: 'wasm' } });
  expect(calls.map(([kind, id, o]) => [kind, id, o.revision])).toEqual([
    ['model', cutout.model.id, cutout.model.revision],
    ['processor', cutout.model.id, cutout.model.revision],
  ]);
  expect(posted).toEqual([{ type: 'error', network: false, message: 'Testlader' }]);
  vi.unstubAllGlobals();
});

import { expect, it, vi } from 'vitest';
import { cutout } from '../tokens';

const calls = vi.hoisted(() => [] as [string, string, Record<string, unknown>][]);
const fail = vi.hoisted(() => ({ message: 'Testlader' }));
// Ersatz-Lader: merkt sich die Argumente und bricht ab, bevor ein Modell nötig wäre
vi.mock('@huggingface/transformers', () => {
  const loader = (kind: string) => ({
    from_pretrained: async (id: string, opts: Record<string, unknown>) => {
      calls.push([kind, id, opts]);
      throw new Error(fail.message);
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
  expect(posted).toEqual([{ type: 'error', reason: undefined, message: 'Testlader' }]);
  vi.unstubAllGlobals();
});

it.each([
  ['Could not locate file: "https://huggingface.co/x/resolve/y/onnx/model.onnx".', 'missing'],
  ['404 error', 'missing'],
  ['Failed to fetch', 'network'],
  ['NetworkError when attempting to fetch resource.', 'network'],
])('Ladefehler «%s» ist %s', async (message, reason) => {
  fail.message = message;
  vi.resetModules();
  const posted: unknown[] = [];
  vi.stubGlobal('self', { location: { href: 'http://localhost/' }, postMessage: (m: unknown) => posted.push(m) });
  await import('./segmentWorker');
  await (globalThis.self as unknown as { onmessage: (e: { data: unknown }) => Promise<void> }).onmessage({ data: { image: new Blob(), device: 'wasm' } });
  expect(posted).toEqual([{ type: 'error', reason, message }]);
  vi.unstubAllGlobals();
});

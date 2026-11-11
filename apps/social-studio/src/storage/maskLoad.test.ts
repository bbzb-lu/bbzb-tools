import { afterEach, describe, expect, it, vi } from 'vitest';
import { memoryAssetStore } from './assets';
import { loadMask, MaskError } from './maskAsset';

/** PNG-Kopf mit behaupteter Grösse (Signatur + IHDR). */
const header = (w: number, h: number) => {
  const b = new Uint8Array(33);
  b.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
  new DataView(b.buffer).setUint32(16, w);
  new DataView(b.buffer).setUint32(20, h);
  return new Blob([b], { type: 'image/png' });
};

afterEach(() => vi.unstubAllGlobals());

describe('loadMask', () => {
  it('lehnt eine zu grosse Maske nach dem PNG-Kopf ab, ohne zu dekodieren', async () => {
    const decode = vi.fn();
    vi.stubGlobal('createImageBitmap', decode);
    const store = memoryAssetStore();
    const id = await store.put(header(60000, 60000));
    await expect(loadMask(store, id)).rejects.toBeInstanceOf(MaskError);
    expect(decode).not.toHaveBeenCalled();
  });

  it('lehnt eine Datei ohne PNG-Kopf ab, ohne zu dekodieren', async () => {
    const decode = vi.fn();
    vi.stubGlobal('createImageBitmap', decode);
    const store = memoryAssetStore();
    const id = await store.put(new Blob(['kein png, aber lang genug fuer den kopf bytes']));
    await expect(loadMask(store, id)).rejects.toBeInstanceOf(MaskError);
    expect(decode).not.toHaveBeenCalled();
  });
});

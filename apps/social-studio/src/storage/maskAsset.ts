import { zlibSync } from 'fflate';
import { mask as maskTokens } from '../tokens';
import type { Mask } from '../model/mask';
import type { AssetMeta } from '../model/types';
import type { AssetStore } from './assets';

export class MaskError extends Error {
  constructor() {
    super('Die Maske konnte nicht gelesen werden.');
    this.name = 'MaskError';
  }
}

export class MaskSaveTimeout extends Error {
  constructor() {
    super('Das Speichern der Maske dauerte zu lange.');
    this.name = 'MaskSaveTimeout';
  }
}

export const maskMeta = (m: { width: number; height: number }): AssetMeta => ({ mime: 'image/png', width: m.width, height: m.height, name: 'Maske' });

const CRC = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (...parts: Uint8Array[]) => {
  let c = 0xffffffff;
  for (const p of parts) for (let i = 0; i < p.length; i++) c = CRC[(c ^ p[i]!) & 255]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

/**
 * Maske als Graustufen-PNG (8 Bit, Wert = R = G = B), ohne Canvas: `OffscreenCanvas.convertToBlob` und `HTMLCanvasElement.toBlob`
 * antworteten in Edge ab und zu nie (Strich blieb ungespeichert). Gleiche Maske, gleiche Bytes, also gleiche Asset-ID.
 */
export function encodeMaskPng(m: Mask): Blob {
  const raw = new Uint8Array((m.width + 1) * m.height); // je Zeile ein Filterbyte 0 (kein Filter)
  for (let y = 0; y < m.height; y++) raw.set(m.data.subarray(y * m.width, (y + 1) * m.width), y * (m.width + 1) + 1);
  const chunk = (type: string, body: Uint8Array) => {
    const out = new Uint8Array(12 + body.length);
    const t = new TextEncoder().encode(type);
    new DataView(out.buffer).setUint32(0, body.length);
    out.set(t, 4);
    out.set(body, 8);
    new DataView(out.buffer).setUint32(8 + body.length, crc32(t, body));
    return out;
  };
  const head = new Uint8Array(13);
  const dv = new DataView(head.buffer);
  dv.setUint32(0, m.width);
  dv.setUint32(4, m.height);
  head.set([8, 0, 0, 0, 0], 8); // 8 Bit, Graustufen, Standardverfahren
  const sig = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
  return new Blob([sig, chunk('IHDR', head), chunk('IDAT', zlibSync(raw, { level: 3 })), chunk('IEND', new Uint8Array(0))], { type: 'image/png' });
}

/** Arbeitskopie speichern, Asset-ID = SHA-256 wie bei Bildern. Nie still hängen: das Schreiben hat ein Zeitlimit (MaskSaveTimeout). */
export async function saveMask(store: AssetStore, m: Mask): Promise<string> {
  const blob = encodeMaskPng(m); // liest die Maske sofort
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<never>((_, no) => void (timer = setTimeout(() => no(new MaskSaveTimeout()), maskTokens.saveTimeout)));
  try {
    return await Promise.race([store.put(blob), limit]);
  } finally {
    clearTimeout(timer);
  }
}

/** Maskendatei lesen: neue Arbeitskopie (der Aufrufer darf sie bemalen). Fehlende, undekodierbare oder zu grosse Datei: MaskError. */
export async function loadMask(store: AssetStore, id: string): Promise<Mask> {
  let bmp: ImageBitmap | undefined;
  try {
    const blob = await store.get(id);
    // Grösse aus dem PNG-Kopf (Signatur 8 Bytes, IHDR: Breite ab Byte 16, Höhe ab 20) prüfen, bevor etwas dekodiert wird
    const head = new DataView(await blob.slice(0, 24).arrayBuffer());
    if (head.byteLength < 24 || head.getUint32(0) !== 0x89504e47 || head.getUint32(16) > maskTokens.maxSize || head.getUint32(20) > maskTokens.maxSize) throw new MaskError();
    bmp = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    if (bmp.width > maskTokens.maxSize || bmp.height > maskTokens.maxSize) throw new MaskError();
    const canvas = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(bmp, 0, 0);
    const rgba = ctx.getImageData(0, 0, bmp.width, bmp.height).data;
    const data = new Uint8ClampedArray(bmp.width * bmp.height);
    for (let i = 0; i < data.length; i++) data[i] = rgba[i * 4]!;
    const out = { width: bmp.width, height: bmp.height, data };
    canvas.width = canvas.height = 0;
    return out;
  } catch (e) {
    throw e instanceof MaskError ? e : new MaskError();
  } finally {
    bmp?.close();
  }
}

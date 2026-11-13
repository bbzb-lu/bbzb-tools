import { heicToJpeg } from './heic';

export class ImportError extends Error {
  constructor() {
    super(
      'Dieses Bild kann Edge nicht öffnen. Schick es als JPEG, auf dem iPhone unter Einstellungen › Kamera › Formate «Maximale Kompatibilität» wählen.',
    );
    this.name = 'ImportError';
  }
}

const MAX = 4096;
export const isHeic = (f: File) => /^image\/hei[cf]$/.test(f.type) || /\.hei[cf]$/i.test(f.name);

/**
 * Dekodiert (mit EXIF-Drehung), verkleinert auf höchstens 4096 px und kodiert immer neu:
 * so gelangen EXIF/GPS-Daten nie in den Speicher oder in Projektdateien.
 */
export async function importImage(file: File): Promise<{ blob: Blob; width: number; height: number; mime: string }> {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    // Edge ohne HEVC-Erweiterung kann HEIC nicht öffnen: dann im Browser umwandeln (JPEG, libheif wendet die Drehung an).
    if (!isHeic(file)) throw new ImportError();
    try {
      bmp = await createImageBitmap(await heicToJpeg(file));
    } catch {
      throw new ImportError();
    }
  }
  try {
    const f = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
    const width = Math.round(bmp.width * f);
    const height = Math.round(bmp.height * f);
    const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const canvas = new OffscreenCanvas(width, height);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, width, height);
    return { blob: await canvas.convertToBlob({ type: mime, quality: 0.92 }), width, height, mime };
  } finally {
    bmp.close();
  }
}

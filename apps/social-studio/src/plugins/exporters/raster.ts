import type { Exporter } from '../../core/types';
import { exportQuality } from '../../tokens';

const toBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(`${type} konnte nicht erzeugt werden`))), type, quality),
  );

export const jpegExporter: Exporter = {
  id: 'jpeg',
  label: 'JPEG',
  extension: 'jpg',
  encode: (canvas, quality = exportQuality.standard.jpeg) => toBlob(canvas, 'image/jpeg', quality),
};

export const pngExporter: Exporter = {
  id: 'png',
  label: 'PNG',
  extension: 'png',
  encode: (canvas) => toBlob(canvas, 'image/png'),
};

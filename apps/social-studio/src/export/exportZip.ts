import { zipSync } from 'fflate';
import Konva from 'konva';
import { EDITOR_ONLY_NODE, VIDEO_FRAME_NODE } from '../canvas/contentLayer';
import { EFFECT_PENDING_NODE } from '../canvas/effects';
import { ensureDoodlesFor } from '../brand/doodles';
import { ensureTablerFor } from '../brand/tabler';
import { allImagesLoaded, imageFailed, loadAssetImage, MISSING_BRAND, MISSING_BRAND_NODE, MISSING_IMAGE, MISSING_IMAGE_NODE, MISSING_VIDEO, MISSING_VIDEO_NODE, videoStored } from '../canvas/images';
import { videoExporters } from '../core/registries';
import type { Exporter } from '../core/types';
import { fontsMissingText } from '../fonts';
import { assetIdOf } from '../model/elements';
import type { Project } from '../model/types';
import { exportQuality } from '../tokens';
import { useUi } from '../store/ui';
import { isVideoSlide } from './exportVideoSlide';
import { safeFileName } from './fileName';

/** Fehler mit Text für Lernende. */
export class ExportError extends Error {}

export const missingFontsText = (missing: string[]) => `${fontsMissingText(missing)} Export abgebrochen. Lade die Seite neu.`;

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/**
 * Slide `index` in exakt Formatgrösse, ohne Auswahl und ohne Skalierung des Editors.
 * `frames` (MP4-Export): ersetzt im Klon das Bild der Video-Elemente (Id → Bildbereich mit Effekten), statt des Startbilds.
 */
export function renderSlide(content: Konva.Layer, p: Project, index: number, frames?: Map<string, HTMLCanvasElement>): HTMLCanvasElement {
  const { width, height } = p.format;
  const stage = new Konva.Stage({ container: document.createElement('div'), width, height });
  try {
    // Die Ebene selbst hat keine Transformation (Zoom und Scrollen liegen auf der Editor-Stage).
    // shortcut: klont pro Video-Frame die ganze Ebene (gemessen 28.10.2026: 1 Slide 1.9 ms, 10 Slides/21 Elemente 5.0 ms, bei 4× Drosselung
    // 5.4 bzw. 13.5 ms/Frame), wenn Exporte grosser Projekte auf Schulgeräten zu langsam sind: einmal je Video-Slide klonen, nur die Bilder tauschen.
    const layer = content.clone({ x: -index * width, y: 0, scaleX: 1, scaleY: 1 });
    // Leerer Platzhalter exportiert nichts: an seiner Stelle zeigt die Slide ihren Hintergrund.
    layer.find(`.${EDITOR_ONLY_NODE}`).forEach((n) => n.destroy());
    frames?.forEach((image, id) => {
      const inner = layer.findOne<Konva.Group>((n: Konva.Node) => n.id() === id)?.findOne<Konva.Group>(`.${VIDEO_FRAME_NODE}`);
      // Rohbild (ohne Effekte) bzw. Effekt-Canvas liegt immer in Bildbereichsgrösse darin
      const size = inner?.findOne<Konva.Image>('Image')?.size();
      if (!inner || !size) throw new Error(`Video-Element ${id} ohne Bild`);
      inner.destroyChildren();
      inner.add(new Konva.Image({ image, ...size }));
    });
    stage.add(layer);
    const canvas = stage.toCanvas({ pixelRatio: 1 });
    if (canvas.width !== width || canvas.height !== height) {
      Konva.Util.releaseCanvas(canvas);
      throw new Error(`Slide ${index + 1} hat ${canvas.width} × ${canvas.height} statt ${width} × ${height}`);
    }
    return canvas;
  } finally {
    stage.destroy();
  }
}

/** Bricht ab, wenn ein Platzhalter für ein fehlendes Bild, Video oder Markenbild in der Ebene liegt. */
function checkPlaceholders(content: Konva.Layer): void {
  const video = content.findOne(`.${MISSING_VIDEO_NODE}`);
  if (video) throw new ExportError(video.getAttr('notice') ?? MISSING_VIDEO);
  if (content.findOne(`.${MISSING_IMAGE_NODE}`)) throw new ExportError(MISSING_IMAGE);
  if (content.findOne(`.${MISSING_BRAND_NODE}`)) throw new ExportError(MISSING_BRAND);
}

/** Alle Slides nacheinander in ein ZIP: Video-Slides als MP4, die übrigen als Bild. Hält nie mehr als ein Slide-Canvas im Speicher. */
export async function exportZip(
  content: Konva.Layer,
  p: Project,
  exporter: Exporter,
  onProgress: (slide: number, total: number, percent?: number) => void = () => {},
  signal?: AbortSignal,
): Promise<Blob> {
  const ui = useUi.getState();
  // Ausschnitt-Geist und Textfeld gehören nicht ins Bild. Den Text hat der Blur beim Klick auf «Exportieren» schon übernommen.
  ui.setCropEditId(null);
  ui.setMaskEditId(null); // Folie und Arbeitskopie gehören nicht ins Bild
  ui.setTextEditId(null);
  // Regler-Vorschau gehört nicht in den Export: volle Auflösung erzwingen, die Knoten warten dann als «effect-pending»
  ui.setSliding(false);
  await document.fonts.ready;
  const missing = useUi.getState().missingFonts;
  if (missing.length > 0) throw new ExportError(missingFontsText(missing));
  // Bilder und Videos der sichtbaren Elemente. Videos nur auf Vorhandensein prüfen, nie als Bild laden.
  const ids = Object.values(p.elements)
    .filter((e) => e.visible)
    .map(assetIdOf)
    .filter((id) => id !== undefined);
  const isVideo = (id: string) => p.assets[id]?.mime.startsWith('video/') ?? false;
  if ((await Promise.all(ids.filter(isVideo).map(videoStored))).includes(false)) throw new ExportError(MISSING_VIDEO);
  const assetIds = ids.filter((id) => !isVideo(id));
  // gescheitert: die Knoten zeigen den Platzhalter, MISSING_BRAND_NODE unten bricht ab
  await Promise.all([ensureTablerFor(p).catch(() => undefined), ensureDoodlesFor(p).catch(() => undefined)]);
  await Promise.allSettled(assetIds.map(loadAssetImage));
  await allImagesLoaded();
  if (assetIds.some(imageFailed)) throw new ExportError(MISSING_IMAGE);
  // shortcut: zwei Frames, bis React geladene Bilder gezeichnet hat; nicht garantiert. Bei Fehlexporten auf ein Signal der Knoten umstellen.
  await frame();
  await frame();
  checkPlaceholders(content);
  // Effekt-Canvas (Korn) fertig rechnen lassen, sonst fehlt der Effekt im Bild.
  for (const t = performance.now(); content.findOne(`.${EFFECT_PENDING_NODE}`); await frame()) {
    if (performance.now() - t > 15000) throw new ExportError('Die Effekte sind nicht fertig berechnet. Versuch es nochmals.');
  }
  // Noch einmal: ein Video kann erst während des Wartens scheitern (Datei da, aber nicht dekodierbar)
  checkPlaceholders(content);
  // Vor der ersten Slide (Videos sind jetzt lesbar): kann Edge die Video-Slides kodieren? Sonst entsteht keine Slide.
  const mp4 = videoExporters.get('mp4');
  const videoSlides = p.slides.map((_, i) => i).filter((i) => isVideoSlide(p, i));
  await mp4.prepare(p, videoSlides);
  signal?.throwIfAborted();

  const base = safeFileName(p.name);
  const files: Record<string, Uint8Array> = {};
  for (let i = 0; i < p.slides.length; i++) {
    signal?.throwIfAborted();
    const total = p.slides.length;
    const name = `${base}_${String(i + 1).padStart(2, '0')}`;
    if (videoSlides.includes(i)) {
      onProgress(i + 1, total, 0);
      const render = (frames: Map<string, HTMLCanvasElement>) => renderSlide(content, p, i, frames);
      files[`${name}.${mp4.extension}`] = await mp4.encode({ project: p, index: i, render, onProgress: (pc) => onProgress(i + 1, total, pc), signal });
      continue;
    }
    onProgress(i + 1, total);
    const canvas = renderSlide(content, p, i);
    try {
      const blob = await exporter.encode(canvas, exportQuality[p.exportQuality ?? 'standard'].jpeg);
      files[`${name}.${exporter.extension}`] = new Uint8Array(await blob.arrayBuffer());
    } finally {
      Konva.Util.releaseCanvas(canvas);
    }
    await frame(); // Oberfläche bleibt bedienbar
  }
  signal?.throwIfAborted();
  // Bilder sind schon komprimiert.
  return new Blob([zipSync(files, { level: 0 }) as BlobPart], { type: 'application/zip' });
}

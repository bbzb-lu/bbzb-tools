import { createRegistry } from './registry';
import type { AiTool, AssetPack, ContextBarState, Effect, ElementType, Exporter, FormatPreset, LayoutPreset, VideoExporter } from './types';

export const formats = createRegistry<FormatPreset>('Format');
export const exporters = createRegistry<Exporter>('Exporter');
export const videoExporters = createRegistry<VideoExporter>('Video-Exporter');
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Props je Typ verschieden
export const elementTypes = createRegistry<ElementType<any>>('Elementtyp');
export const assetPacks = createRegistry<AssetPack>('Asset-Paket');
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Parameter je Effekt verschieden
export const effects = createRegistry<Effect<any>>('Effekt');
export const layouts = createRegistry<LayoutPreset>('Layout');
export const aiTools = createRegistry<AiTool>('KI-Werkzeug');
export const contextBars = createRegistry<ContextBarState>('Kontextleiste');
/** Vorrang der Kontextleisten (kleiner gewinnt), Reihenfolge der Spezifikation. */
export const barRank = { crop: 10, mask: 20, text: 30, ai: 40, multi: 50, video: 60, review: 70, undo: 80 } as const;

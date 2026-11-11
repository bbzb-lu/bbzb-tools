import manifestRaw from '../../brand/manifest.json?raw';
import { assetPacks } from '../core/registries';
import { loadBrandAssets } from '../brand/manifest';

// Vite bündelt jedes Bild unter diesen Ordnern, das Manifest wählt aus. Logos liegen in brand/ui/, nie hier.
const files = import.meta.glob('../../brand/{scribbles,icons,textures}/*.{png,svg,jpg,jpeg,webp}', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>;
export const brandUrls = Object.fromEntries(Object.entries(files).map(([p, u]) => [p.replace('../../brand/', ''), u]));

export function registerBrandPack(): void {
  assetPacks.register({ id: 'bbzb', label: 'BBZB', ...loadBrandAssets(manifestRaw, brandUrls) });
}

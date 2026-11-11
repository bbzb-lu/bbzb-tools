import { z } from 'zod';
import { paletteColors } from '../tokens';

export const brandAssetSchema = z.object({
  id: z.string().min(1),
  /** Pfad relativ zu brand/ */
  file: z.string().min(1),
  name: z.string().min(1),
  category: z.enum(['scribble', 'icon', 'textur']),
  /** Farbtoken-Name oder «akzent», nie Hex. */
  defaultColor: z.enum(paletteColors).optional(),
});
export type BrandAssetEntry = z.infer<typeof brandAssetSchema>;
export type BrandAsset = BrandAssetEntry & { url: string };

/**
 * Prüft das Manifest Eintrag für Eintrag: gültige Assets bleiben nutzbar, jedes Problem wird
 * als deutsche Meldung gesammelt. `urls` = vorhandene Dateien (Pfad relativ zu brand/ → URL).
 */
export function loadBrandAssets(raw: string, urls: Record<string, string>): { assets: BrandAsset[]; errors: string[] } {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { assets: [], errors: ['Das Manifest der Markenbilder ist kaputt. Es konnten keine Markenbilder geladen werden.'] };
  }
  const list = (json as { assets?: unknown } | null)?.assets;
  if (!Array.isArray(list)) {
    return { assets: [], errors: ['Das Manifest der Markenbilder ist kaputt: Die Liste «assets» fehlt.'] };
  }
  const assets: BrandAsset[] = [];
  const errors: string[] = [];
  const ids = new Set<string>();
  list.forEach((item, i) => {
    const r = brandAssetSchema.safeParse(item);
    if (!r.success) return void errors.push(`Markenbild Nr. ${i + 1} im Manifest ist ungültig und wird übersprungen.`);
    const e = r.data;
    if (ids.has(e.id)) return void errors.push(`Markenbild «${e.id}» steht mehrfach im Manifest. Nur das erste gilt.`);
    ids.add(e.id);
    const url = urls[e.file];
    if (!url) return void errors.push(`Die Datei zu «${e.name}» fehlt (${e.file}).`);
    assets.push({ ...e, url });
  });
  return { assets, errors };
}

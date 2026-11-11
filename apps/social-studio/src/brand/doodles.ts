import { assetPacks } from '../core/registries';
import type { Project } from '../model/types';
import type { BrandAsset } from './manifest';

/** Doodles (Khushmeen, CC0): Name `<kategorie>-<name>` → Kategorie, viewBox-Masse, gefüllte Pfade, Suchbegriffe (englisch). */
export type DoodlePack = Record<string, { c: string; w: number; h: number; p: string[]; t: string }>;

const PREFIX = 'doodle-';
const NAME = /^[a-z0-9-]+$/;
const PATH = /^[0-9MmLlHhVvCcSsQqTtAaZz .,+eE-]+$/;
export const DOODLE_PACK = 'doodles';

let loaded: Promise<DoodlePack> | undefined;
let known = false;
let failed = false;

/** Eigener Chunk, einmal geladen. Schlägt das Laden fehl, versucht der nächste Aufruf es neu. */
export function loadDoodles(): Promise<DoodlePack> {
  if (!loaded) {
    failed = false;
    loaded = import('../../brand/doodles/doodles.json').then(
      (m) => ((known = true), m.default as DoodlePack),
      (e) => ((loaded = undefined), (failed = true), Promise.reject(e)),
    );
  }
  return loaded;
}

/** Ist die Datei schon da? Davor ist ein fehlendes Doodle nur «lädt», danach wirklich unbekannt. */
export const doodlesLoaded = () => known;

/** Letzter Ladeversuch ist gescheitert: das Doodle ist dann «nicht verfügbar», nicht «lädt». */
export const doodlesFailed = () => failed;

export const isDoodleId = (id: string): boolean => id.startsWith(PREFIX) && NAME.test(id.slice(PREFIX.length));

export function doodleAsset(name: string, pack: DoodlePack): BrandAsset | undefined {
  const d = NAME.test(name) && Object.hasOwn(pack, name) ? pack[name] : undefined;
  // Pfade stammen aus einer Datei, nicht aus Nutzereingaben, gehen aber ungeprüft in ein SVG: nur Pfadzeichen.
  if (!d || !(d.w > 0 && d.h > 0) || !d.p.every((p) => PATH.test(p))) return undefined;
  const paths = d.p.map((p) => `<path d="${p}"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${d.w} ${d.h}" fill="black">${paths}</svg>`;
  return {
    id: PREFIX + name,
    file: `doodles/${name}`, // virtuell, das Schema verlangt einen Wert
    name,
    category: 'icon',
    defaultColor: 'akzent',
    url: `data:image/svg+xml,${encodeURIComponent(svg)}`,
  };
}

export const doodleCategories = (pack: DoodlePack): string[] => [...new Set(Object.values(pack).map((d) => d.c))].sort();

/**
 * Rangfolge: exakter Name (mit oder ohne Kategorie), Namensanfang, Name enthält alle Wörter, Stichwort enthält alle Wörter.
 * Leere Anfrage: alle Doodles (der Kategorie), damit man stöbern kann. `total` zählt alle Treffer vor dem Limit.
 */
export function searchDoodles(pack: DoodlePack, query: string, category?: string, limit = 120): { names: string[]; total: number } {
  const q = query.trim().toLowerCase().replace(/\s+/g, ' ');
  const words = q ? q.split(' ') : [];
  const dashed = q.replace(/ /g, '-');
  const buckets: string[][] = [[], [], [], []];
  for (const [key, { c, t }] of Object.entries(pack)) {
    if (category && c !== category) continue;
    const name = key.slice(c.length + 1);
    if (!q || name === dashed || key === dashed) buckets[0]!.push(key);
    else if (name.startsWith(dashed)) buckets[1]!.push(key);
    else if (words.every((w) => key.includes(w))) buckets[2]!.push(key);
    else if (words.every((w) => t.includes(w))) buckets[3]!.push(key);
  }
  const all = buckets.flat();
  return { names: all.slice(0, limit), total: all.length };
}

/** Lädt die Datei, wenn eine Id «doodle-*» ist, und trägt diese Doodles im Paket «doodles» ein (dort findet sie die Auflösung wie jedes Markenbild). */
export async function ensureDoodles(ids: string[]): Promise<void> {
  const wanted = ids.filter(isDoodleId);
  if (wanted.length === 0) return;
  const data = await loadDoodles();
  if (!assetPacks.has(DOODLE_PACK)) assetPacks.register({ id: DOODLE_PACK, label: 'Doodles', assets: [], errors: [] });
  const pack = assetPacks.get(DOODLE_PACK);
  for (const id of wanted) {
    if (pack.assets.some((a) => a.id === id)) continue;
    const asset = doodleAsset(id.slice(PREFIX.length), data);
    if (asset) pack.assets.push(asset);
  }
}

/** Alle Doodle-Ids eines Projekts vorladen (Öffnen, Export). */
export function ensureDoodlesFor(p: Project): Promise<void> {
  const ids = Object.values(p.elements).map((e) => (e.props as { brandId?: unknown } | null)?.brandId);
  return ensureDoodles(ids.filter((id): id is string => typeof id === 'string'));
}

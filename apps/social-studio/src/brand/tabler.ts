import { assetPacks } from '../core/registries';
import type { Project } from '../model/types';
import type { BrandAsset } from './manifest';

/** Tabler-Outline-Icons: Name → Pfade (24 × 24, Strich) und Suchbegriffe (englisch). */
export type TablerPack = Record<string, { p: string[]; t: string }>;

const PREFIX = 'tabler-';
const NAME = /^[a-z0-9-]+$/;
const PATH = /^[0-9MmLlHhVvCcSsQqTtAaZz .,+eE-]+$/;
export const TABLER_PACK = 'tabler';

let loaded: Promise<TablerPack> | undefined;
let known = false;
let failed = false;

/** Eigener Chunk, einmal geladen. Schlägt das Laden fehl, versucht der nächste Aufruf es neu. */
export function loadTabler(): Promise<TablerPack> {
  if (!loaded) {
    failed = false;
    loaded = import('../../brand/tabler/outline.json').then(
      (m) => ((known = true), m.default as TablerPack),
      (e) => ((loaded = undefined), (failed = true), Promise.reject(e)),
    );
  }
  return loaded;
}

/** Ist die Datei schon da? Davor ist ein fehlendes Tabler-Icon nur «lädt», danach wirklich unbekannt. */
export const tablerLoaded = () => known;

/** Letzter Ladeversuch ist gescheitert (offline, Datei fehlt): das Icon ist dann «nicht verfügbar», nicht «lädt». */
export const tablerFailed = () => failed;

export const isTablerId = (id: string): boolean => id.startsWith(PREFIX) && NAME.test(id.slice(PREFIX.length));

export function tablerAsset(name: string, pack: TablerPack): BrandAsset | undefined {
  const icon = NAME.test(name) && Object.hasOwn(pack, name) ? pack[name] : undefined;
  // Pfade stammen aus einer Datei, nicht aus Nutzereingaben, gehen aber ungeprüft in ein SVG: nur Pfadzeichen.
  if (!icon || !icon.p.every((d) => PATH.test(d))) return undefined;
  const paths = icon.p.map((d) => `<path d="${d}"/>`).join('');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  return {
    id: PREFIX + name,
    file: `tabler/${name}`, // virtuell, das Schema verlangt einen Wert
    name,
    category: 'icon',
    defaultColor: 'akzent',
    url: `data:image/svg+xml,${encodeURIComponent(svg)}`,
  };
}

/** Namen: exakter Name, Namensanfang, Name enthält alle Wörter, Stichwort enthält alle Wörter. */
export function searchTabler(pack: TablerPack, query: string, limit = 120): string[] {
  const q = query.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!q) return [];
  const words = q.split(' ');
  const dashed = q.replace(/ /g, '-');
  const buckets: string[][] = [[], [], [], []];
  for (const [name, { t }] of Object.entries(pack)) {
    if (name === dashed) buckets[0]!.push(name);
    else if (name.startsWith(dashed)) buckets[1]!.push(name);
    else if (words.every((w) => name.includes(w))) buckets[2]!.push(name);
    else if (words.every((w) => t.includes(w))) buckets[3]!.push(name);
  }
  return buckets.flat().slice(0, limit);
}

/** Lädt die Datei, wenn eine Id «tabler-*» ist, und trägt diese Icons im Paket «tabler» ein (dort findet sie die Auflösung wie jedes Markenbild). */
export async function ensureTabler(ids: string[]): Promise<void> {
  const wanted = ids.filter(isTablerId);
  if (wanted.length === 0) return;
  const data = await loadTabler();
  if (!assetPacks.has(TABLER_PACK)) assetPacks.register({ id: TABLER_PACK, label: 'Tabler', assets: [], errors: [] });
  const pack = assetPacks.get(TABLER_PACK);
  for (const id of wanted) {
    if (pack.assets.some((a) => a.id === id)) continue;
    const asset = tablerAsset(id.slice(PREFIX.length), data);
    if (asset) pack.assets.push(asset);
  }
}

/** Alle Markenbild-Ids eines Projekts vorladen (Öffnen, Export). */
export function ensureTablerFor(p: Project): Promise<void> {
  const ids = Object.values(p.elements).map((e) => (e.props as { brandId?: unknown } | null)?.brandId);
  return ensureTabler(ids.filter((id): id is string => typeof id === 'string'));
}

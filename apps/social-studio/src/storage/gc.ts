import type { AssetStore } from './assets';
import { db } from './db';

export const GC_MIN_AGE_MS = 10 * 60 * 1000;

/** Löscht Assets, die kein gespeichertes Projekt führt und älter als GC_MIN_AGE_MS sind. Gibt die Anzahl zurück. */
export async function collectGarbage(store: AssetStore, now = Date.now()): Promise<number> {
  // Assets zuerst listen: ein danach geschriebenes Asset ist kein Kandidat; ein früheres steht entweder im danach gelesenen Projekt oder ist alt.
  const assets = await store.list();
  const used = new Set((await db.projects.toArray()).flatMap((r) => [...Object.keys(r.data.assets), ...(r.keep ?? [])]));
  const old = (a: { id: string; lastModified: number }) => now - Math.max(a.lastModified, store.touched?.get(a.id) ?? 0) >= GC_MIN_AGE_MS;
  const orphans = assets.filter((a) => !used.has(a.id) && old(a));
  let n = 0;
  // Bricht beim ersten Löschfehler ab (Rest bleibt für den nächsten Lauf).
  for (const a of orphans) {
    // Neu prüfen: ein `put` dazwischen hat die Datei vorgemerkt, ohne sie neu zu schreiben.
    if (!old(a)) continue;
    await store.delete(a.id);
    n++;
  }
  return n;
}

import { ensureDoodles } from '../brand/doodles';
import { ensureTabler } from '../brand/tabler';
import { DUPLICATE_OFFSET } from '../model/elements';
import { editorContext } from '../canvas/editorContext';
import { assetPacks, elementTypes } from '../core/registries';

/** Eintrag der Brand Library: Markenbild aus einem Paket oder Variante eines Elementtyps (Tag). */
export type LibraryItem = { kind: 'asset'; id: string } | { kind: 'variant'; type: string; variant: string };

/** Datentyp beim Ziehen auf die Leinwand; Dateien (Fotos) kommen ohne ihn. */
export const LIBRARY_MIME = 'application/x-bbzb-library';

export function readLibraryItem(dt: DataTransfer): LibraryItem | null {
  if (!dt.types.includes(LIBRARY_MIME)) return null;
  try {
    const v = JSON.parse(dt.getData(LIBRARY_MIME));
    const str = (k: string) => typeof v?.[k] === 'string';
    return (v?.kind === 'asset' && str('id')) || (v?.kind === 'variant' && str('type') && str('variant')) ? (v as LibraryItem) : null;
  } catch {
    return null;
  }
}

const UNKNOWN = 'Dieses Markenbild gibt es nicht mehr. Lade die Seite neu.';

/** Mitte der aktuellen Slide, je belegtem Treffer um den Duplizier-Versatz nach rechts unten verschoben; nichts belegt: undefined (Typ setzt mittig). */
function freeCenter(ctx: ReturnType<typeof editorContext>): { x: number; y: number } | undefined {
  const { width: W, height: H } = ctx.project.format;
  const taken = Object.values(ctx.project.elements).map((e) => [e.x + e.width / 2, e.y + e.height / 2] as const);
  const at = { x: ctx.currentSlide * W + W / 2, y: H / 2 };
  const start = { ...at };
  while (taken.some(([x, y]) => Math.abs(x - at.x) < 1 && Math.abs(y - at.y) < 1)) {
    at.x += DUPLICATE_OFFSET;
    at.y += DUPLICATE_OFFSET;
  }
  return at.x === start.x ? undefined : at;
}

/** Einfügen: ohne `at` mittig auf die aktuelle Slide (bei belegter Stelle versetzt), sonst mit der Mitte bei `at` (globale Koordinaten). */
export async function insertLibraryItem(item: LibraryItem, at?: { x: number; y: number }): Promise<void> {
  const ctx = editorContext();
  at ??= freeCenter(ctx);
  if (item.kind === 'asset') {
    await Promise.all([ensureTabler([item.id]), ensureDoodles([item.id])]).catch(() => undefined); // fehlt die Datei, meldet UNKNOWN unten
    const asset = assetPacks.all().flatMap((p) => p.assets).find((a) => a.id === item.id);
    const type = asset && elementTypes.all().find((t) => t.acceptsAsset?.(asset) && t.fromAsset);
    if (!asset || !type) return ctx.notify('error', UNKNOWN);
    return type.fromAsset!(asset, ctx, at);
  }
  const type = item.kind === 'variant' && elementTypes.has(item.type) ? elementTypes.get(item.type) : undefined;
  // Ziehdaten sind nicht vertrauenswürdig: unbekannte Variante wie unbekanntes Markenbild melden.
  if (!type?.insertVariant || !type.variants?.some((v) => v.id === item.variant)) return ctx.notify('error', UNKNOWN);
  return type.insertVariant(item.variant, ctx, at);
}

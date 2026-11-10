import { elementBounds, intersects } from './geometry';
import { ModelError, clone } from './slides';
import type { Element, Project } from './types';
import type { Channel } from '../tokens';

/** Kanal des Projekts; in älteren Projekten fehlt er: Instagram (Ruling R8). */
export const channelOf = (p: Pick<Project, 'channel'>): Channel => p.channel ?? 'instagram';

function get(p: Project, id: string): Element {
  const e = p.elements[id];
  if (!e) throw new ModelError(`Element ${id} existiert nicht.`);
  return e;
}

export function addElement(p: Project, el: Element, aboveId?: string): void {
  const above = aboveId === undefined ? p.order.length - 1 : p.order.indexOf(aboveId);
  if (above < 0 && aboveId !== undefined) throw new ModelError(`Element ${aboveId} existiert nicht.`);
  const at = above + 1;
  p.elements[el.id] = el;
  p.order.splice(at, 0, el.id);
}

export function updateElement(p: Project, id: string, patch: Partial<Omit<Element, 'id' | 'type'>>): void {
  Object.assign(get(p, id), patch);
}

export function removeElement(p: Project, id: string): void {
  get(p, id);
  delete p.elements[id];
  p.order = p.order.filter((o) => o !== id);
}

/** `offset` 40: sichtbares Duplikat, 0: deckungsgleich. */
export function duplicateElement(p: Project, id: string, offset = 40): string {
  const src = get(p, id);
  const copy = clone({ ...src, id: crypto.randomUUID(), x: src.x + offset, y: src.y + offset, name: `${src.name} Kopie` });
  addElement(p, copy, id);
  return copy.id;
}

/** Gesperrte bleiben. */
export function removeElements(p: Project, ids: string[]): void {
  for (const id of ids) if (!get(p, id).locked) removeElement(p, id);
}

/** Neue Ids in Eingabereihenfolge; jede Kopie liegt über ihrem Original, Abstände bleiben. */
export function duplicateElements(p: Project, ids: string[], offset = 40): string[] {
  return ids.map((id) => duplicateElement(p, id, offset));
}

/** Gesperrte bleiben. */
export function moveElements(p: Project, ids: string[], dx: number, dy: number): void {
  for (const id of ids) {
    const e = get(p, id);
    if (!e.locked) updateElement(p, id, { x: e.x + dx, y: e.y + dy });
  }
}

export function moveInOrder(p: Project, id: string, toIndex: number): void {
  get(p, id);
  p.order.splice(p.order.indexOf(id), 1);
  p.order.splice(toIndex, 0, id);
}

/** Ziel-Index für «Nach vorne» (1) bzw. «Nach hinten» (-1): nächstes Element, das sich überlagert, sonst -1. */
export function layerStep(p: Project, id: string, dir: 1 | -1): number {
  const b = elementBounds(get(p, id));
  for (let j = p.order.indexOf(id) + dir; j >= 0 && j < p.order.length; j += dir) {
    if (intersects(b, elementBounds(p.elements[p.order[j]!]!))) return j;
  }
  return -1;
}

export function nextName(p: Project, label: string): string {
  const re = new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} (\\d+)$`);
  const max = Object.values(p.elements).reduce((m, e) => Math.max(m, Number(re.exec(e.name)?.[1] ?? 0)), 0);
  return `${label} ${max + 1}`;
}

const styleLabels = { titel: 'Titel', kommentar: 'Kommentar' } as const;

/** Folgt der Ebenenname dem Textstil: «Kommentar»/«Kommentar 2» wird zu «Titel»/«Titel 2». Eigene Namen bleiben. */
export function renameForStyle(name: string, from: keyof typeof styleLabels, to: keyof typeof styleLabels): string {
  const m = /^(\S+)((?: \d+)?)$/.exec(name);
  return m && m[1] === styleLabels[from] ? `${styleLabels[to]}${m[2]}` : name;
}

/** Bild-ID eines Elements, falls sein Typ eines hat (props.assetId; der Kern kennt die Plugins nicht). */
export function assetIdOf(e: Element): string | undefined {
  const id = (e.props as { assetId?: unknown } | null)?.assetId;
  return typeof id === 'string' ? id : undefined;
}

/** Maskendatei eines Elements (props.mask, Phase 4a): ein Asset wie das Bild, wandert mit Projektdatei und Kopien. */
export function maskIdOf(e: Element): string | undefined {
  const id = (e.props as { mask?: unknown } | null)?.mask;
  return typeof id === 'string' ? id : undefined;
}

export function referencedAssetIds(p: Project): Set<string> {
  return new Set(Object.values(p.elements).flatMap((e) => [assetIdOf(e), maskIdOf(e)]).filter((id) => id !== undefined));
}

/** Kopie ohne Assets, auf die kein Element mehr zeigt (gelöschte Fotos verlassen so weder Datei noch Speicher). */
export function withReferencedAssets(p: Project): Project {
  const used = referencedAssetIds(p);
  return { ...p, assets: Object.fromEntries(Object.entries(p.assets).filter(([id]) => used.has(id))) };
}

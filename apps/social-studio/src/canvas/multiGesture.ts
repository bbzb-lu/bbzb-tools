import type Konva from 'konva';
import { elementTypes } from '../core/registries';
import { updateElement } from '../model/elements';
import type { Element } from '../model/types';
import { apply, useDoc } from '../store/document';

export type Box = { x: number; y: number; width: number; height: number; rotation: number };
/** gerundet, damit eine eingerastete Position exakt auf der Linie liegt (nicht 879.9999…) */
export const exact = (v: number) => Math.round(v * 1e6) / 1e6;

// Konva startet beim Ziehen eines Transformer-Nodes das Ziehen aller anderen mit; jeder feuert dragend. Während eines
// Mehrfach-Ziehens schreibt commitMove alle Positionen in einem apply, die Elemente selbst schreiben dann nichts.
// Unabhängig von der Auswahl: wechselt sie mitten im Ziehen (Esc, Strg + A), werden die Positionen trotzdem geschrieben.
let group: string[] = [];
let committed = false;
export const inGroupDrag = (id: string) => group.includes(id);
export function startGroupDrag(ids: string[]): void {
  group = ids.length > 1 ? ids : [];
  committed = false;
}
/** dragend: beim ersten dragend eines Mehrfach-Ziehens alle Positionen schreiben, danach nichts mehr. */
export function endGroupDrag(find: (id: string) => Konva.Node | undefined): void {
  if (group.length < 2 || committed) return;
  committed = true;
  commitMove(group, group.map(find).filter((n): n is Konva.Node => !!n));
}

/** Positionen der gezogenen Nodes, ein apply (ein Undo-Schritt). */
export function commitMove(ids: string[], nodes: Konva.Node[]): void {
  const at = new Map(nodes.map((n) => [n.id(), n]));
  apply((d) => {
    for (const id of ids) {
      const n = at.get(id);
      if (n && d.elements[id]) updateElement(d, id, { x: n.x(), y: n.y() });
    }
  });
  // die übrigen Nodes feuern dragend gleich danach im selben Durchlauf: erst danach wieder selbst schreiben lassen
  queueMicrotask(() => (group = []));
}

/** Je Element die Box über `afterTransform` seines Typs übernehmen, ein apply. Auch für die Zahlenfelder im Inspector. */
export function applyBoxes(boxes: Record<string, Box>): void {
  const els = useDoc.getState().project?.elements ?? {};
  const patches: [string, Partial<Element>][] = [];
  for (const [id, box] of Object.entries(boxes)) {
    const cur = els[id];
    if (cur) patches.push([id, elementTypes.get(cur.type).afterTransform(cur, box)]);
  }
  if (patches.length) apply((d) => patches.forEach(([id, patch]) => updateElement(d, id, patch)));
}

/** Nach dem Skalieren: Box je Node aus Position und Skalierung, Skalierung zurücksetzen, dann applyBoxes. */
export function commitTransform(nodes: Konva.Node[]): void {
  const els = useDoc.getState().project?.elements ?? {};
  const boxes: Record<string, Box> = {};
  for (const n of nodes) {
    const cur = els[n.id()];
    if (!cur) continue;
    boxes[cur.id] = {
      x: exact(n.x()),
      y: exact(n.y()),
      width: exact(cur.width * n.scaleX()),
      height: exact(cur.height * n.scaleY()),
      rotation: n.rotation(),
    };
    // Scherung entsteht, wenn eine Mehrfachauswahl mit gedrehtem Element frei (Shift) skaliert wird; das Modell kennt keine
    n.setAttrs({ scaleX: 1, scaleY: 1, skewX: 0, skewY: 0 });
  }
  applyBoxes(boxes);
}

/** Die Box schrumpft um kx, ky: würde ein Element schmaler oder niedriger als min? */
export function tooSmall(nodes: Konva.Node[], kx: number, ky: number, min: number): boolean {
  const els = useDoc.getState().project?.elements ?? {};
  return nodes.some((n) => {
    const e = els[n.id()];
    return !!e && ((kx < 1 && e.width * n.scaleX() * kx < min) || (ky < 1 && e.height * n.scaleY() * ky < min));
  });
}

const NO_RECT = { x: 0, y: 0, width: 0, height: 0 };
/** Live beim Skalieren einer Gruppe: `inner` bleibt unverzerrt und zählt nicht zur Box, die der Transformer misst (sie liefert ein unsichtbares Rect). */
export function keepSize(inner: Konva.Node | null, group: Konva.Node): void {
  if (!inner) return;
  const { x, y } = group.scale();
  inner.scale({ x: 1 / x, y: 1 / y });
  Object.assign(inner, { getClientRect: () => NO_RECT });
}
export function releaseSize(inner: Konva.Node | null): void {
  if (!inner) return;
  inner.scale({ x: 1, y: 1 });
  delete (inner as { getClientRect?: unknown }).getClientRect;
}

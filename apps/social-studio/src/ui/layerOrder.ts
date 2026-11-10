/** Ziel-Index für moveInOrder: `id` kommt direkt über bzw. unter `neighbourId` zu liegen (order: unten → oben). */
export function orderIndexFor(order: string[], id: string, neighbourId: string, where: 'above' | 'below'): number {
  const rest = order.filter((x) => x !== id); // moveInOrder entfernt erst, dann fügt es ein
  const n = rest.indexOf(neighbourId);
  return where === 'above' ? n + 1 : n;
}

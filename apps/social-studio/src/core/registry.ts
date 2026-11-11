export function createRegistry<T extends { id: string }>(kind: string) {
  const items = new Map<string, T>();
  return {
    register(item: T): void {
      if (items.has(item.id)) throw new Error(`${kind} «${item.id}» ist bereits registriert`);
      items.set(item.id, item);
    },
    get(id: string): T {
      const item = items.get(id);
      if (!item) throw new Error(`${kind} «${id}» ist nicht registriert`);
      return item;
    },
    has: (id: string): boolean => items.has(id),
    all: (): T[] => [...items.values()],
  };
}

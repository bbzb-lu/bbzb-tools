import { useEffect, useState } from 'react';
import { iconStyle, themeOf, type Audience, type Slot } from '../tokens';
import type { IconRef } from './catalog';
import { prepareIcon, type Prepared } from './raster';

const ids = new WeakMap<object, number>();
let next = 0;
const idOf = (o: object) => ids.get(o) ?? (ids.set(o, ++next), next);
const keyOf = (r: IconRef) => (r.kind === 'image' ? `image:${idOf(r.bitmap)}` : `${r.kind}:${r.name}`);

type Result = { key: string; icons: Partial<Record<Slot, Prepared>>; error: string };

/** Zeichnet die gewählten Icons vor. `ready` ist erst wahr, wenn das Ergebnis zur aktuellen Wahl gehört (Export wartet darauf). */
export function usePrepared(audience: Audience, wanted: Partial<Record<Slot, IconRef>>) {
  const color = iconStyle.color[themeOf(audience)];
  const entries = Object.entries(wanted) as [Slot, IconRef][];
  const key = `${color}|${entries.map(([s, r]) => `${s}=${keyOf(r)}`).join(',')}`;
  const [res, setRes] = useState<Result | null>(null);
  useEffect(() => {
    let live = true;
    Promise.all(entries.map(async ([s, r]) => [s, await prepareIcon(r, color)] as const)).then(
      (list) => live && setRes({ key, icons: Object.fromEntries(list), error: '' }),
      () => live && setRes({ key, icons: {}, error: 'Ein Icon konnte nicht gezeichnet werden.' }),
    );
    return () => {
      live = false;
    };
    // entries ist aus key abgeleitet
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { icons: res?.icons ?? {}, ready: res?.key === key, error: res?.key === key ? res.error : '' };
}

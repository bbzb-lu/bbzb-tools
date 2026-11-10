import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

export type Box = { x: number; y: number; w: number; h: number };

/** Lage von `item` im Rahmen `host` (Polsterkante), in Layout-Pixeln: Zoom und Skalierung der Vorfahren herausgerechnet. */
export function boxIn(item: DOMRect, host: DOMRect, scale: number, border: { left: number; top: number }): Box {
  const s = scale > 0 ? scale : 1;
  return { x: (item.left - host.left) / s - border.left, y: (item.top - host.top) / s - border.top, w: item.width / s, h: item.height / s };
}

export const sameBox = (a: Box, b: Box) => Math.abs(a.x - b.x) < 0.25 && Math.abs(a.y - b.y) < 0.25 && Math.abs(a.w - b.w) < 0.25 && Math.abs(a.h - b.h) < 0.25;

/** Fasst Aufrufe zu höchstens einem je Bildschirmbild zusammen (requestAnimationFrame): 200 Zeigerereignisse pro Sekunde kosten höchstens 60 Starts. */
export const frameOnce = (fn: () => void, raf: (cb: () => void) => unknown = (cb) => requestAnimationFrame(cb)) => {
  let queued = false;
  return () => {
    if (queued) return;
    queued = true;
    raf(() => {
      queued = false;
      fn();
    });
  };
};

export const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const SLIDE_MS = 220;
const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

/**
 * Gleitende Auswahlfläche: sucht im Rahmen `host` das gewählte Element (`itemSelector`) und legt das Kind `.slide-hl` per transform darüber.
 * Wechselt die Wahl (Klick, Tastatur, Undo), gleitet die Fläche vom gezeigten Stand zum neuen (WAAPI, nur transform); beim ersten Messen, bei
 * Grössenänderung (ResizeObserver, Schriften) und bei reduzierter Bewegung springt sie. Fläche mit Kind `.slide-hl-in` (Textkopie, siehe SlideHighlight)
 * wird gegenläufig verschoben und behält die Breite des Ziels; ohne Kind (Linie) wird sie per scaleX gezogen. `edge`: Fläche nur diese Höhe am unteren Rand.
 * Kein React-State: Messen und Setzen laufen über Refs.
 */
export function useSlidingHighlight(host: RefObject<HTMLElement | null>, itemSelector: string, edge?: number) {
  const last = useRef<Box | null>(null);
  const measure = (animate: boolean) => {
    const h = host.current;
    const bar = h?.querySelector<HTMLElement>(':scope > .slide-hl');
    const item = h?.querySelector<HTMLElement>(itemSelector);
    if (!h || !bar || !item || !h.offsetWidth) {
      last.current = null;
      bar?.removeAttribute('data-on');
      return;
    }
    const hr = h.getBoundingClientRect();
    const box = boxIn(item.getBoundingClientRect(), hr, hr.width / h.offsetWidth, { left: h.clientLeft, top: h.clientTop });
    if (edge) Object.assign(box, { y: box.y + box.h - edge, h: edge });
    const prev = last.current;
    if (prev && sameBox(prev, box)) return;
    last.current = box;
    const inner = bar.querySelector<HTMLElement>(':scope > .slide-hl-in');
    // gezeigter Stand (auch mitten in einer Animation) als Start
    const m = new DOMMatrix(getComputedStyle(bar).transform);
    const fromW = parseFloat(bar.style.width) * m.a;
    bar.getAnimations().forEach((a) => a.cancel());
    inner?.getAnimations().forEach((a) => a.cancel());
    h.style.setProperty('--hl-w', `${h.clientWidth}px`);
    h.style.setProperty('--hl-h', `${h.clientHeight}px`);
    bar.style.width = `${box.w}px`;
    bar.style.height = `${box.h}px`;
    bar.style.transform = `translate(${box.x}px, ${box.y}px)`;
    if (inner) inner.style.transform = `translate(${-box.x}px, ${-box.y}px)`;
    bar.setAttribute('data-on', '');
    if (!animate || !prev || reducedMotion() || !(box.w > 0)) return;
    const opts = { duration: SLIDE_MS, easing: EASE };
    const from = `translate(${m.e}px, ${m.f}px)${inner ? '' : ` scaleX(${fromW / box.w})`}`;
    bar.animate([{ transform: from }, { transform: bar.style.transform }], opts);
    inner?.animate([{ transform: `translate(${-m.e}px, ${-m.f}px)` }, { transform: inner.style.transform }], opts);
  };
  // nach jedem Render: nur die Wahl ändert die Lage, sonst findet sameBox nichts zu tun
  useLayoutEffect(() => measure(true));
  useEffect(() => {
    const h = host.current;
    if (!h) return;
    const ro = new ResizeObserver(() => measure(false));
    ro.observe(h);
    void document.fonts?.ready.then(() => measure(false));
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

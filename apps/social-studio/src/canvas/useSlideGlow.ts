import { useEffect, useEffectEvent, type RefObject } from 'react';
import { useUi } from '../store/ui';

export type Glow = { slide: number; state: 'on' | 'near' } | null;

/**
 * Schatten an (x, y), in Bildschirm-px relativ zur linken oberen Ecke von Slide 1: über oder unter einer Slide (ein Klick wählt
 * ihren Hintergrund) voll, auf ihr (der Klick gilt dem Inhalt) zurückgezogen, neben allen Slides keiner.
 */
export function glowAt(x: number, y: number, w: number, h: number, count: number): Glow {
  const slide = Math.floor(x / w);
  if (x < 0 || slide >= count) return null;
  return { slide, state: y >= 0 && y <= h ? 'near' : 'on' };
}

type Geometry = { originX: number; originY: number; w: number; h: number; count: number };

/**
 * Setzt `data-glow` («on» oder «near») an den Schatten (Kinder von `layer`, `data-slide`) der Slide unter dem Zeiger. Ein nativer pointermove pro Frame, kein React-Render, kein Store; die Animation macht CSS.
 */
export function useSlideGlow(scrollRef: RefObject<HTMLDivElement | null>, layer: RefObject<HTMLDivElement | null>, g: Geometry) {
  const target = useEffectEvent((e: PointerEvent | null): Glow => {
    const el = scrollRef.current!;
    const ui = useUi.getState();
    // gedrückt (Ziehen, Aufziehrahmen, Verschieben), Modi und offene Dialoge: ein Klick wählt dann nicht den Hintergrund
    if (!e || e.buttons || ui.cropEditId || ui.textEditId || ui.maskEditId || el.matches('.pan-ready, .panning')) return null;
    // Menüs und Popover schliessen beim Klick erst sich selbst; Meldung und Tooltip (manuell) nicht, sie blenden nichts aus
    if (document.querySelector('dialog[open], [popover="auto"]:popover-open, .context-menu:popover-open')) return null;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    if (x >= el.clientWidth || y >= el.clientHeight) return null; // Bildlaufleisten
    return glowAt(x + el.scrollLeft - g.originX, y + el.scrollTop - g.originY, g.w, g.h, g.count);
  });
  useEffect(() => {
    const el = scrollRef.current!;
    let last: PointerEvent | null = null;
    let frame = 0;
    const update = () => {
      frame = 0;
      const g = target(last);
      for (const glow of (layer.current?.children ?? []) as Iterable<HTMLElement>) {
        const state = g && Number(glow.dataset.slide) === g.slide ? g.state : undefined;
        if (glow.dataset.glow !== state) {
          if (state) glow.dataset.glow = state;
          else delete glow.dataset.glow;
        }
      }
    };
    const schedule = (e: PointerEvent | null) => {
      last = e;
      frame ||= requestAnimationFrame(update);
    };
    const onPointer = (e: PointerEvent) => schedule(e);
    const onLeave = () => schedule(null);
    const onScroll = () => schedule(last);
    el.addEventListener('pointermove', onPointer, { passive: true });
    el.addEventListener('pointerup', onPointer, { passive: true });
    el.addEventListener('pointerleave', onLeave, { passive: true });
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('pointermove', onPointer);
      el.removeEventListener('pointerup', onPointer);
      el.removeEventListener('pointerleave', onLeave);
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [scrollRef, layer]);
}

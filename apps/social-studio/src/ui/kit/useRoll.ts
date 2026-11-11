import { useEffect, useRef, type RefObject } from 'react';
import { frameOnce, reducedMotion } from '@bbzb/ui';

export const ROLL_MS = 100;

/**
 * Die Zahl `el` gleitet kurz von unten herein, bei jeder Wertänderung (Regler auch beim Ziehen, Drehregler, Tasten, Rad, Undo). Nur transform und opacity, WAAPI statt React-State.
 * Bewegt wird nur die Zifferninsel (bei Zahlenfeldern eine Kopie über dem Feld, `sync(el, neu)` gleicht Text und, am Anfang einer Serie, Schrift an): Rahmen und Feld bleiben stehen.
 * Ein neuer Wert startet die Animation sofort neu (höchstens ein Start je Bildschirmbild). Keine Animation beim ersten Rendern, im fokussierten Feld (dort wird getippt)
 * und bei reduzierter Bewegung. Der Text ist immer der echte Wert, in Ruhe voll sichtbar.
 */
export function useRoll(ref: RefObject<HTMLElement | null>, value: number, sync?: (el: HTMLElement, fresh: boolean) => void) {
  const prev = useRef(value);
  const syncRef = useRef(sync);
  useEffect(() => {
    syncRef.current = sync;
  });

  const play = useRef<() => void>(() => {});
  useEffect(() => {
    play.current = frameOnce(() => {
      const el = ref.current;
      const host = el?.parentElement;
      if (!el || !host || document.activeElement === host.querySelector('input') || reducedMotion()) return;
      const fresh = !host.classList.contains('rolling');
      el.getAnimations().forEach((a) => a.cancel());
      syncRef.current?.(el, fresh);
      host.classList.add('rolling');
      const done = () => {
        if (el.getAnimations().length > 0) return;
        host.classList.remove('rolling');
        if (syncRef.current) el.textContent = '';
      };
      const a = el.animate([{ transform: 'translateY(4px)', opacity: 0.75 }, { transform: 'none', opacity: 1 }], { duration: ROLL_MS, easing: 'ease-out' });
      a.onfinish = done;
      a.oncancel = done;
    });
  }, [ref]);

  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    play.current();
  }, [value]);
}

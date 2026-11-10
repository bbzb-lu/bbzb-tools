import { useEffect, useRef, type KeyboardEvent } from 'react';
import { endGesture, startGesture } from '../store/document';
import { useUi } from '../store/ui';

/** Nur diese Tasten ändern den Regler; Tab o. Ä. startet keine Geste. */
const SLIDER_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End']);

/** Props für <input type="range">: eine Regler-Bewegung = ein Undo-Schritt (Geste nach Ruling Task 7). */
export function useSliderGesture() {
  const sliding = useRef(false);
  const end = () => {
    if (!sliding.current) return;
    sliding.current = false;
    useUi.getState().setSliding(false);
    endGesture();
  };
  const begin = () => {
    if (!sliding.current) useUi.getState().setSliding(true);
    sliding.current = true;
    startGesture();
  };
  // Geste endet auch, wenn die Maus ausserhalb losgelassen wird oder das Fenster den Fokus verliert.
  useEffect(() => {
    const evs = ['pointerup', 'pointercancel', 'blur'] as const;
    evs.forEach((t) => window.addEventListener(t, end));
    return () => {
      evs.forEach((t) => window.removeEventListener(t, end));
      end();
    };
  }, []);
  return {
    onPointerDown: begin,
    onKeyDown: (e: KeyboardEvent) => void (SLIDER_KEYS.has(e.key) && begin()),
    onKeyUp: end,
    onBlur: end,
    onPointerUp: end,
    onPointerCancel: end,
    onLostPointerCapture: end,
  };
}

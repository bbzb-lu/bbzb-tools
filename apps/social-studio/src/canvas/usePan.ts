import { useEffect, type RefObject } from 'react';
import { isTyping } from '../ui/shortcuts';

/**
 * Leinwand verschieben: Leertaste halten und ziehen, oder mittlere Maustaste ziehen. Nur scrollLeft/scrollTop,
 * kein Store. Der Druck wird in der Capture-Phase abgefangen, die Konva-Stage sieht ihn nie (keine Auswahl beim Loslassen).
 */
export function usePan(ref: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = ref.current!;
    let space = false;
    let panning = false;
    const setSpace = (on: boolean) => {
      space = on;
      el.classList.toggle('pan-ready', on);
    };
    // :focus-visible taugt hier nicht: Chromium setzt es schon vor dem keydown der Leertaste. Selbst merken, womit zuletzt bedient wurde.
    // Entschieden wird beim Fokuswechsel (Tab, Pfeile in einer Tab-Leiste = Tastatur; Klick = Maus), nicht bei jeder Taste.
    let lastKey = false;
    let byKeyboard = false;
    const onAnyPointer = () => (lastKey = byKeyboard = false); // Klick auf den schon fokussierten Button: kein focusin
    const onFocusIn = () => (byKeyboard = lastKey);
    const onKeyDown = (e: KeyboardEvent) => {
      lastKey = true;
      if (e.code !== 'Space' || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      // Felder tippen ein Leerzeichen, Radio und Checkbox schalten damit. Buttons und Links lösen sich nur bei Tastaturfokus aus;
      // nach einem Mausklick bleibt der Fokus dort hängen und die Leertaste verschiebt die Leinwand.
      if (isTyping(t) || document.querySelector('dialog[open], [popover]:popover-open')) return;
      if (t instanceof HTMLInputElement && (t.type === 'radio' || t.type === 'checkbox')) return;
      if (t instanceof HTMLElement && byKeyboard && t.closest('button, a, [role="button"]')) return;
      e.preventDefault(); // kein Seiten-Scrollen
      setSpace(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || !space) return;
      e.preventDefault(); // der fokussierte Button löst sich sonst beim Loslassen aus
      setSpace(false);
    };
    const onBlur = () => setSpace(false);
    // Konva startet Ziehen und Auswahl über das mousedown, das nach dem pointerdown folgt: auch das abfangen.
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 1) e.preventDefault(); // Edge: Auto-Scroll-Symbol
      if (panning) e.stopPropagation();
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!(e.button === 1 || (e.button === 0 && space)) || panning) return;
      // Scrollleisten bleiben bedienbar
      if (e.target === el && (e.offsetX > el.clientWidth || e.offsetY > el.clientHeight)) return;
      e.stopPropagation(); // kein preventDefault: sonst fiele das mousedown aus, das Edge-Auto-Scroll unterdrückt
      panning = true;
      const x0 = e.clientX + el.scrollLeft;
      const y0 = e.clientY + el.scrollTop;
      el.setPointerCapture(e.pointerId);
      el.classList.add('panning');
      const move = (m: PointerEvent) => {
        el.scrollLeft = x0 - m.clientX;
        el.scrollTop = y0 - m.clientY;
      };
      const end = () => {
        panning = false;
        el.removeEventListener('lostpointercapture', end);
        el.classList.remove('panning');
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', end);
        el.removeEventListener('pointercancel', end);
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
      el.addEventListener('lostpointercapture', end);
    };
    window.addEventListener('pointerdown', onAnyPointer, true);
    window.addEventListener('focusin', onFocusIn);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    el.addEventListener('mousedown', onMouseDown, { capture: true });
    el.addEventListener('pointerdown', onPointerDown, { capture: true });
    return () => {
      window.removeEventListener('pointerdown', onAnyPointer, true);
      window.removeEventListener('focusin', onFocusIn);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      el.removeEventListener('mousedown', onMouseDown, { capture: true });
      el.removeEventListener('pointerdown', onPointerDown, { capture: true });
    };
  }, [ref]);
}

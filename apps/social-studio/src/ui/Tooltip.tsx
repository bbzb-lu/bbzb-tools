import { useEffect, useRef } from 'react';
import { tooltip } from '../tokens';
import { placeTooltip } from './tooltipPosition';

/** «Strg+Z» → ['Strg','Z']; ein «+» als Taste bleibt erhalten («Strg++»). */
const parts = (keys: string) => keys.split(/\+(?=.)/);
const anchorOf = (t: EventTarget | null) => (t instanceof Element ? t.closest<HTMLElement>('[data-tip]') : null);

/** Ein globaler Tooltip für alle Elemente mit `data-tip` (optional `data-keys`, `data-tip-text`). Kein React-State, kein Render pro Mausbewegung. */
export function Tooltip() {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current!;
    let anchor: HTMLElement | null = null;
    let timer = 0;
    let observer: MutationObserver | undefined;
    let closedAt = -Infinity;

    const hide = () => {
      clearTimeout(timer);
      observer?.disconnect();
      if (el.matches(':popover-open')) {
        el.hidePopover();
        closedAt = performance.now();
      }
      anchor = null;
    };
    const render = (a: HTMLElement) => {
      el.style.left = el.style.top = '0'; // sonst verengt die alte Position die Breite des Kastens
      el.replaceChildren();
      const line = el.appendChild(document.createElement('div'));
      line.className = 'tip-line';
      line.append(a.dataset.tip!);
      for (const k of a.dataset.keys ? parts(a.dataset.keys) : []) line.appendChild(document.createElement('kbd')).textContent = k;
      if (a.dataset.tipText) el.appendChild(document.createElement('div')).textContent = a.dataset.tipText;
      if (!el.matches(':popover-open')) el.showPopover();
      const { x, y } = placeTooltip(a.getBoundingClientRect(), el.getBoundingClientRect(), { width: innerWidth, height: innerHeight });
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    };
    const show = (a: HTMLElement) => {
      render(a);
      observer = new MutationObserver((rs) => {
        if (!a.isConnected) hide();
        else if (rs.some((r) => !el.contains(r.target))) render(a); // eigene Änderungen am Tooltip nicht erneut auslösen
      });
      observer.observe(document.body, { childList: true, subtree: true });
      observer.observe(a, { attributes: true, attributeFilter: ['data-tip', 'data-keys', 'data-tip-text'] });
    };
    const request = (a: HTMLElement | null) => {
      if (a === anchor) return;
      hide();
      if (!a) return;
      anchor = a;
      const open = el.matches(':popover-open') || performance.now() - closedAt < tooltip.graceMs;
      if (open) show(a);
      else timer = window.setTimeout(() => show(a), tooltip.delayMs);
    };

    const over = (e: PointerEvent) => request(anchorOf(e.target));
    const out = (e: PointerEvent) => e.relatedTarget === null && hide();
    const focusIn = (e: FocusEvent) => {
      const a = anchorOf(e.target);
      request(a && (e.target as Element).matches(':focus-visible') ? a : null); // der Fokus sitzt evtl. auf einem Kind (Kanal-Gruppe)
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && hide(); // kein preventDefault: Esc hebt die Auswahl weiter auf
    document.addEventListener('pointerover', over);
    document.addEventListener('pointerout', out);
    document.addEventListener('focusin', focusIn);
    document.addEventListener('focusout', hide);
    document.addEventListener('pointerdown', hide, true);
    document.addEventListener('keydown', key, true);
    document.addEventListener('scroll', hide, true);
    window.addEventListener('blur', hide);
    return () => {
      hide();
      document.removeEventListener('pointerover', over);
      document.removeEventListener('pointerout', out);
      document.removeEventListener('focusin', focusIn);
      document.removeEventListener('focusout', hide);
      document.removeEventListener('pointerdown', hide, true);
      document.removeEventListener('keydown', key, true);
      document.removeEventListener('scroll', hide, true);
      window.removeEventListener('blur', hide);
    };
  }, []);
  return <div ref={box} popover="manual" aria-hidden="true" className="tooltip" />;
}

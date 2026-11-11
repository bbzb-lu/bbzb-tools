import { IconChevronRight } from '@tabler/icons-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import type { MenuAction, MenuItem } from '../core/types';
import { useUi } from '../store/ui';
import { menuItemsFor } from './contextMenuItems';

interface MenuState {
  at: { x: number; y: number } | null;
  items: MenuItem[];
  /** Fokusziel beim Schliessen (wo der Rechtsklick herkam). */
  from: HTMLElement | null;
  /** Menü eines Textfelds: der Fokus geht bei jedem Schliessen ans Feld zurück, sonst bliebe es ohne Fokus offen (Text auf der Leinwand). */
  field: boolean;
  close(): void;
}
const useMenu = create<MenuState>((set) => ({ at: null, items: [], from: null, field: false, close: () => set({ at: null }) }));

/**
 * Fokuswechsel ins Kontextmenü oder aus ihm zurück (Blur bzw. Focus): Felder übernehmen dann keinen Entwurf und beenden weder
 * Bearbeiten noch Geste; das Menü gibt den Fokus beim Schliessen zurück.
 */
export const blurIntoMenu = (e: React.FocusEvent) => e.relatedTarget instanceof Element && !!e.relatedTarget.closest('.context-menu');

/**
 * Öffnet das Menü am Zeiger. Ein nicht gewähltes Element wird zuerst gewählt, ein gewähltes behält die Mehrfachauswahl,
 * `id` null (leere Fläche) wählt ab, `undefined` (Transformer) lässt die Auswahl.
 */
export function openContextMenu(at: { x: number; y: number }, id: string | null | undefined, slide?: number): void {
  const ui = useUi.getState();
  if (id === null) ui.setSelectedIds([]);
  else if (id && !ui.selectedIds.includes(id)) ui.setSelectedId(id);
  const active = document.activeElement;
  useMenu.setState({ at, items: menuItemsFor(useUi.getState().selectedIds, slide), from: active instanceof HTMLElement ? active : null, field: false });
}

/** Öffnet ein fertiges Menü (Slide-Leiste, Kopfzeile u. a.), ohne die Auswahl zu ändern. `field`: Menü dieses Textfelds. */
export function openMenu(at: { x: number; y: number }, items: MenuItem[], field?: HTMLElement): void {
  const active = document.activeElement;
  useMenu.setState({ at, items, from: field ?? (active instanceof HTMLElement ? active : null), field: !!field });
}

const MARGIN = 8;

export function ContextMenu() {
  const { at, items, from, field, close: hide } = useMenu();
  // Textfeld: bei jedem Schliessen Fokus zurück (vor dem Mausklick daneben, der ihn dann regulär wegnimmt)
  const close = useCallback(() => {
    hide();
    if (field && from?.isConnected) from.focus({ preventScroll: true });
  }, [hide, field, from]);
  const box = useRef<HTMLDivElement>(null);
  const subBox = useRef<HTMLDivElement>(null);
  /** Id des Eintrags mit offenem Untermenü. */
  const [open, setOpen] = useState<{ items: MenuItem[]; id: string | null }>({ items, id: null });
  const sub = open.items === items ? open.id : null; // ein neues Menü startet ohne offenes Untermenü
  const setSub = (id: string | null) => setOpen({ items, id });

  // Untermenü rechts neben dem Eintrag (fixed: der Rand des scrollbaren Menüs schneidet es nicht ab), bei Platzmangel links
  useLayoutEffect(() => {
    const el = subBox.current;
    const parent = box.current?.querySelector<HTMLElement>('[aria-expanded=true]');
    if (!el || !parent) return;
    const p = parent.getBoundingClientRect();
    const w = el.getBoundingClientRect();
    el.style.left = `${p.right + w.width + MARGIN > innerWidth ? p.left - w.width : p.right}px`;
    el.style.top = `${Math.max(MARGIN, Math.min(p.top, innerHeight - w.height - MARGIN))}px`;
  }, [sub]);

  // Nach dem Messen im Fenster halten und den ersten Eintrag fokussieren.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el || !at) return;
    if (!el.matches(':popover-open')) el.showPopover();
    const r = el.getBoundingClientRect();
    el.style.left = `${Math.max(MARGIN, Math.min(at.x, innerWidth - r.width - MARGIN))}px`;
    el.style.top = `${Math.max(MARGIN, Math.min(at.y, innerHeight - r.height - MARGIN))}px`;
    // erster freier Eintrag (Rückgängig ist oft gesperrt); alles gesperrt: das Menü selbst, damit Esc es erreicht
    (el.querySelector<HTMLElement>('[role=menuitem]:not([aria-disabled=true])') ?? el).focus();
  }, [at, items]);

  useEffect(() => {
    if (!at) return;
    const el = box.current!;
    const shut = () => close();
    const outside = (e: Event) => void (!el.contains(e.target as Node) && close());
    window.addEventListener('pointerdown', outside, true);
    window.addEventListener('scroll', shut, true);
    window.addEventListener('wheel', shut, { passive: true });
    window.addEventListener('resize', shut);
    window.addEventListener('blur', shut);
    return () => {
      window.removeEventListener('pointerdown', outside, true);
      window.removeEventListener('scroll', shut, true);
      window.removeEventListener('wheel', shut);
      window.removeEventListener('resize', shut);
      window.removeEventListener('blur', shut);
      if (el.matches(':popover-open')) el.hidePopover();
    };
  }, [at, close]);

  const shut = (restore: boolean) => {
    close();
    if (restore && from?.isConnected) from.focus({ preventScroll: true });
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation(); // die Editor-Kürzel (Entf, Esc, Pfeile) gelten nicht, solange das Menü offen ist
    const inSub = !!(e.target as Element).closest('.context-sub');
    const els = [...box.current!.querySelectorAll<HTMLElement>(inSub ? '.context-sub [role=menuitem]' : '[role=menuitem]:not(.context-sub *)')];
    const i = els.indexOf(document.activeElement as HTMLElement);
    const go = (n: number) => {
      const next = els[(n + els.length) % els.length];
      next?.focus();
      next?.scrollIntoView({ block: 'nearest' }); // lange Menüs scrollen mit
    };
    if (e.key === 'ArrowDown') go(i + 1);
    else if (e.key === 'ArrowUp') go(i < 0 ? -1 : i - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(-1);
    else if (inSub && (e.key === 'ArrowLeft' || e.key === 'Escape')) closeSub();
    else if (!inSub && e.key === 'ArrowRight' && (document.activeElement as HTMLElement)?.getAttribute('aria-haspopup')) openSub(document.activeElement as HTMLElement);
    else if (e.key === 'Escape') shut(true);
    else if (e.key === 'Tab') close();
    else return;
    if (e.key !== 'Tab') e.preventDefault();
  };
  /** Untermenü schliessen, der Fokus geht an den Eintrag zurück. */
  const closeSub = () => {
    const parent = box.current?.querySelector<HTMLElement>('[aria-expanded=true]');
    setSub(null);
    parent?.focus();
  };
  const openSub = (parent: HTMLElement) => {
    setSub(parent.dataset.id!);
    // das Untermenü gibt es erst im nächsten Bild
    requestAnimationFrame(() => subBox.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus());
  };
  const choose = (item: MenuAction & { sub?: MenuAction[] }, el?: HTMLElement) => {
    if (item.disabled) return;
    if (item.sub) return void (el && openSub(el)); // auch nach Zeigerkontakt offen: ein Klick schliesst nie
    shut(true); // zuerst Fokus zurück: «Text bearbeiten» setzt ihn danach selbst
    item.run();
  };

  return (
    <div ref={box} className="context-menu" role="menu" aria-label="Kontextmenü" popover="manual" tabIndex={-1} onKeyDown={onKeyDown}
      // Klick auf Eintrag, Trenner oder Rand: Fokus bleibt im Menü (nicht auf body), bis choose ihn zurückgibt
      onMouseDown={(e) => e.preventDefault()} onContextMenu={(e) => e.preventDefault()}>
      {at &&
        items.map((item, i) =>
          'separator' in item ? (
            <div key={i} role="separator" />
          ) : (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              tabIndex={-1}
              data-id={item.id}
              aria-disabled={item.disabled ? true : undefined}
              aria-description={item.disabled}
              aria-haspopup={item.sub ? 'menu' : undefined}
              aria-expanded={item.sub ? sub === item.id : undefined}
              data-tip={item.disabled}
              onClick={(e) => choose(item, e.currentTarget)}
              onPointerEnter={(e) => (item.sub && !item.disabled ? sub !== item.id && setSub(item.id) : sub && e.pointerType === 'mouse' && setSub(null))}
            >
              <span>{item.label}</span>
              {item.sub && <IconChevronRight aria-hidden="true" />}
              {item.keys && (
                <span className="ctx-keys" aria-hidden="true">
                  {item.keys.split('+').map((k) => (
                    <kbd key={k}>{k}</kbd>
                  ))}
                </span>
              )}
            </button>
          ),
        )}
      {at &&
        items.map((item) =>
          'separator' in item || !item.sub || sub !== item.id ? null : (
            <div key={item.id} ref={subBox} className="context-menu context-sub" role="menu" aria-label={item.label}>
              {item.sub.map((s) => (
                <button key={s.id} type="button" role="menuitem" tabIndex={-1} onClick={() => choose(s)}>
                  <span>
                    {s.icon && <span className="ctx-icon" aria-hidden="true"><s.icon /></span>}
                    {s.label}
                  </span>
                </button>
              ))}
            </div>
          ),
        )}
    </div>
  );
}

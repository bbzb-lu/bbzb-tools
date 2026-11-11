import { useDoc } from '../store/document';
import { appMenuItems, slideMenuItems } from './appMenus';
import { openMenu } from './ContextMenu';
import { fieldState, textFieldOf, textMenuItems } from './textMenu';

/** Dort bleibt das Menü des Browsers: Auswahlfelder und Eingaben ohne Text, Dialoge und Popover mit Auswahl (Layouts, Verlauf), Links (Credits). */
const NATIVE = 'input, select, dialog, [role="dialog"], a[href]';
const DIALOG = 'dialog, [role="dialog"]';

/**
 * Eigenes Menü statt dem des Browsers auf dem ganzen Editor. Läuft in der Blasenphase: Leinwand und Ebenenzeilen haben ihr
 * Menü schon geöffnet (defaultPrevented). Auch Menütaste und Umschalt + F10 landen hier, mit dem Fokus als Ziel.
 * In Textfeldern: Ausschneiden, Kopieren, Einfügen, Alles auswählen fürs Feld. Startseite und Dialoge lassen das Menü des Browsers.
 */
export function installGlobalContextMenu(): () => void {
  const onMenu = (e: MouseEvent) => {
    const t = e.target;
    if (e.defaultPrevented || !(t instanceof Element) || !useDoc.getState().project) return;
    const field = t.closest(DIALOG) ? null : textFieldOf(t);
    if (!field && t.closest(NATIVE)) return;
    e.preventDefault();
    const at = { x: e.clientX, y: e.clientY };
    if (field) return openMenu(at, textMenuItems(fieldState(field), field), field);
    const tile = t.closest<HTMLElement>('[data-slide]');
    if (tile) {
      // Die aktuelle Slide bleibt: ihr Nachscrollen in der Leiste würde das Menü sofort schliessen.
      openMenu(at, slideMenuItems(Number(tile.dataset.slide)));
    } else openMenu(at, appMenuItems());
  };
  window.addEventListener('contextmenu', onMenu);
  return () => window.removeEventListener('contextmenu', onMenu);
}

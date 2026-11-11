import { redo, undo, useDoc } from '../store/document';
import { clampZoom } from '../canvas/zoom';
import { useUi } from '../store/ui';
import { selectableOnSlide } from '../model/selection';
import { duplicateMany, nudge, removeMany } from './actions';
import { copySelection, cutSelection, pasteClipboard } from './clipboard';
import { saveProjectFile } from './projectFileActions';

const FORM = ['INPUT', 'TEXTAREA', 'SELECT'];
/** Felder ohne Texteingabe: dort gelten Undo, Duplizieren und Escape weiter (Ruling Task 11). */
const NO_TEXT = new Set(['range', 'radio', 'checkbox', 'button', 'color']);
const isField = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || FORM.includes(t.tagName));
export const isTyping = (t: EventTarget | null) => isField(t) && !(t instanceof HTMLInputElement && NO_TEXT.has(t.type));

/** Pfeiltasten verschieben nur bei Fokus auf Body, Scroll-Container oder Leinwand, nie auf einem Bedienelement. */
const onCanvas = (t: EventTarget | null) =>
  !(t instanceof HTMLElement) || t === document.body || t.classList.contains('canvas-scroll') || t.tagName === 'CANVAS';
const blocked = () => !!document.querySelector('dialog[open]');

/** Tastenkürzel des Editors; gibt die Abmeldung zurück. */
export function installShortcuts(): () => void {
  const onKey = (e: KeyboardEvent) => {
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    if (isTyping(e.target) || blocked()) {
      if (mod && (key === 'd' || key === 's' || key === 'e')) e.preventDefault(); // Edge: Lesezeichen, Seite speichern, Suche; auch beim Tippen
      return;
    }
    const ui = useUi.getState();
    // Pinsel nach e.key, nicht nach Tastenposition. Schweizer Tastatur: [ und ] mit AltGr, das Windows als Strg + Alt meldet.
    const altGr = e.getModifierState?.('AltGraph') ?? false;
    const plain = !e.metaKey && (altGr || (!e.ctrlKey && !e.altKey));
    const brushSize = { '[': -1, '-': -1, ']': 1, '+': 1 }[e.key] as -1 | 1 | undefined;
    if (ui.maskEditId && plain && (key === 'x' || brushSize)) {
      e.preventDefault();
      if (brushSize) ui.stepBrush(brushSize);
      else ui.swapBrushMode();
      return;
    }
    if (mod && key === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    } else if (mod && key === 'y') {
      e.preventDefault();
      redo();
    } else if (mod && key === 'd') {
      e.preventDefault(); // Edge: Lesezeichen
      duplicateMany(ui.selectedIds);
    } else if (mod && key === 'a') {
      e.preventDefault(); // sonst markiert Edge den Seitentext
      const p = useDoc.getState().project;
      if (p) ui.setSelectedIds(selectableOnSlide(p, ui.currentSlide));
    } else if (!mod && !e.altKey && key.startsWith('arrow') && ui.selectedIds.length && onCanvas(e.target)) {
      e.preventDefault();
      const d = e.shiftKey ? 10 : 1;
      nudge(ui.selectedIds, key === 'arrowleft' ? -d : key === 'arrowright' ? d : 0, key === 'arrowup' ? -d : key === 'arrowdown' ? d : 0);
    } else if (mod && key === 's') {
      e.preventDefault(); // Edge: Seite speichern
      void saveProjectFile();
    } else if (mod && key === 'e') {
      e.preventDefault(); // Edge: Suche
      ui.requestExport();
    } else if (mod && (key === '0' || key === '+' || key === '=' || key === '-')) {
      e.preventDefault(); // Edge: Seitenzoom
      ui.setZoom(key === '0' ? 1 : clampZoom(ui.zoom * (key === '-' ? 1 / 1.25 : 1.25)), true);
    } else if (!mod && (key === 'delete' || key === 'backspace') && ui.selectedIds.length && !isField(e.target)) {
      e.preventDefault();
      removeMany(ui.selectedIds);
    } else if (key === 'escape') {
      if (document.querySelector('[popover="auto"]:popover-open')) return; // Menü oder Popover (Effekte, Slide, Unterlage) schliesst sich selbst, die Auswahl bleibt
      if (ui.cropEditId) ui.setCropEditId(null);
      else if (ui.maskEditId) ui.setMaskEditId(null);
      else ui.setSelectedId(null);
    }
  };
  // Zwischenablage nur über DOM-Ereignisse (keine Berechtigungsabfrage); beim Tippen und in Dialogen gehört sie dem Browser.
  const clip = (fn: (e: ClipboardEvent) => unknown) => (e: ClipboardEvent) => {
    if (!isTyping(e.target) && !blocked()) fn(e);
  };
  const onCopy = clip(copySelection);
  const onCut = clip(cutSelection);
  const onPaste = clip(pasteClipboard);
  window.addEventListener('keydown', onKey);
  window.addEventListener('copy', onCopy);
  window.addEventListener('cut', onCut);
  window.addEventListener('paste', onPaste);
  return () => {
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('copy', onCopy);
    window.removeEventListener('cut', onCut);
    window.removeEventListener('paste', onPaste);
  };
}

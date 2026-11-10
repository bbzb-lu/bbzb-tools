import type { MenuItem } from '../core/types';
import { useUi } from '../store/ui';
import { KEYS, keysAttr } from './keys';

type FieldState = { selected: boolean; editable: boolean; empty: boolean };
type Input = HTMLInputElement | HTMLTextAreaElement;

/** Eingaben ohne Text (nichts zu kopieren): dort bleibt das Menü des Browsers. */
const NO_TEXT = /^(file|range|color|checkbox|radio|button|submit|reset|image|hidden)$/;
const isInput = (f: HTMLElement): f is Input => f instanceof HTMLInputElement || f instanceof HTMLTextAreaElement;

/** Textfeld unter dem Rechtsklick (Eingabe, Textbereich, contenteditable), sonst null. */
export function textFieldOf(t: Element): HTMLElement | null {
  const f = t.closest<HTMLElement>('input, textarea, [contenteditable]:not([contenteditable="false"])');
  return !f || (f instanceof HTMLInputElement && NO_TEXT.test(f.type)) ? null : f;
}

export function fieldState(f: HTMLElement): FieldState {
  if (isInput(f)) {
    // Zahlenfelder melden keine Markierung (selectionStart null): dann Kopieren anbieten
    const selected = f.selectionStart === null || f.selectionStart !== f.selectionEnd;
    return { selected, editable: !f.readOnly && !f.disabled, empty: !f.value };
  }
  const sel = getSelection();
  return { selected: !!sel && !sel.isCollapsed && f.contains(sel.anchorNode), editable: f.isContentEditable, empty: !f.textContent };
}

const ctrlV = () => useUi.getState().setNotice({ kind: 'info', text: 'Einfügen: drücke Strg + V.' });

/**
 * Zwischenablage lesen und am Feld einfügen. Die Berechtigungsfrage von Edge kann offen bleiben: ist das Feld danach weg oder
 * bekommt es den Fokus nicht, nie ins gerade fokussierte andere Feld schreiben. Leer (z. B. ein Bild): nichts tun.
 */
export async function pasteInto(f: HTMLElement, read = () => navigator.clipboard.readText(), doc: Document = document) {
  let text: string;
  try {
    text = await read();
  } catch {
    return ctrlV();
  }
  if (!text) return;
  if (!f.isConnected) return ctrlV();
  f.focus({ preventScroll: true });
  // wie getippt: React onChange und das Rückgängig des Feldes laufen mit
  if (doc.activeElement !== f || !doc.execCommand('insertText', false, text)) ctrlV();
}

/** Rechtsklick in ein Textfeld: Bearbeiten-Befehle fürs Feld. Das Menü gibt den Fokus vor `run` ans Feld zurück. */
export function textMenuItems(s: FieldState, f: HTMLElement): MenuItem[] {
  const fixed = s.editable ? undefined : 'Dieses Feld kannst du nicht ändern.';
  const none = s.selected ? undefined : 'Markiere zuerst Text.';
  return [
    { id: 'text-cut', label: 'Ausschneiden', keys: keysAttr(KEYS.cut), disabled: fixed ?? none, run: () => document.execCommand('cut') },
    { id: 'text-copy', label: 'Kopieren', keys: keysAttr(KEYS.copy), disabled: none, run: () => document.execCommand('copy') },
    { id: 'text-paste', label: 'Einfügen', keys: keysAttr(KEYS.paste), disabled: fixed, run: () => void pasteInto(f) },
    { separator: true },
    {
      id: 'text-all',
      label: 'Alles auswählen',
      keys: keysAttr(KEYS.selectAll),
      disabled: s.empty ? 'Das Feld ist leer.' : undefined,
      run: () => (isInput(f) ? f.select() : getSelection()?.selectAllChildren(f)),
    },
  ];
}

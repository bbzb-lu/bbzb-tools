import { elementTypes, formats, layouts } from '../core/registries';
import type { LayoutPreset } from '../core/types';
import type { CopyRules } from '../model/formatCopy';
import { elementsOnSlide } from '../model/geometry';
import { addLayoutSlides, layoutOnSlide, slideAfter, type ContentRules } from '../model/layout';
import { duplicateSlide, groupOf, moveSlide, removeSlide } from '../model/slides';
import type { Project } from '../model/types';
import type { Channel } from '../tokens';
import { useDoc } from '../store/document';
import { useUi } from '../store/ui';
import { tryApply, undoHint } from './actions';

/** Regeln der Elementtypen für den Layoutwechsel; unbekannte Typen gelten als Inhalt (nie entfernen). */
export const contentRules: ContentRules = {
  fit: (e, p, fresh) => elementTypes.get(e.type).fromLayout?.(e, p, fresh) ?? e,
  hasContent: (e) => {
    if (!elementTypes.has(e.type)) return true;
    const t = elementTypes.get(e.type);
    return !!t.takeContent && (t.hasContent?.(e) ?? true);
  },
  take: (into, from, p, base) => elementTypes.get(into.type).takeContent?.(into, from, p, base),
  layout: (id) => (layouts.has(id) ? layouts.get(id) : undefined),
  isEmpty: (e) => elementTypes.has(e.type) && elementTypes.get(e.type).hasContent?.(e) === false,
};

/** Registry für «Als anderes Format kopieren»: Variante gleicher Familie, Rahmen über den Elementtyp (Fotoausschnitt). */
export const copyRules: CopyRules = {
  layout: contentRules.layout,
  get labels() {
    return formats.all().map((f) => f.label);
  },
  variant: (of, format) => layouts.all().find((l) => l.format === format && (l.family ?? l.id) === (of.family ?? of.id)),
  resize: (e, box, p) => ({ ...e, ...(elementTypes.has(e.type) ? elementTypes.get(e.type).afterTransform(e, box, p) : box) }),
};

/** Reihenfolge der Spezifikation (Abschnitt 7); neue Layouts kommen vor «Leer». */
const ORDER = ['titel', 'vollbild', 'panorama', 'collage', 'querformat', 'dreiFotos', 'abschluss', 'leer'];
const rank = (l: LayoutPreset) => {
  const i = ORDER.indexOf(l.family ?? l.id);
  return i < 0 ? ORDER.length - 1.5 : i;
};

export const layoutsFor = (formatId: string): LayoutPreset[] =>
  layouts
    .all()
    .filter((l) => l.format === formatId)
    .sort((a, b) => rank(a) - rank(b));

/** Texte und Tags messen erst mit geladenen Schriften richtig. */
export const fontsLoaded = (): Promise<void> =>
  new Promise((resolve) => {
    if (useUi.getState().fontsReady) return resolve();
    const off = useUi.subscribe((s) => {
      if (!s.fontsReady) return;
      off();
      resolve();
    });
  });

/** Wo «Slide hinzufügen» einfügt: rechts der aktuellen Slide, aber nach einem Panorama, damit es ganz bleibt. */
export const newSlideAt = (p: Project): number => slideAfter(p, useUi.getState().currentSlide, contentRules.layout);

/** «Slide hinzufügen» mit Layout: neue Slides rechts der aktuellen, ein Undo-Schritt. */
export async function addSlidesWithLayout(preset: LayoutPreset): Promise<void> {
  await fontsLoaded();
  const at = newSlideAt(useDoc.getState().project!);
  if (tryApply((d) => void addLayoutSlides(d, preset, at, contentRules))) useUi.getState().setCurrentSlide(at);
}

/** Layout auf die aktuelle Slide: Inhalte wandern in die Platzhalter, ein Undo-Schritt; lag Inhalt auf der Slide, mit Rückgängig-Hinweis. */
export async function applyToCurrentSlide(preset: LayoutPreset): Promise<void> {
  await fontsLoaded();
  const p = useDoc.getState().project!;
  const i = useUi.getState().currentSlide;
  const content = elementsOnSlide(p, i).some((id) => contentRules.hasContent(p.elements[id]!));
  if (tryApply((d) => void layoutOnSlide(d, preset, i, contentRules)) && content) undoHint('Layout gewechselt');
}

/** Kanal des Projekts wechseln: CTA mit dem Standardtext des anderen Kanals zieht um, ein Undo-Schritt (Ruling R4). */
export async function setChannel(channel: Channel): Promise<number | null> {
  await fontsLoaded(); // die Boxbreite misst erst mit geladener Schrift richtig
  let changed = 0;
  const ok = tryApply((d) => {
    d.channel = channel;
    for (const e of Object.values(d.elements)) {
      const next = elementTypes.has(e.type) ? elementTypes.get(e.type).onChannel?.(e, channel) : undefined;
      if (next) {
        d.elements[e.id] = next;
        changed++;
      }
    }
  });
  return ok ? changed : null; // null: die Fehlermeldung steht schon
}

/** Kanal wechseln und melden, wie viele Link-Hinweise sich geändert haben. */
export async function switchChannel(c: Channel) {
  const n = await setChannel(c);
  if (n === null) return;
  useUi.getState().setNotice({
    kind: 'info',
    text: n === 0 ? 'Kein Link-Hinweis mit Standardtext gefunden.' : `${n} ${n === 1 ? 'Link-Hinweis' : 'Link-Hinweise'} angepasst.`,
  });
}

/** Slide-Aktionen auf eine Slide `i` (bei Verknüpfung die ganze Gruppe); danach ist die Ergebnis-Slide aktuell. */
const slidesOf = () => useDoc.getState().project!.slides;
const goTo = (i: number) => useUi.getState().setCurrentSlide(i);

export function duplicateSlideAt(i: number): void {
  const [, last] = groupOf({ slides: slidesOf() }, i);
  if (tryApply((d) => void duplicateSlide(d, i))) goTo(last + 1);
}

export function removeSlideAt(i: number): void {
  const [first, last] = groupOf({ slides: slidesOf() }, i);
  const rest = slidesOf().length - (last - first + 1);
  const n = last - first + 1;
  if (!tryApply((d) => removeSlide(d, i))) return;
  goTo(Math.min(first, rest - 1));
  undoHint(n === 1 ? 'Slide gelöscht' : `${n} Slides gelöscht`);
}

/** Verschiebt die Gruppe von `from` (erste Slide nach `to`, das Modell rundet auf Gruppengrenzen); die Slide bleibt aktuell. */
export function moveSlideTo(from: number, to: number): boolean {
  const slides = slidesOf();
  if (to < 0 || to >= slides.length || to === groupOf({ slides }, from)[0]) return false;
  const id = slides[from]!.id;
  if (!tryApply((d) => moveSlide(d, from, to))) return false;
  goTo(slidesOf().findIndex((s) => s.id === id));
  return true;
}

/** Einen Schritt: links vor die vorige Gruppe, rechts hinter die nächste. Wahr, wenn sich etwas bewegt hat. */
export function stepSlide(from: number, dir: -1 | 1): boolean {
  const slides = slidesOf();
  const [f, l] = groupOf({ slides }, from);
  return (dir < 0 ? f > 0 : l < slides.length - 1) && moveSlideTo(from, f + dir);
}

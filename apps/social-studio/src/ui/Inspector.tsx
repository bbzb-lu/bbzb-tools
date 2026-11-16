import { IconAlertCircle, IconCheck, IconCopy, IconCopyPlus, IconLock, IconStackBack, IconStackFront, IconTrash } from '@tabler/icons-react';
import { useRef, type ReactNode } from 'react';
import { elementTypes } from '../core/registries';
import { layerStep } from '../model/elements';
import type { Element } from '../model/types';
import { useDoc } from '../store/document';
import { useUi } from '../store/ui';
import { akzent } from '../tokens';
import { duplicate, markReviewed, patchElement, remove, restack, tryApply } from './actions';
import { KEYS, keysAttr } from './keys';
import { applyToCurrentSlide, layoutsFor } from './layoutActions';
import { LayoutSection } from './LayoutSection';
import { MultiActions } from './MultiActions';
import { OpacitySlider } from './OpacitySlider';
import { Section } from './Section';
import { SlideEffects } from './SlideEffects';
import { Swatches } from './Swatches';

/**
 * Mit Auswahl: Name, dann die einklappbaren Abschnitte (Ebene immer zuoberst, leere fallen weg);
 * ohne Auswahl: aktuelle Slide mit Layout, Hintergrund und Effekten.
 */
export function Inspector() {
  const selectedId = useUi((s) => s.selectedId);
  const selectedIds = useUi((s) => s.selectedIds);
  const el = useDoc((s) => (selectedId ? s.project?.elements[selectedId] : undefined));
  return (
    <aside className="inspector" aria-label="Eigenschaften">
      {/* key: kein Zustand (Entwürfe, Gesten) vom vorigen Element */}
      {selectedIds.length > 1 ? <MultiPanel key={selectedIds.join()} ids={selectedIds} /> : el && elementTypes.has(el.type) ? <ElementPanel key={el.id} el={el} /> : <SlidePanel />}
    </aside>
  );
}

function SlidePanel() {
  const i = useUi((s) => s.currentSlide);
  const slide = useDoc((s) => s.project!.slides[i]!);
  const { background, layout: current, review } = slide;
  const format = useDoc((s) => s.project!.format);
  const presets = layoutsFor(format.id);
  const heading = useRef<HTMLHeadingElement>(null);
  return (
    <>
      <h2 ref={heading} tabIndex={-1}>
        Slide {i + 1}
      </h2>
      {review ? (
        <section className="review-note" aria-labelledby="pruefen-titel">
          <h3 id="pruefen-titel">
            <IconAlertCircle aria-hidden="true" />
            Bitte prüfen
          </h3>
          <p>Diese Slide kommt aus dem anderen Format. Schau, ob Texte, Fotos und Scribbles gut sitzen.</p>
          <button type="button" onClick={() => {
              markReviewed(i);
              heading.current?.focus(); // der Knopf verschwindet, der Fokus bleibt in der Slide
            }}
          >
            <IconCheck aria-hidden="true" />
            Geprüft
          </button>
        </section>
      ) : (
        <p className="inspector-hint">Nichts ausgewählt. Klick auf ein Element auf der Leinwand, um es zu bearbeiten. Hier stellst du die ganze Slide ein.</p>
      )}
      {presets.length > 0 && <LayoutSection key={i} presets={presets} format={format} current={current} onPick={(l) => void applyToCurrentSlide(l)} />}
      <Section heading="Hintergrund" collapsible>
        <Swatches legend="Farbe" value={background} onChange={(c) => c !== akzent && tryApply((d) => void (d.slides[i]!.background = c))} />
      </Section>
      <SlideEffects index={i} />
    </>
  );
}

/** «Ebene»: immer der erste Abschnitt, startet offen (Duplizieren, Löschen), bei einem Element und bei mehreren (`children` = Aktionen des Elementtyps). */
function LayerSection({ children }: { children: ReactNode }) {
  return (
    <Section heading="Ebene" collapsible defaultOpen>
      <div className="actions actions-row">{children}</div>
    </Section>
  );
}

function ElementPanel({ el }: { el: Element }) {
  const { Inspector: Panel, LayerActions } = elementTypes.get(el.type);
  // Element kann im selben Update verschwinden, bevor das Panel abgebaut ist.
  const canUp = useDoc((s) => !!s.project?.elements[el.id] && layerStep(s.project, el.id, 1) >= 0);
  const canDown = useDoc((s) => !!s.project?.elements[el.id] && layerStep(s.project, el.id, -1) >= 0);
  return (
    <>
      <h2>{el.name}</h2>
      {el.locked && (
        <p className="lock-note">
          <IconLock aria-hidden="true" />
          Gesperrt.
          <button type="button" onClick={() => patchElement(el.id, { locked: false })}>Entsperren</button>
        </p>
      )}
      {/* Gesperrt: Name und Hinweis bleiben bedienbar, alles darunter ist inert (kein Fokus, kein Klick) */}
      <div className="inspector-body" inert={el.locked || undefined}>
      <LayerSection>
        <button type="button" className="icon-btn" aria-label="Duplizieren" data-tip="Duplizieren" data-keys={keysAttr(KEYS.duplicate)} onClick={() => duplicate(el.id)}>
          <IconCopy aria-hidden="true" />
        </button>
        <button type="button" className="icon-btn" aria-label="An gleicher Stelle duplizieren" data-tip="An gleicher Stelle duplizieren" onClick={() => duplicate(el.id, { inPlace: true })}>
          <IconCopyPlus aria-hidden="true" />
        </button>
        <button type="button" className="icon-btn" aria-label="Nach vorne" aria-disabled={!canUp} data-tip={canUp ? 'Nach vorne' : 'Liegt schon ganz vorne'} onClick={() => canUp && restack(el.id, 1)}>
          <IconStackFront aria-hidden="true" />
        </button>
        <button type="button" className="icon-btn" aria-label="Nach hinten" aria-disabled={!canDown} data-tip={canDown ? 'Nach hinten' : 'Liegt schon ganz hinten'} onClick={() => canDown && restack(el.id, -1)}>
          <IconStackBack aria-hidden="true" />
        </button>
        {LayerActions && <LayerActions el={el} />}
        <button type="button" data-tip="Löschen" data-keys={keysAttr(KEYS.remove)} disabled={el.locked} onClick={() => remove(el.id)}>
          <IconTrash aria-hidden="true" />
          Löschen
        </button>
      </LayerSection>
      {/* Darstellung, Bild, Effekte liefert der Elementtyp (mit OpacitySlider); ohne eigenes Panel nur die Deckkraft */}
      {Panel ? <Panel el={el} /> : <Section heading="Darstellung" id={`darstellung-${el.type}`} collapsible defaultOpen><OpacitySlider el={el} /></Section>}
      </div>
    </>
  );
}

/** Mehrfachauswahl: Ebene-Aktionen auf alle (Sperren und Ausblenden im Ebenen-Panel und im Rechtsklickmenü). */
function MultiPanel({ ids }: { ids: string[] }) {
  const els = useDoc((s) => s.project?.elements);
  const all = ids.filter((id) => els?.[id]);
  return (
    <>
      <h2>{all.length} Elemente</h2>
      <p className="inspector-hint">Ziehen auf der Leinwand verschiebt alle {all.length}. Für Farbe, Schrift oder Effekte wählst du ein einzelnes Element.</p>
      <LayerSection>
        <MultiActions ids={all} />
      </LayerSection>
    </>
  );
}

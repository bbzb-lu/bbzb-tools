import type { LayoutPreset } from '../core/types';
import { akzent } from '../tokens';
import { slideIndexOf } from './geometry';
import { LIMIT_TEXT, MAX_SLIDES, ModelError, addSlide, clone, groupOf } from './slides';
import type { Element, Project } from './types';

/**
 * Elemente eines Layouts ab Slide `at` in globalen Koordinaten (Slide i liegt bei x = i × Breite), noch nicht im Dokument.
 * `fit` stellt jedes Element nach seinem Typ fertig (ElementType.fromLayout: Standardwerte, gemessene Grösse).
 */
export function instantiateLayout(
  p: Project,
  preset: LayoutPreset,
  at: number,
  fit: (el: Element, i: number) => Element = (e) => e,
): Element[] {
  if (preset.format !== p.format.id) throw new ModelError('Dieses Layout passt nicht zum Format des Projekts.');
  if (!Number.isInteger(at) || at < 0 || at + preset.slides > p.slides.length) throw new ModelError('Für dieses Layout fehlen Slides.');
  const x0 = at * p.format.width;
  return preset.elements.map((s, i) => {
    const el = fit({
      id: crypto.randomUUID(),
      type: s.type,
      role: s.role,
      name: s.name,
      x: x0 + s.x,
      y: s.y,
      width: s.width,
      height: s.height,
      rotation: s.rotation ?? 0,
      opacity: 1,
      visible: true,
      locked: false,
      props: clone(s.props),
    }, i);
    return s.anchorRight ? { ...el, x: x0 + s.x + s.width - el.width } : el;
  });
}

/** Regeln der Elementtypen (Registry), damit das Modell keinen Typ kennt. */
export interface ContentRules {
  /**
   * ElementType.fromLayout: Standardwerte setzen, Grösse messen. `fresh`: Platzhalter ohne übernommenen Inhalt (neu aus den
   * Layoutdaten), nur dann darf der Typ Werte aus dem Projekt einsetzen (Schul-Tag: `lastTagLocation`).
   */
  fit(el: Element, p: Project, fresh: boolean): Element;
  /** Trägt Inhalt (Foto mit Bild, Text, Tag)? Typen ohne `take` sind Deko (Scribble). */
  hasContent(el: Element): boolean;
  /**
   * Platzhalter `into` mit dem Inhalt von `from` (gleicher Typ) oder undefined, wenn er nicht passt. `base`: Platzhalter des
   * bisherigen Layouts, aus dem `from` stammt (gleiche Rolle und Slide), damit Unverändertes dem neuen Layout folgt (R8).
   */
  take(into: Element, from: Element, p: Project, base?: Element): Element | undefined;
  /** Layout zu `Slide.layout` (Registry), für den Vergleich mit dem bisherigen Layout. */
  layout(id: string): LayoutPreset | undefined;
  /** Leerer Platzhalter (z. B. Foto ohne Bild): fällt immer weg, er trägt nichts. */
  isEmpty(el: Element): boolean;
}

/** `a`: Wert im Dokument, `b`: Wert aus den Layoutdaten. Projekte aus 2.4 haben «orange», wo das Layout heute «akzent» sagt. */
const near = (a: unknown, b: unknown, tol: number): boolean => {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= tol;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const x = a as Record<string, unknown>;
    const y = b as Record<string, unknown>;
    return Object.keys({ ...x, ...y }).every((k) => near(x[k], y[k], tol));
  }
  return a === b || (b === akzent && a === 'orange');
};

/** Gleich wie das Element aus den Layoutdaten: Props, Lage, Grösse, Drehung, Sichtbarkeit (kleine Messtoleranz). */
const unchanged = (e: Element, x: Element) =>
  e.type === x.type &&
  e.role === x.role &&
  e.visible === x.visible &&
  near([e.x, e.y, e.width, e.height], [x.x, x.y, x.width, x.height], 0.5) && // px, Texthöhe gemessen
  near([e.rotation, e.opacity, e.props], [x.rotation, x.opacity, x.props], 1e-6);

/**
 * Ruling R8: Elemente des bisherigen Layouts (laut `Slide.layout`), die noch genau seinen Daten entsprechen. Jedes Datenelement
 * deckt höchstens ein Element ab, eine Kopie an anderer Stelle oder etwas Geändertes bleibt also. `old`: alle Datenelemente.
 */
function untouched(d: Project, at: number, n: number, target: Element[], rules: ContentRules): { same: Set<string>; old: Element[] } {
  const out = new Set<string>();
  const all: Element[] = [];
  const starts = new Set<number>();
  for (let i = at; i < at + n; i++) {
    const id = d.slides[i]!.layout;
    const old = id === undefined ? undefined : rules.layout(id);
    if (!old || old.format !== d.format.id) continue;
    for (let s = Math.max(0, i - old.slides + 1); s <= i; s++) {
      const run = d.slides.slice(s, s + old.slides);
      if (starts.has(s) || run.length < old.slides || !run.every((x) => x.layout === id)) continue;
      starts.add(s);
      for (const x of instantiateLayout(d, old, s, (e) => rules.fit(e, d, true))) {
        all.push(x);
        const e = target.find((t) => !out.has(t.id) && unchanged(t, x));
        if (e) out.add(e.id);
      }
    }
  }
  return { same: out, old: all };
}

/**
 * Layout auf die Slides `at …` anwenden (Entscheid Task 0, Ruling R8): Inhalte wandern in die Platzhalter, zuerst nach gleicher
 * Rolle in Stapelreihenfolge, dann freie Elemente in noch leere Platzhalter. Ersetzt werden nur leere Platzhalter und was vom
 * bisherigen Layout unverändert ist (Deko, Beispieltexte, Tags). Alles Geänderte, Kopierte oder Hinzugefügte bleibt: als Inhalt im
 * Platzhalter oder frei liegend, über dem Layout. Gesperrtes bleibt unberührt. Liefert die Ids der Layout-Elemente.
 */
export function applyLayout(d: Project, preset: LayoutPreset, at: number, rules: ContentRules): string[] {
  instantiateLayout(d, preset, at); // prüft Format und Slides, bevor sich etwas ändert
  const target = d.order.map((id) => d.elements[id]!).filter((e) => {
    const i = slideIndexOf(d, e);
    return i >= at && i < at + preset.slides && !e.locked;
  });
  const { same, old } = untouched(d, at, preset.slides, target, rules);
  const content = target.filter((e) => !same.has(e.id) && rules.hasContent(e));
  const replaced = target.filter((e) => same.has(e.id) || rules.isEmpty(e)).map((e) => e.id);
  return place(d, preset, at, rules, content, replaced, old);
}

/** Layout-Elemente einsetzen; `content` darf in Platzhalter umziehen, `replaced` fällt weg; `old`: Daten des bisherigen Layouts. */
function place(d: Project, preset: LayoutPreset, at: number, rules: ContentRules, content: Element[], replaced: string[], old: Element[] = []): string[] {
  const raw = instantiateLayout(d, preset, at);
  const filled: (Element | undefined)[] = raw.map(() => undefined);
  const gone = new Set(replaced);
  const fill = (pick: (from: Element, into: Element) => boolean) =>
    raw.forEach((into, i) => {
      for (const from of content) {
        if (filled[i] || gone.has(from.id) || from.type !== into.type || !pick(from, into)) continue;
        // shortcut: bei gleichen Rollen auf einer Slide (drei Fotos) zählt der erste Platzhalter; genauer zuordnen, sobald sie verschiedene Verläufe tragen
        const base = old.find((x) => x.type === from.type && x.role === from.role && slideIndexOf(d, x) === slideIndexOf(d, from));
        const r = rules.take(into, from, d, base);
        if (!r) continue;
        // Ausgeblendet oder halb durchsichtig bleibt es auch im neuen Rahmen.
        filled[i] = { ...r, id: from.id, visible: from.visible, opacity: from.opacity };
        gone.add(from.id);
      }
    });
  fill((from, into) => from.role === into.role);
  fill((from) => from.role === undefined);
  // Zweiter Durchlauf nur für fit und anchorRight, mit den gefüllten Elementen.
  const els = instantiateLayout(d, preset, at, (_, i) => rules.fit(filled[i] ?? raw[i]!, d, filled[i] === undefined));
  // Das Layout kommt dorthin, wo das erste ersetzte Element lag: Freies darunter bleibt darunter.
  // Ist nichts ersetzt, unter das unterste freie Element der Slides: Übriges liegt über dem Layout.
  const first = d.order.findIndex((id) => gone.has(id));
  const keep = d.order.filter((id) => !gone.has(id));
  const onSlides = (id: string) => {
    const e = d.elements[id]!;
    const i = slideIndexOf(d, e);
    return !e.locked && i >= at && i < at + preset.slides;
  };
  const lowest = keep.findIndex(onSlides);
  const pos = first >= 0 ? d.order.slice(0, first).filter((id) => !gone.has(id)).length : lowest < 0 ? keep.length : lowest;
  for (const id of gone) delete d.elements[id];
  for (const e of els) d.elements[e.id] = e;
  keep.splice(pos, 0, ...els.map((e) => e.id));
  d.order = keep;
  // Verknüpfung: bisherige Gruppen der Slides lösen (auch die andere Hälfte), ein mehrteiliges Layout verknüpft seine Slides neu.
  // Die verwaiste Hälfte verliert auch ihr Layout: sie ist kein Teil eines Panoramas mehr.
  for (let i = at; i < at + preset.slides; i++) {
    const [first, last] = groupOf(d, i);
    for (let k = first; k <= last; k++) {
      delete d.slides[k]!.link;
      if (k < at || k >= at + preset.slides) delete d.slides[k]!.layout;
    }
  }
  const link = preset.slides > 1 ? crypto.randomUUID() : undefined;
  for (let i = at; i < at + preset.slides; i++) {
    const s = d.slides[i]!;
    if (link) s.link = link;
    Object.assign(s, { background: preset.background, layout: preset.id });
    // Ohne Angabe im Layout aus: das Feld fällt weg (fehlt = aus), wie bei einer neuen Slide
    // Mit Korn bleibt eine gewählte Stärke (wie ein selbst gewählter Verlauf), ohne fällt sie mit weg
    if (preset.grain) s.grain = true;
    else {
      delete s.grain;
      delete s.grainStrength;
    }
  }
  return els.map((e) => e.id);
}

/** Neue, leere Slides ab `at` für das Layout einfügen und es dort einsetzen («Slide hinzufügen»). Nimmt nichts auf. */
export function addLayoutSlides(d: Project, preset: LayoutPreset, at: number, rules: ContentRules): string[] {
  if (d.slides.length + preset.slides > MAX_SLIDES) throw new ModelError(`${LIMIT_TEXT} «${preset.label}» braucht ${preset.slides} Slides.`);
  for (let i = 0; i < preset.slides; i++) addSlide(d, at + i);
  return place(d, preset, at, rules, [], []);
}

/**
 * Index der Slide nach der Slide `i`, ohne ein mehrteiliges Layout (Panorama) zu teilen: Gehört `i` zu einer verknüpften Gruppe
 * (`Slide.link`) oder ohne Verknüpfung zu einem Lauf von `preset.slides` Slides mit derselben `Slide.layout`, kommt die neue Slide
 * danach. Läufe von links gezählt (wie die Format-Kopie).
 */
export function slideAfter(d: Project, i: number, layout: (id: string) => LayoutPreset | undefined): number {
  for (let s = 0; s <= i; ) {
    const id = d.slides[s]!.layout;
    const pre = id === undefined ? undefined : layout(id);
    const n = pre && pre.format === d.format.id ? pre.slides : 1;
    const run = d.slides.slice(s, s + n);
    const link = d.slides[s]!.link;
    // Verknüpfte Slides: die Gruppe; sonst ein Lauf mit demselben Layout ohne verknüpfte Slides (Projekte aus 2.1, Ruling R1)
    const end = link !== undefined ? groupOf(d, s)[1] + 1 : s + (run.length === n && run.every((x) => x.layout === id && x.link === undefined) ? n : 1);
    if (i < end) return end;
    s = end;
  }
  return i + 1;
}

/**
 * Layout auf die Slide `i` anwenden. Braucht es mehr Slides, kommen sie nach `slideAfter` dazu (die nächste Slide und ein
 * Panorama bleiben ganz); Slides des eigenen Laufs (z. B. dasselbe Panorama) werden wiederverwendet.
 */
export function layoutOnSlide(d: Project, preset: LayoutPreset, i: number, rules: ContentRules): string[] {
  const end = slideAfter(d, i, rules.layout);
  const extra = Math.max(0, preset.slides - (end - i));
  if (extra > 0) {
    if (d.slides.length + extra > MAX_SLIDES) throw new ModelError(`${LIMIT_TEXT} «${preset.label}» braucht ${preset.slides} Slides.`);
    for (let k = 0; k < extra; k++) addSlide(d, end + k);
  }
  return applyLayout(d, preset, i, rules);
}

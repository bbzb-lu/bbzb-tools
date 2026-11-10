import type { FormatPreset, LayoutElement, LayoutPreset } from '../core/types';
import { safeZones } from '../tokens';
import { elementBounds, slideIndexOf } from './geometry';
import { duplicateProject, groupOf } from './slides';
import type { Element, Project } from './types';

/** Registry und Elementtypen für die Format-Kopie, damit das Modell keinen Typ kennt. */
export interface CopyRules {
  /** Layout zu `Slide.layout`. */
  layout(id: string): LayoutPreset | undefined;
  /** Variante derselben Familie im Zielformat (Ruling R6). */
  variant(of: LayoutPreset, format: string): LayoutPreset | undefined;
  /** Namen aller Formate («Story 9:16»): nur diese Endung einer früheren Kopie wird ersetzt. */
  labels: readonly string[];
  /** Neuer Rahmen (ElementType.afterTransform: Fotoausschnitt neu einpassen). */
  resize(el: Element, box: { x: number; y: number; width: number; height: number; rotation: number }, p: Project): Element;
}

/** Verschiebung, damit [lo, hi] in [a, b] liegt; Grösseres deckt [a, b] ganz ab (Vollbild bleibt, wo es ist). */
const fit = (lo: number, hi: number, a: number, b: number) =>
  hi - lo <= b - a ? Math.max(a - lo, 0) + Math.min(b - hi, 0) : Math.min(a - lo, 0) + Math.max(b - hi, 0);

const frame = (s: LayoutElement, slide: number, w: number) => ({ x: slide * w + s.x, y: s.y, width: s.width, height: s.height, rotation: s.rotation ?? 0 });

/**
 * «Als anderes Format kopieren» (Entscheid Task 0): neues Projekt, das Original bleibt unverändert. Elemente in Platzhaltern
 * eines Layouts (`Slide.layout`, nach Rolle und Reihenfolge) nehmen den Rahmen der Variante, Abweichungen vom Platzhalter
 * bleiben erhalten; alles andere bleibt relativ zur Slide-Mitte. Danach liegt alles in der Safe Zone (Grösseres deckt sie).
 * Slides mit frei behandelten oder verschobenen Elementen bekommen `review` («Bitte prüfen»). Props bleiben, wie sie sind
 * (kein Korn für alte Fotos erfunden); neue Elemente entstehen keine.
 */
export function copyToFormat(src: Project, format: FormatPreset, rules: CopyRules, now = Date.now()): Project {
  const d = duplicateProject(src, now);
  // Endung einer früheren Kopie («(Story 9:16)») ersetzen statt anhängen; eigene Klammern («(Version 1:2)») bleiben
  const old = rules.labels.find((l) => src.name.endsWith(` (${l})`));
  d.name = `${old ? src.name.slice(0, -old.length - 3) : src.name} (${format.label})`.slice(0, 200);
  d.format = { id: format.id, width: format.width, height: format.height };
  const { width: W0, height: H0 } = src.format;
  const { width: W, height: H } = format;
  const zone = safeZones[format.id] ?? { top: 0, right: 0, bottom: 0, left: 0 };

  // Slide.layout ist nur ein Hinweis (zuletzt angewendet): gilt, wenn alle Slides des Layouts ihn tragen und die Variante passt.
  // Slide.link bleibt, wie es ist (duplicateProject).
  const placed = new Map<string, { from: LayoutElement; to: LayoutElement; at: number }>();
  for (let i = 0; i < src.slides.length; ) {
    const id = src.slides[i]!.layout;
    const pre = id === undefined ? undefined : rules.layout(id);
    const v = pre?.format === src.format.id ? rules.variant(pre, format.id) : undefined;
    const n = pre?.slides ?? 1;
    const run = src.slides.slice(i, i + n);
    // Verknüpfte Slides: der Lauf muss genau die Gruppe sein (eine gelöste Panorama-Hälfte davor gehört nicht dazu).
    const link = src.slides[i]!.link;
    const linked = link === undefined ? run.every((s) => s.link === undefined) : groupOf(src, i)[1] === i + n - 1;
    if (!pre || !v || v.slides !== n || run.length < n || run.some((s) => s.layout !== id) || !linked) {
      delete d.slides[i]!.layout;
      i++;
      continue;
    }
    const taken = new Map<string, number>(); // je Rolle und Typ: schon belegte Platzhalter
    for (const e of src.order.map((k) => src.elements[k]!)) {
      const s = slideIndexOf(src, e);
      if (e.role === undefined || s < i || s >= i + n) continue;
      const key = `${e.type}/${e.role}`;
      const k = taken.get(key) ?? 0;
      const same = (l: LayoutElement) => l.type === e.type && l.role === e.role;
      const from = pre.elements.filter(same)[k];
      const to = v.elements.filter(same)[k];
      if (!from || !to) continue;
      taken.set(key, k + 1);
      placed.set(e.id, { from, to, at: i });
    }
    for (let k = i; k < i + n; k++) d.slides[k]!.layout = v.id;
    i += n;
  }

  for (const id of src.order) {
    const e = src.elements[id]!;
    const i = slideIndexOf(src, e);
    const m = placed.get(id);
    let next: Element;
    let zoneX = true;
    let zoneY = true;
    const before = elementBounds(e);
    // Freies Foto über die ganze Slide (Phase 1, «Leer»): bleibt randabfallend, wird senkrecht gestreckt.
    const bleed = !m && e.type === 'photo' && e.rotation === 0 && before.x <= i * W0 && before.x + before.width >= (i + 1) * W0
      && before.y <= 0 && before.y + before.height >= H0;
    if (bleed) {
      next = rules.resize(e, { x: e.x, y: (e.y * H) / H0, width: e.width, height: (e.height * H) / H0, rotation: 0 }, d);
      zoneX = zoneY = false;
    } else if (m) {
      // Platzhalter → Variante; ein vom Platzhalter abweichender Rahmen behält seinen Abstand (rechtsbündige Tags, verschobener Text).
      const P = frame(m.from, m.at, W0);
      const V = frame(m.to, m.at, W);
      const sx = V.width / P.width;
      const sy = V.height / P.height;
      const box = { x: V.x + (e.x - P.x) * sx, y: V.y + (e.y - P.y) * sy, width: e.width * sx, height: e.height * sy, rotation: e.rotation };
      next = sx === 1 && sy === 1 ? { ...e, x: box.x, y: box.y } : rules.resize(e, box, d);
      // Was die Variante bis an den Rand zieht (Vollbild, Freisteller), bleibt dort.
      const b = elementBounds({ ...e, ...V });
      zoneX = b.x >= i * W + zone.left && b.x + b.width <= (i + 1) * W - zone.right;
      zoneY = b.y >= zone.top && b.y + b.height <= H - zone.bottom;
    } else {
      next = { ...e, x: e.x + (i + 0.5) * (W - W0), y: e.y + (H - H0) / 2 };
    }
    const b = elementBounds(next);
    // Über die Naht Ragendes (z. B. Panorama-Scribble) bleibt waagrecht, wie es ist: beide Formate sind gleich breit.
    // Nur die Mitte kommt in die eigene Slide, sonst wäre ein sehr breites Element unerreichbar.
    const seam = (i > 0 && before.x < i * W0) || (i < src.slides.length - 1 && before.x + before.width > (i + 1) * W0);
    const cx = b.x + b.width / 2;
    const dx = !zoneX ? 0 : seam ? Math.min(Math.max(cx, i * W), (i + 1) * W) - cx : fit(b.x, b.x + b.width, i * W + zone.left, (i + 1) * W - zone.right);
    const dy = zoneY ? fit(b.y, b.y + b.height, zone.top, H - zone.bottom) : 0;
    d.elements[id] = { ...next, x: next.x + dx, y: next.y + dy };
    if ((!m && !bleed) || Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) d.slides[i]!.review = true;
  }
  return d;
}

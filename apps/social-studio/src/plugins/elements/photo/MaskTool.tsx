import Konva from 'konva';
import { useEffect, useRef, useState } from 'react';
import { Image as KImage } from 'react-konva';
import { BRUSH_RING_NODE, EDITOR_ONLY_NODE, getContentLayer, MASK_VEIL_NODE } from '../../../canvas/contentLayer';
import { containsPoint } from '../../../model/geometry';
import { canvasToMask, maskScale, maskSize, newMask, paintStroke, strokeBounds, type Brush, type Mask } from '../../../model/mask';
import { sourceRect } from '../../../model/crop';
import type { Element, Rect } from '../../../model/types';
import { opfsAssetStore } from '../../../storage/assets';
import { loadMask, saveMask } from '../../../storage/maskAsset';
import { endGesture, startGesture, useDoc } from '../../../store/document';
import { useUi } from '../../../store/ui';
import { brush as tokens, colors, rgba } from '../../../tokens';
import { MASK_FAILED, setWorkingMask } from './maskLayer';
import { DROPPED, MASK_BUSY, maskIdle, maskOpRunning, saveStroke } from './maskOps';
import { flipOf, flipYOf, imageArea, maskOf, type PhotoProps } from './schema';


type Point = { x: number; y: number };

/** Arbeitskopie im Pinselmodus. `maskId`: Stand im Store, dem sie entspricht (das eigene Speichern lädt nicht neu). */
interface Session {
  mask: Mask;
  maskId: string | undefined;
  /** Maske als Deckkraft, in Maskengrösse. */
  alpha: OffscreenCanvas;
  /** Rote Folie: deckend, wo ausgeblendet; Deckkraft der Folie über `opacity` des Knotens. */
  veil: HTMLCanvasElement;
}

/** Deckkraft und Folie im Rechteck `r` (Maskenpixel) aus der Arbeitskopie. */
function paintAlpha(s: Session, r: Rect): void {
  const { mask: m } = s;
  const px = new ImageData(r.width, r.height);
  for (let y = 0; y < r.height; y++) {
    const row = (r.y + y) * m.width + r.x;
    for (let x = 0; x < r.width; x++) px.data[(y * r.width + x) * 4 + 3] = m.data[row + x]!;
  }
  s.alpha.getContext('2d')!.putImageData(px, r.x, r.y);
  const v = s.veil.getContext('2d')!;
  v.clearRect(r.x, r.y, r.width, r.height);
  v.fillStyle = tokens.veil.color;
  v.fillRect(r.x, r.y, r.width, r.height);
  v.globalCompositeOperation = 'destination-out';
  v.drawImage(s.alpha, r.x, r.y, r.width, r.height, r.x, r.y, r.width, r.height);
  v.globalCompositeOperation = 'source-over';
}

/**
 * Wie `paintMasked`, aber nur im Rechteck `r` (Maskenpixel): Foto neu, dann die Deckkraft. Die Quelle ist 2 Maskenpixel
 * grösser als der Ausschnitt, damit die Interpolation an seinem Rand der des ganzen Bildes entspricht (keine Nähte).
 */
function paintPhoto(canvas: HTMLCanvasElement, photo: HTMLImageElement, s: Session, r: Rect): void {
  const { width: mw, height: mh } = s.mask;
  const [kx, ky] = [canvas.width / mw, canvas.height / mh];
  const [dx, dy] = [Math.floor(r.x * kx), Math.floor(r.y * ky)];
  const [dw, dh] = [Math.ceil((r.x + r.width) * kx) - dx, Math.ceil((r.y + r.height) * ky) - dy];
  const [sx, sy] = [Math.max(0, r.x - 2), Math.max(0, r.y - 2)];
  const [sw, sh] = [Math.min(mw, r.x + r.width + 2) - sx, Math.min(mh, r.y + r.height + 2) - sy];
  const ctx = canvas.getContext('2d')!;
  ctx.save();
  ctx.beginPath();
  ctx.rect(dx, dy, dw, dh);
  ctx.clip();
  ctx.clearRect(dx, dy, dw, dh);
  ctx.drawImage(photo, dx, dy, dw, dh, dx, dy, dw, dh); // die Canvas hat die Grösse des Fotos
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(s.alpha, sx, sy, sw, sh, sx * kx, sy * ky, sw * kx, sh * ky);
  ctx.restore();
}

function newSession(mask: Mask, maskId: string | undefined): Session {
  const veil = document.createElement('canvas');
  [veil.width, veil.height] = [mask.width, mask.height];
  const s = { mask, maskId, alpha: new OffscreenCanvas(mask.width, mask.height), veil };
  paintAlpha(s, { x: 0, y: 0, width: mask.width, height: mask.height });
  return s;
}

/**
 * Pinselmodus am Foto `el` (aktiv, wenn `photo` gesetzt ist). Im Modus zeigt das Element das ganze Foto, die Folie markiert
 * das Ausgeblendete. Lädt die Maske als Arbeitskopie (`setWorkingMask`) und malt je Bild höchstens einmal in sie, in die Folie
 * und in die maskierte Canvas (`masked`, aus `useMaskedImage`), damit das Foto beim Verlassen ohne Sprung maskiert erscheint.
 * Kein React-Render und kein Store pro Mausbewegung; am Strichende ein `apply` (ein Undo-Schritt). Undo/Redo im Modus lädt neu.
 * Ein Druck ausserhalb des Fotos geht an die Leinwand (Auswahl ändert sich, der Modus endet). Gibt die Folie zurück.
 */
export function useMaskTool(el: Element<PhotoProps>, photo: HTMLImageElement | undefined, masked: CanvasImageSource | undefined) {
  const { id } = el;
  const maskedRef = useRef(masked);
  useEffect(() => void (maskedRef.current = masked), [masked]);
  const active = photo !== undefined;
  const maskId = maskOf(el.props);
  const session = useRef<Session | null>(null);
  const [veil, setVeil] = useState<HTMLCanvasElement>();

  // Arbeitskopie laden: beim Öffnen und wenn sich die Maske im Store ändert (Undo, Redo), nicht nach dem eigenen Strich
  useEffect(() => {
    if (!active || (session.current && session.current.maskId === maskId)) return;
    const meta = useDoc.getState().project?.assets[el.props.assetId ?? ''];
    if (!meta) return;
    let live = true;
    const size = maskSize(meta);
    (maskId ? loadMask(opfsAssetStore(), maskId) : Promise.resolve(newMask(size.width, size.height))).then(
      (m) => {
        if (!live) return;
        // die alte Sitzung nicht leeren: ein offener Strich könnte sie noch halten (der GC gibt sie frei)
        session.current = newSession(m, maskId);
        setWorkingMask(id, m);
        setVeil(session.current.veil);
      },
      (e: unknown) => {
        console.error(e);
        if (!live) return;
        useUi.getState().setNotice({ kind: 'error', text: MASK_FAILED });
        useUi.getState().setMaskEditId(null);
      },
    );
    return () => {
      live = false;
    };
  }, [active, maskId, id, el.props.assetId]);

  // Malen und Pinselring: native Listener am Stage-Container, in der Capture-Phase vor Konva (wie usePan)
  useEffect(() => {
    const stage = getContentLayer()?.getStage();
    const layer = stage?.findOne<Konva.Layer>('.selection');
    if (!photo || !stage || !layer) return;
    const box = stage.container();
    const ring = new Konva.Group({ name: BRUSH_RING_NODE, listening: false, visible: false });
    const back = new Konva.Circle({ stroke: rgba('blauschwarz', tokens.ring.backAlpha), strokeWidth: tokens.ring.backWidth, strokeScaleEnabled: false });
    const front = new Konva.Circle({ stroke: colors.warmweiss, strokeWidth: tokens.ring.width, strokeScaleEnabled: false });
    ring.add(back, front);
    layer.add(ring);
    // Ring in Slide-Koordinaten: die Stage skaliert ihn mit dem Zoom, die Linie bleibt dünn
    const size = () => [back, front].forEach((c) => c.radius(useUi.getState().brush.size / 2));
    size();
    const offBrush = useUi.subscribe((s, p) => void (s.brush.size !== p.brush.size && (size(), layer.batchDraw())));
    const world = (e: MouseEvent): Point => {
      const r = box.getBoundingClientRect();
      return { x: (e.clientX - r.left - stage.x()) / stage.scaleX(), y: (e.clientY - r.top - stage.y()) / stage.scaleY() };
    };
    const showRing = (e: PointerEvent) => {
      ring.position(world(e)).visible(true);
      layer.batchDraw();
    };
    const hideRing = () => void (ring.visible(false), layer.batchDraw());

    let stroke: { s: Session; brush: Brush; toMask: (p: Point) => Point; last?: Point; pending: Point[]; frame: number; changed: boolean } | null = null;
    // je Bild einmal: Punkte seit dem letzten Bild in die Maske, nur das berührte Rechteck neu zeichnen
    const flush = () => {
      const st = stroke!;
      st.frame = 0;
      const pts = st.last ? [st.last, ...st.pending] : st.pending;
      st.pending = [];
      if (!pts.length) return;
      st.last = pts.at(-1);
      const r = strokeBounds(st.s.mask, pts, st.brush.radius, st.brush.clip);
      if (!r) return;
      paintStroke(st.s.mask, pts, st.brush);
      st.changed = true;
      paintAlpha(st.s, r);
      const c = maskedRef.current;
      if (c instanceof HTMLCanvasElement) paintPhoto(c, photo, st.s, r);
      getContentLayer()?.batchDraw();
    };
    const hover = (e: PointerEvent) => void (!stroke && showRing(e));
    const move = (e: PointerEvent) => {
      if (e.buttons === 0) return end(); // Loslassen verpasst (z. B. Alt + Tab)
      showRing(e);
      stroke!.pending.push(stroke!.toMask(world(e)));
      stroke!.frame ||= requestAnimationFrame(flush);
    };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      if (!stroke) return;
      const st = stroke;
      try {
        cancelAnimationFrame(st.frame);
        flush();
      } finally {
        stroke = null;
        endGesture();
      }
      const { s, changed } = st;
      if (!changed) return;
      // Sitzung inzwischen ersetzt (Maske im Store geändert): der Strich passt nicht mehr dazu
      if (s !== session.current) return void useUi.getState().setNotice({ kind: 'error', text: DROPPED });
      // liest die Maske sofort, der nächste Strich darf weitermalen; die Kette des Fotos schreibt der Reihe nach ins Dokument
      void saveStroke(id, s, saveMask(opfsAssetStore(), s.mask));
    };
    const down = (e: PointerEvent) => {
      const p = useDoc.getState().project;
      const cur = p?.elements[id] as Element<PhotoProps> | undefined;
      const meta = cur?.props.assetId === undefined ? undefined : p?.assets[cur.props.assetId];
      // ausserhalb des Fotos: die Leinwand wählt (anderes Element oder ins Leere), das beendet den Modus
      if (e.button !== 0 || stroke || !cur || !meta || !containsPoint(cur, world(e))) return;
      e.stopPropagation();
      if (maskOpRunning(id)) return void useUi.getState().setNotice({ kind: 'error', text: MASK_BUSY });
      const s = session.current;
      if (!s) return; // Maske lädt noch
      const b = useUi.getState().brush;
      const area = imageArea(cur.props, cur);
      const flip = { x: flipOf(cur.props), y: flipYOf(cur.props) };
      const toMask = (q: Point) => canvasToMask(cur, area, cur.props.crop, flip, meta, s.mask, q);
      // nur im sichtbaren Ausschnitt malen: weggeschnittene Bildteile bleiben unberührt
      const clip = sourceRect(cur.props.crop, area, s.mask.width / meta.width, s.mask.height / meta.height);
      const brush = { radius: (b.size / 2) * maskScale(meta, s.mask, cur.props.crop), hardness: b.hardness / 100, mode: b.mode, clip };
      // Geste offen: Undo/Redo wirken während des Strichs nicht (die Arbeitskopie bleibt die des Strichs)
      startGesture();
      stroke = { s, brush, toMask, pending: [toMask(world(e))], frame: 0, changed: false };
      stroke.frame = requestAnimationFrame(flush);
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', end);
      window.addEventListener('pointercancel', end);
    };
    // Konva startet Ziehen und Auswahl auch über mousedown/touchstart nach dem pointerdown
    const block = (e: Event) => void (stroke && e.stopPropagation());
    box.addEventListener('pointerdown', down, true);
    box.addEventListener('mousedown', block, true);
    box.addEventListener('touchstart', block, true);
    box.addEventListener('pointermove', hover);
    box.addEventListener('pointerleave', hideRing);
    const cursor = box.style.cursor;
    box.style.cursor = 'crosshair';
    return () => {
      end(); // Modus mitten im Strich verlassen: der Strich zählt
      box.removeEventListener('pointerdown', down, true);
      box.removeEventListener('mousedown', block, true);
      box.removeEventListener('touchstart', block, true);
      box.removeEventListener('pointermove', hover);
      box.removeEventListener('pointerleave', hideRing);
      box.style.cursor = cursor;
      offBrush();
      ring.destroy();
      layer.batchDraw();
    };
  }, [photo, id]);

  // Verlassen (nach dem Abbau der Listener oben, der einen offenen Strich zuerst abschliesst): Folie weg; die Arbeitskopie erst nach dem letzten Speichern abgeben, sonst zeigte das Foto kurz den alten Stand
  useEffect(() => {
    if (!active) return;
    return () => {
      const s = session.current;
      session.current = null;
      setVeil(undefined);
      void maskIdle(id).then(() => {
        if (!session.current) setWorkingMask(id, undefined);
        if (s) s.alpha.width = s.alpha.height = 0;
      });
    };
  }, [active, id]);

  return veil;
}

/** Rote Folie über ausgeblendeten Flächen, im Bildbereich mit demselben Ausschnitt wie das Foto (`crop` in Fotopixeln). Nur im Editor. */
export function MaskVeil({ veil, crop, photo, width, height }: { veil: HTMLCanvasElement; crop: Rect; photo: { width: number; height: number }; width: number; height: number }) {
  const [kx, ky] = [veil.width / photo.width, veil.height / photo.height];
  return (
    <KImage
      name={`${EDITOR_ONLY_NODE} ${MASK_VEIL_NODE}`}
      image={veil}
      width={width}
      height={height}
      crop={{ x: crop.x * kx, y: crop.y * ky, width: crop.width * kx, height: crop.height * ky }}
      opacity={tokens.veil.alpha}
      listening={false}
    />
  );
}

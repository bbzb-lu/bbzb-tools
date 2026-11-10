import type Konva from 'konva';
import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react';
import { Stage } from 'react-konva';
import { elementTypes } from '../core/registries';
import { containsPoint } from '../model/geometry';
import { idsInRect, selectableOnSlide } from '../model/selection';
import { useDoc } from '../store/document';
import { useUi } from '../store/ui';
import { ContextBars } from '../ui/contextbar/ContextBars';
import { insertLibraryItem, readLibraryItem } from '../ui/libraryItem';
import { setEditorStage } from './contentLayer';
import { editorContext } from './editorContext';
import { SafeZoneLayer } from './SafeZoneLayer';
import { rubberBand } from './rubberBand';
import { Scene } from './Scene';
import { SelectionLayer } from './SelectionLayer';
import { SlideEdgeLayer } from './SlideEdgeLayer';
import { isMenuPress, onStageContextMenu } from './stageContextMenu';
import { TextEditOverlay } from './TextEditOverlay';
import { usePan } from './usePan';
import { useSlideGlow } from './useSlideGlow';
import { canvasLayout, PAD, zoomAround, zoomStep } from './zoom';

/** Ganze Leinwand: Stage in Containergrösse, scrollbar über einen nativen Scroll-Container. */
export function CanvasView() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  usePan(scrollRef);
  const [view, setView] = useState({ width: 0, height: 0 });
  const format = useDoc((s) => s.project!.format);
  const slideCount = useDoc((s) => s.project!.slides.length);
  const zoom = useUi((s) => s.zoom);
  const fitScale = Math.max(0.05, (view.height - 2 * PAD) / format.height);
  const scale = fitScale * zoom;
  const layoutAt = (z: number) => canvasLayout(view, { width: slideCount * format.width * fitScale * z, height: format.height * fitScale * z }, z);
  const layout = layoutAt(zoom);
  const glowRef = useRef<HTMLDivElement>(null);
  const slideW = format.width * scale;
  const slideH = format.height * scale;
  useSlideGlow(scrollRef, glowRef, { originX: layout.originX, originY: layout.originY, w: slideW, h: slideH, count: slideCount });

  useLayoutEffect(() => {
    const el = scrollRef.current!;
    const ro = new ResizeObserver(() => setView({ width: el.clientWidth, height: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Stage folgt dem Scrollen ohne React-Render.
  const sync = useEffectEvent(() => {
    const stage = stageRef.current;
    if (stage) stage.position({ x: layout.originX - scrollRef.current!.scrollLeft, y: layout.originY - scrollRef.current!.scrollTop });
  });
  useEffect(() => {
    const el = scrollRef.current!;
    const onScroll = () => sync();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Aktuelle Slide sichtbar halten (Slide-Leiste, neue oder verschobene Slide); nur scrollen, wenn sie nicht ganz zu sehen ist.
  // Nicht während eines Klicks auf die Leinwand: die gewählte Slide ist sichtbar, Scrollen würde das Ziehen stören.
  // Nicht beim Zoomen (nur Slide-Wechsel und -Anzahl, Fenstergrösse nur bei «Einpassen»), sonst kämpft es gegen den Zoom-Anker.
  const current = useUi((s) => s.currentSlide);
  const pressed = useRef(false);
  const showSlide = useEffectEvent((onlyAtFit: boolean) => {
    const el = scrollRef.current!;
    if (pressed.current || (onlyAtFit && zoom !== 1)) return;
    const left = layout.originX + current * format.width * scale - PAD;
    const right = left + format.width * scale + 2 * PAD;
    if (left < el.scrollLeft) el.scrollLeft = left;
    else if (right > el.scrollLeft + el.clientWidth) el.scrollLeft = Math.min(left, right - el.clientWidth);
  });
  useEffect(() => showSlide(false), [current, slideCount]);
  useEffect(() => showSlide(true), [fitScale]);

  // Zoom um einen Punkt (Zeiger, sonst Mitte): Scroll-Ziel beim Ändern des Zooms merken, solange die alte Scroll-Position
  // noch gilt, und nach dem Commit der neuen Inhaltsgrösse setzen (ohne sichtbaren Sprung).
  const zoomPointer = useRef<{ x: number; y: number } | null>(null);
  const scrollTarget = useRef<{ left: number; top: number } | null>(null);
  // Der Browser rundet scrollLeft/Top; ohne das exakte letzte Ziel würde der Anker über viele Pinch-Schritte wandern.
  const lastTarget = useRef<{ left: number; top: number } | null>(null);
  // Ohne Zeiger zurück auf ≤ 100 %: danach die aktuelle Slide zeigen, falls sie nicht ganz sichtbar ist.
  const refit = useRef(false);
  const onZoom = useEffectEvent((from: number, to: number) => {
    const el = scrollRef.current!;
    // Ohne Zeiger (Buttons, Tasten): Mitte des sichtbaren Slide-Bereichs, nicht der leeren Fläche daneben.
    const s0 = fitScale * from;
    const next = layoutAt(to);
    const mid = (start: number, size: number, view: number) => (Math.max(0, start) + Math.min(view, start + size)) / 2;
    const p = zoomPointer.current ?? {
      x: mid(layout.originX - el.scrollLeft, slideCount * format.width * s0, el.clientWidth),
      y: mid(layout.originY - el.scrollTop, format.height * s0, el.clientHeight),
    };
    refit.current = !zoomPointer.current && to <= 1 && from > 1;
    const t = lastTarget.current;
    const scroll = t && Math.abs(t.left - el.scrollLeft) < 1 && Math.abs(t.top - el.scrollTop) < 1 ? t : { left: el.scrollLeft, top: el.scrollTop };
    const o0 = { x: layout.originX, y: layout.originY };
    scrollTarget.current = zoomAround(scroll, p, s0, fitScale * to, o0, { x: next.originX, y: next.originY });
  });
  useEffect(() => useUi.subscribe((s, prev) => void (s.zoom !== prev.zoom && onZoom(prev.zoom, s.zoom))), []);
  useLayoutEffect(() => {
    const el = scrollRef.current!;
    if (scrollTarget.current) {
      el.scrollLeft = scrollTarget.current.left;
      el.scrollTop = scrollTarget.current.top;
      lastTarget.current = scrollTarget.current;
      scrollTarget.current = null;
    }
    if (refit.current) {
      refit.current = false;
      showSlide(false);
    }
    sync();
  }, [view, layout.originX, layout.originY, layout.width, layout.height]);

  // Rad: mit Ctrl/Alt (auch Touchpad-Pinch) zoomen, pro Frame gebündelt; sonst waagrecht, wenn senkrecht nichts zu scrollen ist.
  // Nativ, weil React-onWheel passiv ist und preventDefault (Edge-Seitenzoom) nicht wirkt.
  useEffect(() => {
    const el = scrollRef.current!;
    let delta = 0;
    let frame = 0;
    let altZoomed = false;
    // Windows: Alt allein loslassen fokussiert sonst das Edge-Menü (nicht auf Windows geprüft).
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key !== 'Alt') return;
      e.preventDefault();
      altZoomed = false;
      window.removeEventListener('keyup', onKeyUp);
    };
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) {
        e.preventDefault();
        if (e.altKey && !altZoomed) {
          altZoomed = true;
          window.addEventListener('keyup', onKeyUp);
        }
        const r = el.getBoundingClientRect();
        zoomPointer.current = { x: e.clientX - r.left, y: e.clientY - r.top };
        delta += e.deltaY;
        frame ||= requestAnimationFrame(() => {
          const ui = useUi.getState();
          frame = 0;
          ui.setZoom(zoomStep(ui.zoom, delta));
          zoomPointer.current = null; // auch wenn der Zoom an der Grenze stehen blieb
          delta = 0;
        });
      } else if (!useUi.getState().cropEditId && !e.shiftKey && e.deltaX === 0 && el.scrollHeight <= el.clientHeight) {
        // im Ausschnittmodus zoomt das Rad das Bild (PhotoNode)
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      window.removeEventListener('keyup', onKeyUp);
      cancelAnimationFrame(frame);
    };
  }, []);
  const backdrop = useUi((s) => s.stageBackdrop);

  const slideAt = (stageX: number) =>
    Math.min(slideCount - 1, Math.max(0, Math.floor(stageX / scale / format.width)));

  const onPointerDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
    if (isMenuPress(e.evt)) return; // Rechtsklick öffnet das Menü, startet weder Aufziehrahmen noch Auswahl
    pressed.current = true;
    const end = new AbortController();
    const release = () => {
      setTimeout(() => (pressed.current = false)); // der Slide-Wechsel beim Loslassen (Klick ins Leere) soll nicht scrollen
      end.abort();
    };
    window.addEventListener('pointerup', release, { signal: end.signal });
    window.addEventListener('pointercancel', release, { signal: end.signal });
    const stage = e.target.getStage()!;
    const elements = useDoc.getState().project!.elements;
    const ui = useUi.getState();
    let n: Konva.Node | null = e.target;
    // Das Trefferbild zeichnet Konva erst im nächsten Frame neu. Hat sich die Szene eben geändert (Klick, dann Doppelklick:
    // der Ausschnittmodus tauscht Bildknoten), trifft der dritte Klick ins Leere und würde abwählen. Nur dann neu zeichnen.
    if (n === stage) {
      // shortcut: wählt nur aus, ein Ziehen startet in diesem Fall erst beim nächsten Druck; bei Klagen das Ziehen hier von Hand starten
      (stage.findOne('.content') as Konva.Layer).drawHit();
      n = stage.getIntersection(stage.getPointerPosition()!) ?? stage;
    }
    while (n && !Object.hasOwn(elements, n.id())) n = n.getParent();
    if (ui.cropEditId && n?.id() !== ui.cropEditId) ui.setCropEditId(null);
    if (n) {
      const node = n;
      const id = n.id();
      const toggle = e.evt.shiftKey && selectableOnSlide(useDoc.getState().project!, ui.currentSlide).includes(id);
      const removed = toggle && ui.selectedIds.includes(id);
      if (toggle) ui.setSelectedIds(removed ? ui.selectedIds.filter((s) => s !== id) : [...ui.selectedIds, id]);
      else if (!ui.selectedIds.includes(id)) ui.setSelectedId(id); // Druck auf ein gewähltes Element: Auswahl bleibt (Mehrfach-Ziehen)
      if (removed) {
        // herausgenommen: nicht ziehen. Konva bereitet das Ziehen erst beim folgenden mousedown vor, darum bis zum Loslassen aus
        const was = node.draggable();
        node.draggable(false);
        const restore = new AbortController();
        const back = () => (node.draggable(was), restore.abort());
        window.addEventListener('pointerup', back, { signal: restore.signal });
        window.addEventListener('pointercancel', back, { signal: restore.signal });
      }
    } else if (e.target === stage) {
      const slide = slideAt(stage.getPointerPosition()!.x - stage.x());
      const shift = e.evt.shiftKey;
      // Klick ohne Zug wählt ab und setzt die Slide erst beim Loslassen; mit Zug zählt, was der Rahmen berührt.
      rubberBand(stage, stage.findOne('.selection') as Konva.Layer, (rect) => {
        const ui = useUi.getState();
        const hits = rect ? idsInRect(useDoc.getState().project!, slide, rect) : [];
        if (rect || !shift) ui.setSelectedIds(shift ? [...new Set([...ui.selectedIds, ...hits])] : hits);
        ui.setCurrentSlide(slide);
      })(e.evt);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const el = scrollRef.current!;
    const rect = el.getBoundingClientRect();
    // Stage-Pixel → globale Koordinaten (Zoom und Scrollen), auf die Leinwand begrenzt
    const sx = e.clientX - rect.left + el.scrollLeft - layout.originX;
    const sy = e.clientY - rect.top + el.scrollTop - layout.originY;
    useUi.getState().setCurrentSlide(slideAt(sx));
    const item = readLibraryItem(e.dataTransfer);
    if (item) {
      const clamp = (v: number, max: number) => Math.min(max, Math.max(0, v));
      return void insertLibraryItem(item, { x: clamp(sx / scale, slideCount * format.width), y: clamp(sy / scale, format.height) });
    }
    // Über einem Platzhalter füllt die erste passende Datei ihn, alles andere wird ein neues Element. Es zählt das oberste
    // sichtbare Foto unter dem Punkt (Texte und Tags verdecken nicht): ein freies Foto darüber nimmt den Drop als neues Foto.
    const p = useDoc.getState().project!;
    const at = { x: sx / scale, y: sy / scale };
    const top = p.order
      .map((id) => p.elements[id]!)
      .findLast((el) => el.visible && elementTypes.has(el.type) && elementTypes.get(el.type).fillFromFile && containsPoint(el, at));
    let into = top?.role && !top.locked ? top : undefined;
    for (const file of e.dataTransfer.files) {
      const target = into && elementTypes.get(into.type);
      if (into && target?.acceptsFile?.(file)) {
        void target.fillFromFile!(into, file, editorContext());
        into = undefined;
        continue;
      }
      const type = elementTypes.all().find((t) => t.acceptsFile?.(file) && t.fromFile);
      if (type) void type.fromFile!(file, editorContext());
      else useUi.getState().setNotice({ kind: 'info', text: 'Diese Datei kann ich nicht verwenden. Erlaubt sind Fotos.' });
    }
  };

  return (
    <div className="canvas">
      <div
        ref={scrollRef}
        className="canvas-scroll"
        style={{ background: `var(--unterlage-${backdrop})` }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <div className="canvas-content" style={{ width: layout.width, height: layout.height }}>
          {/* vor der Stage: Lineal und Slides liegen über dem Schatten. Nur Ansicht, nie im Export */}
          <div ref={glowRef} className={`slide-glows ${backdrop}`} aria-hidden="true">
            {Array.from({ length: slideCount }, (_, i) => [
              <div key={`t${i}`} className="slide-glow top" data-slide={i} style={{ left: layout.originX + i * slideW, width: slideW, bottom: `calc(100% - ${layout.originY}px)` }} />,
              <div key={`b${i}`} className="slide-glow bottom" data-slide={i} style={{ left: layout.originX + i * slideW, width: slideW, top: layout.originY + slideH }} />,
            ])}
          </div>
          <div className="canvas-stage">
            {view.width > 0 && (
              <Stage
                ref={(s) => {
                  stageRef.current = s;
                  setEditorStage(s);
                  return () => setEditorStage(null);
                }}
                width={view.width}
                height={view.height}
                scaleX={scale}
                scaleY={scale}
                onPointerDown={onPointerDown}
                onContextMenu={(e) => onStageContextMenu(e, slideAt)}
              >
                <Scene />
                <SlideEdgeLayer scale={scale} />
                <SafeZoneLayer />
                <SelectionLayer />
              </Stage>
            )}
          </div>
          <TextEditOverlay scale={scale} originX={layout.originX} originY={layout.originY} />
        </div>
      </div>
      <ContextBars />
    </div>
  );
}

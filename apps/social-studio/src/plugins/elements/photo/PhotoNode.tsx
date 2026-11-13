import Konva from 'konva';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { Group, Image as KImage, Rect, Text } from 'react-konva';
import { EDITOR_ONLY_NODE, VIDEO_FRAME_NODE } from '../../../canvas/contentLayer';
import { EFFECT_PENDING_NODE, useEffectCanvas } from '../../../canvas/effects';
import { MISSING_IMAGE_NODE, MISSING_VIDEO_NODE, useAssetImage } from '../../../canvas/images';
import { useVideoFrame } from '../../../canvas/useVideoFrame';
import type { ElementRenderProps } from '../../../core/types';
import { clampCrop, coverCrop, proportional, resizeCrop, sourceRect } from '../../../model/crop';
import { updateElement } from '../../../model/elements';
import type { Crop, Element } from '../../../model/types';
import { apply, endGesture, startGesture, useDoc } from '../../../store/document';
import { useUi } from '../../../store/ui';
import { colors, cropLine, photoFrame, placeholderStyle as ph, rgba, uiFamily } from '../../../tokens';
import { baseOf, hintColor } from './hint';
import { CARD_RECT, fitFrame, FRAME_RECT, InsetFrame, OutsideFrame } from './FrameRing';
import { cancelRing, finishRing, liteSource, liveRing, resetRing, RING_IMAGE } from './liveRing';
import { useMaskedImage } from './maskLayer';
import { MaskVeil, useMaskTool } from './MaskTool';
import { flipOf, flipYOf, frameOf, frameOutsideOf, imageArea, maskOf, type PhotoProps } from './schema';
import { photoSteps } from './steps';
import { attachPreview, usePreviewCanvas } from './usePreview';
import { RECT_RING, useOutline } from './useOutline';
import { inGroupDrag } from '../../../canvas/multiGesture';

type Size = { width: number; height: number };
const MAX_ZOOM = 8; // × Deckend-Skalierung

let wheelTimer: ReturnType<typeof setTimeout> | undefined;
/** Eine Rad-Serie = ein Undo-Schritt: endet 300 ms nach dem letzten Rad-Event oder beim Fokusverlust. */
function finishWheel() {
  clearTimeout(wheelTimer);
  wheelTimer = undefined;
  window.removeEventListener('blur', finishWheel);
  endGesture();
}
function wheelGesture() {
  if (wheelTimer === undefined) {
    startGesture();
    window.addEventListener('blur', finishWheel);
  }
  clearTimeout(wheelTimer);
  wheelTimer = setTimeout(finishWheel, 300);
}

const setCrop = (id: string, crop: Crop) =>
  apply((d) => {
    (d.elements[id] as Element<PhotoProps>).props.crop = crop;
  });

export function PhotoNode({ el, editing }: ElementRenderProps<PhotoProps>) {
  // Video: Bild bei `video.start` statt des Fotos; Rahmen, Spiegeln und Bildregler gibt es dort nicht (schema.ts)
  const vid = el.props.video;
  const photo = useAssetImage(vid ? undefined : el.props.assetId);
  const still = useVideoFrame(vid ? el.props.assetId : undefined, vid?.start ?? 0);
  // Foto mit Maske: Canvas mit der Maske als Deckkraft statt des Fotos, gilt für Anzeige, Effekte, Kontur und Export
  const masked = useMaskedImage(el.id, vid ? undefined : photo.img, maskOf(el.props));
  const img = vid ? still.frame : masked.img;
  const preview = usePreviewCanvas(el.id);
  const failed = vid ? still.error !== undefined : photo.failed;
  const frameRef = useRef<Konva.Image>(null);
  const fxRef = useRef<Konva.Image>(null);
  const innerRef = useRef<Konva.Group>(null);
  const rootRef = useRef<Konva.Group>(null);
  // Pinselmodus: ganzes Foto mit roter Folie, Effekte erst danach wieder (wie im Ausschnittmodus); der Pinsel malt die maskierte Canvas mit
  const masking = useUi((s) => s.maskEditId === el.id) && !vid;
  // «Ergebnis»: statt Foto und Folie die maskierte Canvas, die der Pinsel ohnehin live nachmalt
  const result = useUi((s) => s.maskView === 'ergebnis') && masking;
  const veil = useMaskTool(el, masking ? photo.img : undefined, masked.img);
  // Während einer Geste: letzte Skalierung (am Ende ist sie am Knoten schon zurückgesetzt) und verkleinerte Bildkopie für die Kontur
  const gesture = useRef<{ sx: number; sy: number; lite: ReturnType<typeof liteSource> } | null>(null);
  const { id } = el;
  const { crop } = el.props;
  // Elementbox = Aussenrand; Bild, Ausschnitt und Effekt-Canvas gelten für den Bildbereich darin
  const area = imageArea(el.props, el);
  const { width, height } = area;
  // dieselbe Quelle wie afterTransform, sonst springt der Ausschnitt beim Loslassen
  const meta = useDoc((s) => (el.props.assetId === undefined ? undefined : s.project?.assets[el.props.assetId]));
  // Hinweisfarbe nach der Fläche darunter: Rahmen, sonst Slide-Hintergrund. Panorama: gilt die Slide unter der Rahmenmitte.
  const slideBg = useDoc((s) => {
    const p = s.project;
    const i = p ? Math.min(p.slides.length - 1, Math.max(0, Math.floor((el.x + el.width / 2) / p.format.width))) : 0;
    return p?.slides[i]?.background ?? 'warmweiss';
  });
  const size: Size = meta ?? { width: photo.img?.naturalWidth ?? img?.width ?? 1, height: photo.img?.naturalHeight ?? img?.height ?? 1 };
  // Ausschnitt gilt in Asset-Pixeln; das Videobild ist kleiner (höchstens 1080 breit)
  const [kx, ky] = vid && img ? [img.width / size.width, img.height / size.height] : [1, 1];
  const frameCrop = (c: Crop) => sourceRect(c, { width, height }, kx, ky);

  // Effekte erst nach dem Ausschnittmodus rechnen: dort ändert sich der Ausschnitt bei jedem Rad-Schritt.
  const fx = useEffectCanvas(
    img && !editing && !masking ? `${el.props.assetId}${masked.key} ${crop.x} ${crop.y} ${crop.scale}${vid ? ` @${still.time}` : ''}` : null,
    width,
    height,
    photoSteps(el.props),
    (ctx) => {
      const f = frameCrop(crop);
      ctx.drawImage(img!, f.x, f.y, f.width, f.height, 0, 0, ctx.canvas.width, ctx.canvas.height);
    },
    masked.key !== '',
  );
  const showFx = !!fx.canvas && !editing && !masking;
  const flip = flipOf(el.props);
  const flipY = flipYOf(el.props);
  /** Kontur-Canvas wie die Anzeige spiegeln (w × h). */
  const mirror = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    if (flip || flipY) ctx.setTransform(flip ? -1 : 1, 0, 0, flipY ? -1 : 1, flip ? w : 0, flipY ? h : 0);
  };
  // Rahmen aussen: Kontur des sichtbaren Inhalts (gespiegelt wie angezeigt), je Bild, Ausschnitt, Spiegeln und Box einmal gerechnet
  const outside = frameOutsideOf(el.props);
  const outline = useOutline(
    // «Ergebnis»: Kontur nach jedem Strich neu (die Masken-Id wechselt mit jedem gespeicherten Strich)
    outside && img ? `${el.props.assetId}${masked.key}${result ? maskOf(el.props) : ''} ${crop.x} ${crop.y} ${crop.scale} ${flip} ${flipY} ${width}x${height}${vid ? ` @${still.time}` : ''}` : null,
    editing,
    width,
    height,
    (ctx) => {
      const f = frameCrop(crop);
      mirror(ctx, ctx.canvas.width, ctx.canvas.height);
      ctx.drawImage(img!, f.x, f.y, f.width, f.height, 0, 0, ctx.canvas.width, ctx.canvas.height);
    },
  );
  // Leerer Platzhalter oder fehlendes Bild: Rechteck. Bild lädt noch: noch kein Rahmen (der Export wartet aufs Bild).
  const ring = el.props.assetId === undefined || failed ? RECT_RING : outline.ring;
  const legacy = frameOf(el.props) && !outside;
  /** Beim Skalieren Rohbild mit Live-Ausschnitt zeigen (unverzerrt), danach wieder die Effekt-Canvas. */
  const showRaw = (raw: boolean) => {
    if (!fxRef.current) return;
    fxRef.current.visible(!raw);
    frameRef.current?.visible(raw);
  };

  /** Zeichnet das Rohbild mit dem Live-Ausschnitt (aus der verkleinerten Kopie, wenn es sie gibt) in die Rechen-Canvas der Kontur. */
  const ringDraw = (lite: ReturnType<typeof liteSource>) => (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const f = frameRef.current!.crop();
    const [source, k] = lite ? [lite.canvas, lite.k] : [img!, 1];
    mirror(ctx, w, h);
    ctx.drawImage(source, f.x * k, f.y * k, f.width * k, f.height * k, 0, 0, w, h);
  };
  const ringNode = (g: Konva.Group | null) => g?.findOne<Konva.Image>(`.${RING_IMAGE}`);
  // Abbau mitten in der Geste (Element gelöscht, Slide gewechselt): Rechnung und Canvas freigeben
  useEffect(() => {
    const g = rootRef.current;
    return () => {
      const n = ringNode(g);
      if (n) cancelRing(n);
      const lite = gesture.current?.lite;
      if (lite) Konva.Util.releaseCanvas(lite.canvas);
      gesture.current = null;
    };
  }, []);
  // Neue Kontur da (nach dem Loslassen gerechnet): die Live-Kontur der Geste weicht ihr
  useLayoutEffect(() => {
    const n = ringNode(rootRef.current);
    if (n) resetRing(n, ring);
  }, [ring]);

  // Ausschnittmodus verlassen schliesst eine offene Rad-Geste ab.
  useEffect(() => (editing ? () => void (wheelTimer !== undefined && finishWheel()) : undefined), [editing]);

  const toLocal = (node: Konva.Node) => node.getParent()!.getAbsoluteTransform().copy();

  return (
    <Group
      ref={rootRef}
      id={id}
      x={el.x}
      y={el.y}
      rotation={el.rotation}
      opacity={el.opacity}
      draggable={!el.locked && !editing}
      listening={!el.locked}
      onDragEnd={(e) => {
        if (e.target !== e.currentTarget || inGroupDrag(id)) return; // mehrere: commitMove schreibt alle
        apply((d) => updateElement(d, id, { x: e.target.x(), y: e.target.y() }));
      }}
      onTransformStart={() => {
        showRaw(true);
        gesture.current = { sx: 1, sy: 1, lite: ring && !ring.rect && !vid && img ? liteSource(img) : null };
      }}
      onTransformEnd={(e) => {
        showRaw(false);
        const g = e.currentTarget as Konva.Group;
        const rect = g.findOne<Konva.Rect>(`.${FRAME_RECT}`);
        if (rect) fitFrame(rect, el.width, el.height, 1, 1); // zurück auf die Lage aus den Props; die neue Box kommt per Render
        if (legacy) {
          // alter Innenrahmen: Lage und Grösse des Bildes aus den Props, die Karte wieder mit unverzerrtem Schatten
          innerRef.current?.setAttrs({ x: area.x + (flip ? width : 0), y: area.y + (flipY ? height : 0) });
          frameRef.current?.size({ width, height });
          g.findOne<Konva.Rect>(`.${CARD_RECT}`)?.shadowOffsetY(photoFrame.shadow.offsetY);
        }
        // Der Transformer hat die Skalierung schon zurückgesetzt und übernommen: die letzte aus der Geste zählt.
        // Mit Änderung: Live-Kontur einmal in Slide-Pixeln neu setzen, bis die gerechnete Kontur da ist; ohne: zurück auf die alte.
        const n = ringNode(g);
        const last = gesture.current;
        if (n && last) {
          if (Math.abs(last.sx - 1) < 1e-9 && Math.abs(last.sy - 1) < 1e-9) resetRing(n, ring);
          else if (img) finishRing(n, { draw: ringDraw(last.lite), box: { width: el.width, height: el.height }, sx: last.sx, sy: last.sy });
        }
        if (last?.lite) Konva.Util.releaseCanvas(last.lite.canvas);
        gesture.current = null;
      }}
      onTransform={(e) => {
        // Live-Vorschau ohne Verzerrung: Ausschnitt wie afterTransform, Skalierung des Knotens ausgleichen.
        const node = e.currentTarget as unknown as Konva.Group;
        const frame = frameRef.current;
        if (!frame || (e.target as Konva.Node) !== node) return;
        const [sx, sy] = [node.scaleX(), node.scaleY()];
        // Rechteckrahmen: Randbreite ohne Verzerrung
        const rect = node.findOne<Konva.Rect>(`.${FRAME_RECT}`);
        if (rect) fitFrame(rect, el.width, el.height, sx, sy);
        // Alter Innenrahmen: die Ränder um das Bild behalten ihre Breite, nur der Bildbereich wächst
        const { left, top, right, bottom } = photoFrame.inset;
        const next = legacy
          ? { width: Math.max(1, el.width * sx - left - right), height: Math.max(1, el.height * sy - top - bottom) }
          : { width: width * sx, height: height * sy };
        const c = resizeCrop({ width, height }, next, size, crop, proportional(el, { width: el.width * sx, height: el.height * sy }));
        frame.crop(sourceRect(c, next, kx, ky));
        if (legacy) {
          innerRef.current?.setAttrs({ x: left / sx + (flip ? next.width / sx : 0), y: top / sy + (flipY ? next.height / sy : 0) });
          frame.size({ width: next.width / sx, height: next.height / sy });
          node.findOne<Konva.Rect>(`.${CARD_RECT}`)?.shadowOffsetY(photoFrame.shadow.offsetY / sy);
        }
        // Kontur um Freisteller: in Vorschau-Auflösung neu, in echter Breite (Bild und Ausschnitt wie das Rohbild darüber)
        const ringN = ringNode(node);
        if (gesture.current) Object.assign(gesture.current, { sx, sy });
        if (ringN && ring && !ring.rect && img) {
          liveRing(ringN, { draw: ringDraw(gesture.current?.lite ?? null), box: { width: el.width, height: el.height }, sx, sy });
        }
      }}
      onDblClick={(e) => e.evt.button === 0 && el.props.assetId && useUi.getState().setCropEditId(id)} // Windows: Rechtsklick zählt sonst mit
      onDblTap={() => el.props.assetId && useUi.getState().setCropEditId(id)}
      onWheel={(e) => {
        // Ctrl/Alt + Rad zoomt die Ansicht (CanvasView), nicht das Bild
        if (!editing || !img || e.evt.ctrlKey || e.evt.altKey || e.evt.metaKey) return;
        e.evt.preventDefault();
        wheelGesture();
        const cur = (useDoc.getState().project!.elements[id] as Element<PhotoProps>).props.crop;
        // im gespiegelten Inhalt rechnen: der Ausschnitt gilt fürs ungespiegelte Bild
        const p = innerRef.current!.getAbsoluteTransform().copy().invert().point(e.currentTarget.getStage()!.getPointerPosition()!);
        const max = coverCrop({ width, height }, size).scale * MAX_ZOOM;
        const scale = Math.min(max, cur.scale * (e.evt.deltaY < 0 ? 1.1 : 1 / 1.1));
        const k = scale / cur.scale;
        setCrop(id, clampCrop({ width, height }, size, { x: p.x - (p.x - cur.x) * k, y: p.y - (p.y - cur.y) * k, scale }));
      }}
    >
      {/* Rahmen auch beim leeren Platzhalter: gehört zum Layout und wird exportiert (wie früher die Fläche darunter) */}
      {outside && ring && <OutsideFrame ring={ring} width={el.width} height={el.height} />}
      {frameOf(el.props) && !outside && <InsetFrame width={el.width} height={el.height} />}
      {el.props.assetId === undefined && (
        // Leerer Platzhalter: nur im Editor sichtbar, der Export entfernt die Gruppe (Slide-Hintergrund bleibt).
        <Group name={EDITOR_ONLY_NODE} x={area.x} y={area.y}>
          <Rect
            width={width}
            height={height}
            fill={rgba(ph.color, ph.fillAlpha)}
            stroke={rgba(ph.color, ph.edgeAlpha)}
            strokeWidth={ph.edgeWidth}
            dash={[...ph.edgeDash]}
          />
          <Text
            text="Foto hierher ziehen"
            width={width}
            height={height}
            align="center"
            verticalAlign="middle"
            padding={ph.fontSize / 2}
            fontFamily={uiFamily}
            fontSize={ph.fontSize}
            fill={colors[hintColor(baseOf(slideBg, frameOf(el.props)))]}
            listening={false}
          />
        </Group>
      )}
      {failed && <Rect name={vid ? MISSING_VIDEO_NODE : MISSING_IMAGE_NODE} notice={still.error} x={area.x} y={area.y} width={width} height={height} fill={colors.blauschwarz} />}
      {failed && vid && (
        <Text
          text={still.error}
          x={area.x}
          y={area.y}
          width={width}
          height={height}
          align="center"
          verticalAlign="middle"
          padding={ph.fontSize / 2}
          fontFamily={uiFamily}
          fontSize={ph.fontSize}
          fill={colors.warmweiss}
          listening={false}
        />
      )}
      {/* Videobild oder Maske lädt noch: der Export wartet */}
      {((vid && !img && !failed) || masked.pending) && <Group name={EFFECT_PENDING_NODE} />}
      {/* Spiegeln nur in der Anzeige: Ausschnitt und Effekt-Canvas bleiben ungespiegelt, Ziehen im Ausschnittmodus rechnet im Inhalt */}
      <Group ref={innerRef} name={vid ? VIDEO_FRAME_NODE : undefined} x={area.x + (flip ? width : 0)} y={area.y + (flipY ? height : 0)} scaleX={flip ? -1 : 1} scaleY={flipY ? -1 : 1}>
        {img && editing && (
          // Ganzes Bild halbtransparent: zeigt, was ausserhalb des Rahmens liegt; ziehen verschiebt den Ausschnitt.
          <KImage
            image={img}
            x={crop.x}
            y={crop.y}
            width={size.width * crop.scale}
            height={size.height * crop.scale}
            opacity={0.4}
            draggable
            dragBoundFunc={function (this: Konva.Node, pos) {
              const t = toLocal(this);
              const local = t.copy().invert().point(pos);
              return t.point(clampCrop({ width, height }, size, { ...local, scale: crop.scale }));
            }}
            onDragMove={(e) => frameRef.current?.crop(frameCrop({ x: e.target.x(), y: e.target.y(), scale: crop.scale }))}
            // erneut begrenzen: die Matrix-Umrechnung in dragBoundFunc lässt Rundungsreste (1e-14) stehen
            onDragEnd={(e) => setCrop(id, clampCrop({ width, height }, size, { x: e.target.x(), y: e.target.y(), scale: crop.scale }))}
          />
        )}
        {img && (
          <KImage
            ref={frameRef}
            // Pinselmodus: der Export wartet, bis das Foto wieder maskiert gezeichnet ist
            name={fx.pending || outline.pending || still.pending || masking ? EFFECT_PENDING_NODE : undefined}
            image={masking && !result ? photo.img : img}
            width={width}
            height={height}
            crop={frameCrop(crop)}
            visible={!showFx}
            listening={!editing}
          />
        )}
        {showFx && <KImage ref={fxRef} image={fx.canvas} width={width} height={height} />}
        {veil && !result && <MaskVeil veil={veil} crop={frameCrop(crop)} photo={size} width={width} height={height} />}
        {/* Ausschnittmodus: Rand des Ausschnitts als dünne Linie, nur im Editor; dreht und spiegelt mit dem Bildbereich */}
        {img && editing && <Rect name={EDITOR_ONLY_NODE} width={width} height={height} stroke={colors.orange} strokeWidth={cropLine.width} strokeScaleEnabled={false} listening={false} />}
      </Group>
      {/* Video-Vorschau (Inspector «Vorschau»): liegt über dem Startbild, nur im Editor; die Schleife zeichnet sie neu */}
      {preview && !editing && (
        <KImage ref={(n) => attachPreview(id, n)} name={EDITOR_ONLY_NODE} image={preview} x={area.x} y={area.y} width={width} height={height} listening={false} />
      )}
    </Group>
  );
}

import type Konva from 'konva';
import { useEffect, useRef } from 'react';
import { Layer, Line, Transformer } from 'react-konva';
import { useShallow } from 'zustand/react/shallow';
import { elementTypes } from '../core/registries';
import { unionBounds } from '../model/selection';
import type { Element } from '../model/types';
import { useDoc } from '../store/document';
import { useUi } from '../store/ui';
import { colors } from '../tokens';
import { commitTransform, endGroupDrag, exact, startGroupDrag, tooSmall } from './multiGesture';
import { type Guides, snapAnchor, snapLines, snapMove, type SnapLines } from './snap';

const MIN_SIZE = 20;
const CORNERS = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];
const OPPOSITE: Record<string, string> = { 'top-left': 'bottom-right', 'top-right': 'bottom-left', 'bottom-right': 'top-left', 'bottom-left': 'top-right' };
const GUIDE = { visible: false, stroke: colors.orange, strokeWidth: 2, strokeScaleEnabled: false, listening: false };
type Pt = { x: number; y: number };

// Eine Geste zur Zeit (eine Stage): Linien einmal pro Geste, Einrasten und Hilfslinien danach nur imperativ in Konva (kein Store, kein Render).
// lead: der gezogene Node; die übrigen zieht der Transformer mit.
let gesture: { lead: Konva.Node; nodes: Konva.Node[]; els: Element[]; lines: SnapLines } | null = null;

function showGuides(layer: Konva.Layer | null | undefined, g: Guides | null) {
  const v = layer?.findOne<Konva.Line>('.guide-x');
  const h = layer?.findOne<Konva.Line>('.guide-y');
  if (!v || !h) return;
  const { format, slides } = useDoc.getState().project!;
  v.visible(g?.x != null);
  h.visible(g?.y != null);
  if (g?.x != null) v.points([g.x, 0, g.x, format.height]);
  if (g?.y != null) h.points([0, g.y, slides.length * format.width, g.y]);
  layer!.batchDraw();
}
function begin(lead: Konva.Node, all: Konva.Node[]) {
  const p = useDoc.getState().project!;
  const nodes = all.filter((n) => Object.hasOwn(p.elements, n.id()));
  const ids = nodes.map((n) => n.id());
  gesture = nodes.length ? { lead, nodes, els: ids.map((id) => p.elements[id]!), lines: snapLines(p, ids, { zones: useUi.getState().safeZones }) } : null;
}
function end(layer: Konva.Layer | null | undefined) {
  gesture = null;
  showGuides(layer, null);
}

/** Auswahl und Nahtlinien. Wird nie exportiert. */
export function SelectionLayer() {
  const trRef = useRef<Konva.Transformer>(null);
  const selectedIds = useUi((s) => s.selectedIds);
  const editing = useUi((s) => s.cropEditId !== null || s.textEditId !== null || s.maskEditId !== null);
  // Gesperrte und ausgeblendete Elemente der Auswahl bleiben stehen: nicht am Transformer
  const attached = useDoc(
    useShallow((s) => (editing ? [] : selectedIds.map((id) => s.project?.elements[id]).filter((e): e is Element => !!e && e.visible && !e.locked && elementTypes.has(e.type)))),
  );
  const slideCount = useDoc((s) => s.project!.slides.length);
  const { width, height } = useDoc((s) => s.project!.format);
  const active = attached.length === 1 ? attached[0] : undefined;
  const multi = attached.length > 1;
  // ein gedrehtes Element in der Gruppe: frei skaliert entstünde eine Scherung, die das Modell nicht kennt. Shift wirkt dann nicht.
  const lockRatio = multi && attached.some((e) => e.rotation % 360 !== 0);
  // Ziehen: Konva-Ereignisse steigen bis zur Stage auf; das Element setzt seine Position erst bei dragend in den Store
  // (mehrere: commitMove, ein apply).
  useEffect(() => {
    const tr = trRef.current!;
    const layer = tr.getLayer();
    const stage = tr.getStage()!;
    stage.on('dragstart.snap', (e) => {
      if (!Object.hasOwn(useDoc.getState().project!.elements, e.target.id())) return;
      if (gesture?.lead.isDragging() && gesture.nodes.includes(e.target)) return; // vom Transformer mitgezogen
      begin(e.target, tr.nodes().includes(e.target) ? tr.nodes() : [e.target]);
      startGroupDrag(gesture?.nodes.map((n) => n.id()) ?? []);
    });
    stage.on('dragmove.snap', (e) => {
      const g = gesture;
      if (!g || e.target !== g.lead) return; // Konva hat alle Nodes schon gesetzt: einmal pro Mausbewegung einrasten
      if ((e.evt as MouseEvent).ctrlKey) return showGuides(layer, null); // Ctrl: frei ziehen
      const box = unionBounds(g.nodes.map((n, i) => ({ ...g.els[i]!, x: n.x(), y: n.y() })));
      const r = snapMove(box, g.lines, stage.scaleX());
      for (const n of g.nodes) n.position({ x: r.guides.x != null ? exact(n.x() + r.dx) : n.x(), y: r.guides.y != null ? exact(n.y() + r.dy) : n.y() });
      showGuides(layer, r.guides);
    });
    stage.on('dragend.snap', () => {
      const content = stage.findOne('.content') as Konva.Layer;
      endGroupDrag((id) => content.findOne((n: Konva.Node) => n.id() === id));
      end(layer);
    });
    return () => void stage.off('.snap');
  }, []);

  // Skalieren: den gezogenen Anfasser einrasten (Bildschirm-Koordinaten der Stage → global und zurück).
  const anchorBound = (oldAbs: Pt, newAbs: Pt, evt: MouseEvent) => {
    const tr = trRef.current!;
    const name = tr.getActiveAnchor();
    const g = gesture;
    if (!g || !name || name === 'rotater' || evt.ctrlKey) {
      showGuides(tr.getLayer(), null);
      return newAbs;
    }
    const stage = tr.getStage()!;
    const s = stage.scaleX();
    const o = stage.position();
    const toGlobal = (p: Pt) => ({ x: (p.x - o.x) / s, y: (p.y - o.y) / s });
    const corner = (n: string) => toGlobal(tr.findOne(`.${n}`)!.getAbsolutePosition());
    const pts = CORNERS.map(corner);
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const bbox = { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
    // wie Konva: Ecken mit Seitenverhältnis (Shift frei, shiftBehavior «inverted»), Alt skaliert um die Mitte
    const fixed = !OPPOSITE[name] || !tr.keepRatio() || (evt.shiftKey && tr.shiftBehavior() !== 'none') ? null
      : evt.altKey ? { x: (pts[0]!.x + pts[2]!.x) / 2, y: (pts[0]!.y + pts[2]!.y) / 2 } : corner(OPPOSITE[name]);
    const r = snapAnchor(toGlobal(oldAbs), toGlobal(newAbs), bbox, fixed, g.lines, s);
    showGuides(tr.getLayer(), r.guides);
    return { x: r.point.x * s + o.x, y: r.point.y * s + o.y };
  };

  // Auswahl wechselt mitten in der Geste: Hilfslinien weg. Nur bei anderer Auswahl, nicht bei jedem Store-Update desselben Elements.
  useEffect(() => end(trRef.current!.getLayer()), [selectedIds]);

  useEffect(() => {
    const tr = trRef.current!;
    const content = tr.getStage()?.findOne('.content') as Konva.Layer | undefined;
    const nodes = attached.map((el) => content?.findOne((n: Konva.Node) => n.id() === el.id)).filter((n): n is Konva.Node => !!n);
    tr.nodes(nodes);
    tr.forceUpdate();
  }, [attached]);

  const onTransformEnd = () => {
    end(trRef.current!.getLayer());
    commitTransform(trRef.current!.nodes());
  };

  return (
    <Layer name="selection">
      {Array.from({ length: slideCount - 1 }, (_, i) => (
        <Line
          key={i}
          points={[(i + 1) * width, 0, (i + 1) * width, height]}
          stroke={colors.blauschwarz}
          opacity={0.5}
          strokeWidth={1}
          strokeScaleEnabled={false}
          dash={[8, 8]}
          listening={false}
        />
      ))}
      <Line name="guide-x" {...GUIDE} />
      <Line name="guide-y" {...GUIDE} />
      <Transformer
        ref={trRef}
        // mehrere: gemeinsame Box nur an den Ecken skalieren, nicht drehen (Spezifikation 2.10)
        enabledAnchors={multi ? CORNERS : active ? elementTypes.get(active.type).anchors : []}
        rotateEnabled={!multi}
        flipEnabled={false}
        keepRatio
        // Rahmen = Elementbox: der gestrichelte Rand des leeren Foto-Platzhalters ragt sonst 2 px hinaus, Einrasten wäre daneben
        ignoreStroke
        // Ecken proportional, Shift macht frei (in Konva heisst das «inverted»; «default» hiesse Shift = proportional)
        shiftBehavior={lockRatio ? 'none' : 'inverted'}
        rotateAnchorOffset={16}
        borderStroke={colors.orange}
        anchorStroke={colors.orange}
        anchorFill={colors.warmweiss}
        anchorCornerRadius={0}
        rotationSnaps={[0, 90, 180, 270]}
        boundBoxFunc={(old, next) => {
          const small = Math.abs(next.width) < MIN_SIZE || Math.abs(next.height) < MIN_SIZE;
          const nodes = trRef.current!.nodes();
          return small || (nodes.length > 1 && tooSmall(nodes, Math.abs(next.width / old.width), Math.abs(next.height / old.height), MIN_SIZE)) ? old : next;
        }}
        anchorDragBoundFunc={anchorBound}
        onTransformStart={() => {
          const nodes = trRef.current!.nodes();
          if (nodes[0]) begin(nodes[0], nodes);
        }}
        onTransformEnd={onTransformEnd}
      />
    </Layer>
  );
}

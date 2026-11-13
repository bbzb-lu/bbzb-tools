import { unzipSync } from 'fflate';
import Konva from 'konva';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { BRUSH_RING_NODE, getContentLayer, MASK_VEIL_NODE } from './canvas/contentLayer';
import { EFFECT_PENDING_NODE, previewStats } from './canvas/effects';
import { editorContext } from './canvas/editorContext';
import { loadBrandAssets } from './brand/manifest';
import { ensureDoodles } from './brand/doodles';
import { ensureTabler } from './brand/tabler';
import { aiTools, assetPacks, elementTypes, exporters } from './core/registries';
import { fakeSegment, type FakeMode } from './ai/fakeSegment';
import { videoExportStats } from './export/exportVideoSlide';
import { exportZip, renderSlide } from './export/exportZip';
import { apply, endGesture, gestureOpen, startGesture, useDoc } from './store/document';
import { useUi, type AiRun } from './store/ui';
import { updateElement } from './model/elements';
import { newMask, paintStroke } from './model/mask';
import { opfsAssetStore } from './storage/assets';
import { loadMask, maskMeta, saveMask } from './storage/maskAsset';
import type { Element, Project } from './model/types';
import type { LayoutPreset } from './core/types';
import { applyLayout } from './model/layout';
import { contentRules, fontsLoaded } from './ui/layoutActions';
import { Section } from './ui/Section';
import { SliderLab } from './ui/kit/SliderLab';

type VideoProbe = { pixels: number[][]; duration: number; width: number; height: number; frames: number; audio: string | null; audioDuration: number | null };

/** RGB eines 5 × 5-Flecks je Punkt (relativ zur Canvas). */
const patches = (c: HTMLCanvasElement, pts: [number, number][]) => {
  const ctx = c.getContext('2d')!;
  return pts.map(([x, y]) => {
    const d = ctx.getImageData(Math.round(x * c.width) - 2, Math.round(y * c.height) - 2, 5, 5).data;
    return Array.from(d).filter((_, i) => i % 4 !== 3);
  });
};

declare global {
  interface Window {
    /** Nur im Build mit `--mode test` vorhanden (e2e). */
    __bbzbTest: {
      /** Echte einklappbare Section ein- oder ausbinden (e2e der Grundbauteile). */
      mountSection(on: boolean): void;
      /** Regler-Bauteile (Slider, Knob, RangeSlider) ein- oder ausbinden. */
      mountSliders(on: boolean): void;
      elements(): Element[];
      project(): Project;
      contentIds(): string[];
      transformerNodes(): number;
      transformerAnchors(): string[];
      nodePos(id: string): { x: number; y: number };
      layerNames(): string[];
      /** Namen aller Knoten der Ebene «content» (was exportiert wird). */
      contentNames(): string[];
      /** Name der Ebene, in der der Knoten mit diesem Namen liegt (null: nicht gefunden). */
      nodeLayer(name: string): string | null;
      /** Geste von aussen öffnen, schliessen, abfragen (e2e: fremde Geste darf ein Zahlenfeld nicht beenden). */
      gesture: { start(): void; end(): void; open(): boolean };
      patch(id: string, patch: Partial<Element>): void;
      select(id: string): void;
      selectIds(ids: string[]): void;
      selected(): string | null;
      rubberVisible(): boolean;
      safeZoneListening(): boolean;
      safeZoneRects(): { width: number; height: number }[];
      safeZoneMargins(): number[][];
      safeZoneMarginStrokes(): { line: string; back: string }[];
      guides(): { x: number | null; y: number | null };
      overlayStrokes(): string[];
      view(): { x: number; y: number; scale: number };
      hit(clientX: number, clientY: number): string | null;
      insertBrand(id: string, at?: { x: number; y: number }): Promise<void>;
      insertTag(variant: string, at?: { x: number; y: number }): Promise<void>;
      pendingEffects(): number;
      /** Bildschirmpunkt eines Transformer-Anfassers (z. B. «bottom-right») und Skalierung des Knotens eines Elements. */
      anchorScreen(name: string): { x: number; y: number };
      nodeScale(id: string): { x: number; y: number };
      /** Gezeichnete Skalierung (ohne Zoom) des ersten Rects im Element: 1, wenn der Inhalt unverzerrt bleibt. */
      contentScale(id: string): { x: number; y: number };
      /** Höhe, die der Elementtyp (Text: measureTextHeight) für das Element bei seiner Breite misst. */
      textHeight(id: string): number;
      /** Sichtbare Randbreite des Fotorahmens (links, oben, rechts, unten) in Slide-Pixeln (Rechteck, Kontur oder alter Innenrahmen), null ohne Rahmen. */
      frameInset(id: string): { left: number; top: number; right: number; bottom: number } | null;
      hintFill(): string | null;
      breakManifest(missing?: string[]): void;
      notify(kind: 'info' | 'error', text: string): void;
      applyLayout(preset: LayoutPreset, at: number): Promise<string[]>;
      /** Video-Vorschau: gezeichnete Bilder seit dem Laden, offene Video-Elemente (nach Stopp 0). */
      preview(): { frames: number; open: number };
      /** Slide wie der Export sie zeichnet (Videos: Startbild), RGB-Flecken 5 × 5 px an relativen Punkten (0 bis 1). */
      slidePixels(index: number, pts: [number, number][]): number[][];
      /** Video (Base64) mit Mediabunny dekodiert wie im Editor: Bild bei `t` an relativen Punkten, dazu Dauer, Grösse, Frames, Ton. */
      videoProbe(b64: string, t: number, pts: [number, number][], width?: number): Promise<VideoProbe>;
      /** Export wie der Dialog, ohne Download; bricht ab, sobald ein Video-Slide `abortAt` Prozent erreicht. */
      runExport(format: string, abortAt?: number): Promise<{ files?: string[]; error?: string; progress: number }>;
      /** Ordner-Export: ersetzt den Ordnerdialog durch einen OPFS-Ordner, einen mit AbortError oder einen mit SecurityError. */
      fakePicker(mode: 'opfs' | 'abort' | 'security'): void;
      /** Dateien im OPFS-Ersatzordner (Pfad relativ, Unterordner = Projektname) mit SHA-256; `clear` löscht den Ordner. */
      folderFiles(clear?: boolean): Promise<Record<string, string>>;
      /** Hält die Wartezeit auf Effekte im Export offen (ein Platzhalterknoten in der Ebene), bis `holdEffects(false)`. */
      holdEffects(on: boolean): void;
      /** Offene Video-Exporte (Decoder, Encoder, Canvases); nach Ende oder Abbruch 0. */
      videoExportOpen(): number;
      /** Maske malen, in OPFS speichern, wieder lesen: Pixelwerte vorher und nachher. */
      /** Maske in OPFS speichern (Spalten ab `split` aus, davor an), mit Eintrag in `project.assets`; liefert die Id. */
      putMask(width: number, height: number, split: number): Promise<string>;
      /** Pinselmodus, Ausschnittmodus, Pinselwerte, Zoom; Undo-Schritte in der History. */
      ui(): { maskEditId: string | null; cropEditId: string | null; textEditId: string | null; brush: { size: number; hardness: number; mode: string }; zoom: number; ai?: AiRun; selectedIds: string[] };
      setMaskEdit(id: string | null): void;
      history(): number;
      /** Pinselring: Mitte und Radius in Slide-Koordinaten, Radius auf dem Bildschirm; null, wenn nicht sichtbar. */
      brushRing(): { x: number; y: number; r: number; screenR: number } | null;
      /** Knoten der roten Folie in der Ebene «content». */
      veils(): number;
      /** Gespeicherte Maske eines Elements: Grösse und Werte an Maskenpunkten (null ohne Maske). */
      maskValues(id: string, pts: [number, number][]): Promise<{ width: number; height: number; values: number[] } | null>;
      /** Freistellen ohne Modell: das registrierte Werkzeug rechnet ab jetzt mit `fakeSegment` (Kreis, leer oder Netzfehler). */
      fakeCutout(mode: FakeMode, ms?: number): void;
      maskRoundtrip(): Promise<{ id: string; again: string; before: number[]; after: number[]; width: number; height: number }>;
    };
  }
}

const TEST_FOLDER = 'social-studio-export-test';
let kitRoot: Root | undefined;

export function installTestHook(): void {
  window.__bbzbTest = {
    mountSliders: (on) => {
      kitRoot?.unmount();
      kitRoot = undefined;
      document.getElementById('kit-host')?.remove();
      if (!on) return;
      const host = document.body.appendChild(document.createElement('div'));
      host.id = 'kit-host';
      kitRoot = createRoot(host);
      kitRoot.render(createElement(SliderLab));
    },
    mountSection: (on) => {
      kitRoot?.unmount();
      kitRoot = undefined;
      document.getElementById('kit-host')?.remove();
      if (!on) return;
      const host = document.body.appendChild(document.createElement('div'));
      host.id = 'kit-host';
      kitRoot = createRoot(host);
      kitRoot.render(createElement(Section, { heading: 'Testabschnitt', id: 'test', collapsible: true }, createElement('input', { 'aria-label': 'Innenfeld' })));
    },
    elements: () => {
      const p = useDoc.getState().project!;
      return p.order.map((id) => p.elements[id]!);
    },
    project: () => useDoc.getState().project!,
    /** Ids der Knoten in der Ebene «content» (was exportiert würde). */
    contentIds: () => (Konva.stages[0]!.findOne('.content') as Konva.Layer).getChildren().map((n) => n.id()),
    gesture: { start: startGesture, end: endGesture, open: gestureOpen },
    /** Store-Update an einem Element (e2e: Änderung mitten in einer Geste). */
    patch: (id, patch) => apply((d) => updateElement(d, id, patch)),
    /** Element wählen wie per Klick (Ansicht, nicht in der History). */
    select: (id) => useUi.getState().setSelectedId(id),
    /** Mehrfachauswahl setzen (wie Shift-Klick). */
    selectIds: (ids) => useUi.getState().setSelectedIds(ids),
    /** Gewähltes Element (oder null). */
    selected: () => useUi.getState().selectedId,
    /** Aufziehrahmen ist gerade sichtbar. */
    rubberVisible: () => Konva.stages[0]!.find('.rubber').length > 0,
    layerNames: () => Konva.stages[0]!.getChildren().map((l) => l.name()),
    contentNames: () => (Konva.stages[0]!.findOne('.content') as Konva.Layer).find(() => true).map((n) => n.name()),
    nodeLayer: (name) => Konva.stages[0]!.findOne(`.${name}`)?.getLayer()?.name() ?? null,
    safeZoneListening: () => Konva.stages[0]!.findOne('.safezones')!.listening(),
    safeZoneMargins: () => (Konva.stages[0]!.findOne('.safezones') as Konva.Layer | undefined)?.find<Konva.Line>('.margin').map((l) => [...l.points()]) ?? [],
    safeZoneMarginStrokes: () => { const l = Konva.stages[0]!.findOne('.safezones') as Konva.Layer; return [{ line: l.findOne<Konva.Line>('.margin')!.stroke() as string, back: l.findOne<Konva.Line>('.marginBack')!.stroke() as string }]; },
    safeZoneRects: () => Array.from((Konva.stages[0]!.findOne('.safezones') as Konva.Layer | undefined)?.find<Konva.Rect>('Rect') ?? []).map((r) => ({ width: r.width(), height: r.height() })),
    /** Füllfarbe des Platzhalter-Hinweises (null: kein leerer Platzhalter). */
    hintFill: () => (Konva.stages[0]!.findOne<Konva.Text>((n: Konva.Node) => n.getClassName() === 'Text' && (n as Konva.Text).text() === 'Foto hierher ziehen')?.fill() as string | undefined) ?? null,
    notify: (kind, text) => useUi.getState().setNotice({ kind, text }),
    transformerNodes: () => (Konva.stages[0]!.findOne('Transformer') as Konva.Transformer).nodes().length,
    /** Position des Konva-Nodes eines Elements (was die Leinwand zeigt). */
    nodePos: (id) => {
      const n = Konva.stages[0]!.findOne((x: Konva.Node) => x.id() === id)!;
      return { x: n.x(), y: n.y() };
    },
    /** Aktive Anfasser des Transformers, «rotater» wenn Drehen geht. */
    transformerAnchors: () => {
      const t = Konva.stages[0]!.findOne<Konva.Transformer>('Transformer')!;
      return [...t.enabledAnchors(), ...(t.rotateEnabled() ? ['rotater'] : [])];
    },
    /** Randfarben der Leinwand-Overlays: Transformer-Rahmen, Anker, Hilfslinien. */
    overlayStrokes: () => {
      const st = Konva.stages[0]!;
      const t = st.findOne<Konva.Transformer>('Transformer')!;
      return [t.borderStroke(), t.anchorStroke(), st.findOne<Konva.Line>('.guide-x')!.stroke() as string, st.findOne<Konva.Line>('.guide-y')!.stroke() as string];
    },
    /** Sichtbare Hilfslinien beim Einrasten (globale Koordinaten). */
    guides: () => {
      const at = (name: string, i: number) => {
        const l = Konva.stages[0]!.findOne<Konva.Line>(`.${name}`)!;
        return l.visible() ? l.points()[i]! : null;
      };
      return { x: at('guide-x', 0), y: at('guide-y', 1) };
    },
    view: () => {
      const s = Konva.stages[0]!;
      return { x: s.x(), y: s.y(), scale: s.scaleX() };
    },
    /** Id des Elements unter dem Bildschirmpunkt (oder null). */
    hit: (clientX, clientY) => {
      const s = Konva.stages[0]!;
      const r = s.container().getBoundingClientRect();
      const { elements } = useDoc.getState().project!;
      let n: Konva.Node | null = s.getIntersection({ x: clientX - r.left, y: clientY - r.top });
      while (n && !Object.hasOwn(elements, n.id())) n = n.getParent();
      return n?.id() ?? null;
    },
    /** Wie die Brand Library (Task 9): Markenbild per id einfügen. */
    insertBrand: async (id, at) => {
      await Promise.all([ensureTabler([id]), ensureDoodles([id])]);
      const asset = assetPacks.all().flatMap((p) => p.assets).find((a) => a.id === id)!;
      await elementTypes.all().find((t) => t.acceptsAsset?.(asset))!.fromAsset!(asset, editorContext(), at);
    },
    /** Wie die Brand Library (Task 9): Tag-Variante (schul, ort, cta) einfügen. */
    insertTag: (variant, at) => elementTypes.get('tag').insertVariant!(variant, editorContext(), at),
    textHeight: (id) => {
      const e = useDoc.getState().project!.elements[id]!;
      return elementTypes.get(e.type).afterTransform(e, e).height ?? e.height;
    },
    anchorScreen: (name) => {
      const s = Konva.stages[0]!;
      const r = s.container().getBoundingClientRect();
      const p = s.findOne(`.${name}`)!.getAbsolutePosition();
      return { x: r.left + p.x, y: r.top + p.y };
    },
    nodeScale: (id) => {
      const n = Konva.stages[0]!.findOne((x: Konva.Node) => x.id() === id)!;
      return { x: n.scaleX(), y: n.scaleY() };
    },
    contentScale: (id) => {
      const stage = Konva.stages[0]!;
      const a = stage.findOne<Konva.Group>((x: Konva.Node) => x.id() === id)!.findOne('Rect')!.getAbsoluteScale();
      return { x: a.x / stage.scaleX(), y: a.y / stage.scaleY() };
    },
    frameInset: (id) => {
      const stage = Konva.stages[0]!;
      const g = stage.findOne<Konva.Group>((x: Konva.Node) => x.id() === id);
      const el = useDoc.getState().project?.elements[id];
      if (!g || !el) return null;
      const k = stage.scaleX();
      const card = g.findOne<Konva.Rect>('.photo-card');
      const image = g.findOne<Konva.Image>('Image');
      if (card && image) {
        // alter Innenrahmen: Abstand des Bildes zur Karte
        const [a, b] = [card.getAbsolutePosition(), image.getAbsolutePosition()];
        const [cs, is] = [card.getAbsoluteScale(), image.getAbsoluteScale()];
        const left = (b.x - a.x) / k;
        const top = (b.y - a.y) / k;
        return { left, top, right: (card.width() * cs.x) / k - left - Math.abs(image.width() * is.x) / k, bottom: (card.height() * cs.y) / k - top - Math.abs(image.height() * is.y) / k };
      }
      const r = g.findOne<Konva.Node>('.photo-ring') ?? g.findOne<Konva.Node>('.photo-frame');
      if (!r) return null;
      const s = r.getAbsoluteScale();
      return {
        left: (-r.x() * s.x) / k,
        top: (-r.y() * s.y) / k,
        right: ((r.x() + r.width() - el.width) * s.x) / k,
        bottom: ((r.y() + r.height() - el.height) * s.y) / k,
      };
    },
    /** Elemente, deren Effekt-Canvas (Korn) noch rechnet. */
    pendingEffects: () => Konva.stages[0]!.find(`.${EFFECT_PENDING_NODE}`).length,
    /** Manifest wie nach einem Fehler laden: Dateien zu `missing` fehlen, ein Eintrag ist ungültig. Vor dem Öffnen des Editors aufrufen. */
    /** Layout ab Slide `at` anwenden wie die Layout-Wahl (ohne neue Slides), ein apply; liefert die Ids der Layout-Elemente. */
    applyLayout: async (preset, at) => {
      await fontsLoaded(); // Tags und Texte messen
      let ids: string[] = [];
      apply((d) => void (ids = applyLayout(d, preset, at, contentRules)));
      return ids;
    },
    preview: () => ({ ...previewStats }),
    slidePixels: (index, pts) => {
      const c = renderSlide(getContentLayer()!, useDoc.getState().project!, index);
      try {
        return patches(c, pts);
      } finally {
        Konva.Util.releaseCanvas(c);
      }
    },
    videoProbe: async (b64, t, pts, width) => {
      const m = await import('mediabunny');
      const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
      const input = new m.Input({ source: new m.BufferSource(bytes), formats: [m.MP4, m.QTFF] });
      try {
        const v = (await input.getPrimaryVideoTrack())!;
        const a = await input.getPrimaryAudioTrack();
        const w = (await new m.CanvasSink(v, width ? { width } : {}).getCanvas(Math.max(t, await v.getFirstTimestamp())))!;
        return {
          pixels: patches(w.canvas as HTMLCanvasElement, pts),
          duration: await input.computeDuration(),
          width: v.displayWidth,
          height: v.displayHeight,
          frames: (await v.computePacketStats()).packetCount,
          audio: a?.codec ?? null,
          audioDuration: a ? await a.computeDuration() : null,
        };
      } finally {
        input.dispose();
      }
    },
    runExport: async (format, abortAt) => {
      const ctl = new AbortController();
      let progress = 0;
      try {
        const zip = await exportZip(getContentLayer()!, useDoc.getState().project!, exporters.get(format), (slide, __, percent) => {
          if (slide > 0) progress++; // 0 = Vorbereitung
          if (abortAt !== undefined && (percent ?? 0) >= abortAt) ctl.abort();
        }, ctl.signal);
        return { files: Object.keys(unzipSync(new Uint8Array(await zip.arrayBuffer()))), progress };
      } catch (e) {
        return { error: e instanceof Error ? `${e.name}: ${e.message}` : String(e), progress };
      }
    },
    fakePicker: (mode) => {
      const fail = (name: string) => () => Promise.reject(new DOMException('test', name));
      window.showDirectoryPicker =
        mode === 'abort' ? fail('AbortError') : mode === 'security' ? fail('SecurityError') : async () => (await navigator.storage.getDirectory()).getDirectoryHandle(TEST_FOLDER, { create: true });
    },
    folderFiles: async (clear) => {
      const root = await navigator.storage.getDirectory();
      const out: Record<string, string> = {};
      const dir = await root.getDirectoryHandle(TEST_FOLDER, { create: true });
      for await (const [sub, handle] of dir.entries()) {
        if (handle.kind !== 'directory') continue;
        for await (const [name, file] of (handle as FileSystemDirectoryHandle).entries()) {
          const bytes = await (await (file as FileSystemFileHandle).getFile()).arrayBuffer();
          out[`${sub}/${name}`] = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (b) => b.toString(16).padStart(2, '0')).join('');
        }
      }
      if (clear) await root.removeEntry(TEST_FOLDER, { recursive: true });
      return out;
    },
    holdEffects: (on) => {
      const layer = getContentLayer()!;
      if (on) layer.add(new Konva.Group({ name: EFFECT_PENDING_NODE, id: 'hold-effects' }));
      else layer.findOne('#hold-effects')?.destroy();
    },
    videoExportOpen: () => videoExportStats.open,
    putMask: async (width, height, split) => {
      const m = newMask(width, height);
      for (let i = 0; i < m.data.length; i++) if (i % width >= split) m.data[i] = 0;
      const id = await saveMask(opfsAssetStore(), m);
      apply((d) => void (d.assets[id] = maskMeta(m)));
      return id;
    },
    ui: () => {
      const { maskEditId, cropEditId, textEditId, brush, zoom, ai, selectedIds } = useUi.getState();
      return { maskEditId, cropEditId, textEditId, brush, zoom, ai, selectedIds };
    },
    setMaskEdit: (id) => useUi.getState().setMaskEditId(id),
    history: () => useDoc.temporal.getState().pastStates.length,
    brushRing: () => {
      const g = Konva.stages[0]!.findOne<Konva.Group>(`.${BRUSH_RING_NODE}`);
      const c = g?.findOne<Konva.Circle>('Circle');
      if (!g?.visible() || !c) return null;
      return { x: g.x(), y: g.y(), r: c.radius(), screenR: c.radius() * c.getAbsoluteScale().x };
    },
    veils: () => Konva.stages[0]!.find(`.${MASK_VEIL_NODE}`).length,
    maskValues: async (id, pts) => {
      const mid = (useDoc.getState().project!.elements[id]!.props as { mask?: string }).mask;
      if (!mid) return null;
      const m = await loadMask(opfsAssetStore(), mid);
      return { width: m.width, height: m.height, values: pts.map(([x, y]) => m.data[y * m.width + x]!) };
    },
    fakeCutout: (mode, ms = 0) => void Object.assign(aiTools.get('freistellen'), { run: fakeSegment(mode, ms) }),
    maskRoundtrip: async () => {
      const store = opfsAssetStore();
      const m = newMask(37, 23);
      paintStroke(m, [{ x: 5, y: 5 }, { x: 30, y: 15 }], { radius: 6, hardness: 0.4, mode: 'hide' });
      const id = await saveMask(store, m);
      const back = await loadMask(store, id);
      return { id, again: await saveMask(store, back), before: [...m.data], after: [...back.data], width: back.width, height: back.height };
    },
    breakManifest: (missing = ['scribble-02']) => {
      const pack = assetPacks.get('bbzb');
      const urls = Object.fromEntries(pack.assets.filter((a) => !missing.includes(a.id)).map((a) => [a.file, a.url]));
      const raw = JSON.stringify({ assets: [...pack.assets.map((a) => ({ ...a, url: undefined })), { id: 'kaputt' }] });
      Object.assign(pack, loadBrandAssets(raw, urls));
    },
  };
}

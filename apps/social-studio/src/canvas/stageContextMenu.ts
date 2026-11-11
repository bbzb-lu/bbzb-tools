import type Konva from 'konva';
import { useDoc } from '../store/document';
import { useUi } from '../store/ui';
import { openContextMenu } from '../ui/ContextMenu';

/** Mac: Strg + Klick löst «contextmenu» aus, zählt aber als linker Druck; er darf keine Geste starten. */
export const isMenuPress = (e: PointerEvent): boolean => e.button !== 0 || (e.ctrlKey && /Mac/.test(navigator.platform));

/** Rechtsklick auf der Stage: Element unter dem Zeiger (oder leere Fläche auf `slide`) öffnet das Menü, das des Browsers nicht. */
export function onStageContextMenu(e: Konva.KonvaEventObject<MouseEvent>, slideAt: (stageX: number) => number): void {
  e.evt.preventDefault();
  const stage = e.target.getStage()!;
  const elements = useDoc.getState().project!.elements;
  let n: Konva.Node | null = e.target;
  while (n && !Object.hasOwn(elements, n.id())) n = n.getParent();
  // Rahmen und Anfasser des Transformers gehören zur Auswahl: sie bleibt
  const onFrame = !n && e.target.getLayer()?.name() === 'selection';
  const slide = slideAt(stage.getPointerPosition()!.x - stage.x());
  // Leere Fläche: Einfügen soll auf der Slide unter dem Zeiger landen
  if (!n && !onFrame) useUi.getState().setCurrentSlide(slide);
  // Die Slide unter dem Zeiger bestimmt auch, welche gesperrten oder ausgeblendeten Elemente das Menü anbietet
  openContextMenu({ x: e.evt.clientX, y: e.evt.clientY }, onFrame ? undefined : (n?.id() ?? null), slide);
}

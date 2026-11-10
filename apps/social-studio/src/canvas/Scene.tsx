import { memo } from 'react';
import { Layer } from 'react-konva';
import { elementTypes } from '../core/registries';
import { useDoc } from '../store/document';
import { useUi } from '../store/ui';
import { SlideBackground } from './SlideBackground';

/** Liest nur das eigene Element: Änderungen an einem Element rendern nur dieses neu. */
const ElementNode = memo(function ElementNode({ id }: { id: string }) {
  const el = useDoc((s) => s.project?.elements[id]);
  const editing = useUi((s) => s.cropEditId === id || s.textEditId === id);
  if (!el || !el.visible || !elementTypes.has(el.type)) return null;
  const { Render } = elementTypes.get(el.type);
  return <Render el={el} editing={editing} />;
});

/** Ebene «content»: das, was exportiert wird. Hintergründe der Slides zuunterst, darüber die Elemente in `order`. */
export function Scene() {
  const order = useDoc((s) => s.project!.order);
  const slides = useDoc((s) => s.project!.slides);
  const { width, height } = useDoc((s) => s.project!.format);
  return (
    <Layer name="content">
      {slides.map((s, i) => <SlideBackground key={s.id} slide={s} x={i * width} width={width} height={height} />)}
      {order.map((id) => <ElementNode key={id} id={id} />)}
    </Layer>
  );
}

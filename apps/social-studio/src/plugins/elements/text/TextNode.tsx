import type Konva from 'konva';
import { useRef } from 'react';
import { Group, Text } from 'react-konva';
import { useColor } from '../../../canvas/accent';
import type { ElementRenderProps } from '../../../core/types';
import { updateElement } from '../../../model/elements';
import { apply } from '../../../store/document';
import { useUi } from '../../../store/ui';
import { textConfig } from './measure';
import type { TextProps } from './schema';
import { inGroupDrag } from '../../../canvas/multiGesture';

export function TextNode({ el, editing }: ElementRenderProps<TextProps>) {
  const textRef = useRef<Konva.Text>(null);
  const { id } = el;
  const fill = useColor(el.props.color, el);
  const edit = () => useUi.getState().setTextEditId(id);
  return (
    <Group
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
      onTransform={(e) => {
        // Live-Umbruch statt Stauchen: Breite übernehmen, Skalierung der Gruppe ausgleichen.
        const t = textRef.current;
        if (!t || e.target !== e.currentTarget) return;
        const sx = e.currentTarget.scaleX();
        t.width(el.width * sx);
        t.scaleX(1 / sx);
      }}
      onTransformEnd={() => textRef.current?.scaleX(1)}
      onDblClick={(e) => e.evt.button === 0 && edit()} // Windows: Rechtsklick zählt sonst mit
      onDblTap={edit}
    >
      {/* Im Textmodus liegt die Textarea darüber. */}
      <Text ref={textRef} {...textConfig(el.props, el.width)} fill={fill} opacity={editing ? 0 : 1} />
    </Group>
  );
}

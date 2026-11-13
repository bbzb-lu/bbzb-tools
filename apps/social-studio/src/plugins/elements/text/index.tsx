import { IconTypography } from '@tabler/icons-react';
import type { ElementType } from '../../../core/types';
import { addElement, nextName } from '../../../model/elements';
import { useUi } from '../../../store/ui';
import { margin, textStyles } from '../../../tokens';
import { measureTextHeight } from './measure';
import { textPropsSchema, type TextProps } from './schema';
import { TextInspector } from './TextInspector';
import { TextNode } from './TextNode';

export const textType: ElementType<TextProps> = {
  id: 'text',
  label: 'Text',
  propsSchema: textPropsSchema,
  Render: TextNode,
  Inspector: TextInspector,
  menuItems: (el) => [{ id: 'edit', label: 'Text bearbeiten', run: () => useUi.getState().setTextEditId(el.id) }],
  anchors: ['middle-left', 'middle-right'],
  // Seitenanker: nur die Breite ändert sich. Wächst die Höhe im selben Verhältnis (Gruppe, keepRatio), skaliert die Schriftgrösse mit.
  afterTransform(el, box, _project, scaleContent) {
    const k = box.width / el.width;
    if (!scaleContent || Math.abs(k - 1) < 1e-6 || Math.abs(box.height / el.height - k) > 1e-3 * k) return { ...box, height: measureTextHeight(el.props, box.width) };
    const props = { ...el.props, fontSize: Math.max(1, Math.round(el.props.fontSize * k)) };
    return { ...box, props, height: measureTextHeight(props, box.width) };
  },
  fromLayout: (el) => ({ ...el, height: measureTextHeight(el.props, el.width) }),
  // Stil, Farbe und Grösse gibt das neue Layout vor, damit der Text lesbar bleibt.
  takeContent: (into, from) => ({ ...into, props: { ...into.props, text: from.props.text } }),
  add: {
    label: 'Text hinzufügen',
    icon: IconTypography,
    run(ctx) {
      const { width } = ctx.project.format;
      // Warmweiss auf warmweisser Slide wäre unsichtbar.
      const color = ctx.project.slides[ctx.currentSlide]!.background === 'warmweiss' ? 'blauschwarz' : 'warmweiss';
      const props: TextProps = { text: 'Titel', style: 'titel', color, fontSize: textStyles.titel.defaultSize, align: 'left' };
      const id = crypto.randomUUID();
      ctx.apply((d) =>
        addElement(d, {
          id,
          type: 'text',
          name: nextName(d, 'Text'),
          x: ctx.currentSlide * width + margin,
          y: margin,
          width: width - 2 * margin,
          height: measureTextHeight(props, width - 2 * margin),
          rotation: 0,
          opacity: 1,
          visible: true,
          locked: false,
          props,
        }),
      );
      ctx.select(id);
    },
  },
};

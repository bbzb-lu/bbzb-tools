import type { ElementType } from '../../../core/types';
import { channelOf } from '../../../model/elements';
import { tagBoxWidth, tagHeightOf } from './layout';
import { measureLabel } from './measure';
import { ctaFor, insertTag, libraryLabels } from './insert';
import { TagInspector } from './TagInspector';
import { TagNode } from './TagNode';
import { locations, tagPropsSchema, tagVariants, type TagProps } from './schema';

export const tagType: ElementType<TagProps> = {
  id: 'tag',
  label: 'Tag',
  propsSchema: tagPropsSchema,
  Render: TagNode,
  Inspector: TagInspector,
  // Grösse folgt dem Text, nie von Hand.
  anchors: [],
  afterTransform: (el, box) => ({ ...box, width: el.width, height: el.height }),
  variants: tagVariants.map((id) => ({ id, label: libraryLabels[id] })),
  insertVariant: (variant, ctx, at) => insertTag(variant as TagProps['variant'], ctx, at),
  takeContent: (into, from) => {
    if (into.props.variant !== from.props.variant) return undefined;
    const { text, dept, color } = from.props;
    const props = { ...into.props, text, dept, color };
    return { ...into, props, width: tagBoxWidth(props, measureLabel(props)), height: tagHeightOf(props) };
  },
  fromLayout: (el, p, fresh) => {
    const last = p?.lastTagLocation;
    // Neuer Schul-Tag aus dem Layout: zuletzt gewählter Standort (wie beim Einfügen); übernommener Text bleibt.
    const schul = fresh && el.props.variant === 'schul' && last !== undefined && (locations as readonly string[]).includes(last);
    const props =
      el.props.variant === 'cta' ? { ...el.props, text: ctaFor(el.props.text, channelOf(p ?? {})) } : schul ? { ...el.props, text: last } : el.props;
    return { ...el, props, width: tagBoxWidth(props, measureLabel(props)), height: tagHeightOf(props) };
  },
  onChannel: (el, channel) => {
    const text = el.props.variant === 'cta' ? ctaFor(el.props.text, channel) : el.props.text;
    if (text === el.props.text) return undefined;
    const props = { ...el.props, text };
    return { ...el, props, width: tagBoxWidth(props, measureLabel(props)) };
  },
};

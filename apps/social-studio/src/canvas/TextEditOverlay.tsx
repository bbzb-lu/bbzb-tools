import { useLayoutEffect, useRef } from 'react';
import { elementTypes } from '../core/registries';
import { removeElement, updateElement } from '../model/elements';
import type { Element } from '../model/types';
import { apply, useDoc } from '../store/document';
import { useUi } from '../store/ui';
import { blurIntoMenu } from '../ui/ContextMenu';
import { textMetrics, textStyles, type PaletteColor } from '../tokens';
import { useColor } from './accent';

/** Gemeinsame Felder aller Text-Props; der Kern kennt das Plugin-Schema nicht. */
interface TextLike {
  text: string;
  style: keyof typeof textStyles;
  color: PaletteColor;
  fontSize: number;
  align: 'left' | 'center' | 'right';
  lineHeight?: number;
  tracking?: number;
}

/** Textarea deckungsgleich über dem Text. Blur oder Ctrl+Enter übernimmt (ein apply), Escape verwirft. */
export function TextEditOverlay({ scale, originX, originY }: { scale: number; originX: number; originY: number }) {
  const id = useUi((s) => s.textEditId);
  const el = useDoc((s) => (id ? s.project?.elements[id] : undefined));
  if (!el) return null;
  return <Editor key={el.id} el={el as Element<TextLike>} scale={scale} originX={originX} originY={originY} />;
}

function Editor({ el, scale, originX, originY }: { el: Element<TextLike>; scale: number; originX: number; originY: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const done = useRef(false);
  const { props } = el;
  const color = useColor(props.color, el);
  const s = textStyles[props.style];
  const { lineHeight, letterSpacing } = textMetrics(props.style, props.fontSize, props.lineHeight, props.tracking);

  // Höhe misst der Elementtyp (afterTransform), nicht der Kern.
  const measure = (text: string) =>
    elementTypes.get(el.type).afterTransform({ ...el, props: { ...props, text } }, el).height ?? el.height;
  // Höhe wie auf der Leinwand plus 1em Polster für Ober- und Unterlängen (siehe .text-edit).
  const fit = () => {
    const ta = ref.current!;
    ta.style.height = `calc(${measure(ta.value) * scale}px + 1em)`;
  };
  // Der Browser rastet die erste Grundlinie auf ganze Pixel ein, Konva nicht (bis 1 px Versatz): messen und ausgleichen.
  // Konva setzt die Grundlinie auf Zeilenhöhe / 2 + (Ascent − Descent) / 2 der Schrift.
  const alignBaseline = () => {
    const ta = ref.current!;
    const probe = document.createElement('div');
    // Einzelwerte statt font-Kurzform: mit font-variant-ligatures: none liefert getComputedStyle(ta).font einen Leerstring.
    const cs = getComputedStyle(ta);
    probe.style.cssText = `position: absolute; font-style: ${cs.fontStyle}; font-weight: ${cs.fontWeight}; font-size: ${cs.fontSize}; font-family: ${cs.fontFamily}; line-height: ${lineHeight}`;
    probe.innerHTML = '<span style="display: inline-block; height: 0"></span>';
    ta.after(probe);
    const dom = probe.firstElementChild!.getBoundingClientRect().top - probe.getBoundingClientRect().top;
    probe.remove();
    const ctx = document.createElement('canvas').getContext('2d')!;
    ctx.font = `${props.fontSize}px "${s.family}"`;
    const m = ctx.measureText('M');
    const konva = ((m.fontBoundingBoxAscent - m.fontBoundingBoxDescent) / 2 + (lineHeight * props.fontSize) / 2) * scale;
    ta.style.marginTop = `calc(${konva - dom}px - 0.5em)`;
  };
  useLayoutEffect(() => {
    fit();
    alignBaseline();
  });
  useLayoutEffect(() => {
    ref.current!.focus();
    ref.current!.select();
  }, []);

  const finish = (save: boolean) => {
    if (done.current) return;
    done.current = true;
    const text = ref.current!.value;
    useUi.getState().setTextEditId(null);
    if (!save) return;
    if (!text.trim()) {
      apply((d) => removeElement(d, el.id));
      useUi.getState().setSelectedId(null);
    } else if (text !== props.text) {
      const next = { ...props, text };
      apply((d) => updateElement(d, el.id, { props: next, height: measure(text) }));
    }
  };

  return (
    <textarea
      ref={ref}
      className="text-edit"
      aria-label="Text"
      defaultValue={props.text}
      spellCheck={false}
      onInput={fit}
      onBlur={(e) => !blurIntoMenu(e) && finish(true)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') finish(false);
        else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) finish(true);
      }}
      style={{
        left: originX + el.x * scale,
        top: originY + el.y * scale,
        width: `calc(${el.width * scale}px + 1em)`,
        transform: `rotate(${el.rotation}deg)`,
        fontFamily: `"${s.family}"`,
        fontSize: props.fontSize * scale,
        letterSpacing: letterSpacing * scale,
        lineHeight,
        // wie die Leinwand: Braveold ohne Ligaturen (dort per ZWNJ, hier per CSS, der Text bleibt unverändert)
        fontVariantLigatures: 'none',
        textAlign: props.align,
        color,
      }}
    />
  );
}

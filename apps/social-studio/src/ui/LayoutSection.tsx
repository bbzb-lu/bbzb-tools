import { useId, useRef, useState } from 'react';
import type { LayoutPreset } from '../core/types';
import { Section } from './Section';
import { LayoutPicker } from './LayoutPicker';

/** Layout der Slide: die Kacheln bleiben zu, bis «Layout ändern» sie öffnet; eine Wahl klappt sie wieder zu. Mit `key={Slide}` aufrufen. */
export function LayoutSection({ presets, format, current, onPick }: { presets: LayoutPreset[]; format: { width: number; height: number }; current?: string; onPick(preset: LayoutPreset): void }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const toggle = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    toggle.current?.focus(); // die fokussierte Kachel verschwindet, der Fokus bleibt im Abschnitt
  };
  return (
    <Section heading="Layout" collapsible>
      <button ref={toggle} type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        Layout ändern
      </button>
      <div id={id} hidden={!open} onKeyDown={(e) => { if (e.key === 'Escape' && open) { e.stopPropagation(); close(); } }}>
        <p className="muted hint">Fotos und Texte ziehen in die neuen Rahmen mit.</p>
        <LayoutPicker presets={presets} format={format} current={current} label="Layout für diese Slide" onPick={(l) => { close(); onPick(l); }} />
      </div>
    </Section>
  );
}

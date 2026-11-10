import { useState } from 'react';
import { apply, useDoc } from '../../store/document';
import { updateElement } from '../../model/elements';
import { Slider } from '../Slider';
import { Knob } from './Knob';
import { RangeSlider } from './RangeSlider';

/** Nur für e2e (testHook): alle Regler-Bauteile. Knopf und Bereich schreiben in x und y des ersten Elements (Undo prüfbar), die Regler halten lokalen Zustand. */
export function SliderLab() {
  const [a, setA] = useState(50);
  const [b, setB] = useState(20);
  const [c, setC] = useState(0);
  const id = useDoc((s) => s.project?.order[0]);
  const el = useDoc((s) => (id ? s.project?.elements[id] : undefined));
  const set = (patch: { x?: number; y?: number }) => id && apply((d) => updateElement(d, id, patch));
  return (
    <div className="inspector" style={{ position: 'fixed', top: 40, right: 40, width: 300, padding: 16, background: 'var(--paper)', zIndex: 1000 }}>
      <Slider label="Lang" value={a} min={0} max={100} defaultValue={50} unit="%" onChange={setA} />
      <Slider label="Kurz" variant="short" value={b} min={0} max={100} defaultValue={20} unit="%" onChange={setB} />
      <Slider label="Helligkeit" center={{ low: 'dunkel', high: 'hell' }} value={c} min={-100} max={100} defaultValue={0} onChange={setC} />
      <Knob label="Stärke" value={el?.x ?? 0} min={-1000} max={1000} defaultValue={0} unit="%" onChange={(x) => set({ x })} />
      <RangeSlider start={el?.y ?? 0} end={(el?.x ?? 0) + 2000} min={0} max={4000} step={1} onChange={(s, e) => set({ y: s, x: e - 2000 })} />
    </div>
  );
}

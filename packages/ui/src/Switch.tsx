import type { ReactNode } from 'react';

/** Ja/Nein-Schalter: dunkler Block rechts heisst an. Ein Klick = ein onChange. Mit `children` ist der Text Teil der Klickfläche und gibt den Namen. */
export function Switch({ label, checked, onChange, disabled, children }: { label?: string; checked: boolean; onChange(v: boolean): void; disabled?: boolean; children?: ReactNode }) {
  const button = (
    <button type="button" role="switch" className="kit-switch" aria-checked={checked} aria-label={children ? undefined : label} aria-disabled={disabled || undefined} onClick={() => !disabled && onChange(!checked)}>
      <span className="switch-knob" aria-hidden="true" />
    </button>
  );
  return children ? <label className="kit-switch-field">{<span className="kit-switch-text">{children}</span>}{button}</label> : button;
}

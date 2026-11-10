/** Ja/Nein-Schalter: dunkler Block rechts heisst an. Ein Klick = ein onChange. */
export function Switch({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange(v: boolean): void; disabled?: boolean }) {
  return (
    <button type="button" role="switch" className="kit-switch" aria-checked={checked} aria-label={label} aria-disabled={disabled || undefined} onClick={() => !disabled && onChange(!checked)}>
      <span className="switch-knob" aria-hidden="true" />
    </button>
  );
}

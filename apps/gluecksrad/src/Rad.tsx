const R = 96;

function punkt(winkel: number, r: number): string {
  const w = (winkel * Math.PI) / 180;
  return `${(r * Math.sin(w)).toFixed(2)} ${(-r * Math.cos(w)).toFixed(2)}`;
}

/** Zwei Töne im Wechsel, bei ungerader Zahl bekommt das letzte Segment den Akzent, damit nie zwei gleiche aneinanderstossen. */
function ton(i: number, n: number): 'a' | 'b' | 'akzent' {
  if (n > 1 && n % 2 === 1 && i === n - 1) return 'akzent';
  return i % 2 === 0 ? 'a' : 'b';
}

/** Rad als SVG, Zeiger oben. Dreht per CSS auf `drehung` Grad; `onEnde` kommt nach der Transition. */
export function Rad({ optionen, drehung, onEnde }: { optionen: string[]; drehung: number; onEnde(): void }) {
  const n = optionen.length;
  const w = 360 / Math.max(n, 1);
  const fs = Math.min(9, Math.max(3, ((2 * Math.PI * 60) / Math.max(n, 1)) * 0.5));
  const maxZeichen = Math.floor(70 / (fs * 0.55));
  const kurz = (s: string) => (s.length > maxZeichen ? `${s.slice(0, maxZeichen - 1)}…` : s);
  return (
    <svg className="rad" viewBox="-104 -104 208 208" role="img" aria-label={`Glücksrad mit ${n} Optionen`}>
      <g className="rad-dreh" style={{ transform: `rotate(${drehung}deg)` }} onTransitionEnd={onEnde}>
        {n === 1 ? (
          <circle r={R} className="seg-a" />
        ) : (
          optionen.map((_, i) => (
            <path key={i} className={`seg-${ton(i, n)}`} d={`M0 0 L${punkt(i * w, R)} A${R} ${R} 0 0 1 ${punkt((i + 1) * w, R)} Z`} />
          ))
        )}
        {optionen.map((o, i) => (
          <text key={i} className={`seg-text-${ton(i, n)}`} transform={`rotate(${(i + 0.5) * w - 90})`} x={R - 6} y={fs * 0.35} textAnchor="end" fontSize={fs}>
            {kurz(o)}
          </text>
        ))}
      </g>
      <circle r="6" className="rad-nabe" />
      <path className="rad-zeiger" d="M-7 -104 L7 -104 L0 -88 Z" />
    </svg>
  );
}

import { useId } from 'react';

const R = 90; // Segmente, darum der Ring bis 100
const LEER = 8; // Segmente des Leerzustands

function punkt(winkel: number, r: number): string {
  const w = (winkel * Math.PI) / 180;
  return `${(r * Math.sin(w)).toFixed(2)} ${(-r * Math.cos(w)).toFixed(2)}`;
}

type Ton = 'a' | 'b' | 'c';

/** Violett und Blau im Wechsel, bei ungerader Zahl bekommt das letzte Segment Grau, damit nie zwei gleiche aneinanderstossen. */
function ton(i: number, n: number): Ton {
  if (n > 1 && n % 2 === 1 && i === n - 1) return 'c';
  return i % 2 === 0 ? 'a' : 'b';
}

const keil = (i: number, w: number) => `M0 0 L${punkt(i * w, R)} A${R} ${R} 0 0 1 ${punkt((i + 1) * w, R)} Z`;

/**
 * Rad als SVG, Zeiger oben. Dreht per CSS auf `drehung` Grad; `onEnde` kommt nach der Transition.
 * `hervor` ist der Index des Gewinners: er bleibt kräftig, die übrigen treten zurück.
 */
export function Rad({ optionen, drehung, onEnde, hervor }: { optionen: string[]; drehung: number; onEnde(): void; hervor: number | null }) {
  const u = useId();
  const n = optionen.length;
  const w = 360 / Math.max(n, 1);
  const fs = Math.min(9, Math.max(3, ((2 * Math.PI * 60) / Math.max(n, 1)) * 0.5));
  const maxZeichen = Math.floor(70 / (fs * 0.55));
  const kurz = (s: string) => (s.length > maxZeichen ? `${s.slice(0, maxZeichen - 1)}…` : s);
  const lampen = Array.from({ length: 24 }, (_, i) => i * 15);
  return (
    <svg className="rad" viewBox="-104 -104 216 216" role="img" aria-label={n === 0 ? 'Glücksrad ohne Optionen' : `Glücksrad mit ${n} Optionen`}>
      <defs>
        {(['a', 'b', 'c'] as const).map((t) => (
          <radialGradient key={t} id={`${u}${t}`} gradientUnits="userSpaceOnUse" cx="0" cy="0" r={R}>
            <stop offset="0" style={{ stopColor: `var(--rad-${t})` }} />
            <stop offset="1" style={{ stopColor: `color-mix(in srgb, var(--rad-${t}) 78%, black)` }} />
          </radialGradient>
        ))}
      </defs>
      <circle r="100" className="rad-schatten" transform="translate(4 4)" />
      <circle r="100" className="rad-ring" />
      <g className="rad-dreh" style={{ transform: `rotate(${drehung}deg)` }} onTransitionEnd={onEnde}>
        {n === 0 &&
          Array.from({ length: LEER }, (_, i) => <path key={i} className={i % 2 ? 'seg-leer-b' : 'seg-leer-a'} d={keil(i, 360 / LEER)} />)}
        {n === 1 && <circle r={R} fill={`url(#${u}a)`} className="seg" />}
        {n > 1 &&
          optionen.map((_, i) => (
            <path key={i} className={`seg${hervor !== null && hervor !== i ? ' zurueck' : ''}`} fill={`url(#${u}${ton(i, n)})`} d={keil(i, w)} />
          ))}
        {optionen.map((o, i) => (
          <text key={i} className={`seg-text${hervor !== null && hervor !== i ? ' zurueck' : ''}`} transform={`rotate(${(i + 0.5) * w - 90})`} x={R - 6} y={fs * 0.35} textAnchor="end" fontSize={fs}>
            {kurz(o)}
          </text>
        ))}
      </g>
      {lampen.map((a) => (
        <circle key={a} className="rad-lampe" r="1.7" cx={(95 * Math.sin((a * Math.PI) / 180)).toFixed(2)} cy={(-95 * Math.cos((a * Math.PI) / 180)).toFixed(2)} />
      ))}
      {n === 0 ? (
        <g className="rad-leer">
          <rect x="-50" y="-11" width="100" height="22" />
          <text textAnchor="middle" y="3" fontSize="7.5">Optionen eintragen</text>
        </g>
      ) : (
        <>
          <circle r="11" className="rad-nabe" />
          <circle r="4" className="rad-nabe-punkt" />
        </>
      )}
      <path className="rad-zeiger" d="M-9 -108 H9 L0 -80 Z" />
    </svg>
  );
}

import { IconCode, IconHeadset } from '@tabler/icons-react';
import { useId } from 'react';

/** Verlauf von Weiss zu Violett; `runter` = Violett unten. */
function Verlauf({ id, runter }: { id: string; runter: boolean }) {
  return (
    <linearGradient id={id} x1="0" y1={runter ? 0 : 1} x2="0" y2={runter ? 1 : 0}>
      <stop offset="0" stopColor="var(--on-accent)" />
      <stop offset="1" stopColor="var(--illu)" />
    </linearGradient>
  );
}

const W = 484;
const H = 311;

/** Bild im oberen Teil der Kachel, nach dem Pen-Entwurf «Ideas/Experimentation». Rein dekorativ. */
export function Illustration({ tool }: { tool: string }) {
  const u = useId();
  const [ab, auf] = [`${u}ab`, `${u}auf`];
  const defs = (
    <defs>
      <Verlauf id={ab} runter />
      <Verlauf id={auf} runter={false} />
    </defs>
  );
  let inhalt: React.ReactNode = null;
  if (tool === 'social-studio')
    inhalt = [35, 177, 320].map((x, i) => <rect key={x} x={x} y={27} width={142} height={252} fill={`url(#${i === 1 ? auf : ab})`} />);
  else if (tool === 'news-banner')
    inhalt = (
      <>
        <rect x={32} y={37} width={403} height={219} fill={`url(#${ab})`} />
        <IconHeadset x={176} y={89} width={114} height={114} color="var(--on-accent)" stroke={1.5} />
      </>
    );
  else if (tool === 'gluecksrad')
    inhalt = (
      <>
        {/* ein Verlauf über das ganze Rad, benachbarte Segmente gegenläufig, sonst bricht jeder Keil seinen eigenen Streifen */}
        <defs>
          {['ab', 'auf'].map((k, j) => (
            <linearGradient key={k} id={`${u}r${k}`} gradientUnits="userSpaceOnUse" x1="0" y1={j ? 295 : 55} x2="0" y2={j ? 55 : 295}>
              <stop offset="0" stopColor="var(--on-accent)" />
              <stop offset="1" stopColor="var(--illu)" />
            </linearGradient>
          ))}
        </defs>
        {Array.from({ length: 8 }, (_, i) => (
          <path key={i} d={`M242 175 L${242 + 120 * Math.sin((i * Math.PI) / 4)} ${175 - 120 * Math.cos((i * Math.PI) / 4)} A120 120 0 0 1 ${242 + 120 * Math.sin(((i + 1) * Math.PI) / 4)} ${175 - 120 * Math.cos(((i + 1) * Math.PI) / 4)} Z`} fill={`url(#${u}r${i % 2 ? 'auf' : 'ab'})`} stroke="var(--paper)" strokeWidth={3} />
        ))}
        <circle cx={242} cy={175} r={14} fill="var(--ink)" stroke="var(--paper)" strokeWidth={3} />
        <path d="M226 24 H258 L242 62 Z" fill="var(--ink)" stroke="var(--paper)" strokeWidth={3} strokeLinejoin="round" />
      </>
    );
  else if (tool === 'legiccard-creator')
    inhalt = (
      <>
        <rect x={49} y={38} width={124} height={219} fill={`url(#${ab})`} />
        <svg x={220} y={37} width={176} height={220} viewBox="0 0 176 220">
          <path d="M88 32a42 46 0 1 1 0 92a42 46 0 1 1 0-92M2 220c4-50 40-82 86-82s82 32 86 82z" fill={`url(#${auf})`} />
          <rect x={0.75} y={0.75} width={174.5} height={218.5} fill="none" stroke="var(--ink)" strokeWidth={1.5} />
        </svg>
      </>
    );
  else if (tool === 'mensa-bahnhof')
    inhalt = (
      <>
        {/* Teller mit Besteck */}
        <circle cx={242} cy={156} r={118} fill={`url(#${ab})`} />
        <circle cx={242} cy={156} r={78} fill={`url(#${auf})`} stroke="var(--paper)" strokeWidth={3} />
        {[64, 82, 100].map((x) => <rect key={x} x={x} y={46} width={8} height={70} fill={`url(#${ab})`} />)}
        <rect x={64} y={108} width={44} height={20} fill={`url(#${ab})`} />
        <rect x={78} y={126} width={16} height={140} fill={`url(#${auf})`} />
        <path d="M384 46 C412 60 418 120 412 160 H384 Z" fill={`url(#${ab})`} />
        <rect x={384} y={156} width={16} height={110} fill={`url(#${auf})`} />
      </>
    );
  else if (tool === 'sharepoint')
    inhalt = [[18, 110], [170, 15], [215, 137]].map(([x, y]) => (
      <g key={x}>
        <rect x={x} y={y} width={154} height={88} fill={`url(#${ab})`} />
        <IconCode x={x! + 48} y={y! + 15} width={58} height={58} color="var(--on-accent)" stroke={1.5} />
      </g>
    ));
  return (
    <svg className="illustration" viewBox={`0 0 ${W} ${H}`} aria-hidden="true" focusable="false">
      {defs}
      {inhalt}
    </svg>
  );
}

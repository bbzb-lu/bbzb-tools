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
  else if (tool === 'sharepoint-embeds')
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

import { useEffect } from 'react';

const STUECKE = 22;

/** Konfetti als feste Zahlen, damit es bei jedem Render gleich aussieht: Richtung und Weite streuen über sin(). */
const stuecke = Array.from({ length: STUECKE }, (_, i) => {
  const winkel = (i / STUECKE) * 2 * Math.PI + Math.sin(i * 12.9898) * 0.35;
  const weite = 150 + (Math.sin(i * 78.233) * 0.5 + 0.5) * 120;
  return { x: Math.round(Math.sin(winkel) * weite), y: Math.round(-Math.cos(winkel) * weite * 0.7), r: Math.round(Math.sin(i * 3.7) * 360), farbe: i % 4 };
});

/** Karte über dem Rad: der Name springt auf, Konfetti fliegt weg. Klick oder Esc schliesst. Der Name steht in `.ergebnis`. */
export function Gewinner({ name, onClose }: { name: string; onClose(): void }) {
  useEffect(() => {
    const zu = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', zu);
    return () => window.removeEventListener('keydown', zu);
  }, [onClose]);
  return (
    <div className="gewinner" role="status">
      <div className="konfetti" aria-hidden="true">
        {stuecke.map((s, i) => (
          <span key={i} className={`stueck f${s.farbe}`} style={{ '--x': `${s.x}px`, '--y': `${s.y}px`, '--r': `${s.r}deg` } as React.CSSProperties} />
        ))}
      </div>
      <button type="button" className="gewinner-karte" onClick={onClose} aria-label={`Gewinner ${name}, Schliessen`}>
        <span className="ergebnis" aria-hidden="true">{name}</span>
      </button>
    </div>
  );
}

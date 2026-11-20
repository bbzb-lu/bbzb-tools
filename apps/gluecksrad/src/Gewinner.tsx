import { useEffect } from 'react';

const STUECKE = 22;

/** Konfetti als feste Zahlen, damit es bei jedem Render gleich aussieht: Richtung und Weite streuen über sin(). */
const stuecke = Array.from({ length: STUECKE }, (_, i) => {
  const winkel = (i / STUECKE) * 2 * Math.PI + Math.sin(i * 12.9898) * 0.35;
  const weite = 150 + (Math.sin(i * 78.233) * 0.5 + 0.5) * 120;
  return { x: Math.round(Math.sin(winkel) * weite), y: Math.round(-Math.cos(winkel) * weite * 0.7), r: Math.round(Math.sin(i * 3.7) * 360), farbe: i % 4 };
});

/** Karte über dem Rad: der Name springt auf, Konfetti fliegt weg. Klick oder Esc schliesst. Der Name steht in `.ergebnis`. */
export function Gewinner({ name, onClose, brille }: { name: string; onClose(): void; brille?: boolean }) {
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
        {brille && (
          <>
            <svg className="brille" viewBox="0 0 120 40" aria-hidden="true">
              <rect x="0" y="8" width="6" height="6" /><rect x="114" y="8" width="6" height="6" />
              <rect x="4" y="8" width="50" height="24" /><rect x="66" y="8" width="50" height="24" /><rect x="54" y="12" width="12" height="6" />
              <rect className="glanz" x="10" y="12" width="16" height="4" /><rect className="glanz" x="72" y="12" width="16" height="4" />
            </svg>
            <span className="deal" aria-hidden="true">DEAL WITH IT</span>
          </>
        )}
      </button>
    </div>
  );
}

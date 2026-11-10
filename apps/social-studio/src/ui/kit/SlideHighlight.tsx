import type { ReactNode } from 'react';

/**
 * Gleitende Auswahlfläche (Tinte), vom Hook useSlidingHighlight bewegt; als letztes Kind des Rahmens, aria-hidden, ohne Zeigerereignisse.
 * Mit Kindern: Textkopie in Papierfarbe (`cls` = Klasse des Rahmens, damit dessen Layout gilt), die die Fläche ausschneidet. So ist die Schrift
 * auf jeder Lage der Fläche lesbar: Tinte auf Grund, Papier auf Tinte, nie Papier auf Grund. Ohne Kinder: schlichte Linie.
 */
export function SlideHighlight({ cls, children }: { cls?: string; children?: ReactNode }) {
  return (
    <i className="slide-hl" aria-hidden="true">
      {children && <i className={`slide-hl-in ${cls ?? ''}`}>{children}</i>}
    </i>
  );
}

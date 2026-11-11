import type { ReactNode } from 'react';
import { feedbackUrl } from './feedback';

/** Zweizeilig wie die Schilder im Entwurf: vor dem letzten Wort, sonst nach dem letzten Bindestrich. */
export function zeilen(name: string): string[] {
  const i = name.includes(' ') ? name.lastIndexOf(' ') : name.lastIndexOf('-') + 1;
  return i > 0 ? [name.slice(0, i).trimEnd(), name.slice(i).trimStart()] : [name];
}

/** Zeilen als Blöcke: der Text bleibt genau der Name (für Vorleser und Tests), der Umbruch kommt aus dem CSS. */
export const Zeilen = ({ name }: { name: string }) => (
  <>
    {zeilen(name).map((z, i) => (
      <span key={i} className="bbzb-zeile">
        {i > 0 && name.includes(' ') ? <span className="bbzb-leer"> </span> : null}
        {z}
      </span>
    ))}
  </>
);

/** Schriftgrösse im 56-px-Quadrat nach der längsten Zeile (Verhältnisse aus dem Entwurf: 36, 28, 22 px auf 127 px). */
const groesse = (name: string): string => {
  const n = Math.max(...zeilen(name).map((z) => z.length));
  return n <= 6 ? '' : n <= 8 ? ' mittel' : ' lang';
};

/**
 * Kopf aller Tools, bleibt beim Scrollen oben. Logo: Quadrat mit dem Toolnamen; Zeigen oder Fokus blendet «BBZB Tools» ein (Klick führt zur Übersicht).
 * Ohne `tool` (Startseite) steht «BBZB Tools» fest. `className` hängt eine Tool-Klasse an, `bbzb-header` bleibt immer.
 * `feedback` ist die Option «Tool» im Feedback-Formular; ohne sie gibt es keinen Feedback-Link.
 */
export function Header({ tool, feedback, className, children }: { tool?: string; feedback?: string; className?: string; children?: ReactNode }) {
  return (
    <header className={className ? `bbzb-header ${className}` : 'bbzb-header'}>
      <a href="/" className={tool ? 'bbzb-wordmark' : 'bbzb-wordmark fest'} aria-label={tool ? `BBZB Tools, ${tool}, zur Startseite` : 'BBZB Tools, Startseite'}>
        {tool && <span className={`bbzb-logo-tool${groesse(tool)}`}><Zeilen name={tool} /></span>}
        <span className="bbzb-logo-suite" aria-hidden={tool ? 'true' : undefined}>
          <Zeilen name="BBZB Tools" />
        </span>
      </a>
      {children}
      {feedback && (
        <a className="bbzb-feedback" href={feedbackUrl(feedback)} target="_blank" rel="noopener noreferrer" aria-label="Feedback geben (öffnet Microsoft Forms in neuem Tab)">
          Feedback
        </a>
      )}
    </header>
  );
}

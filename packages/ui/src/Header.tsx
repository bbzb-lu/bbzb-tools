import type { ReactNode } from 'react';
import { feedbackUrl } from './feedback';

/**
 * `className` hängt eine Tool-Klasse an (z. B. für Tool-eigene Regeln und Tests), `bbzb-header` bleibt immer.
 * `feedback` ist die Option «Tool» im Feedback-Formular; ohne sie gibt es keinen Feedback-Link.
 */
export function Header({ tool, feedback, className, children }: { tool: string; feedback?: string; className?: string; children?: ReactNode }) {
  return (
    <header className={className ? `bbzb-header ${className}` : 'bbzb-header'}>
      <a href="/" className="bbzb-wordmark" aria-label={`BBZB Tools, ${tool}, zur Startseite`}>
        <span className="bbzb-wordmark-name">BBZB Tools</span>
        <span className="bbzb-wordmark-tool">{tool}</span>
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

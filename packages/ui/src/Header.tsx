import type { ReactNode } from 'react';

/** `className` hängt eine Tool-Klasse an (z. B. für Tool-eigene Regeln und Tests), `bbzb-header` bleibt immer. */
export function Header({ tool, className, children }: { tool: string; className?: string; children?: ReactNode }) {
  return (
    <header className={className ? `bbzb-header ${className}` : 'bbzb-header'}>
      <a href="/" className="bbzb-wordmark" aria-label={`BBZB Tools, ${tool}, zur Startseite`}>
        <span className="bbzb-wordmark-name">BBZB Tools</span>
        <span className="bbzb-wordmark-tool">{tool}</span>
      </a>
      {children}
    </header>
  );
}

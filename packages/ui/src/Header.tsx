import type { ReactNode } from 'react';

export function Header({ tool, children }: { tool: string; children?: ReactNode }) {
  return (
    <header className="bbzb-header">
      <a href="/" className="bbzb-wordmark" aria-label="BBZB Tools, zur Startseite">
        <span className="bbzb-wordmark-name">BBZB Tools</span>
        <span className="bbzb-wordmark-tool">{tool}</span>
      </a>
      {children}
    </header>
  );
}

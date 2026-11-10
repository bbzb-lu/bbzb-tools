/** Wortmarke aus dem Pen-Entwurf (Kopf und Startseite): Schrift statt Bilddatei. Als Bild benannt, damit der Name einmal gelesen wird. */
export function Logo({ className }: { className: string }) {
  return (
    <span className={`logo ${className}`} role="img" aria-label="Social Studio BBZB">
      <span className="logo-name">Social Studio</span>
      <span className="logo-sub">BBZB</span>
    </span>
  );
}

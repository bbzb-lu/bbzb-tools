export type Partikel = {
  x: number; y: number; vx: number; vy: number;
  g: number; // Schwerkraft in px/s²
  reibung: number; // Faktor je 1/60 s
  leben: number; alter: number; // Sekunden
  art: 'rect' | 'linie' | 'kreis' | 'ring';
  farbe: string; groesse: number; wachs: number; // Wachstum der Grösse in px/s
  rot: number; vrot: number; // Radiant und Radiant/s
};

/** Obergrenze, damit schwache Geräte nicht ins Stocken kommen. */
export const MAX = 360;

type Zufall = () => number;
const zw = (rnd: Zufall, a: number, b: number) => a + rnd() * (b - a);
const wahl = <T,>(rnd: Zufall, l: T[]): T => l[Math.floor(rnd() * l.length)]!;

export function hinzufuegen(liste: Partikel[], neue: Partikel[]): Partikel[] {
  const alle = [...liste, ...neue];
  return alle.length > MAX ? alle.slice(alle.length - MAX) : alle;
}

/** Ein Zeitschritt `dt` in Sekunden: bewegen, Schwerkraft, Reibung, Abgelaufene entfernen. */
export function schritt(liste: Partikel[], dt: number): Partikel[] {
  return liste.flatMap((p) => {
    const alter = p.alter + dt;
    if (alter >= p.leben) return [];
    const r = p.reibung ** (dt * 60);
    const vx = p.vx * r;
    const vy = p.vy * r + p.g * dt;
    return [{ ...p, alter, vx, vy, x: p.x + vx * dt, y: p.y + vy * dt, groesse: p.groesse + p.wachs * dt, rot: p.rot + p.vrot * dt }];
  });
}

const neu = (o: Partial<Partikel> & Pick<Partikel, 'x' | 'y' | 'art' | 'farbe' | 'groesse' | 'leben'>): Partikel => ({ vx: 0, vy: 0, g: 0, reibung: 1, alter: 0, wachs: 0, rot: 0, vrot: 0, ...o });

/** Konfetti aus einer Kanone; `richtungGrad` zählt wie das Rad im Uhrzeigersinn ab oben. */
export function konfetti(x: number, y: number, richtungGrad: number, farben: string[], rnd: Zufall = Math.random, anzahl = 90): Partikel[] {
  return Array.from({ length: anzahl }, () => {
    const w = ((richtungGrad + zw(rnd, -28, 28)) * Math.PI) / 180;
    const v = zw(rnd, 500, 1100);
    return neu({ x, y, vx: Math.sin(w) * v, vy: -Math.cos(w) * v, g: 900, reibung: 0.985, leben: zw(rnd, 1.6, 2.6), art: 'rect', farbe: wahl(rnd, farben), groesse: zw(rnd, 6, 12), rot: zw(rnd, 0, 6), vrot: zw(rnd, -10, 10) });
  });
}

export function feuerwerk(x: number, y: number, farbe: string, rnd: Zufall = Math.random): Partikel[] {
  return Array.from({ length: 48 }, (_, i) => {
    const w = (i / 48) * 2 * Math.PI + zw(rnd, -0.05, 0.05);
    const v = zw(rnd, 150, 420);
    return neu({ x, y, vx: Math.sin(w) * v, vy: -Math.cos(w) * v, g: 250, reibung: 0.97, leben: zw(rnd, 0.9, 1.4), art: 'kreis', farbe, groesse: zw(rnd, 2, 4) });
  });
}

/** Druckwelle als wachsender Ring plus Trümmer. */
export function explosion(x: number, y: number, farben: string[], rnd: Zufall = Math.random): Partikel[] {
  const ring = neu({ x, y, art: 'ring', farbe: farben[0] ?? 'white', groesse: 10, wachs: 1100, leben: 0.6 });
  const teile = Array.from({ length: 70 }, () => {
    const w = zw(rnd, 0, 2 * Math.PI);
    const v = zw(rnd, 200, 900);
    return neu({ x, y, vx: Math.sin(w) * v, vy: -Math.cos(w) * v, g: 300, reibung: 0.96, leben: zw(rnd, 0.6, 1.3), art: 'kreis', farbe: wahl(rnd, farben), groesse: zw(rnd, 4, 14) });
  });
  return [ring, ...teile];
}

export function zeichne(ctx: CanvasRenderingContext2D, liste: Partikel[]): void {
  for (const p of liste) {
    const t = p.alter / p.leben;
    ctx.globalAlpha = Math.max(0, 1 - t ** 3);
    ctx.fillStyle = p.farbe;
    ctx.strokeStyle = p.farbe;
    if (p.art === 'ring') {
      ctx.lineWidth = Math.max(1, 14 * (1 - t));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.groesse, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (p.art === 'kreis') {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.groesse, 0, 2 * Math.PI);
      ctx.fill();
    } else if (p.art === 'linie') {
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.cos(p.rot) * p.groesse, p.y + Math.sin(p.rot) * p.groesse);
      ctx.stroke();
    } else {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillRect(-p.groesse / 2, -p.groesse / 4, p.groesse, p.groesse / 2);
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
}

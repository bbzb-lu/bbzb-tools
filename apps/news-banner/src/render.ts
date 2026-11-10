import { fitRect } from './icons/fit';
import type { Prepared } from './icons/raster';
import { badge, canvas, gradients, guideColors, iconStyle, slots, themeOf, zones, type Audience, type Kind, type Slot, type Theme } from './tokens';

export type BannerState = { audience: Audience; kind: Kind };
export type BannerAssets = { badges: Record<Kind, CanvasImageSource>; icons: Partial<Record<Slot, Prepared>> };

export function gradientColor(theme: Theme, y: number): [number, number, number] {
  const stops = gradients[theme];
  const first = stops[0]!;
  const last = stops[stops.length - 1]!;
  if (y <= first[0]) return [...first[1]];
  if (y >= last[0]) return [...last[1]];
  const i = stops.findIndex(([sy]) => sy >= y);
  const [y0, c0] = stops[i - 1]!;
  const [y1, c1] = stops[i]!;
  const t = (y - y0) / (y1 - y0);
  return [0, 1, 2].map((k) => Math.round(c0[k]! + (c1[k]! - c0[k]!) * t)) as [number, number, number];
}

/** Zeichnet das Banner (ohne Hilfslinien). Vorschau und Export nutzen dieselbe Funktion. */
export function renderBanner(ctx: CanvasRenderingContext2D, state: BannerState, assets: BannerAssets) {
  const theme = themeOf(state.audience);
  const g = ctx.createLinearGradient(0, 0, 0, canvas.h);
  for (const [y, [r, gr, b]] of gradients[theme]) g.addColorStop(y / (canvas.h - 1), `rgb(${r},${gr},${b})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.w, canvas.h);
  for (const [slot, p] of Object.entries(assets.icons) as [Slot, Prepared][]) drawIcon(ctx, p, slot, theme);
  ctx.drawImage(assets.badges[state.kind], badge.cx - badge.w / 2, badge.cy[state.kind] - badge.h / 2, badge.w, badge.h);
}

const sprite = (w: number, h: number) => Object.assign(document.createElement('canvas'), { width: Math.ceil(w), height: Math.ceil(h) });

/** Innenschatten oder Innenlicht: Farbe füllen, das versetzte Icon ausstanzen, auf das Icon zuschneiden. */
function inner(icon: CanvasImageSource, w: number, h: number, pad: number, color: string, dx: number, blur: number) {
  const c = sprite(w + 2 * pad, h + 2 * pad);
  const x = c.getContext('2d')!;
  x.fillStyle = color;
  x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = 'destination-out';
  x.filter = `blur(${blur}px)`;
  x.drawImage(icon, pad + dx, pad + dx, w, h);
  x.filter = 'none';
  x.globalCompositeOperation = 'destination-in';
  x.drawImage(icon, pad, pad, w, h);
  return c;
}

/** Ein Icon im Platz: einpassen, dann (bei Strichicons) weicher Schein und Relief wie in der PSD. */
function drawIcon(ctx: CanvasRenderingContext2D, p: Prepared, slot: Slot, theme: Theme) {
  const r = fitRect(p.w, p.h, slot);
  if (!p.tinted) return void ctx.drawImage(p.src, r.x, r.y, r.w, r.h);
  const k = Math.min(1, r.w / 340, r.h / 262) || 1; // Effekte schrumpfen mit kleinen Icons
  const glow = iconStyle.glow[theme];
  const { shade, light, offset, blur } = iconStyle.relief;
  const pad = Math.ceil(glow.blur * k * 3);
  const base = sprite(r.w + 2 * pad, r.h + 2 * pad);
  base.getContext('2d')!.drawImage(p.src, pad, pad, r.w, r.h);
  ctx.save();
  ctx.translate(r.x - pad, r.y - pad);
  ctx.filter = `blur(${glow.blur * k}px)`;
  ctx.globalAlpha = glow.alpha;
  ctx.drawImage(base, 0, 0);
  ctx.globalAlpha = 1;
  ctx.filter = 'none';
  ctx.drawImage(base, 0, 0);
  ctx.drawImage(inner(p.src, r.w, r.h, pad, shade, offset * k, blur * k), 0, 0);
  ctx.drawImage(inner(p.src, r.w, r.h, pad, light, -offset * k, blur * k), 0, 0);
  ctx.restore();
}

/** Nur Vorschau: Banner-Zone rot gestrichelt, Sperrzonen gelb schraffiert, der gewählte Icon-Platz als Rahmen. */
export function renderGuides(ctx: CanvasRenderingContext2D, active: Slot) {
  ctx.save();
  ctx.strokeStyle = guideColors.banner;
  ctx.lineWidth = 3;
  ctx.setLineDash([16, 10]);
  const b = zones.banner;
  ctx.strokeRect(b.x + 1.5, b.y, b.w - 3, b.h);
  ctx.setLineDash([]);
  ctx.strokeStyle = guideColors.blocked;
  ctx.lineWidth = 2;
  for (const z of zones.blocked) for (let y = z.y; y < z.y + z.h; y += 30) {
    ctx.beginPath();
    ctx.moveTo(z.x, y);
    ctx.lineTo(z.x + z.w, y);
    ctx.stroke();
  }
  const a = slots[active];
  for (const [color, width] of [[guideColors.activeOuter, 6], [guideColors.activeInner, 2]] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.strokeRect(a.cx - a.w / 2, a.cy - a.h / 2, a.w, a.h);
  }
  ctx.restore();
}

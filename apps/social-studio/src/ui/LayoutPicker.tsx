import type { LayoutPreset } from '../core/types';
import { resolveColor, tagPreviewFill } from '../model/accent';
import { colors, photoFrame, rgba, type PaletteColor } from '../tokens';

/** Schema-Kachel aus den Layoutdaten: Fotos als dunkles Feld, Texte als Balken, Tags in ihrer Farbe. Kein Rendern, kein Bild. */
function Thumb({ preset, width, height }: { preset: LayoutPreset; width: number; height: number }) {
  return (
    <svg className="layout-thumb" viewBox={`0 0 ${width * preset.slides} ${height}`} aria-hidden="true" focusable="false">
      <rect width={width * preset.slides} height={height} fill={colors[preset.background]} />
      {preset.slides > 1 && <line x1={width} x2={width} y2={height} stroke={rgba('warmweiss', 0.6)} strokeWidth={8} strokeDasharray="24 16" />}
      {preset.elements.map((e, i) => {
        const p = e.props as { color?: PaletteColor; frame?: boolean; frameOutside?: boolean; text?: string; fontSize?: number; variant?: string };
        const turn = e.rotation ? `rotate(${e.rotation} ${e.x} ${e.y})` : undefined;
        // Foto mit Rahmen: warmweisse Karte wie im Export, aussen um die Box (frameOutside) bzw. alt mit eingerücktem Bildbereich
        const none = { left: 0, top: 0, right: 0, bottom: 0 };
        const m = p.frame && !p.frameOutside ? photoFrame.inset : none;
        const o = p.frame && p.frameOutside ? photoFrame.inset : none;
        if (e.type === 'photo')
          return (
            <g key={i} transform={turn}>
              {p.frame && <rect x={e.x - o.left} y={e.y - o.top} width={e.width + o.left + o.right} height={e.height + o.top + o.bottom} fill={colors[photoFrame.color]} />}
              <rect x={e.x + m.left} y={e.y + m.top} width={e.width - m.left - m.right} height={e.height - m.top - m.bottom} fill={rgba('blauschwarz', 0.35)} stroke={colors.warmweiss} strokeWidth={6} />
            </g>
          );
        if (e.type === 'tag' && p.variant) return <rect key={i} x={e.x} y={e.y} width={e.width} height={e.height} fill={tagPreviewFill(p.variant, colors.orange)} />;
        if (e.type !== 'text') return null;
        const size = p.fontSize ?? 60;
        const lines = (p.text ?? '').split('\n');
        return lines.map((_, l) => (
          <rect key={`${i}-${l}`} x={e.x} y={e.y + l * size} width={e.width * 0.8} height={size * 0.6} fill={resolveColor(p.color ?? 'blauschwarz', colors.orange)} />
        ));
      })}
    </svg>
  );
}

/** Layouts als Kacheln; `current` ist das Layout der Slide (falls bekannt). */
export function LayoutPicker({
  presets,
  format,
  current,
  label,
  onPick,
}: {
  presets: LayoutPreset[];
  format: { width: number; height: number };
  current?: string;
  label: string;
  onPick(preset: LayoutPreset): void;
}) {
  return (
    <ul className="layout-grid" aria-label={label}>
      {presets.map((l) => (
        <li key={l.id} data-wide={l.slides > 1 ? '' : undefined}>
          <button type="button" className="layout-tile" aria-current={l.id === current ? 'true' : undefined} onClick={() => onPick(l)}>
            <Thumb preset={l} width={format.width} height={format.height} />
            <span className="layout-label">
              {l.label}
              {l.slides > 1 && <span className="muted"> · {l.slides} Slides</span>}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

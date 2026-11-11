import { Layer, Line, Rect } from 'react-konva';
import { useDoc } from '../store/document';
import { useUi } from '../store/ui';
import { colors, margin, marginLineStyle, rgba, safeZoneStyle, safeZones } from '../tokens';

const BAND = rgba('blauschwarz', safeZoneStyle.bandAlpha);
const MARGIN_BACK = rgba('warmweiss', marginLineStyle.backAlpha);

/** Sicherheitszonen: dunkle Bänder mit orangem Rand pro Slide. Hört nicht auf Zeiger, ist nicht in «content», wird nie exportiert. */
export function SafeZoneLayer() {
  const on = useUi((s) => s.safeZones);
  const format = useDoc((s) => s.project!.format);
  const slides = useDoc((s) => s.project!.slides.length);
  const z = safeZones[format.id];
  if (!on || !z) return null;
  const { width: w, height: h } = format;
  const edge = (points: number[], key: string) => (
    <Line key={key} points={points} stroke={colors.orange} strokeWidth={safeZoneStyle.edgeWidth} dash={[...safeZoneStyle.edgeDash]} strokeScaleEnabled={false} />
  );
  return (
    <Layer name="safezones" listening={false}>
      {Array.from({ length: slides }, (_, i) => {
        const x = i * w;
        // heller Untergrund unter dunkler Linie: lesbar auf Blau, Foto und Band
        const line = (points: number[], key: string) => [
          <Line key={`${key}b`} name="marginBack" points={points} stroke={MARGIN_BACK} strokeWidth={marginLineStyle.backWidth} strokeScaleEnabled={false} />,
          <Line key={key} name="margin" points={points} stroke={colors.blauschwarz} strokeWidth={marginLineStyle.width} dash={[...marginLineStyle.dash]} strokeScaleEnabled={false} />,
        ];
        return [
          line([x + margin, 0, x + margin, h], `ml${i}`),
          line([x + w - margin, 0, x + w - margin, h], `mr${i}`),
          line([x, margin, x + w, margin], `mt${i}`),
          line([x, h - margin, x + w, h - margin], `mb${i}`),
          z.top > 0 && <Rect key={`t${i}`} x={x} y={0} width={w} height={z.top} fill={BAND} />,
          z.top > 0 && edge([x, z.top, x + w, z.top], `te${i}`),
          z.bottom > 0 && <Rect key={`b${i}`} x={x} y={h - z.bottom} width={w} height={z.bottom} fill={BAND} />,
          z.bottom > 0 && edge([x, h - z.bottom, x + w, h - z.bottom], `be${i}`),
          z.left > 0 && <Rect key={`l${i}`} x={x} y={0} width={z.left} height={h} fill={BAND} />,
          z.left > 0 && edge([x + z.left, 0, x + z.left, h], `le${i}`),
          z.right > 0 && <Rect key={`r${i}`} x={x + w - z.right} y={0} width={z.right} height={h} fill={BAND} />,
          z.right > 0 && edge([x + w - z.right, 0, x + w - z.right, h], `re${i}`),
        ];
      })}
    </Layer>
  );
}

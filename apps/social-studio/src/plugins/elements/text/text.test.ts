import { describe, expect, it } from 'vitest';
import { textStyles } from '../../../tokens';
import { textType } from './index';
import { textConfig } from './measure';
import { textPropsSchema, type TextProps } from './schema';

const base: TextProps = { text: 'Kunst Lust', style: 'kommentar', color: 'blauschwarz', fontSize: 100, align: 'left' };

describe('Text-Feineinstellung', () => {
  it('alte Props ohne Zeilenabstand und Laufweite: Stilwerte', () => {
    expect(textPropsSchema.parse(base)).toEqual(base);
    const c = textConfig(base, 500);
    expect(c.lineHeight).toBe(textStyles.kommentar.lineHeight);
    expect(c.letterSpacing).toBeCloseTo(textStyles.kommentar.letterSpacingEm * 100);
  });

  it('Zeilenabstand in % des Stilwerts, Laufweite als Abweichung in 1/1000 em', () => {
    const c = textConfig({ ...base, style: 'titel', lineHeight: 80, tracking: 20 }, 500);
    expect(c.lineHeight).toBeCloseTo(textStyles.titel.lineHeight * 0.8);
    expect(c.letterSpacing).toBeCloseTo((-40 + 20) / 10);
  });

  it('Grenzen: 80 bis 130 %, ±20, ganze Zahlen', () => {
    for (const ok of [{ lineHeight: 80 }, { lineHeight: 130 }, { tracking: -20 }, { tracking: 20 }])
      expect(textPropsSchema.safeParse({ ...base, ...ok }).success).toBe(true);
    for (const bad of [{ lineHeight: 79 }, { lineHeight: 131 }, { tracking: 21 }, { tracking: -21 }, { tracking: 1.5 }])
      expect(textPropsSchema.safeParse({ ...base, ...bad }).success).toBe(false);
  });

  it('ZWNJ nur bei Laufweite 0 (sonst zeichnet Konva je Zeichen, ZWNJ gäbe Extra-Abstand)', () => {
    expect(textConfig(base, 500).text).toBe('Kunst Lust');
    expect(textConfig({ ...base, tracking: 10 }, 500)).toMatchObject({ text: 'Kuns‌t Lus‌t', letterSpacing: 0 });
    expect(textConfig({ ...base, tracking: 5 }, 500).text).toBe('Kunst Lust');
  });
});

describe('Text beim Layoutwechsel', () => {
  it('nur der Text zieht um, Stil, Farbe und Grösse kommen vom Layout', () => {
    const at = (props: TextProps) => ({ id: 'x', type: 'text', name: 'T', x: 0, y: 0, width: 10, height: 10, rotation: 0, opacity: 1, visible: true, locked: false, props });
    const r = textType.takeContent!(at(base), at({ ...base, text: 'Mein Text', style: 'titel', color: 'orange', tracking: 10 }), {} as never)!;
    expect(r.props).toEqual({ ...base, text: 'Mein Text' });
  });
});

import { describe, expect, it, vi } from 'vitest';
import { copyRules } from '../../../ui/layoutActions';
import { textStyles } from '../../../tokens';
import { textType } from './index';
import { measureTextHeight, textConfig } from './measure';
import { textPropsSchema, type TextProps } from './schema';

// Konva misst im Node-Test nicht (kein Canvas): zwei Zeilen je Schriftgrösse genügen für das Verhältnis.
vi.mock('./measure', async (orig) => ({ ...(await orig<typeof import('./measure')>()), measureTextHeight: (p: { fontSize: number }) => p.fontSize * 2 }));

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

describe('Text beim Skalieren', () => {
  const el = { id: 'x', type: 'text', name: 'T', x: 0, y: 0, width: 400, height: measureTextHeight(base, 400), rotation: 0, opacity: 1, visible: true, locked: false, props: base };

  it('Gruppe (Breite und Höhe im selben Verhältnis): Schriftgrösse skaliert mit', () => {
    const patch = textType.afterTransform(el, { x: 0, y: 0, width: 200, height: el.height / 2, rotation: 0 }, undefined, true);
    expect(patch.props).toEqual({ ...base, fontSize: 50 });
    expect(patch.height).toBe(measureTextHeight({ ...base, fontSize: 50 }, 200));
  });

  it('gleiche Box ohne scaleContent (Zahlenfelder, Format-Kopie, Layoutwechsel): Schriftgrösse bleibt', () => {
    const box = { x: 0, y: 0, width: 200, height: el.height / 2, rotation: 0 };
    expect(textType.afterTransform(el, box).props).toBeUndefined();
    expect(copyRules.resize(el, box, {} as never)).toMatchObject({ width: 200, props: { fontSize: base.fontSize } });
  });

  it('nur die Breite ändert sich (Seitenanker): Schriftgrösse bleibt', () => {
    const patch = textType.afterTransform(el, { x: 0, y: 0, width: 200, height: el.height, rotation: 0 });
    expect(patch.props).toBeUndefined();
    expect(patch.height).toBe(measureTextHeight(base, 200));
  });
});

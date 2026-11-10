import { describe, expect, it } from 'vitest';
import { gradientColor } from './render';

describe('gradientColor', () => {
  it('trifft die Stützpunkte der PSD', () => {
    expect(gradientColor('dark', 0)).toEqual([84, 120, 181]);
    expect(gradientColor('dark', 540)).toEqual([50, 88, 159]);
    expect(gradientColor('light', 1079)).toEqual([129, 155, 200]);
  });
  it('interpoliert dazwischen', () => {
    expect(gradientColor('dark', 150)).toEqual([75, 112, 175]);
  });
  it('klemmt ausserhalb', () => {
    expect(gradientColor('light', -5)).toEqual([255, 255, 255]);
    expect(gradientColor('dark', 2000)).toEqual([16, 56, 136]);
  });
});

import { describe, expect, it } from 'vitest';
import { filmkorn } from '../tokens';
import { grainDefault, grainOpacity } from './grain';

describe('Korn-Stärke', () => {
  it('Standard = bisheriger Wert: Fläche 40, Foto 14; fehlt oder Standard ergibt genau die Token-Deckkraft (pixelgleich)', () => {
    expect(grainDefault).toEqual({ flaeche: 40, foto: 14 });
    expect(grainOpacity(undefined, 'flaeche')).toBe(filmkorn.opacityFlaeche);
    expect(grainOpacity(40, 'flaeche')).toBe(filmkorn.opacityFlaeche);
    expect(grainOpacity(undefined, 'foto')).toBe(filmkorn.opacityFoto);
    expect(grainOpacity(14, 'foto')).toBe(filmkorn.opacityFoto);
  });

  it('linear: 0 = kein Korn, 100 = volle Deckkraft', () => {
    expect(grainOpacity(0, 'flaeche')).toBe(0);
    expect(grainOpacity(100, 'foto')).toBe(1);
    expect(grainOpacity(30, 'flaeche')).toBeCloseTo(0.3);
  });
});

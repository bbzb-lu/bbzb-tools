import { filmkorn } from '../tokens';

/**
 * Korn-Stärke (Drehregler) = Deckkraft des Overlays in Prozent, 0 bis 100, linear. Standard = bisheriger Wert (Fläche 40, Foto 14):
 * fehlt das Feld (altes Projekt) oder steht es auf dem Standard, ergibt sich genau die Token-Deckkraft (40 / 100 === 0.4), also dieselben Pixel.
 */
export const grainDefault = { flaeche: Math.round(filmkorn.opacityFlaeche * 100), foto: Math.round(filmkorn.opacityFoto * 100) };

export const grainOpacity = (strength: number | undefined, kind: keyof typeof grainDefault): number => (strength ?? grainDefault[kind]) / 100;

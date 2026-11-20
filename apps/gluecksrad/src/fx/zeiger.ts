/** Segment unter dem Zeiger oben. Segment i belegt [i*w, (i+1)*w) im Uhrzeigersinn ab oben; dreht das Rad um θ, steht dort der Radwinkel -θ. */
export function indexUnterZeiger(drehungGrad: number, n: number): number {
  const winkel = (((-drehungGrad % 360) + 360) % 360);
  return Math.min(n - 1, Math.floor(winkel / (360 / n)));
}

/** Drehwinkel in Grad aus einem berechneten CSS-`transform` (`matrix(a, b, …)` oder `none`). */
export function winkelAusMatrix(transform: string): number {
  const m = /^matrix\(([^,]+),([^,]+)/.exec(transform);
  return m ? (Math.atan2(Number(m[2]), Number(m[1])) * 180) / Math.PI : 0;
}

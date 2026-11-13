// Eigene Datei, damit theme.ts ohne Schriftdateien importierbar bleibt (Edge-Tests lesen die Tokens in Node).
import hg400 from '@bbzb/ui/fonts/host-grotesk-latin-400-normal.woff2?url';
import hg600 from '@bbzb/ui/fonts/host-grotesk-latin-600-normal.woff2?url';
import hg700 from '@bbzb/ui/fonts/host-grotesk-latin-700-normal.woff2?url';
import hg800 from '@bbzb/ui/fonts/host-grotesk-latin-800-normal.woff2?url';

/** Familien der Oberfläche (Dateien aus @bbzb/ui). Fehlen sie, greifen die System-Schriften; der Export bleibt unberührt. */
export const uiFonts = [
  { family: 'Host Grotesk', weight: '400', url: hg400, label: 'Host Grotesk' },
  { family: 'Host Grotesk', weight: '600', url: hg600, label: 'Host Grotesk SemiBold' },
  { family: 'Host Grotesk', weight: '700', url: hg700, label: 'Host Grotesk Bold' },
  { family: 'Host Grotesk', weight: '800', url: hg800, label: 'Host Grotesk ExtraBold' },
] as const;

/** Lädt die Oberflächen-Schriften; wirft nie, bei Fehler bleibt der System-Fallback. */
export async function loadUiFonts(): Promise<void> {
  await Promise.allSettled(uiFonts.map((f) => document.fonts.load(`${f.weight} 1em "${f.family}"`, 'Äöüé')));
}

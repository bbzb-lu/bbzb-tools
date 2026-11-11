import segoeUi from '../brand/fonts/segoeui.ttf?url';
import segoeUiBold from '../brand/fonts/segoeuib.ttf?url';
import segoeUiBlack from '../brand/fonts/seguibl.ttf?url';
import { tagStyles, textStyles, uiFamily } from './tokens';

// Braveold ist lizenziert und liegt nicht im Repo, sondern in fonts-private/ (npm run fonts). Fehlt sie, bleibt das Glob-Ergebnis leer.
const braveold = import.meta.glob<string>('../../../fonts-private/Braveold-Light.otf', { query: '?url', import: 'default', eager: true });

type Face = { family: string; url: string | undefined; label: string; weight?: string };

/** Export-Schriften; `braveoldGlob` ist das Ergebnis von `import.meta.glob` für Braveold (leer, wenn die Datei fehlt). */
export const brandFaces = (braveoldGlob: Record<string, string>): Face[] => [
  { family: textStyles.titel.family, url: segoeUiBlack, label: 'Segoe UI Black' },
  { family: textStyles.kommentar.family, url: Object.values(braveoldGlob)[0], label: 'Braveold Light' },
  { family: tagStyles.tag.family, url: segoeUiBold, label: 'Segoe UI Bold' },
  { family: uiFamily, url: segoeUi, label: 'Segoe UI' },
  { family: uiFamily, url: segoeUiBold, label: 'Segoe UI Bold', weight: '700' },
];

export const faces = brandFaces(braveold);

/** Lädt alle Brand-Schriften; wirft nie, `missing` nennt die fehlenden lesbar (auch solche ohne Datei). */
export async function loadBrandFonts(list: Face[] = faces): Promise<{ missing: string[] }> {
  const results = await Promise.allSettled(
    list.map(async (f) => {
      if (!f.url) throw new Error(`${f.label}: Datei fehlt`);
      const face = new FontFace(f.family, `url(${f.url})`, { weight: f.weight ?? '400' });
      document.fonts.add(await face.load());
    }),
  );
  // Set: Segoe UI Bold liegt unter zwei Familien (UI und Tag), soll aber nur einmal gemeldet werden.
  return { missing: [...new Set(list.filter((_, i) => results[i]!.status === 'rejected').map((f) => f.label))] };
}

/** «Schrift «A» fehlt.» bzw. «Schriften «A», «B» fehlen.» */
export const fontsMissingText = (missing: string[]): string =>
  missing.length === 1
    ? `Schrift «${missing[0]}» fehlt.`
    : `Schriften ${missing.map((m) => `«${m}»`).join(', ')} fehlen.`;

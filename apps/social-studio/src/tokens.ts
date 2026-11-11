export const colors = {
  blau: '#009FE2',
  orange: '#FF4E00',
  warmweiss: '#FBF8F3',
  blauschwarz: '#0F1B26',
} as const;

/** Tooltip: Verzögerung bis zum Erscheinen, Schonfrist, in der der nächste sofort erscheint (ms). */
export const tooltip = { delayMs: 400, graceMs: 800 } as const;

/** Meldungen: Info verschwindet nach so vielen ms (Hover/Fokus pausiert), Fehler bleiben bis zum Schliessen. `undoMs`: ebenso der Rückgängig-Hinweis in der Kontextleiste. */
export const notice = { infoMs: 8000, undoMs: 6000 } as const;

export type ColorToken = keyof typeof colors;

/** Alle Farbnamen, z. B. für z.enum. */
export const colorTokens = Object.keys(colors) as [ColorToken, ...ColorToken[]];

/**
 * Akzentfarbe (Phase 2.5): Farbwert «akzent» ohne Hex, aufgelöst beim Zeichnen und Exportieren (`model/accent.ts`):
 * im Modus «fix» Orange, im Modus «standort» die Farbe des Schul-Tags der Slide. Darum nicht in `colors`.
 */
export const akzent = 'akzent' as const;
export type PaletteColor = ColorToken | typeof akzent;
/** Palettenfarben plus Akzent, z. B. für z.enum der Elementfarben. */
export const paletteColors = [...colorTokens, akzent] as [PaletteColor, ...PaletteColor[]];

/** Standorte des Schul-Tags (Entscheid Phase 2a, Phase 2.6: «BBZB» als Nicht-Standort und BM). */
export const locations = ['BBZB', 'Bahnhof', 'Heimbach', 'Weggismatt', 'Dagmersellen', 'BM'] as const;
export type Location = (typeof locations)[number];

/**
 * Standortfarben (Wunsch Schulleitung, Phase 2.5/2.6) und die Schrift darauf (= `onAccent(fill)`, Test).
 * BBZB = Blau mit Blauschwarz (Warmweiss hat 2.81 < 3). Heimbach Indigo (Warmweiss 5.44), BM Magenta (Warmweiss 3.40).
 */
export const locationColors: Record<Location, { fill: string; text: 'warmweiss' | 'blauschwarz' }> = {
  BBZB: { fill: '#009FE2', text: 'blauschwarz' },
  Bahnhof: { fill: '#008C7E', text: 'warmweiss' },
  Heimbach: { fill: '#4C5EBD', text: 'warmweiss' },
  Weggismatt: { fill: '#FF4E00', text: 'warmweiss' },
  Dagmersellen: { fill: '#D81E3A', text: 'warmweiss' },
  BM: { fill: '#D84FC3', text: 'warmweiss' },
};

/** Fachbereiche je Standort (Phase 2.6). «BBZB» hat keine. Bautechnik gibt es bei Heimbach und Dagmersellen. */
export const departments: Record<Exclude<Location, 'BBZB'>, readonly string[]> = {
  Bahnhof: ['Automobiltechnik', 'Gebäudetechnik', 'Fahrzeugbau und Strassentransport', 'Zimmerleute'],
  Heimbach: ['Bautechnik', 'Coiffeure', 'Visuelle Gestaltung', 'Bühnentänzer/innen', 'Gastronomie', 'Zeichner ZFA/ZFI'],
  Dagmersellen: ['Bautechnik', 'Steinmetze'],
  Weggismatt: ['Elektrotechnik EI/ME', 'Maler', 'Elektrotechnik EP/GIN/NE'],
  BM: ['BM-Tals', 'BM Arte'],
};

/** Füllung des freien Tags: Palettenfarben, Akzent oder eine Standortfarbe. */
export const tagFills = [...colorTokens, akzent, ...locations.filter((l) => l !== 'BBZB')] as const;
export type TagFill = (typeof tagFills)[number];

/**
 * Mindestkontrast für Warmweiss auf einer Akzentfläche: WCAG AA für grosse Schrift (Tag 28 px, CTA 34 px, fett). 4.5 ist mit
 * der Marke nicht zu halten: Warmweiss auf Orange (PSD) hat 3.13, auf Bahnhof-Grün 3.92. Darunter (BBZB-Blau 2.81) Blauschwarz.
 */
export const accentTextContrast = 3;

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};

/** Schrift auf einer Akzentfläche: Warmweiss (Marke), solange es den Kontrast für grosse Schrift hält, sonst Blauschwarz. */
export function onAccent(hex: string): 'warmweiss' | 'blauschwarz' {
  const ratio = (luminance(colors.warmweiss) + 0.05) / (luminance(hex) + 0.05);
  return ratio >= accentTextContrast ? 'warmweiss' : 'blauschwarz';
}

export const margin = 72;

/** Überlagerung der Sicherheitszonen: Band-Deckkraft, Randlinie (Bildschirm-px) gestrichelt, damit eine Einrast-Hilfslinie (durchgezogen) auf dem Rand sichtbar bleibt. */
export const safeZoneStyle = { bandAlpha: 0.5, edgeWidth: 1.5, edgeDash: [12, 8] } as const;

/** 72-px-Ränder jeder Slide: feiner und gepunktet in Blauschwarz auf hellem Grund, damit sie auf Blau, Fotos und den dunklen Bändern lesbar bleiben und nicht mit den orangen Instagram-Zonen verwechselt werden. */
export const marginLineStyle = { width: 1, dash: [2, 6], backWidth: 3, backAlpha: 0.6 } as const;

/**
 * Sicherheitszonen je Format-Id (Entscheid Phase 2b): freizuhaltende Ränder in px.
 * Story: oben 250, unten 340 (Instagram-Bedienelemente). Post: Profilraster schneidet auf 3:4 zu, 1350 × 3/4 = 1012.5 breit.
 */
export const safeZones: Record<string, { top: number; right: number; bottom: number; left: number }> = {
  post: { top: 0, right: 33.75, bottom: 0, left: 33.75 },
  story: { top: 250, right: 0, bottom: 340, left: 0 },
};

export const textStyles: Record<
  'titel' | 'kommentar',
  { family: string; letterSpacingEm: number; lineHeight: number; defaultSize: number }
> = {
  titel: { family: 'BBZB Titel', letterSpacingEm: -0.04, lineHeight: 0.86, defaultSize: 150 },
  kommentar: { family: 'BBZB Kommentar', letterSpacingEm: -0.01, lineHeight: 76 / 66, defaultSize: 62 },
};

/** Text-Feineinstellung (Entscheid Phase 2a): Zeilenabstand in % des Stilwerts, Laufweite als Abweichung in 1/1000 em. */
export const textAdjust = { lineHeight: { min: 80, max: 130 }, tracking: { min: -20, max: 20 } } as const;

/** Wirksame Zeilenhöhe (Faktor) und Laufweite (px); ohne eigene Werte gilt der Stilwert. Für Leinwand und Textarea. */
export function textMetrics(style: keyof typeof textStyles, fontSize: number, lineHeight = 100, tracking = 0) {
  const s = textStyles[style];
  // ganze Tausendstel rechnen, damit Stilwert + Abweichung exakt 0 ergeben kann (Ligatur-Fall)
  return { lineHeight: (s.lineHeight * lineHeight) / 100, letterSpacing: ((Math.round(s.letterSpacingEm * 1000) + tracking) / 1000) * fontSize };
}

/** Tag und CTA (orange Box): Segoe UI Bold, immer Grossbuchstaben, feste Grösse. */
export const tagStyles: Record<'tag' | 'cta', { family: string; letterSpacingEm: number; size: number; uppercase: boolean }> = {
  tag: { family: 'BBZB Tag', letterSpacingEm: 0.11, size: 28, uppercase: true },
  cta: { family: 'BBZB Tag', letterSpacingEm: 0.11, size: 34, uppercase: true },
};

/** Kanäle des Projekts und ihr CTA-Standardtext (components.cta der PSD). */
export const channels = ['instagram', 'linkedin'] as const;
export type Channel = (typeof channels)[number];
export const ctaText: Record<Channel, string> = { instagram: 'LINK IN BIO', linkedin: 'BBZB.LU.CH' };
export const channelLabels: Record<Channel, string> = { instagram: 'Instagram', linkedin: 'LinkedIn' };

/**
 * Boxmasse der Tags (aus components.schulTag/ortTag/cta der PSD). Schul-Tag, CTA und Pin in «akzent» (im Modus «fix» Orange wie
 * die PSD); die Schrift wählt `onAccent(Füllung)`, das ergibt Warmweiss wie die PSD.
 */
export const tagBox = {
  schul: { height: 62, fill: akzent, paddingLeft: 36, paddingRight: 36 },
  // fach: Füllung real über tagFillOf (Standortfarbe), hier Platzhalter. frei: Füllung aus den Props.
  fach: { height: 62, fill: akzent, paddingLeft: 36, paddingRight: 36 },
  frei: { height: 62, fill: akzent, paddingLeft: 36, paddingRight: 36 },
  // Schul-Tag mit Fachbereich darunter: eigene Höhe und Schriftgrösse, optisch zu prüfen
  schulDept: { height: 104, size: 24 },
  ort: { height: 62, fill: 'blauschwarz', iconColor: akzent, textX: 68, paddingRight: 36, icon: { x: 22, y: 11, w: 33, h: 41 } },
  cta: { height: 75, fill: akzent, paddingLeft: 44, paddingRight: 44, defaultText: ctaText.instagram },
} as const;

/**
 * Verlauf am Foto (Entscheid Phase 2.3): Palettenfarbe an der gewählten Kante → transparent nach `reach` % der Bildlänge.
 * leicht = verlaufOben der PSD (Alpha 0.45 × Ebenendeckkraft 0.25), stark = verlaufUnten (Alpha 0.7; PSD-Farbe #0B2A3C ist kein
 * Token, abgedunkelt wird mit Blauschwarz), mittel dazwischen
 * (nicht aus der PSD, gesetzt). Reichweite in %, Standard wie die PSD-Stopps (0.56).
 */
export const scrim = {
  alpha: { leicht: 0.45 * 0.25, mittel: 0.35, stark: 0.7 },
  reach: { min: 30, max: 100, default: 56 },
  /** Höchstens so viele Verläufe je Foto (Phase 2.5). */
  max: 4,
  color: { dark: 'blauschwarz', light: 'warmweiss' },
} as const;

/**
 * Fotorahmen (Collage der PSD). Ränder in docs/reference/layouts/Beispiel_05_Collage.jpg gemessen (quer zu den gedrehten
 * Kanten, ringsum 24 px): die PSD-Bounds (Rahmen 99/172 882 × 1034, Foto 154/213 772 × 924) enthalten Schatten und Drehung,
 * ihre Differenz 55/41/55/69 ist nicht der sichtbare Rand (Ruling R4).
 * Schatten aus components.fotoRahmen.dropShadow (90°, Abstand 14, Grösse 30, 22 %). PSD-Farbe #002846 mit «Multiplizieren»
 * ist kein Token: normaler Schatten in Blauschwarz.
 * `inset` ist die Rahmenbreite: seit Phase 2.5 ragt der Rahmen um sie über die Box hinaus (Kontur, `frameOutside`); bei Altprojekten
 * ohne `frameOutside` ist sie der Einzug des Bildbereichs in der Box.
 */
export const photoFrame = {
  inset: { left: 24, top: 24, right: 24, bottom: 24 },
  color: 'warmweiss',
  shadow: { color: 'blauschwarz', opacity: 0.22, offsetY: 14, blur: 30 },
} as const;

/** Filmkorn (components.filmkorn der PSD): nie global, nur auf das Foto bzw. den Slide-Hintergrund. Textur = Manifest-Eintrag `textureId`. */
// contrast: nicht aus der PSD, sondern an den Referenzbildern kalibriert (Streuung im Grünkanal der blauen Flächen in
// docs/reference/layouts/Beispiel_05 und _07, etwa 25); ein e2e-Test vergleicht das.
export const filmkorn = {
  textureId: 'filmkorn',
  blend: 'overlay',
  opacityFoto: 0.14,
  opacityFlaeche: 0.4,
  contrast: 6,
} as const;

/**
 * BBZB-Look (components.bildlook der PSD): Annäherung an die Lightroom-Presets des Teams. Einzige Stelle der Werte; ein
 * späteres Preset ersetzt nur diese Zeilen. `photoFilter.color` ist ein Filterparameter, keine Palettenfarbe.
 */
export const bildlook = {
  photoFilter: { color: '#EC8A00', density: 0.12, preserveLuminosity: true },
  vibrance: 5,
  saturation: -5,
} as const;

/**
 * Bildregler (Entscheid Phase 2a): Helligkeit, Kontrast, Sättigung, Wärme je −50 bis +50, 0 = neutral.
 * `strength`: Wirkung am Anschlag (±50) als Faktor, z. B. Helligkeit 0.5 = ×0.5 bis ×1.5; Wärme hebt Rot und senkt Blau.
 */
export const imageAdjust = {
  min: -50,
  max: 50,
  strength: { brightness: 0.5, contrast: 0.5, saturation: 0.5, warmth: 0.2 },
} as const;

export const rgba = (c: ColorToken, alpha: number) =>
  `rgba(${[1, 3, 5].map((i) => parseInt(colors[c].slice(i, i + 2), 16)).join(',')},${alpha})`;

export const uiFamily = 'BBZB UI';

/** Leerer Foto-Platzhalter, nur im Editor (nie im Export): Füllung und gestrichelter Rand in Blauschwarz, Hinweis in der UI-Schrift. */
export const placeholderStyle = { color: 'blauschwarz', fillAlpha: 0.08, edgeAlpha: 0.45, edgeWidth: 4, edgeDash: [16, 12], fontSize: 56 } as const;

/**
 * Regler, Masse aus den Bauteilen «Fader» im Pen-Entwurf (Phase 4c.1): Bahn 6 px, Griff eckig 20 × 28 px mit Akzentstrich.
 * `hit` = Höhe der klickbaren Zeile (Zielgrösse), hier gleich hoch wie der Griff. Der Griffmittelpunkt läuft von thumb/2 bis
 * Breite − thumb/2, die Füllung folgt derselben Rechnung; so sitzt der Griff bei 0 und 100 % bündig an der Bahn.
 */
export const slider = { track: 6, thumb: 20, thumbHeight: 28, hit: 28 } as const;

/** Bereichsregler (Video kürzen) wie «Bereichsregler» im Pen-Entwurf: Klammern 12 × 32 px mit Stab und Füssen 5 px, Schiene 8 px. */
export const range = { handle: 12, handleHeight: 32, bar: 5, rail: 8 } as const;

/** Video (Phase 3): Grenzen und Export. Bitrate für 1080x1350 H.264 (ca. 8 Mbit/s). */
/** Exportqualität (Projekteinstellung `exportQuality`, fehlt = standard): Video-Bitrate in bit/s und JPEG-Qualität. */
export const exportQuality = {
  klein: { bitrate: 4_000_000, jpeg: 0.8 },
  standard: { bitrate: 8_000_000, jpeg: 0.92 },
  hoch: { bitrate: 14_000_000, jpeg: 0.97 },
} as const;
export type ExportQuality = keyof typeof exportQuality;

export const video = {
  maxSlideSeconds: 60,
  warnSeconds: 60,
  warnBytes: 500 * 1024 * 1024,
  minLength: 1,
  fps: 30,
  /** Lange Seite beim Dekodieren (Editor und Export): Querformat-Ausschnitte in Hochformat-Slides bleiben scharf. */
  decodeMax: 1920,
  /** Schlüsselbild alle n Sekunden im exportierten MP4. */
  keyFrameInterval: 2,
  /** Vorschaubilder im Inspector (Start, Ende): CSS-Breite in px, dekodiert in doppelter Breite (scharf bei 200 % Skalierung). */
  thumbWidth: 96,
} as const;

/** Maske am Foto (Phase 4a): lange Seite der Maskendatei höchstens `maxSize` px (das Foto selbst bleibt bei 4096); Stempelabstand eines Strichs als Anteil des Radius. */
/** `saveTimeout`: längstens so viele ms für das Schreiben der Maske (sonst bliebe ein Strich still ungespeichert). `soften`: Weichheit (Radius in Maskenpixeln) für «Maske weich zeichnen». */
export const mask = { maxSize: 2048, spacing: 0.25, saveTimeout: 10000, soften: { min: 1, max: 60, default: 12 } } as const;

/**
 * Freistellen (Phase 4b): Anteil der sichtbaren Fläche, ausserhalb von [minCover, maxCover] gilt das Ergebnis als «kein Motiv».
 * Modell: ISNet (Entscheid Task 1), geladen über `host` (Modellquelle, für einen eigenen Spiegel änderbar; neue Hosts auch in
 * `public/_headers` eintragen). `dtype` wählt die Datei `onnx/model_<dtype>.onnx`, `downloadMB` ist die Grössenangabe «ca. X MB».
 */
export const cutout = {
  minCover: 0.02,
  maxCover: 0.98,
  model: {
    id: 'imgly/isnet-general-onnx',
    // Commit des Modell-Repos, gegen den getestet wurde (fp16, 88 MB); Wechsel siehe docs/deployment.md
    revision: '440dea96dd4a3b06bbbf5abec3e26569dd7ec49f',
    host: 'https://huggingface.co/',
    // Dateispeicher, auf den host weiterleitet (Subdomain je Region); muss wie host im Schulnetz frei sein, steht so in connect-src
    storageHost: 'hf.co',
    inputSize: 1024,
    dtype: 'fp16',
    downloadMB: 88,
  },
} as const;

/**
 * Pinsel der Maske (Phase 4a): Grösse = Durchmesser in Slide-Pixeln (Regler und Tasten), `step` = Faktor je Tastendruck,
 * Härte in Prozent (0 weich, 100 hart). Folie: Farbe und Deckkraft über ausgeblendeten Flächen, nur im Editor.
 * Ring: dunkle Linie unter heller, in Bildschirmpixeln, damit er auf jedem Hintergrund sichtbar ist.
 */
export const brush = {
  size: { min: 4, max: 400, default: 80 },
  step: 1.25,
  hardness: { default: 50 },
  veil: { color: '#FF1F1F', alpha: 0.45 },
  ring: { width: 1.5, backWidth: 3.5, backAlpha: 0.6 },
} as const;

/** Ausschnittmodus: Linie am Rand des Ausschnitts in Bildschirmpixeln (bei jedem Zoom gleich), Farbe wie Auswahl und Hilfslinien (Orange). */
export const cropLine = { width: 1 } as const;

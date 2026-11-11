import { globSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { faces } from './fonts';
import { akzent, bildlook, colors, colorTokens, departments, locationColors, locations, tagFills, onAccent, paletteColors, ctaText, filmkorn, imageAdjust, margin, photoFrame, rgba, scrim, tagBox, tagStyles, textStyles } from './tokens';
import { theme } from './ui/theme';

// Vitest läuft im Hauptordner der Suite: Pfade vom App-Ordner aus auflösen.
const app = (p = '') => fileURLToPath(new URL(`../${p}`, import.meta.url));

const psd = JSON.parse(readFileSync(app('docs/reference/psd-geometry.json'), 'utf8'));
const { titel, kommentar, tag, cta } = psd.textStyles;
/** Datei der Schriftfamilie laut fonts.ts, z. B. «seguibl.ttf». */
const fileOf = (family: string) => faces.find((f) => f.family === family)!.url?.split('/').pop();
const base = (file: string) => file.split('/').pop();

it('Farben und Rand wie PSD', () => {
  expect(colors).toEqual(psd.tokens.colors);
  expect(margin).toBe(psd.tokens.margin);
});

it('Titel und Kommentar wie PSD', () => {
  expect(fileOf(textStyles.titel.family)).toBe(base(titel.file));
  expect(textStyles.titel.letterSpacingEm).toBe(titel.tracking / 1000);
  expect(textStyles.titel.lineHeight).toBe(0.86);
  expect(textStyles.titel.lineHeight).toBeCloseTo(titel.examples[0].leading / titel.examples[0].size, 2);
  expect(textStyles.titel.defaultSize).toBe(titel.examples[1].size);
  expect(fileOf(textStyles.kommentar.family), 'Braveold fehlt: npm run fonts').toBe(base(kommentar.file));
  expect(textStyles.kommentar.letterSpacingEm).toBe(kommentar.tracking / 1000);
  expect(textStyles.kommentar.lineHeight).toBe(kommentar.examples[0].leading / kommentar.examples[0].size);
  expect(textStyles.kommentar.defaultSize).toBe(kommentar.examples[1].size);
});

it('Tag und CTA wie PSD', () => {
  for (const [key, s] of [['tag', tag], ['cta', cta]] as const) {
    expect(fileOf(tagStyles[key].family)).toBe(base(s.file));
    expect(tagStyles[key]).toMatchObject({ letterSpacingEm: s.tracking / 1000, size: s.size, uppercase: s.uppercase });
  }
});

it('Tag-Boxen wie PSD', () => {
  const { schulTag, ortTag, cta: ctaBox } = psd.components;
  expect(tagBox.schul).toMatchObject({ height: schulTag.height, paddingLeft: schulTag.paddingLeft, paddingRight: schulTag.paddingRight });
  expect(tagBox.ort).toMatchObject({ height: ortTag.height, textX: ortTag.textX, paddingRight: ortTag.paddingRight, fill: ortTag.fill, icon: { x: ortTag.icon.x, y: ortTag.icon.y, w: ortTag.icon.w, h: ortTag.icon.h } });
  expect(tagBox.cta).toMatchObject({ height: ctaBox.height, paddingLeft: ctaBox.paddingLeft, paddingRight: ctaBox.paddingRight });
  // Phase 2.5: Schul-Tag und CTA in «akzent» (Modus fix = Orange = PSD), Schrift nach onAccent = Warmweiss wie die PSD
  expect([tagBox.schul.fill, tagBox.cta.fill, tagBox.ort.iconColor]).toEqual([akzent, akzent, akzent]);
  for (const [box, fill] of [[schulTag, colors.orange], [ortTag, colors[tagBox.ort.fill]], [ctaBox, colors.orange]] as const) {
    expect(fill).toBe(colors[box.fill as keyof typeof colors]);
    expect(onAccent(fill)).toBe(box.textColor);
  }
  expect(tagBox.cta.defaultText).toBe(ctaBox.instagram);
  expect(ctaText).toEqual({ instagram: ctaBox.instagram, linkedin: ctaBox.linkedin });
});

it('Foto-Verlauf: leicht = verlaufOben, stark = verlaufUnten der PSD, mittel dazwischen; Reichweite wie die Stopps', () => {
  const { verlaufOben, verlaufUnten } = psd.components;
  expect(scrim.alpha.leicht).toBeCloseTo(verlaufOben.stops[0].alpha * verlaufOben.layerOpacity, 10);
  expect(scrim.alpha.stark).toBeCloseTo(verlaufUnten.stops[0].alpha * verlaufUnten.layerOpacity, 10);
  expect(scrim.alpha.mittel).toBeGreaterThan(scrim.alpha.leicht);
  expect(scrim.alpha.mittel).toBeLessThan(scrim.alpha.stark);
  for (const v of [verlaufOben, verlaufUnten]) {
    expect(v.stops[1].alpha).toBe(0);
    expect(scrim.reach.default).toBeCloseTo(v.stops[1].at * 100, 10);
  }
  expect(scrim.reach).toMatchObject({ min: 30, max: 100 });
  // Vier-Farben-Regel: abdunkeln Blauschwarz, aufhellen Warmweiss (PSD-Farbe #0B2A3C von verlaufUnten ist kein Token, Ruling R3 aus 2.1)
  expect(verlaufUnten.color).toBe('#0B2A3C');
  expect(scrim.color).toEqual({ dark: 'blauschwarz', light: 'warmweiss' });
});

it('Fotorahmen: Ränder wie in Beispiel_05 gemessen (Ruling R4), Schatten aus fotoRahmen, Blauschwarz statt #002846', () => {
  const { fotoRahmen } = psd.components;
  // gemessen quer zu den gedrehten Kanten in Beispiel_05_Collage.jpg: ringsum 24 px (Median je Seite 24.0 bis 24.1)
  expect(photoFrame.inset).toEqual({ left: 24, top: 24, right: 24, bottom: 24 });
  // die Differenz der PSD-Bounds (55/41/55/69) enthält Schatten und Drehung und ist bewusst nicht der Rand
  const [box, foto] = psd.layouts.collage.elements as { x: number; y: number; w: number; h: number }[];
  expect(foto!.x - box!.x).toBeGreaterThan(photoFrame.inset.left);
  expect(photoFrame.color).toBe(fotoRahmen.fill);
  const s = fotoRahmen.dropShadow;
  expect(s.angle).toBe(90); // Licht von oben: Versatz nur nach unten
  expect(photoFrame.shadow).toMatchObject({ opacity: s.opacity, offsetY: s.distance, blur: s.blur });
  // #002846 mit «Multiplizieren» ist kein Token: normaler Schatten in Blauschwarz (Vier-Farben-Regel, wie 2a R3)
  expect(s.color).toBe('#002846');
  expect(photoFrame.shadow.color).toBe('blauschwarz');
});

it('Filmkorn wie PSD', () => {
  const k = psd.components.filmkorn;
  const manifest = JSON.parse(readFileSync(app('brand/manifest.json'), 'utf8'));
  const entry = manifest.assets.find((a: { id: string }) => a.id === filmkorn.textureId);
  expect('brand/' + entry.file).toBe(k.texture);
  expect(filmkorn).toMatchObject({ blend: k.blend, opacityFoto: k.opacityFoto, opacityFlaeche: k.opacityFlaeche });
});

it('BBZB-Look wie PSD (components.bildlook), Filterfarbe keine Palettenfarbe', () => {
  const b = psd.components.bildlook;
  expect(bildlook).toEqual({
    photoFilter: { color: b.photoFilter.approxHex, density: b.photoFilter.density, preserveLuminosity: b.photoFilter.preserveLuminosity },
    vibrance: b.vibrance,
    saturation: b.saturation,
  });
  expect(Object.values(colors)).not.toContain(bildlook.photoFilter.color);
  expect(imageAdjust).toMatchObject({ min: -50, max: 50 });
});

it('rgba() aus Token', () => {
  expect(rgba('orange', 0.5)).toBe('rgba(255,78,0,0.5)');
});

it('Oberflächen-Tokens sind nie Slide-Farben', () => {
  for (const hex of Object.values(theme)) expect(Object.values(colors).map((c) => c.toLowerCase())).not.toContain(hex.toLowerCase());
  expect(colorTokens).not.toContain('accent');
});

it('Standortfarben (Phase 2.5) stehen nur in tokens.ts; «akzent» ist kein Hexwert der Palette', () => {
  expect(locations).toEqual(['BBZB', 'Bahnhof', 'Heimbach', 'Weggismatt', 'Dagmersellen', 'BM']);
  expect(Object.fromEntries(locations.map((l) => [l, locationColors[l].fill]))).toEqual({
    BBZB: '#009FE2',
    Bahnhof: '#008C7E',
    Heimbach: '#4C5EBD',
    Weggismatt: '#FF4E00',
    Dagmersellen: '#D81E3A',
    BM: '#D84FC3',
  });
  for (const l of locations) expect(locationColors[l].text).toBe(onAccent(locationColors[l].fill));
  expect(locationColors.BBZB.text).toBe('blauschwarz');
  expect(locationColors.Heimbach.text).toBe('warmweiss');
  expect(locationColors.BM.text).toBe('warmweiss');
  const hexes = ['#008C7E', '#4C5EBD', '#D81E3A', '#D84FC3'];
  const files = globSync('src/**/*.{ts,tsx,css}', { cwd: app(), exclude: (f) => /\.test\.tsx?$/.test(f) }).map((f) => f.replaceAll('\\', '/'));
  expect(files.length).toBeGreaterThan(100); // leerer Glob wäre stumm grün
  expect(files.filter((f) => f !== 'src/tokens.ts' && hexes.some((h) => readFileSync(app(f), 'utf8').toUpperCase().includes(h)))).toEqual([]);
  expect(Object.keys(colors)).not.toContain(akzent);
  expect(colorTokens).not.toContain(akzent);
  expect(paletteColors).toEqual([...colorTokens, akzent]);
});

it('Fachbereiche (Phase 2.6): 17 Einträge, Bautechnik bei Heimbach und Dagmersellen', () => {
  expect(Object.values(departments).flat()).toHaveLength(17);
  expect(Object.keys(departments)).not.toContain('BBZB');
  expect(departments.Weggismatt).toContain('Maler');
  expect(departments.Heimbach).toContain('Bautechnik');
  expect(departments.Dagmersellen).toContain('Bautechnik');
});

it('Tag-Füllungen und neue Boxen (Phase 2.6)', () => {
  expect(tagFills).toEqual(['blau', 'orange', 'warmweiss', 'blauschwarz', 'akzent', 'Bahnhof', 'Heimbach', 'Weggismatt', 'Dagmersellen', 'BM']);
  expect(tagBox.fach.height).toBe(62);
  expect(tagBox.frei).toMatchObject({ paddingLeft: tagBox.schul.paddingLeft, paddingRight: tagBox.schul.paddingRight });
  expect(tagBox.schulDept).toEqual({ height: 104, size: 24 });
});

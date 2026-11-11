# Phase 1 «Grundgerüst» Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein benutzbarer Editor in Edge: Projekt anlegen (Post 4:5 oder Story 9:16), Slides auf einer durchgehenden Leinwand, Foto- und Text-Elemente, Ebenen-Panel im Profi-Modus, Undo, Autosave, Projektdatei `.bbzbsocial`, JPEG/PNG-ZIP-Export ohne Nähte, deployt auf Cloudflare Pages hinter Access mit CSP.

**Architecture:** Reines TypeScript-Dokumentmodell (`src/model/`), mutierende Operationen für immer-Drafts. Ein zustand-Store mit zundo hält nur das Projekt in der History, UI-Zustand liegt in einem zweiten Store. Element-Typen, Formate und Exporter registrieren sich über `src/plugins/index.ts` in Registries (`src/core/`); Kern, Store und UI importieren nie aus `src/plugins/`. Export klont die Konva-Inhaltsebene des Editors in eine Bühne von exakt einer Slide (gleicher Szenengraph, kein zweiter Renderer).

**Tech Stack:** React 19.3, Vite 8, TypeScript 6.0 (strict; nicht 7, typescript-eslint verlangt `<6.1`), Konva 10 + react-konva 19, zustand 5 + immer 11 + zundo 2, Dexie 4, fflate 0.8, zod 4, Vitest 5 (+ fake-indexeddb), Playwright 1.64 mit `channel: 'msedge'`, pngjs (nur Tests), wrangler (Deploy).

**Spec:** `docs/superpowers/specs/2026-10-21-bbzb-social-studio-design.md` (Phase 1 = Abschnitt 11, Punkt 1, plus «Projektdatei früh» und «Fehlende Brand-Schrift blockiert den Export» aus Abschnitt 12). Ausserdem `CLAUDE.md`, `docs/deployment.md`, `docs/research/`.

## Global Constraints

- Kein Foto, Video oder Projekt verlässt den Browser. Kein Backend, keine Analytics, keine Laufzeit-CDNs, keine externen Fonts. In Phase 1 gibt es **gar keine** externen Requests (`connect-src 'self'`).
- Exporte: exakt 1080 px breit (`format.width × format.height`), sRGB, ohne UI (Auswahl, Transformer, Hilfslinien). JPEG-Qualität 0.92.
- Formate: Post `1080 × 1350`, Story `1080 × 1920`. Format nach Anlegen nicht änderbar.
- Max. 20 Slides, min. 1.
- Farben nur `blau #009FE2`, `orange #FF4E00`, `warmweiss #FBF8F3`, `blauschwarz #0F1B26`, Rand `72`. Diese Werte stehen **nur** in `src/tokens.ts`, nirgends sonst ein Hex-Wert.
- Textstile: Titel = Segoe UI Black, Laufweite −40/1000 em, Zeilenabstand 0.86 × Grösse. Kommentar = Braveold Light, Laufweite −10/1000 em. Schriften aus `brand/fonts/`, selbst gehostet.
- Lädt eine Brand-Schrift nicht: deutliche Warnung im Editor, Export bricht mit verständlicher Meldung ab. Kein stiller Fallback.
- UI-Texte Deutsch, Schweizer Rechtschreibung («ss», nie «ß»), Guillemets «…», Du-Form, kurz, keine Halbgeviertstriche (–).
- Dateien unter 400 Zeilen. Kein abgerundetes UI-Element, das mit den Slides konkurriert: Editor schlicht und eckig.
- Medien als Blob in OPFS unter SHA-256-Hex-ID, im Dokument nur die ID. Kein Base64.
- Undo: ein Schritt pro Geste. Auswahl, Modus und Viewport sind nicht in der History.
- Commit nur, wenn `npm run typecheck`, `npm run lint`, `npm test` und (bei UI/Export) `npm run test:e2e` grün sind und die Änderung in Edge selbst angeschaut wurde. Commit-Nachrichten Englisch, mit `Co-Authored-By`-Zeile.
- Performance: Die Windows-Geräte der Schule sind schwach. Keine Riesen-Canvas, keine unnötigen Re-Renders der Konva-Bühne, Fotos auf max. 4096 px. Bei jedem UI-Task in den Edge-DevTools (CPU 4× gedrosselt) prüfen, dass Ziehen flüssig bleibt; Auffälligkeiten im Abschluss melden.
- Lizenzierte Schriften nie ausserhalb dieses privaten Repos und nie vor dem Access-Schutz ausliefern.

## Review Focus

1. **Riesige iPhone-Fotos (48 MP) oder HEIC:** Import darf Edge nicht einfrieren. Fotos werden auf längste Kante 4096 px verkleinert; HEIC, das Edge nicht dekodiert, ergibt eine klare Meldung statt eines leeren Rahmens. Tests in Task 9.
2. **Neuladen direkt nach einer Änderung** (innerhalb der Autosave-Verzögerung): Änderung ist nach dem Reload da. Autosave schreibt bei `pagehide` sofort. Tests in Task 7 und Task 8.
3. **Kaputte oder fremde `.bbzbsocial`-Datei:** verständliche Meldung, bestehende Projekte bleiben unverändert, nichts halb importiert. Tests in Task 5 und Task 8.
4. **Browser-Speicher voll** beim Foto-Import: Meldung «Speicher voll …», kein Element ohne Bilddaten im Dokument. Test in Task 9.
5. **Projektname mit Umlauten, Schrägstrich, Doppelpunkt:** Exportdateien und ZIP-Einträge sind unter Windows gültig. Test in Task 13.

---

## Dateistruktur

```
index.html
public/_headers                      CSP und Sicherheits-Header (Cloudflare und vite preview)
vite.config.ts  playwright.config.ts  eslint.config.js  tsconfig.json
src/
  main.tsx                           Einstieg: Plugins registrieren, Tokens als CSS-Variablen, persist(), App
  tokens.ts                          EINZIGE Quelle für Farben, Rand, Textstile
  fonts.ts                           FontFace-Laden der Brand-Schriften, meldet fehlende
  core/types.ts                      ElementType, FormatPreset, Exporter, EditorContext
  core/registry.ts                   createRegistry<T>()
  core/registries.ts                 elementTypes, formats, exporters (Instanzen)
  model/types.ts                     Project, Slide, Element, AssetMeta, Crop, Rect
  model/geometry.ts                  Mittelpunkt, Slide-Zuordnung, Bounding Box, Slide-Rechteck
  model/crop.ts                      coverCrop, clampCrop
  model/slides.ts                    createProject, add/duplicate/remove/moveSlide
  model/elements.ts                  add/update/remove/duplicate, Reihenfolge
  model/parse.ts                     zod-Validierung eines Projekts (Vertrauensgrenze)
  plugins/index.ts                   registriert alle Module
  plugins/formats.ts                 Post, Story
  plugins/elements/photo/            schema.ts, index.tsx, PhotoNode.tsx, PhotoInspector.tsx, importImage.ts
  plugins/elements/text/             schema.ts, index.tsx, TextNode.tsx, TextInspector.tsx, measure.ts
  plugins/exporters/raster.ts        JPEG und PNG
  store/document.ts                  zustand+immer+zundo, apply(), Gesten
  store/ui.ts                        Modus (persistiert), Auswahl, aktuelle Slide, Bearbeitungsmodi
  storage/db.ts                      Dexie: Projekte
  storage/assets.ts                  AssetStore (OPFS + Speicher-Variante für Tests)
  storage/gc.ts                      verwaiste Assets löschen
  storage/autosave.ts                entprellt speichern, bei pagehide sofort
  projectFile/projectFile.ts         .bbzbsocial packen/entpacken
  export/fileName.ts                 safeFileName
  export/exportZip.ts                Slides rendern, ZIP bauen
  canvas/images.ts                   Asset-ID → HTMLImageElement (Cache), allImagesLoaded()
  canvas/CanvasView.tsx              Bühne, Scrollen, Slides, Nähte, Drop
  canvas/Scene.tsx                   Inhaltsebene: Slide-Hintergründe + Elemente via Registry
  canvas/SelectionLayer.tsx          Transformer (eigene Ebene, nie exportiert)
  canvas/TextEditOverlay.tsx         Textarea über dem Text beim Bearbeiten
  ui/App.tsx  ui/StartPage.tsx  ui/EditorPage.tsx  ui/Header.tsx  ui/SlideBar.tsx
  ui/Inspector.tsx  ui/LayersPanel.tsx  ui/ExportDialog.tsx  ui/Swatches.tsx  ui/Notice.tsx
  ui/shortcuts.ts  ui/app.css
  test/architecture.test.ts          Leitplanken (Hex nur in Tokens, keine Plugin-Importe, 400 Zeilen, «ß»/«–»)
e2e/
  fixtures.ts                        PNG-Generator (pngjs), .bbzbsocial-Bauer
  smoke.spec.ts  project.spec.ts  editor.spec.ts  export.spec.ts  network.spec.ts
```

---

### Task 1: Gerüst, Werkzeuge, CSP-Header

**Files:**
- Create: `package.json`, `index.html`, `vite.config.ts`, `tsconfig.json`, `eslint.config.js`, `playwright.config.ts`, `public/_headers`, `src/main.tsx`, `src/ui/App.tsx`, `src/ui/app.css`, `e2e/smoke.spec.ts`

**Interfaces:**
- Produces: npm-Skripte `dev`, `build`, `preview`, `typecheck` (`tsc --noEmit`), `lint` (`eslint .`), `test` (`vitest run`), `test:e2e` (`playwright test`). `vite preview` liefert die Header aus `public/_headers`.

- [ ] **Step 1: Projekt aufsetzen.** `npm create vite@latest . -- --template react-ts` in ein leeres Unterverzeichnis und die Dateien übernehmen (bestehende `README.md`, `.gitignore` nicht überschreiben). Abhängigkeiten exakt:
  - dependencies: `react@19.3 react-dom@19.3 konva@10.9 react-konva@19.3 zustand@5 immer@11 zundo@2 dexie@4 fflate@0.8 zod@4`
  - devDependencies: `typescript@~6.0.3 vite@8 @vitejs/plugin-react@6 vitest@5 fake-indexeddb@6 @playwright/test@1.64 pngjs@7 @types/pngjs eslint@10 typescript-eslint@8 eslint-plugin-react-hooks@7 @types/react @types/react-dom @types/node wrangler`
  - `tsconfig.json`: `strict: true`, `noUncheckedIndexedAccess: true`, `types: ["vite/client"]`.
- [ ] **Step 2: Header-Datei.** `public/_headers` mit dem Block aus `docs/deployment.md`, aber `connect-src 'self'` (Phase 1 lädt keine Modelle). `vite.config.ts` liest diese Datei beim Start und setzt die Zeilen unter `/*` als `preview.headers` (kleiner Parser im Config-File: Zeilen `  Name: Wert` nach `/*`). `server.headers` bleibt leer (React-Refresh im Dev braucht Inline-Skript).
- [ ] **Step 3: Playwright konfigurieren.** `projects: [{ name: 'edge', use: { channel: 'msedge' } }]`, `webServer: { command: 'npm run build && npm run preview -- --port 4173 --strictPort', url: 'http://localhost:4173' }`, `use.baseURL` gleich. `vitest` schliesst `e2e/**` aus.
- [ ] **Step 4: Smoke-Test schreiben.**

```ts
test('App lädt mit CSP und ohne Konsolenfehler', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  const res = await page.goto('/');
  expect(res!.headers()['content-security-policy']).toContain("connect-src 'self'");
  await expect(page.getByRole('heading', { name: 'BBZB Social Studio' })).toBeVisible();
  expect(errors).toEqual([]);
});
```

- [ ] **Step 5: Test laufen lassen.** `npm run test:e2e` → FAIL (Überschrift fehlt).
- [ ] **Step 6: `App` rendert `<h1>BBZB Social Studio</h1>`.** `index.html`: `lang="de-CH"`, Titel «BBZB Social Studio».
- [ ] **Step 7: Alles grün.** `npm run typecheck && npm run lint && npm run test:e2e` → PASS. (`npm test` hat erst ab Task 2 Tests.)
- [ ] **Step 8: Commit** `Scaffold Vite + React + TS, Playwright on Edge, CSP headers`.

---

### Task 2: Tokens, Registries, Formate, Leitplanken-Test

**Files:**
- Create: `src/tokens.ts`, `src/core/registry.ts`, `src/core/types.ts`, `src/core/registries.ts`, `src/plugins/formats.ts`, `src/plugins/index.ts`, `src/test/architecture.test.ts`, `src/core/registry.test.ts`, `src/tokens.test.ts`
- Modify: `src/main.tsx` (Plugins registrieren, Tokens als CSS-Variablen)

**Interfaces:**
- Produces:
  - `tokens.ts`: `colors: { blau, orange, warmweiss, blauschwarz }` (Hex-Strings), `type ColorToken = keyof typeof colors`, `margin = 72`, `textStyles: Record<'titel'|'kommentar', { family: string; letterSpacingEm: number; lineHeight: number; defaultSize: number }>` mit titel `{ family: 'BBZB Titel', letterSpacingEm: -0.04, lineHeight: 0.86, defaultSize: 150 }`, kommentar `{ family: 'BBZB Kommentar', letterSpacingEm: -0.01, lineHeight: 76/66, defaultSize: 62 }` (Werte aus `psd-geometry.json`), `uiFamily = 'BBZB UI'`.
  - `createRegistry<T extends { id: string }>(kind: string): { register(item: T): void; get(id: string): T; has(id: string): boolean; all(): T[] }`. `register` wirft bei doppelter ID, `get` wirft bei unbekannter ID (Meldung enthält `kind` und `id`).
  - `core/types.ts`: `FormatPreset { id: string; label: string; width: number; height: number }`. `ElementType`, `Exporter`, `EditorContext` (Signaturen siehe Task 9 und 13; hier schon deklarieren).
  - `core/registries.ts`: `formats`, `elementTypes`, `exporters`.
  - `plugins/index.ts`: `registerPlugins(): void` (idempotent). Formate: `{ id: 'post', label: 'Post 4:5', width: 1080, height: 1350 }`, `{ id: 'story', label: 'Story 9:16', width: 1080, height: 1920 }`.

- [ ] **Step 1: Tests schreiben.**

```ts
// src/core/registry.test.ts
it('wirft bei doppelter und unbekannter ID', () => {
  const r = createRegistry<{ id: string }>('Format');
  r.register({ id: 'post' });
  expect(() => r.register({ id: 'post' })).toThrow(/Format.*post/);
  expect(() => r.get('x')).toThrow(/Format.*x/);
});

// src/tokens.test.ts: Tokens stimmen mit der PSD überein
const psd = JSON.parse(readFileSync('docs/reference/psd-geometry.json', 'utf8'));
it('Farben und Rand wie PSD', () => {
  expect(colors).toEqual(psd.tokens.colors);
  expect(margin).toBe(psd.tokens.margin);
});

// src/test/architecture.test.ts (fs.globSync über src/**/*.{ts,tsx}, ohne *.test.*)
it('Hex-Farben nur in tokens.ts', ...)          // /#[0-9a-fA-F]{6}\b/ ausser src/tokens.ts
it('nur main.tsx importiert aus plugins/', ...) // /from ['"].*plugins\// ausserhalb src/plugins und src/main.tsx
it('keine Datei hat 400 Zeilen oder mehr', ...)
it('kein «ß» und kein «–» im Quelltext', ...)
```

- [ ] **Step 2:** `npm test` → FAIL (Module fehlen).
- [ ] **Step 3: Implementieren.** `main.tsx` setzt für jede Farbe `document.documentElement.style.setProperty('--' + name, hex)`; `app.css` nutzt nur `var(--blau)` usw.
- [ ] **Step 4:** `npm test` → PASS, dazu typecheck/lint.
- [ ] **Step 5: Commit** `Add design tokens, registries, format presets, architecture guard tests`.

---

### Task 3: Dokumenttypen, Geometrie, Ausschnitt-Mathematik

**Files:**
- Create: `src/model/types.ts`, `src/model/geometry.ts`, `src/model/crop.ts`, `src/model/geometry.test.ts`, `src/model/crop.test.ts`

**Interfaces:**
- Produces:

```ts
export interface Rect { x: number; y: number; width: number; height: number }
export interface Slide { id: string; background: ColorToken }
export interface Element<P = unknown> {
  id: string; type: string; name: string;
  x: number; y: number; width: number; height: number; // globale Koordinaten, x/y = linke obere Ecke vor Drehung
  rotation: number;                                     // Grad, Drehpunkt (x, y) wie Konva-Standard
  opacity: number; visible: boolean; locked: boolean;
  props: P;
}
export interface AssetMeta { mime: string; width: number; height: number; name: string }
export interface Project {
  schemaVersion: 1; id: string; name: string;
  format: { id: string; width: number; height: number }; // Masse eingefroren, unabhängig von der Registry
  createdAt: number; updatedAt: number;
  slides: Slide[]; elements: Record<string, Element>; order: string[]; // order: unten → oben
  assets: Record<string, AssetMeta>;                                  // Schlüssel = SHA-256-Hex
}
export interface Crop { x: number; y: number; scale: number } // Bildinhalt relativ zum Rahmen
```

  - `elementCenter(el): { x: number; y: number }` (Drehung um `(x, y)` berücksichtigt)
  - `elementBounds(el): Rect` (achsenparallele Hülle des gedrehten Rechtecks)
  - `slideRect(p: Project, index: number): Rect` → `{ x: index × W, y: 0, width: W, height: H }`
  - `slideIndexOf(p: Project, el: Element): number` → `floor(center.x / W)`, auf `[0, slides.length − 1]` begrenzt
  - `elementsOnSlide(p: Project, index: number): string[]` → IDs in `order`-Reihenfolge, deren Hülle die Slide mit positiver Fläche schneidet (auch hineinragende)
  - `coverCrop(frame: {width,height}, img: {width,height}): Crop` → kleinste deckende Skalierung, zentriert
  - `clampCrop(frame, img, crop): Crop` → `scale ≥ cover`, `x ∈ [frame.width − img.width·scale, 0]`, analog `y`

- [ ] **Step 1: Tests schreiben** (Projekt-Fixture: Post, 3 Slides, W = 1080).

```ts
it('Mittelpunkt mit Drehung 90°', () => {
  expect(elementCenter(el({ x: 0, y: 0, width: 200, height: 100, rotation: 90 }))).toEqual({ x: -50, y: 100 });
});
it('Element über der Naht gehört zur Slide seines Mittelpunkts', () => {
  expect(slideIndexOf(p, el({ x: 700, width: 600 }))).toBe(0); // Mitte 1000
  expect(slideIndexOf(p, el({ x: 900, width: 600 }))).toBe(1); // Mitte 1200
  expect(slideIndexOf(p, el({ x: 5000, width: 10 }))).toBe(2); // ausserhalb → letzte
});
it('hineinragende Elemente zählen zur Slide', () => {
  // a liegt auf 0 und ragt in 1, b nur auf 2
  expect(elementsOnSlide(p, 1)).toEqual(['a']);
});
it('Kante an Kante zählt nicht', () => {
  expect(elementsOnSlide(p, 1)).not.toContain('bisNaht'); // x 0..1080
});
it('coverCrop füllt Querformat-Rahmen mit Hochformat-Bild', () => {
  expect(coverCrop({ width: 2160, height: 1350 }, { width: 3000, height: 4000 }))
    .toEqual({ x: 0, y: -(4000 * 0.72 - 1350) / 2, scale: 0.72 });
});
it('clampCrop verhindert Lücken und Unterskalierung', () => {
  const c = clampCrop({ width: 100, height: 100 }, { width: 200, height: 100 }, { x: 50, y: -10, scale: 0.5 });
  expect(c).toEqual({ x: 0, y: 0, scale: 1 });
});
```

- [ ] **Step 2:** `npx vitest run src/model` → FAIL.
- [ ] **Step 3: Implementieren.**
- [ ] **Step 4:** PASS.
- [ ] **Step 5: Commit** `Add document types, slide geometry and crop math`.

---

### Task 4: Slide- und Element-Operationen

**Files:**
- Create: `src/model/slides.ts`, `src/model/elements.ts`, `src/model/slides.test.ts`, `src/model/elements.test.ts`

**Interfaces:**
- Consumes: Task 3 (`slideIndexOf`, Typen).
- Produces (alle mutieren `p` und sind für immer-Drafts gedacht; Tests wrappen mit `produce`):
  - `createProject(opts: { name: string; format: FormatPreset; now?: number }): Project` → eine Slide, Hintergrund `warmweiss`, `id = crypto.randomUUID()`.
  - `export const MAX_SLIDES = 20`
  - `addSlide(p, at: number): string` → neue Slide (warmweiss) bei Index `at`; Elemente mit `slideIndexOf ≥ at` wandern um `+W`. Wirft `ModelError('Instagram erlaubt höchstens 20 Slides.')` ab 20.
  - `duplicateSlide(p, index): string` → Kopie bei `index + 1` mit Kopien aller Elemente, deren Mittelpunkt auf `index` liegt (neue IDs, direkt über den Originalen in `order`), Grenze wie oben.
  - `removeSlide(p, index): void` → entfernt Slide und Elemente mit Mittelpunkt darauf; spätere Elemente `−W`. Wirft `ModelError('Ein Projekt braucht mindestens eine Slide.')` bei der letzten.
  - `moveSlide(p, from, to): void` → jedes Element wandert mit der Slide seines Mittelpunkts (`x += (neuerIndex − alterIndex) × W`).
  - `addElement(p, el: Element, aboveId?: string): void` (sonst ganz oben)
  - `updateElement(p, id, patch: Partial<Omit<Element, 'id' | 'type'>>): void`
  - `removeElement(p, id): void`
  - `duplicateElement(p, id): string` → Versatz `+40/+40`, direkt darüber, Name `«<Name> Kopie»`
  - `moveInOrder(p, id, toIndex: number): void` (Index in `order`)
  - `nextName(p, label: string): string` → «Foto 1», «Foto 2» …
  - `class ModelError extends Error`

- [ ] **Step 1: Tests schreiben.**

```ts
it('moveSlide nimmt nahtübergreifendes Element mit seiner Mittelpunkt-Slide mit', () => {
  // Slides A,B,C; e: x 700 w 600 (Mitte auf A), f: x 2200 (auf C)
  const r = produce(p, d => moveSlide(d, 0, 2));
  expect(r.slides.map(s => s.id)).toEqual(['B', 'C', 'A']);
  expect(r.elements.e.x).toBe(700 + 2160);
  expect(r.elements.f.x).toBe(2200 - 1080);
});
it('removeSlide löscht Elemente der Slide und schiebt spätere nach links', ...);
it('removeSlide auf letzter Slide wirft', ...);
it('addSlide bei 20 Slides wirft ModelError', ...);
it('addSlide in der Mitte schiebt spätere Elemente um W nach rechts', ...);
it('duplicateSlide kopiert nur Elemente mit Mittelpunkt auf der Slide, mit neuen IDs', ...);
it('duplicateElement liegt direkt über dem Original', ...);
it('moveInOrder ordnet um, ohne IDs zu verlieren', ...);
it('nextName zählt pro Typ-Label hoch', ...);
```

- [ ] **Step 2:** FAIL. **Step 3:** implementieren. **Step 4:** PASS.
- [ ] **Step 5: Commit** `Add slide and element operations`.

---

### Task 5: Validierung und Projektdatei `.bbzbsocial`

**Files:**
- Create: `src/plugins/elements/photo/schema.ts`, `src/plugins/elements/text/schema.ts`, `src/model/parse.ts`, `src/model/parse.test.ts`, `src/projectFile/projectFile.ts`, `src/projectFile/projectFile.test.ts`

**Interfaces:**
- Produces:
  - `photoPropsSchema = z.object({ assetId: z.string().regex(/^[0-9a-f]{64}$/), crop: z.object({ x, y, scale: z.number().positive() }) })`, `type PhotoProps`.
  - `textPropsSchema = z.object({ text: z.string().max(2000), style: z.enum(['titel','kommentar']), color: z.enum([...ColorToken]), fontSize: z.number().min(8).max(600), align: z.enum(['left','center','right']) })`, `type TextProps`.
  - `parseProject(json: unknown, propsSchemaFor: (type: string) => z.ZodType | undefined): Project` wirft `ProjectFileError` mit deutscher Meldung. Prüft: `schemaVersion === 1`, 1 bis 20 Slides, jede ID in `order` existiert in `elements` und umgekehrt, bekannter Typ, gültige Props, jede `assetId` eines Fotos steht in `assets`.
  - `packProject(p: Project, readAsset: (id: string) => Promise<Blob>): Promise<Uint8Array>` → ZIP mit `project.json` (`{ schemaVersion: 1, project }`) und `assets/<id>`.
  - `unpackProject(bytes: Uint8Array, propsSchemaFor): Promise<{ project: Project; assets: Map<string, Uint8Array> }>` → neue Projekt-ID, prüft jede Asset-ID gegen den SHA-256 des Inhalts.
  - `sha256Hex(data: Uint8Array | Blob): Promise<string>` (in `projectFile.ts` exportiert, auch für den Import in Task 9).
  - `class ProjectFileError extends Error`

- [ ] **Step 1: Tests schreiben.**

```ts
it('Roundtrip: packen und entpacken ergibt dasselbe Projekt mit neuer ID', ...);
it.each([
  ['kein ZIP', new Uint8Array([1, 2, 3]), 'Diese Datei ist keine BBZB-Projektdatei.'],
  ['neuere Schema-Version', zipWith({ schemaVersion: 2 }), 'Diese Projektdatei stammt aus einer neueren Version der App.'],
  ['Asset fehlt', zipWithoutAsset, 'In der Projektdatei fehlt ein Bild.'],
  ['Asset verändert', zipWithTamperedAsset, 'Ein Bild in der Projektdatei ist beschädigt.'],
  ['unbekannter Element-Typ', zipWithType('video'), 'Die Projektdatei enthält einen unbekannten Inhalt.'],
  ['order passt nicht zu elements', zipWithBrokenOrder, 'Die Projektdatei ist beschädigt.'],
])('%s → ProjectFileError', async (_n, bytes, msg) => {
  await expect(unpackProject(bytes, lookup)).rejects.toThrow(msg);
});
```

- [ ] **Step 2:** FAIL. **Step 3:** implementieren (`fflate.unzipSync` in try/catch → «keine BBZB-Projektdatei»). **Step 4:** PASS.
- [ ] **Step 5: Commit** `Add project validation and .bbzbsocial pack/unpack`.

---

### Task 6: Speicher: Projekte, Assets, Aufräumen

**Files:**
- Create: `src/storage/db.ts`, `src/storage/assets.ts`, `src/storage/gc.ts`, `src/storage/storage.test.ts`

**Interfaces:**
- Consumes: `Project`, `sha256Hex`.
- Produces:
  - `interface ProjectSummary { id: string; name: string; formatId: string; updatedAt: number }`
  - `saveProject(p: Project): Promise<void>`, `loadProject(id): Promise<Project | undefined>`, `listProjects(): Promise<ProjectSummary[]>` (neueste zuerst), `deleteProject(id): Promise<void>`. Dexie-DB `bbzb-social-studio`, Tabelle `projects: '&id, updatedAt'`, Zeile `{ id, name, formatId, updatedAt, data: Project }`.
  - `interface AssetStore { put(blob: Blob): Promise<string>; get(id: string): Promise<Blob>; delete(id: string): Promise<void>; list(): Promise<string[]> }`. `put` liefert `sha256Hex`, schreibt nicht doppelt.
  - `opfsAssetStore(): AssetStore` (Ordner `assets` in `navigator.storage.getDirectory()`, schreibt über `createWritable()`; darauf stützt sich der «Speicher voll»-Test in Task 9), `memoryAssetStore(): AssetStore` (Tests).
  - `collectGarbage(store: AssetStore): Promise<number>` löscht Assets, die kein gespeichertes Projekt in `assets` führt; Rückgabe = Anzahl.
  - `class StorageFullError extends Error` (Meldung «Speicher voll. Sichere ältere Projekte als Datei und lösche sie hier.»); `put` übersetzt `QuotaExceededError` darin.

- [ ] **Step 1: Tests** (`import 'fake-indexeddb/auto'`):

```ts
it('listProjects sortiert nach updatedAt absteigend', ...);
it('put ist idempotent und liefert den Hash', ...);
it('collectGarbage behält Assets, die noch ein Projekt nutzt', async () => {
  // Projekt A nutzt h1, Projekt B nutzt h1 und h2; B löschen → nur h2 weg
  expect(await collectGarbage(store)).toBe(1);
  expect(await store.list()).toEqual([h1]);
});
it('QuotaExceededError wird zu StorageFullError', ...);
```

- [ ] **Step 2:** FAIL. **Step 3:** implementieren. **Step 4:** PASS.
- [ ] **Step 5: Commit** `Add Dexie project store, OPFS asset store, asset GC`.

---

### Task 7: Dokument-Store mit Undo, UI-Store, Autosave

**Files:**
- Create: `src/store/document.ts`, `src/store/ui.ts`, `src/storage/autosave.ts`, `src/store/document.test.ts`, `src/storage/autosave.test.ts`

**Interfaces:**
- Consumes: Model-Operationen, `saveProject`.
- Produces:
  - `useDoc` (zustand + immer + zundo `temporal`, `partialize: s => ({ project: s.project })`, `limit: 100`) mit State `{ project: Project | null }` und Aktionen:
    - `load(p: Project | null): void` → setzt Projekt, leert History.
    - `apply(recipe: (draft: Project) => void): void` → ein History-Schritt, setzt `updatedAt = Date.now()`. Wirft `ModelError` des Rezepts weiter, Zustand bleibt dann unverändert.
    - `startGesture(): void` / `endGesture(): void` → Änderungen dazwischen ergeben genau einen Undo-Schritt (beim Start pausieren und Snapshot merken, beim Ende fortsetzen und Snapshot als einen Eintrag in `pastStates` legen, `futureStates` leeren). Ohne Änderung kein Eintrag.
    - `undo()`, `redo()`, `canUndo`, `canRedo` (aus `useDoc.temporal`).
  - `useUi` (zustand, `persist` nur für `mode`, Key `bbzb.ui`): `{ mode: 'einfach' | 'profi'; selectedId: string | null; currentSlide: number; cropEditId: string | null; textEditId: string | null; notice: { kind: 'error' | 'info'; text: string } | null }` plus Setter.
  - `startAutosave(): () => void` → abonniert `useDoc`, speichert 500 ms nach der letzten Änderung, bei `pagehide` und `visibilitychange → hidden` sofort. Rückgabe = Abmelden.

- [ ] **Step 1: Tests schreiben.**

```ts
it('apply = ein Undo-Schritt, Auswahl nicht in History', ...);
it('Geste mit drei apply = ein Undo-Schritt zurück auf den Stand vor der Geste', () => {
  startGesture(); apply(d => { d.name = 'a'; }); apply(d => { d.name = 'b'; }); apply(d => { d.name = 'c'; }); endGesture();
  undo();
  expect(useDoc.getState().project!.name).toBe('Start');
});
it('apply mit ModelError lässt Projekt und History unverändert', ...);
it('load leert die History', ...);
it('Autosave speichert nach 500 ms einmal', /* vi.useFakeTimers, fake-indexeddb */ ...);
it('Autosave speichert bei pagehide sofort', ...); // Review Focus 2
```

- [ ] **Step 2:** FAIL. **Step 3:** implementieren. **Step 4:** PASS.
- [ ] **Step 5: Commit** `Add document store with gesture undo, UI store, autosave`.

---

### Task 8: Schriften, Startseite, Projektliste, Import

**Files:**
- Create: `src/fonts.ts`, `src/ui/StartPage.tsx`, `src/ui/EditorPage.tsx` (vorerst nur Kopfzeile + leerer Bereich), `src/ui/Header.tsx`, `src/ui/Notice.tsx`, `e2e/fixtures.ts`, `e2e/project.spec.ts`
- Modify: `src/ui/App.tsx`, `src/main.tsx`, `src/ui/app.css`

**Interfaces:**
- Consumes: Tasks 5 bis 7.
- Produces:
  - `loadBrandFonts(): Promise<{ missing: string[] }>` → `FontFace` je Schrift (`BBZB Titel` = `brand/fonts/seguibl.ttf`, `BBZB Kommentar` = `Braveold-Light.otf`, `BBZB UI` = `segoeui.ttf` und `segoeuib.ttf` mit `weight: 700`), URLs per `import url from '../brand/fonts/…?url'`, `document.fonts.add`. `missing` enthält lesbare Namen («Segoe UI Black», «Braveold Light»). Familiennamen aus `tokens.ts`.
  - `useFonts()`-Status in `useUi`: `missingFonts: string[]`, `fontsReady: boolean`.
  - `e2e/fixtures.ts`: `gradientPng(width, height): Buffer` (waagrechter Verlauf orange→blau via pngjs), `bbzbsocial(project, assets): Buffer`, `newProject(page, format: 'Post 4:5' | 'Story 9:16')`.
- UI (Deutsch, Du-Form):
  - Startseite: Überschrift «BBZB Social Studio», Bereich «Neues Projekt» mit Buttons «Post 4:5» und «Story 9:16» (legt «Projekt TT.MM.JJJJ» an, öffnet Editor), Button «Projektdatei öffnen» (`input[type=file][accept=".bbzbsocial"]`), Liste «Deine Projekte» (Name, Format, «zuletzt bearbeitet» `de-CH`), je «Öffnen» und «Löschen» (Bestätigung in `<dialog>`: «‹Name› löschen? Das kann man nicht rückgängig machen.», danach `collectGarbage`). Leerer Zustand: «Noch keine Projekte.»
  - Editor-Kopfzeile: «Übersicht» (zurück), Projektname als Eingabefeld (Commit bei Blur/Enter), Platzhalter für weitere Buttons.
  - `main.tsx`: `registerPlugins()`, `navigator.storage?.persist?.()`, `loadBrandFonts()`, `startAutosave()`.
  - Fehlende Schrift: dauerhaftes Banner im Editor «Schrift ‹…› fehlt. Export ist gesperrt. Lade die Seite neu.» (`role="alert"`).
- Gestaltung: Vor dem ersten UI-Code `/impeccable` mit dem Auftrag «Editor-Chrome für BBZB Social Studio: schlicht, eckig, Warmweiss-Fläche, Blauschwarz-Text, Orange nur für Primäraktion und Fokus, Segoe UI; darf nicht mit den Slides konkurrieren» aufrufen und das Ergebnis als Grundlage für `app.css` nehmen. Fokus sichtbar, alle Bedienelemente per Tastatur erreichbar, `aria-label` an Icon-Buttons.

- [ ] **Step 1: E2E-Tests schreiben** (`e2e/project.spec.ts`):

```ts
test('neues Projekt überlebt Neuladen, auch direkt nach Umbenennen', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Post 4:5' }).click();
  await page.getByLabel('Projektname').fill('Sporttag');
  await page.getByLabel('Projektname').press('Enter');
  await page.reload();                                          // Review Focus 2: kein Warten auf Debounce
  await expect(page.getByRole('listitem').filter({ hasText: 'Sporttag' })).toBeVisible();
});
test('Löschen fragt nach und entfernt das Projekt', ...);
test('kaputte Projektdatei zeigt Meldung, Liste bleibt gleich', async ({ page }) => {
  // vorher ein Projekt anlegen, dann Buffer.from('kaputt') als .bbzbsocial wählen
  await expect(page.getByRole('alert')).toHaveText('Diese Datei ist keine BBZB-Projektdatei.');
  await expect(page.getByRole('listitem')).toHaveCount(1);       // Review Focus 3
});
test('gültige Projektdatei wird als neues Projekt importiert', ...); // fixtures.bbzbsocial mit gradientPng
test('Schriften sind geladen', async ({ page }) => {
  await page.goto('/');
  expect(await page.evaluate(() => document.fonts.check('150px "BBZB Titel"'))).toBe(true);
  expect(await page.evaluate(() => document.fonts.check('62px "BBZB Kommentar"'))).toBe(true);
});
```

- [ ] **Step 2:** `npm run test:e2e` → FAIL.
- [ ] **Step 3: Implementieren.**
- [ ] **Step 4:** PASS. Zusätzlich: Font-Datei in `vite preview` absichtlich umbenennen, Banner prüfen, zurückbenennen. **In Edge anschauen** (Screenshot Startseite und leerer Editor).
- [ ] **Step 5: Commit** `Add start page, project list, project file import, brand font loading`.

---

### Task 9: Leinwand, Foto-Element, Auswahl, Ausschnitt

**Files:**
- Create: `src/canvas/images.ts`, `src/canvas/CanvasView.tsx`, `src/canvas/Scene.tsx`, `src/canvas/SelectionLayer.tsx`, `src/plugins/elements/photo/index.tsx`, `PhotoNode.tsx`, `PhotoInspector.tsx`, `importImage.ts`, `src/ui/Inspector.tsx` (Grundgerüst), `e2e/editor.spec.ts`
- Modify: `src/core/types.ts`, `src/plugins/index.ts`, `src/ui/EditorPage.tsx`

**Interfaces:**
- Consumes: `useDoc.apply`, `startGesture/endGesture`, `AssetStore`, `coverCrop/clampCrop`, `slideRect`, `addElement`, `nextName`.
- Produces:

```ts
// core/types.ts
export interface EditorContext {
  project: Project; currentSlide: number;
  apply(recipe: (d: Project) => void): void;
  assets: AssetStore;
  select(id: string | null): void;
  notify(kind: 'error' | 'info', text: string): void;
}
export interface ElementRenderProps<P> { el: Element<P>; editing: boolean } // editing = Ausschnitt- bzw. Textmodus
export interface ElementType<P = unknown> {
  id: string; label: string;
  propsSchema: z.ZodType<P>;
  timeBased: boolean;                               // Phase 3 (Video)
  Render: ComponentType<ElementRenderProps<P>>;     // Konva-Gruppe mit id = el.id, draggable wenn !locked
  Inspector?: ComponentType<{ el: Element<P> }>;
  anchors: string[];                                // Konva Transformer enabledAnchors
  afterTransform(el: Element<P>, box: { x: number; y: number; width: number; height: number; rotation: number }): Partial<Element<P>>;
  add?: { label: string; run(ctx: EditorContext): Promise<void> | void };
  acceptsFile?(file: File): boolean;
  fromFile?(file: File, ctx: EditorContext): Promise<void>;
}
```

  - `images.ts`: `loadAssetImage(id: string): Promise<HTMLImageElement>` (Cache, `URL.createObjectURL`; `// shortcut: Object-URLs werden nie freigegeben, aufräumen falls Speicher bei langen Sitzungen knapp wird`), `useAssetImage(id): HTMLImageElement | undefined`, `allImagesLoaded(): Promise<void>`.
  - `importImage(file: File): Promise<{ blob: Blob; width: number; height: number; mime: string }>` → `createImageBitmap(file)` (EXIF-Drehung), längste Kante > 4096 → auf 4096 verkleinern (`OffscreenCanvas`, JPEG 0.92; PNG bleibt PNG). Dekodierfehler → `ImportError('Dieses Bild kann Edge nicht öffnen. Schick es als JPEG, auf dem iPhone unter Einstellungen › Kamera › Formate «Maximale Kompatibilität» wählen.')`.
  - Foto `fromFile`: `importImage` → `assets.put` → erst danach **ein** `apply` (Asset-Meta + Element: Rahmen = `slideRect(currentSlide)`, `crop = coverCrop`). Fehler (`ImportError`, `StorageFullError`) → `notify('error', message)`, kein `apply`.
  - Foto `afterTransform`: neue Grösse übernehmen, `crop = clampCrop(...)` mit bisheriger Skalierung.
  - `CanvasView`: Konva-`Stage` in Containergrösse; Massstab = (Höhe − 48 px Rand) / `format.height`; waagrechtes Scrollen über einen nativen Scroll-Container mit Platzhalter der Breite `slides × W × Massstab`, `stage.x = −scrollLeft` (keine Riesen-Canvas). Ebene 1 `Scene` (Name `content`), Ebene 2 `SelectionLayer` (Transformer, Nahtlinien als gestrichelte Linien `listening: false`), nie exportiert. Klick auf Leere → Auswahl aufheben und `currentSlide` = Slide unter dem Zeiger. Datei-Drop und Button «Foto hinzufügen» (aus `elementTypes.all()`, keine direkte Foto-Referenz).
  - Ziehen: Konva bewegt den Knoten selbst, `onDragEnd` → ein `apply`. Gesperrte Elemente: `listening: false`. Ausgeblendete: nicht gerendert.
  - Ausschnitt: Doppelklick → `cropEditId`; Bild innerhalb des Clips ziehbar (`dragBoundFunc` mit `clampCrop`), Mausrad zoomt um den Zeiger (Geste: `startGesture` beim ersten Rad-Event, `endGesture` 300 ms nach dem letzten); `Escape` oder Klick daneben beendet. Inspector-Button «Ausschnitt bearbeiten» macht dasselbe.

- [ ] **Step 1: E2E-Tests schreiben.**

```ts
test('Foto per Dateiauswahl füllt die aktuelle Slide', async ({ page }) => {
  await newProject(page, 'Post 4:5');
  await page.getByRole('button', { name: 'Foto hinzufügen' }).click(); // filechooser mit gradientPng(3000, 2000)
  await expect.poll(() => page.evaluate(() => window.__bbzbTest.elements()))
    .toMatchObject([{ type: 'photo', x: 0, y: 0, width: 1080, height: 1350 }]);
});
test('48-MP-Foto wird auf 4096 px verkleinert', ...);         // gradientPng(8000, 6000) → assets[*].width 4096; Review Focus 1
test('nicht lesbare Datei zeigt Meldung', ...);              // Buffer 'ftypheic…' als foto.heic → alert-Text von ImportError
test('Speicher voll: Meldung, kein Element', ...);           // page.addInitScript: FileSystemWritableFileStream.prototype.write wirft QuotaExceededError; Review Focus 4
test('Ziehen ergibt einen Undo-Schritt', ...);               // mouse.down/move×10/up, dann Ctrl+Z → x wieder 0
```

  `window.__bbzbTest` existiert nur bei `import.meta.env.MODE === 'test'` und liefert `elements()` und `project()`. Der Playwright-`webServer` baut dafür mit `vite build --mode test`; der Deploy-Build (`production`) enthält den Hook nicht.

- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Implementieren.**
- [ ] **Step 4:** PASS. **In Edge anschauen:** Foto ziehen, über die Naht schieben, skalieren, drehen, Ausschnitt verschieben. Screenshot.
- [ ] **Step 5: Commit** `Add canvas, photo element, selection, crop editing`.

---

### Task 10: Text-Element

**Files:**
- Create: `src/plugins/elements/text/index.tsx`, `TextNode.tsx`, `TextInspector.tsx`, `measure.ts`, `src/canvas/TextEditOverlay.tsx`, `src/ui/Swatches.tsx`
- Modify: `src/plugins/index.ts`, `e2e/editor.spec.ts`

**Interfaces:**
- Consumes: `ElementType`, `textStyles`, `colors`.
- Produces:
  - `measureTextHeight(props: TextProps, width: number): number` (via `new Konva.Text`, nach Schriftladen).
  - Text `add.run`: Titel-Stil, Text «Titel», Farbe `warmweiss`, `x = slideX + margin`, `y = margin`, `width = W − 2 × margin`, Grösse `textStyles.titel.defaultSize`, Höhe gemessen.
  - Render: `Konva.Text` mit `fontFamily = textStyles[style].family`, `letterSpacing = letterSpacingEm × fontSize`, `lineHeight`, `align`, `wrap: 'word'`.
  - `anchors: ['middle-left', 'middle-right']`; `afterTransform` übernimmt Breite und misst Höhe neu (Schriftgrösse ändert sich nur im Inspector).
  - Doppelklick → `textEditId`, `TextEditOverlay` legt eine `textarea` deckungsgleich über den Text (gleiche Schrift, Grösse × Massstab, Laufweite, Drehung); Commit bei Blur oder `Ctrl+Enter` als ein `apply`, `Escape` verwirft. Leerer Text beim Commit → Element löschen.
  - `Swatches`: Radiogruppe der vier Token-Farben mit `aria-label` = deutscher Farbname («Blau», «Orange», «Warmweiss», «Blauschwarz»). Wird in Task 11 für den Slide-Hintergrund wiederverwendet.
  - Inspector: Stil (Titel/Kommentar), Farbe (`Swatches`), Grösse (Zahlenfeld + Regler, Regler als Geste), Ausrichtung (links/Mitte/rechts).

- [ ] **Step 1: E2E-Tests ergänzen.**

```ts
test('Text hinzufügen, auf der Leinwand bearbeiten, Undo', async ({ page }) => {
  await page.getByRole('button', { name: 'Text hinzufügen' }).click();
  await page.mouse.dblclick(/* Textmitte aus __bbzbTest */);
  await page.keyboard.press('Control+A'); await page.keyboard.type('Sporttag 2026');
  await page.mouse.click(5, 5);                                      // Blur
  await expect.poll(textOf).toBe('Sporttag 2026');
  await page.keyboard.press('Control+Z');
  await expect.poll(textOf).toBe('Titel');
});
test('Stil Kommentar und Farbe Orange wirken', ...);
test('Grössenregler erzeugt einen Undo-Schritt', ...);
```

- [ ] **Step 2:** FAIL. **Step 3:** implementieren. **Step 4:** PASS. **In Edge anschauen:** Titel mehrzeilig, Zeilenabstand dicht (0.86), Kommentar in Braveold; Zeilenumbrüche im Editor und in der Textarea gleich. Screenshot.
- [ ] **Step 5: Commit** `Add text element with inline editing`.

---

### Task 11: Slide-Leiste, Inspector-Grundfunktionen, Tastenkürzel, Modus

**Files:**
- Create: `src/ui/SlideBar.tsx`, `src/ui/shortcuts.ts`
- Modify: `src/ui/Inspector.tsx`, `src/ui/Header.tsx`, `src/ui/EditorPage.tsx`, `e2e/editor.spec.ts`

**Interfaces:**
- Consumes: `addSlide`, `duplicateSlide`, `removeSlide`, `moveSlide`, `duplicateElement`, `removeElement`, `moveInOrder`, `updateElement`, `Swatches`, `ModelError`.
- Produces:
  - Slide-Leiste unter der Leinwand: nummerierte Kacheln (Hintergrundfarbe), aktuelle hervorgehoben, Klick scrollt hin und setzt `currentSlide`. Umsortieren per HTML5-Drag-and-drop **und** per Tastatur (`Alt+←/→` auf der fokussierten Kachel). Buttons «Slide hinzufügen» (nach der aktuellen), «Duplizieren», «Löschen» (bei 1 Slide deaktiviert). Bei 20 Slides sind Hinzufügen/Duplizieren deaktiviert, `title` «Instagram erlaubt höchstens 20 Slides.».
  - Inspector ohne Auswahl: «Slide N», Hintergrund (`Swatches`).
  - Inspector mit Auswahl, beide Modi: typ-spezifisches Panel, «Duplizieren», «Nach vorne», «Nach hinten», «Löschen». Nur Profi: Deckkraft (Regler, Geste), X/Y/Breite/Höhe/Drehung (Zahlenfelder), «Sperren», «Ausblenden».
  - Kopfzeile: Undo/Redo-Buttons («Rückgängig», «Wiederholen»), Schalter «Profi» (`role="switch"`, gespeichert in `useUi.mode`).
  - `installShortcuts(): () => void`: `Ctrl+Z`, `Ctrl+Shift+Z`, `Ctrl+Y`, `Delete`/`Backspace` (Auswahl löschen), `Ctrl+D` (duplizieren), `Escape` (Modi beenden, Auswahl aufheben). Ignoriert Ereignisse aus `input`, `textarea`, `[contenteditable]`.

- [ ] **Step 1: E2E-Tests ergänzen.**

```ts
test('Slide umsortieren nimmt nahtübergreifendes Foto mit', ...); // Foto auf Slide 1 über Naht, Slide 1 ans Ende ziehen → x += 2 × 1080
test('21. Slide geht nicht', ...);                                // 19× hinzufügen → Button disabled, 20 Kacheln
test('letzte Slide lässt sich nicht löschen', ...);
test('Delete und Ctrl+Z', ...);
test('Profi-Schalter bleibt nach Neuladen an und zeigt Deckkraft', ...);
test('Einfach-Modus zeigt keine Deckkraft und keine Positionsfelder', ...);
```

- [ ] **Step 2:** FAIL. **Step 3:** implementieren. **Step 4:** PASS. **In Edge anschauen.**
- [ ] **Step 5: Commit** `Add slide bar, inspector actions, shortcuts, simple/pro mode`.

---

### Task 12: Ebenen-Panel (Profi)

**Files:**
- Create: `src/ui/LayersPanel.tsx`
- Modify: `src/ui/EditorPage.tsx`, `e2e/editor.spec.ts`

**Interfaces:**
- Consumes: `elementsOnSlide`, `moveInOrder`, `updateElement`, `useUi`.
- Produces: Panel «Ebenen» nur im Profi-Modus. Zeigt `elementsOnSlide(currentSlide)` von oben nach unten. Zeile: Name (Klick wählt aus, Doppelklick → Eingabefeld, Enter speichert, Escape verwirft, leerer Name wird verworfen), Auge (`aria-pressed`, «Ausblenden»/«Einblenden»), Schloss («Sperren»/«Entsperren»). Umordnen per Drag (Ziel = Position eines anderen Elements in `order`, Umrechnung von Listenindex auf `order`-Index) und per Tastatur (`Alt+↑/↓`). Gesperrte und ausgeblendete Elemente sind nur hier auswählbar.

- [ ] **Step 1: E2E-Tests:** Umbenennen per Doppelklick, Ausblenden entfernt das Element aus `content`-Ebene, Ziehen ändert `order`, Element von Nachbar-Slide, das hineinragt, erscheint in der Liste.
- [ ] **Step 2:** FAIL. **Step 3:** implementieren. **Step 4:** PASS. **In Edge anschauen.**
- [ ] **Step 5: Commit** `Add layers panel for pro mode`.

---

### Task 13: Export (JPEG/PNG-ZIP), Projektdatei sichern, Nahttest

**Files:**
- Create: `src/plugins/exporters/raster.ts`, `src/export/fileName.ts`, `src/export/fileName.test.ts`, `src/export/exportZip.ts`, `src/ui/ExportDialog.tsx`, `e2e/export.spec.ts`
- Modify: `src/plugins/index.ts`, `src/ui/Header.tsx`

**Interfaces:**
- Consumes: Konva-Ebene `content` (über `stage.findOne('.content')`), `allImagesLoaded`, `packProject`, `useUi.missingFonts`.
- Produces:
  - `Exporter { id: string; label: string; extension: string; encode(canvas: HTMLCanvasElement): Promise<Blob> }`; registriert `{ id: 'jpeg', label: 'JPEG', extension: 'jpg' }` (`toBlob('image/jpeg', 0.92)`) und `{ id: 'png', label: 'PNG', extension: 'png' }`.
  - `safeFileName(name: string): string` → NFD, Diakritika weg, `ä→ae ö→oe ü→ue` vorher, alles ausser `[A-Za-z0-9 _-]` → `-`, Mehrfach-`-` zusammenfassen, trimmen, leer → `bbzb-social`, max. 60 Zeichen.
  - `renderSlide(content: Konva.Layer, p: Project, index: number): HTMLCanvasElement` → Offscreen-`Konva.Stage` (`width = W`, `height = H`), `content.clone({ x: −index × W, y: 0, scaleX: 1, scaleY: 1 })`, `toCanvas({ pixelRatio: 1 })`; prüft `canvas.width === W && canvas.height === H`, sonst Fehler. Stage danach `destroy()`.
  - `exportZip(content, p, exporter): Promise<Blob>` → wartet `document.fonts.ready` und `allImagesLoaded()`, wirft `ExportError('Schrift ‹…› fehlt. Export abgebrochen. Lade die Seite neu.')` wenn Schriften fehlen; Dateien `<safeFileName>_01.jpg` … (zweistellig), `fflate.zipSync` mit `level: 0` (Bilder sind schon komprimiert).
  - Export-Dialog («Exportieren» in der Kopfzeile): Liste der Slides mit Typ «Bild», Format JPEG (Standard) oder PNG, Button «ZIP herunterladen», Fortschritt «Slide 3 von 5». Bei fehlender Schrift ist der Button deaktiviert und die Meldung steht im Dialog.
  - Kopfzeile «Projektdatei sichern» → `packProject` → Download `<safeFileName>.bbzbsocial`.

- [ ] **Step 1: Unit-Test** `fileName.test.ts`:

```ts
it.each([
  ['Sporttag 2026', 'Sporttag 2026'],
  ['Bühne/Luzern: «Tag»', 'Buehne-Luzern-Tag'],   // Review Focus 5
  ['Café', 'Cafe'],
  ['  ...  ', 'bbzb-social'],
])('%s → %s', (i, o) => expect(safeFileName(i)).toBe(o));
```

- [ ] **Step 2: E2E-Tests** (`e2e/export.spec.ts`, ZIP mit `fflate.unzipSync` in Node, PNG mit pngjs):

```ts
test('Foto über die Naht: Slides schliessen lückenlos an', async ({ page }) => {
  // Fixture-Projekt per Import: 2 Slides, Hintergrund blauschwarz, Foto gradientPng(2160, 1350) mit Rahmen x 0 w 2160
  const files = await exportZip(page, 'PNG');
  expect(Object.keys(files)).toEqual(['Nahttest_01.png', 'Nahttest_02.png']);
  const [a, b] = files.map(PNG.sync.read);
  expect([a.width, a.height]).toEqual([1080, 1350]);
  for (let y = 0; y < 1350; y += 50) {
    const last = px(a, 1079, y), first = px(b, 0, y);
    expect(maxChannelDiff(last, first)).toBeLessThanOrEqual(3);     // Verlauf: Nachbarspalten fast gleich
    expect(last).not.toEqual(rgb(tokens.blauschwarz));               // kein Hintergrund in der Naht
  }
});
test('JPEG-Export: Namen, Grösse 1080 × 1350, keine Auswahlrahmen', ...); // ausgewähltes Element; Eckpixel ohne Transformer-Farbe
test('Story-Export ist 1080 × 1920', ...);
test('fehlende Schrift sperrt den Export', ...);  // page.route auf seguibl.ttf → 404, Button deaktiviert, Meldung sichtbar
test('Projektdatei sichern und wieder öffnen ergibt dieselben Elemente', ...);
```

- [ ] **Step 3:** FAIL. **Step 4:** implementieren. **Step 5:** PASS.
- [ ] **Step 6: Selbst prüfen:** In Edge ein Projekt mit Panorama-Foto und Titel exportieren, ZIP entpacken, Bilder öffnen und mit `docs/reference/layouts/Beispiel_03_Panorama_links.jpg` / `_04_` vergleichen (Schnitt an der Naht, Schärfe, Farben). Befund im Commit-Text oder PR notieren.
- [ ] **Step 7: Commit** `Add JPEG/PNG ZIP export, project file download, seam pixel test`.

---

### Task 14: Netzwerk-Test, Gesamtablauf, UI-Durchsicht

**Files:**
- Create: `e2e/network.spec.ts`
- Modify: UI-Dateien nach Befund

**Interfaces:**
- Consumes: alles.

- [ ] **Step 1: Netzwerk-Test schreiben.**

```ts
test('kompletter Ablauf ohne fremde Requests', async ({ page, baseURL }) => {
  const bad: string[] = [];
  page.on('request', r => {
    const u = new URL(r.url());
    if (u.protocol === 'blob:' || u.protocol === 'data:') return;
    if (u.origin !== new URL(baseURL!).origin || r.method() !== 'GET') bad.push(`${r.method()} ${r.url()}`);
  });
  // Projekt anlegen → Foto → Text → Slide hinzufügen → Ebenen → Export ZIP → Projektdatei sichern → Neuladen
  expect(bad).toEqual([]);
});
```

- [ ] **Step 2:** `npm run test:e2e` → PASS (sonst Ursache beheben, Test nicht lockern).
- [ ] **Step 3: UI-Durchsicht** mit `/impeccable critique` und `/impeccable audit` auf Startseite und Editor (Screenshots aus Edge). Befunde mit Gewicht «hoch» beheben, Rest als Liste im PR. Prüfpunkte: eckig, keine Farbe ausser den Tokens, Fokus sichtbar, Kontrast AA, Texte Du-Form und «ss».
- [ ] **Step 4:** Alle vier Prüfbefehle grün.
- [ ] **Step 5: Code-Review** mit `superpowers:requesting-code-review` bzw. `/ponytail-review` über den ganzen Branch, Befunde beheben.
- [ ] **Step 6: Commit** `Add network privacy test, polish editor UI`.

---

### Task 15: Deployment auf Cloudflare Pages hinter Access

**Files:**
- Modify: `package.json` (Skript `deploy`), `docs/deployment.md` (Stand nachführen)

**Interfaces:**
- Produces: `npm run deploy` = `npm run typecheck && npm run lint && npm test && npm run test:e2e && vite build && wrangler pages deploy dist --project-name bbzb-social-studio --branch main`.

- [ ] **Step 1: Voraussetzung (Alexej, manuell):** Cloudflare Access für `bbzb-social-studio.pages.dev` und `*.bbzb-social-studio.pages.dev` eingerichtet, Regel «Emails ending in `@sluz.ch`», One-time PIN (`docs/deployment.md`, Schritt 3). **Ohne Bestätigung von Alexej nicht deployen**, sonst sind Schriften öffentlich.
- [ ] **Step 2: Deploy** von einem Netz ausserhalb des Schulnetzes: `npm run deploy` → wrangler meldet die Deploy-URL.
- [ ] **Step 3: Prüfen.**
  - `curl -sI https://bbzb-social-studio.pages.dev/` → `302` auf `*.cloudflareaccess.com`.
  - `curl -sI https://bbzb-social-studio.pages.dev/assets/<seguibl-Hash>.ttf` → ebenfalls `302`, nie `200`.
  - Nach Login in Edge: Header `content-security-policy` mit `connect-src 'self'` vorhanden (DevTools → Netzwerk), Ablauf «Projekt → Foto → Export» funktioniert.
- [ ] **Step 4: Doku nachführen** (`docs/deployment.md`: Datum erstes Deploy, geprüfte Header).
- [ ] **Step 5: Commit** `Deploy phase 1 to Cloudflare Pages behind Access`.

---

## Bewusst nicht in Phase 1 (laut Spezifikation spätere Phasen)

Layout-Presets, Tags, Brand Library, Korn, BBZB-Look, Hilfslinien und Einrasten (Phase 2); Video und MP4 (Phase 3); Freistellen (Phase 4); Sicherheitszonen, Vorschaubilder in der Projektliste, Export direkt in einen Ordner, PWA (Phase 5). Foto-Spiegeln und Bildregler kommen mit dem BBZB-Look in Phase 2. Die Braveold-«st»-Ligatur wird in Phase 2 mit den Textstilen per Pixel-Test abgesichert; in Phase 1 setzt die Laufweite ≠ 0 bereits Einzelzeichen-Rendering voraus, ungeprüft.

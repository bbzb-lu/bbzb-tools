# Archiv: technische Restpunkte (Backlog)

Code-nahe Kleinigkeiten aus Phase 2b bis 2.5. Beim Planen der betroffenen Phase mit `grep` danach suchen, nicht vorab lesen.

**Auf einem Windows-Schulgerät von Hand prüfen (offen):** Checkliste in `docs/windows-checkliste.md`.

**Leinwand und Zoom**
- Fenstergrösse ändern bei Zoom ≠ 1 verschiebt die Ansicht.
- Schnelles Zoomen per Tastenwiederholung kann den Zoompunkt leicht verschieben.
- Textbearbeitung offen + Zoom: das Textfeld misst bei jedem Frame neu.
- Element ganz ausserhalb aller Slides ist kaum erreichbar.

**Fotos und Export**
- Scribble-PNGs nach dem Verkleinern auf 2048 px schlecht komprimiert (3.0 statt 1.1 MB): verlustfrei nachkomprimieren (oxipng/zopflipng).
- WebP/GIF mit Transparenz werden beim Import zu JPEG → WebP zu PNG.
- Export klont pro Slide die ganze Inhaltsebene; pausiert in einem Hintergrund-Tab.
- `safeFileName`: reservierte Windows-Namen (CON, NUL).
- `importImage` ohne Unit-Test; OPFS prüft «gültig» nur über die Dateigrösse.
- Effekte: Foto beim Ziehen eines Bildreglers weicher (Vorschau 540 px). Effekt-Canvas in Slide-Pixeln, über 100 % Zoom weicher. Fehlgeschlagener Effekt rechnet erst bei geänderter Eingabe neu. Textur wird einmal pro Sitzung auf dem Hauptthread normalisiert (Mac etwa 300 ms). Für Kontur und Schatten (Phase 4) braucht die Effekt-Canvas Rand.
- Markenbilder: Shift-Skalieren verzerrt die Vorschau bis zum Loslassen. Einfärben auf 1024 px begrenzt. Export wartet nach dem Einfärben zwei Frames. `fromAsset` prüft `naturalWidth` 0 nicht. Vorschauen der Bibliothek geben ihre Object-URLs nie frei.
- Effekte, Robustheit: Schlägt ein Effektschritt fehl, entfallen alle Effekte und der Export liefert das Rohfoto. Besser pro Schritt anwenden oder den Export bei einer Fehlermarke blockieren.
- Effekte, Start: Beim Öffnen starten alle Effekt-Canvas im selben rAF (451 bis 899 ms auf dem Mac bei 10 Look-Fotos). Pro Frame nur eine Komposition, auf Windows prüfen.
- Doppelter Code: Suche in `assetPacks` viermal (BrandNode, TagNode, grain.ts, libraryItem) und der Einfärb-Effekt zweimal. Zu `findBrandAsset` und `useTinted` zusammenführen.
- Schichtung: `canvas/CanvasView` importiert `ui/libraryItem`.
- Leistungszahlen (4× Drosselung, Export-Speicher) stammen vom Mac, auf einem Schul-Laptop wiederholen.
- Pro-Felder Breite/Höhe zentrieren den Fotoausschnitt neu; in der Spezifikation erwähnen.

**Bedienung**
- Jeder Pfeiltasten-Schritt an einem Regler ist ein eigener Undo-Schritt.
- Bibliothek: Klick setzt jedes Element genau in die Slide-Mitte, mehrere Einfügungen liegen übereinander. Kein Hinweis, dass man auch ziehen kann.
- Tags: senkrechte Lage des Texts in der Box nicht an der Grundlinie der PSD gemessen.
- Ort-Tag: Löschen des letzten Zeichens wird ohne Hinweis ignoriert. Standard «Luzern» und Standortliste stehen nicht in den Tokens.
- Laufweite zeigt «-10» mit Bindestrich statt «−10». Stilwechsel setzt Zeilenabstand und Laufweite zurück (wie die Grösse), in der Hilfe erwähnen.
- CSP `style-src 'unsafe-inline'` und `wasm-unsafe-eval` prüfen, sobald klar ist, was Phase 4 braucht.

**Layouts und Hilfen (aus Phase 2b)**
- Einrasten: Seitengriffe gedrehter Elemente rasten nicht ein (gewollt). Beim Einrasten gedrehter Elemente wird die Knotenposition gerundet, nicht der Rahmen. Ctrl zum Ausschalten auf Windows nicht geprüft.
- Titel-Layout: der Beispieltitel verdeckt «Foto hierher ziehen» (nur im Editor).
- Duplizierte Platzhalter behalten ihre Rolle; `Slide.layout` ist bei zwei Panoramas nebeneinander oder einer duplizierten Panorama-Slide mehrdeutig. Die Format-Kopie kann dann ein falsches Paar zuordnen.
- Fotorahmen füllen heisst jede Slide einzeln anwählen. (Die Slide-Leiste zeigt seit 2.4 bei 1280 px alle Kacheln und das Paar; die Aktionen brechen dafür um, siehe «Aus Phase 2.4».)
- Startseite: Die Projektzeile wird eng, sobald es mehr Formate gibt (Aktionen sind seit 2.4 Icons).
- Format-Kopie: zu grosser Text oder ein freies Foto, das kleiner als die Slide ist, deckt die Safe Zone statt hineinzupassen (Slide ist markiert). Ändert sich das Seitenverhältnis, wird der Fotoausschnitt neu zentriert.
- Scribble-Seitenverhältnis kommt aus dem PNG, nicht aus der Tinten-Box der PSD.
- `tagBox.cta.defaultText` doppelt zu `ctaText.instagram`; `.project-name` mit `min-width: 5rem`.

**Aus Phase 2.1**
- Rahmen speichert beim Ausschalten `false` statt das Feld zu löschen; `takeContent` schreibt `frame: undefined`. Harmlos, aber uneinheitlich mit «fehlt = aus».
- Im Profi-Modus liegen Hintergrund und Korn der Slide unter dem Ebenen-Panel und den Layout-Kacheln, bei 1536 × 864 erst nach Scrollen sichtbar.
- Ersetzte oder abgebaute Effekt-Canvas werden nicht freigegeben (Speicher bei vielen Fotos).
- Fotorahmen: Beim Ziehen an einem Griff skaliert der Rand bis zum Loslassen mit (`shortcut:` in PhotoNode).
- Neues Projekt: Die Layout-Wahl liegt über den Layout-Kacheln im Eigenschaften-Panel, man sieht kurz zwei Auswahlen.
- Nach einer Layout-Wahl auf einer leeren Slide gibt es keine Rückmeldung, solange die Schriften laden (Hinweis mit `role=status`).
- Aufräumen: toter Zweig `add.proOnly` (`ui/libraryItem.ts`, `canvas/CanvasView.tsx`, `core/types.ts`), übrige Kommentare zu «Fläche» und «Startvorlage» (`model/layout.ts`), doppelte Leerzeile in `app.css`.

**Aus Phase 2.2**
- Verknüpfung: Kommentar in `untouched()` zu `link` fehlt.
- Kanal: Die Meldung «Kein Link-Hinweis mit Standardtext gefunden.» erscheint bei jedem Wechsel ohne CTA (so spezifiziert). `setChannel` hat keinen Test für den Fehlerpfad von `tryApply`. Prettier-Warnung in `Header.tsx` (schon vorher).
- Akzentfarbe: Die Strichfarben der Hilfslinien werden als Eigenschaften geprüft, solange sie unsichtbar sind.

**Aus Phase 2.3**
- Verlauf: `scrim: undefined` bleibt als Schlüssel im Store, wenn der Verlauf ausgeschaltet wird. Der Platzhalter für den Vergleich (`base`) ist der erste seiner Rolle (`shortcut:`-Kommentar). Import-Reihenfolge in `tokens` und `layout.test.ts` bei 397 Zeilen (bei der nächsten Ergänzung aufteilen).
- Verlauf: Der e2e-Test dupliziert die Token-Werte. Die fünf Richtungsoptionen brauchen CSS über `:has(nth-child(5))`.
- Ränder: Der Rand-e2e prüft Farben als Zeichenketten. Die Linien sind auf den Story-Bändern schwächer. Der Einrast-Test läuft bei 195 % (nächster Zoomschritt).

**Aus Phase 2.4**
- Native Schieberegler (`input[type=range]`) haben `accent-color` Blauschwarz; nicht gestaltet wie die Knöpfe.
- Limit bei «Slide hinzufügen»/«Slide duplizieren»: nativ `disabled`, der Hinweis im Tooltip ist per Tastatur nicht erreichbar.
- Startseite: «Post anlegen» und «Story anlegen» sind beide Primärknöpfe in Logo-Blau, die Spezifikation sieht den Akzent nur für «Exportieren» vor.
- Der gestrichelte Rand des Platzhalters (Blauschwarz) ist auf einer blauschwarzen Slide ohne Rahmen unsichtbar. Der Hinweis bei einem Panorama richtet sich nur nach einer der zwei Slides.
- Profi: Die Ebenenliste zeigt 4 ganze Zeilen und scrollt; ausser der Bildlaufleiste weist nichts auf weitere Zeilen hin.
- Slide-Leiste bei 1280 px: Die Aktionen brechen in eine zweite Zeile um (etwa 2.75 rem Höhe).
- `saveProjectFile` (Schutz gegen doppelten Aufruf) hat keinen Test; im Header kann das `saving`-Flag bei einem zweiten Klick während der Sicherung früher zurückgehen (nicht geprüft).
- Der Tooltip beobachtet `document.body` per `MutationObserver`, solange er offen ist; auf schwachen Geräten bei vielen DOM-Änderungen prüfen. `placeTooltip` kann den Knopf überdecken, wenn keine Seite passt.
- Kleinkram: `header-icons.spec.ts` ist ganz umformatiert (Diff-Rauschen), `.header-actions .icon-btn + .icon-btn` mit magischem Abstand, deaktivierte Icons mit Deckkraft 0.4 (unter 3:1, WCAG nimmt sie aus), Löschen-Padding in der Aktionsreihe lässt 1 px Reserve, Ringfarbe der Layout-Kachel auf Blauschwarz ungeprüft. (Die Knöpfe `slideLeft`/`slideRight` sind seit 2.5 entfernt, ihr Testpunkt entfällt.)
- Ruherahmen `--line` hat 1.45:1 (nur dekorativ, Hover ändert zusätzlich die Fläche).

**Aus Phase 2.5**
- `accentFor` beachtet die Drehung nicht (`slideIndexOf` schon): ein gedrehtes Element an einer Slide-Naht kann den Akzent der Nachbarin nehmen.
- Bibliothek- und Layout-Vorschauen und Tag-Chips zeigen «Akzent» im Standortmodus immer orange.
- Heimbach-Scribble (`#8ED8F8`) auf warmweisser Slide nur etwa 1.5:1: Entscheid offen (so lassen, dunklerer Strich für Heimbach oder Akzent auf Warmweiss sperren).
- Akzent-Optionen untereinander statt nebeneinander; Hinweistext immer sichtbar.
- Verlauf und Korn malen auf die transparenten Flächen eines PNG mit Alphakanal ohne Maske (mit Maske seit 4a begrenzt, `effects.ts`).
- Rahmenkontur: opake Fotos brauchen die Kontur-Rechnung nicht (Vorprüfung); Rechnung im Worker oder halbe Auflösung (2048 px: ca. 150 ms, gedrosselt 780 ms); Ring fehlt einen Frame nach dem Laden; Vorschau beim Skalieren eines Freistellers weicht bis zum Loslassen ab; die Kontur ausserhalb der Box ist nicht anklickbar; Einrasten gilt der Box, nicht der Kontur; `pin()`-Ref pro Render neu.
- Meldung: `--notice-top` nicht neu berechnet, wenn eine Meldung die andere ersetzt; über dem modalen Export-Dialog nicht bedienbar; Esc schliesst sie nicht.
- Regler: Doppelklick auf die Bahn gibt zwei Undo-Schritte; Regler- und Inspector-Masse liegen in CSS statt in `tokens.ts`.
- Retint von Scribbles/Pin nach Standortwechsel ist asynchron ohne `EFFECT_PENDING`-Marke (ein sofortiger Export kann die alte Farbe erwischen); der Tint-Cache wächst pro Hex.
- Tests: automatische Prüfung für Regler-Kontrast, Kachelrahmen und Reihenfolge innerhalb eines Abschnitts; Alt + Pfeil am Rand einer verknüpften Gruppe; Dunkel nach Hell wählen.
- Optik zum Beurteilen: h3 («Layout») noch fett; aktiver Schalter «Erweiterte Optionen» und aktuelle Slide-Kachel nur durch Füllung/Rahmen markiert; Hinzufügen-Kacheln sehen den Tabs ähnlich (Alternative: zwei breite Zeilen, Screenshot `task-13-alt-rows-1280-einfach.png`); Überschrift «Ebene» unter dem Elementnamen wirkt doppelt; 28-px-Farbkacheln im Eigenschaftenbereich (vorher 40 px).
- Light-Schrift: Segoe UI Light/Semilight ist nicht lizenziert und nicht im Repo; die UI ist nur durch weniger Fettschrift leichter.

**Aus Phase 4a**
- Maskenkette (`maskOps.ts`): ein Job nach einem abgelehnten Kettenglied wird übersprungen.
- `loadMask` in `changeMask` hat kein Zeitlimit.
- Undo während eine Maske geschrieben wird, wird bis zu 10 s still abgelehnt.
- Ein Strich geht verloren, wenn man den Pinselmodus nach einem fehlgeschlagenen Speichern verlässt.

**Aus Phase 4b**
- Verworfenes KI-Ergebnis kann eine verwaiste Maskendatei hinterlassen (wie bei `changeMask`).
- Worker dekodiert 4096-px-Fotos in voller Grösse; `createImageBitmap` mit `resizeWidth`/`resizeHeight` spart Speicher.
- Build-Wächter `kein-cdn` kennt nur drei CDN-Hosts.
- Hängender Modell-Download hat kein Zeitlimit (nur «Abbrechen»).
- `titleOf`: keine Tests für ausgeblendeten Titel, Titel als Tag und mehrere Titel.
- Dünner Test: Projektdatei-Rundreise mit Sticker-Kopie und gelöschtem Original.
- Sticker von einem gesperrten Original ist ebenfalls gesperrt (Duplizieren kopiert `locked` und `role`).
- `fakeSegment` (nur Test) entfernt seinen Abbruch-Listener nicht.

**Tests**
- 2b: kein Unit-Test für Ecken-Skalieren gedrehter Elemente mit festem Seitenverhältnis, für `textType.fromLayout` und `setChannel`; keine Projektdatei-Rundreise für den Kanal. Die gedrehte Collage-Box ist durch keinen Test festgehalten. Post-Safe-Zone-e2e prüft nur Grössen. Der Daten-Test der Story-Zonen nimmt jedes Foto am oberen oder unteren Rand aus (auf Rollen beschränken). `ZONE` doppelt in `e2e/layout-presets.spec.ts`, `newProjectKeep` doppelt. Der SHOT-Screenshot-Test prüft nichts. Mögliches `frames`-Flackern im ersten Safe-Zone-Test.
- 2b, Aufräumen: Strichbreite der Hilfslinie als Zahl im Code statt in den Tokens.
- 2.1: Der R2-Test der Collage hält nur die x-Lage der Bildecke fest, y fehlt. Die Kosten von `drawHit` beim Klick auf leere Leinwand sind unter Drosselung nicht gemessen. Der Token-Test des Fotorahmens prüft schwach. Der Helfer `newProject(page, …, 'Carousel')` sollte auf die Titel-Elemente warten, bevor er Slides hinzufügt.
- E2E für den Alt + ←/→-Schutz (späten `keydown`-Listener registrieren, `defaultPrevented` prüfen).
- Test-Hook für `setZoom` und `now` (Export bei exakt 250 %, Aufräumen ohne 10-Minuten-Schonfrist).
- Fehlende Fälle: eine Slide mit beiden Verschiebe-Buttons deaktiviert, Foto über der Naht per Button, freies Skalieren oberhalb der Deckend-Grenze, `resizeCrop` für sehr kleine Elemente, Shift-Skalieren senkrecht.
- `e2e/editor.spec.ts` nahe 400 Zeilen: Text-Tests in eine eigene Datei.
- 2a: Textfeld ohne «st»-Ligatur nur per CSS geprüft, nicht per Pixel. Kein e2e für Drehen/Skalieren von Markenbildern. Leistungstest prüft beim Ziehen nur `pendingEffects`, nicht die Canvas selbst. `export setSliding(false)` ungetestet. Golden `korn.png` 3 MB, ein Ausschnitt würde reichen.
- 2a, Aufräumen: Segoe UI Bold zweimal registriert (UI und Tag). Rundung der Laufweite doppelt (TextInspector und Tokens). Manifest-Version wird nicht geprüft. Lucide-Raster im TagNode ohne `shortcut:`-Kommentar.

**Aus Phase 4c**
- Drehregler `Knob` nur im Test-Labor genutzt, bis Korn-Stärke kommt (Bahn-Abbruch per `pointercancel` beendet das Ziehen nicht).
- `theme.test.ts` scannt Variablen und Hex nur in `src/ui/*.css`, nicht in `src/ui/kit/kit.css`.
- `--line` als einziger Rand der Bibliothekskacheln hat etwa 1.7:1; der Kontrast-Test deckt `--line` nicht ab.
- Natives `disabled` bei gesperrtem Element (Inspector, Deckkraft) statt `aria-disabled` mit Grund.
- Zwei Prüfungen können nicht scheitern: «Ecke trägt Slide-Farbe» in `stage-backdrop.spec`, Outline der aktuellen Kachel in `slidebar-icons.spec`.
- `SlideEdgeLayer` ist ein eigener Konva-Layer (eine Canvas mehr); passt in einen bestehenden Overlay-Layer.
- Ältere e2e-Specs (vor 4c) schreiben Screenshots weiterhin ohne `SHOTS` nach `.superpowers/`.
- Effekt-Zeilen-Id ist indexbasiert (Klappzustand springt beim Entfernen).
- RangeSlider-Griff 8 px breit; `sliderMath` ohne Tests für min == max, NaN und step ≤ 0.
- CSS-Anchor-Positioning (Slide-Popover, Effektmenü, Unterlage) ohne Fallback, nur Edge geprüft.
- `formatHint` im Export-Dialog hart kodiert; Export-Segmented ohne Tooltip-Grund beim Sperren.
- `ligature.spec`: RED nie gezeigt; Effektmenü-Esc-Tests sind auch ohne Guard grün (nur der Slide/Unterlage-Test beweist ihn).
- «vier» vs «4» in Texten zur Verlaufsgrenze; Submenü-Einträge (`MenuItem`) ohne Icon-Feld.
- LayersPanel bleibt im versteckten Reiter eingehängt; Auge/Schloss haben Namen und `aria-pressed` zugleich.
- Newsreader kursiv nicht gebündelt; `fonts.test` prüft nur die Trennung der Listen.
- `src/ui/app.css` nahe 400 Zeilen (368).

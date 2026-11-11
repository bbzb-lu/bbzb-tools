# BBZB Social Studio: Design-Spezifikation

Verbindliche Spezifikation, beschreibt den aktuellen Soll-Zustand. Frühere Entscheide und Umsetzungsstände je Phase: `docs/archiv/spec-phasenlog.md` (nur zum Nachschlagen).

## 1. Worum es geht
Das BBZB (Berufsbildungszentrum Bau und Gewerbe Luzern, 4 Standorte, ca. 4500 Lernende) hat ein Social-Media-Designsystem für Instagram und LinkedIn entwickelt. Bisher existiert es nur als Photoshop-Vorlage (`docs/reference/layouts/`, Kurzanleitung als PDF). Die Geschäftsleitung hat das Konzept begrüsst. Jetzt soll es **umsetzbar** werden, und zwar von Leuten **ohne** Photoshop- oder Social-Media-Wissen.

Die App ist ein Browser-Editor für Carousels und Stories, ähnlich der Mobile-App «scrl», zugeschnitten auf die BBZB-Vorlagen.

### Typischer Ablauf (vom Auftraggeber beschrieben)
1. Eine Lehrperson schickt über irgendeinen Kanal Fotos (und Videos) eines Anlasses mit einem kurzen Text.
2. Lernende oder Mitarbeitende des Sekretariats bereiten daraus mit der App einen Post oder eine Story auf.
3. Sie exportieren die Slides und posten sie selbst auf Instagram/LinkedIn.

### Wer die App benutzt
- **Hauptnutzer:innen:** Lernende (Content Creation) und Sekretariat. Keine Bildbearbeitungskenntnisse. Die App muss sie davor bewahren, das CI zu brechen.
- **Power-User:** Social-Media-Management (Kommunikation BBZB). Pflegt Layouts und Brand Library.
- **Gerät:** verwaltete Windows-11-Geräte mit **Microsoft Edge** (Entwicklung auf macOS mit Edge). Browser-Profile werden nur bei grossen Updates gelöscht. Andere Browser und mobile Bedienung sind kein Ziel.

## 2. Ziele
1. Ein Carousel im BBZB-Look ist in **unter 15 Minuten** fertig, ohne Vorwissen.
2. Fotos laufen nahtlos über Slide-Grenzen (Panorama, Pfeil über Naht).
3. Fotos, Videos und Text im selben Projekt. Slides mit Video werden **automatisch als MP4** exportiert, die übrigen als JPEG (optional PNG).
4. Formate: **Post 4:5 (1080 × 1350)** für Instagram-Karussell und LinkedIn, **Story/Reel 9:16 (1080 × 1920)**. Weitere Formate lassen sich als Daten ergänzen.
5. Vorgefertigte Layouts gemäss Photoshop-Vorlage. Die Nutzer:innen wählen ein Layout pro Slide und ersetzen nur Inhalte.
6. **Brand Library:** Scribbles, Icons, Texturen, Farben, Schriften, Tags und eigene Sticker auf einen Klick.
7. **KI-Freistellen** im Browser für Sticker, Pop-outs und «Motiv vor Titel».
8. **Ebenen**-Panel mit Reihenfolge, Sichtbarkeit, Sperren und Umbenennen.
9. Modular: Neue Element-Typen, Layouts, Asset-Pakete, Export-Formate und KI-Werkzeuge kommen ohne Umbau des Kerns dazu.

## 3. Nicht-Ziele
- Keine Lightroom-Umgebung. Es gibt einen BBZB-Look plus höchstens 4 einfache Regler.
- Keine Cloud-Speicherung, keine Konten, keine gemeinsame Echtzeit-Bearbeitung.
- Kein direktes Posten über die Instagram- oder LinkedIn-API.
- **Keine KI-generierten Bilder** (das Social-Media-Konzept verbietet sie). KI nur als Werkzeug (Freistellen, Auswahl).
- Keine Mobile-Version, keine Unterstützung für Firefox/Safari.
- Kein Video-Schnittprogramm. Pro Video-Element gibt es nur Start/Ende kürzen, Ton an/aus und Position.

## 4. Anti-Ziele (wäre ein Misserfolg, auch wenn es technisch läuft)
- **Ein Foto oder Video verlässt den Rechner.** Es gibt keinen Server-Upload, auch nicht zur «Analyse».
- Die Oberfläche ist so mächtig, dass das Sekretariat sie nicht benutzt. Im Zweifel weniger Optionen.
- Exporte, die das CI brechen: abgerundete Textboxen, Logo auf Slides, reines Weiss/Schwarz, falsche Schriften, unscharfe Exporte.
- Sichtbare Nähte oder Versatz an Slide-Grenzen.
- Projekte gehen beim Neuladen verloren.

## 5. Randbedingungen
- **Datenschutz:** Medien bleiben im Browser (IndexedDB/OPFS). Eine Content Security Policy belegt das technisch: `connect-src 'self'` plus ausdrücklich erlaubte Modell-Downloads (nur GET, siehe 9).
- **Hosting:** statischer Host (Cloudflare Pages), öffentlich ohne Cloudflare Access, Schriften per Web-Lizenz abgedeckt (Suite `bbzb-tools`, CSP in `_headers` im Hauptordner). Dort liegt nur die App, nie Projekte oder Medien. Kein Backend. CSP und Header kommen vom Host. Lokal läuft dieselbe App mit `npm run dev`.
- **Sprache der Oberfläche:** Deutsch mit Schweizer Rechtschreibung («ss», Guillemets «…»), Du-Form, kurz.
- **Lizenzen:** Für den internen Testdurchlauf ist das stärkste Modell erlaubt, auch wenn es nicht kommerziell lizenziert ist. Das Repo bleibt **privat** (Schriften liegen darin). Vor einer Verbreitung werden Modell und Schriften neu lizenziert.

## 6. Designsystem (verbindlich für Exporte)
Quelle: `CLAUDE.md` im Social-Media-Ordner und `docs/reference/`. Die Werte gehören als Tokens in eine einzige Datei.

**Farben**

| Token | Hex | Einsatz |
|---|---|---|
| `blau` | `#009FE2` | Hauptfarbe, Flächen, Titel auf Warmweiss |
| `orange` | `#FF4E00` | Akzent: Schul-Tag, CTA, Pfeile, Scribbles, Icons. Nie Fliesstext |
| `warmweiss` | `#FBF8F3` | ersetzt reines Weiss überall |
| `blauschwarz` | `#0F1B26` | ersetzt Schwarz überall, Ort-Tags |

Die Farbwahl im Editor bietet **nur** diese vier Farben an, dazu im Standortmodus die Kachel «Akzent» (Standortfarben, siehe «Akzentfarbe nach Standort» in 8). Standard ist fixes Orange.

**Textstile** (Presets, keine freie Schriftwahl für Hauptnutzer:innen)

| Stil | Schrift | Werte |
|---|---|---|
| Titel | Segoe UI Black | Laufweite −40/1000 em, Zeilenabstand 0.86 × Grösse |
| Kommentar | Braveold Light | Laufweite −10/1000 em, **keine Ligaturen** (vor allem kein «st») |
| Tag | Segoe UI Bold, Versalien | Laufweite +110/1000 em |
| CTA | Segoe UI Bold, Versalien, warmweiss auf oranger Fläche (Höhe 75 px, Innenabstand 44 px) | Laufweite +110/1000 em, Grösse 34 px (z. B. «LINK IN BIO», «BBZB.LU.CH») |

**Elemente und Regeln**
- **Schul-Tag:** oranges, eckiges Rechteck, Text warmweiss, z. B. «BBZB BAHNHOF». Standort per Auswahl (Bahnhof, Heimbach, Weggismatt, Dagmersellen).
- **Ort-Tag:** blauschwarzes Rechteck, oranger Tabler-`map-pin`, Text warmweiss, Freitext für den Ort.
- Kein Logo, keine Wortmarke, keine Textboxen, keine abgerundeten Flächen, keine Kreise als Formen.
- **Scribbles** sind PNGs mit Alphakanal (Quellfarbe egal, höchstens 2048 px, zugeschnitten) und werden im Editor eingefärbt (Standard Orange). 18 Stück; 13 bis 18 (Glühbirne, Fragezeichen, Ausrufezeichen, Kreuz, je ein Fragezeichen und Ausrufezeichen im Pinselstil) kamen mit Phase 2.6a.
- **Filmkorn:** nicht global. Pro Foto (Overlay, Standard 14 %) und auf dem Slide-Hintergrund (Overlay, Standard 40 %), Stärke je mit Drehregler. Textur: `brand/textures/film-grain-03.jpg`, auf Mittelgrau normalisiert.
- **Sticker:** Freisteller mit warmweisser Kontur und weichem Schatten.
- **Ränder:** 72 px als Hilfslinien, Elemente schnappen daran ein.

## 7. Layouts
Die 8 Zeichenflächen der PSD werden zu Layout-Presets. Referenzbilder: `docs/reference/layouts/Beispiel_0X_*.jpg`. **Masse, Schriftgrössen, Effekte und Farben:** `docs/reference/psd-geometry.json` (aus der PSD ausgelesen, inkl. Werten für Sticker-Kontur, Schatten, Verläufe, Filmkorn und Bildlook).

| Preset | Inhalt | Slides |
|---|---|---|
| Titel | Vollbild-Foto + Korn, optional Verlauf oben, grosser Titel, **Motiv vor Titel** (Freisteller-Kopie über dem Titel), Kommentar, Schul-Tag oben rechts | 1 |
| Vollbild | Foto + Korn, optional Verlauf, Pfeil-Scribble, Kommentar | 1 |
| Panorama | ein Foto über 2 Slides, Pfeil mittig über der Naht | 2 |
| Collage | blauer Hintergrund + Korn, Hauptfoto im Rahmen, Sticker, Ort-Tag, kein Text | 1 |
| Querformat | Warmweiss, Querfoto im Rahmen mit Pop-out (Freisteller ragt aus dem Rahmen), Kommentar, Ort-Tag, Scribble | 1 |
| Drei Fotos | Blau + Korn, drei versetzte Querformate, Sticker, Scribbles | 1 |
| Abschluss | Warmweiss, Schul-Tag, blauer Titel, Kommentar, CTA «Link in Bio» (Instagram) oder «bbzb.lu.ch» (LinkedIn), Freisteller von unten, Pfeil | 1 |
| Leer | Hintergrundfarbe aus der Palette | 1 |

- Ein Layout besteht aus Daten (JSON/TS-Objekt) mit **Platzhaltern** (Foto, Video, Titel, Kommentar, Tag). Ein Platzhalter nimmt Fotos per Drag-and-drop auf und füllt den Rahmen («cover»).
- Jedes Layout hat eine 4:5-Variante. Story-Varianten (9:16) leitet der Builder sinnvoll ab und beachtet die Instagram-Sicherheitszonen oben und unten. Die Zonen sind als zuschaltbare Überlagerung sichtbar.
- **Layouts als Dateien:** 8 Post- und 8 Story-Varianten als JSON in `src/plugins/layouts/presets/`, Werte aus `psd-geometry.json`, verbunden über die gemeinsame `family`. Ein neues Layout braucht eine Datei und eine Referenz.
- **Story-Variante:** der Post, um 240 px nach unten in das freie Band geschoben; randabfallende Fotos wachsen auf 1920 px Höhe, der Abschluss-Freisteller reicht bis an den unteren Rand. Alle Inhalte liegen ausserhalb der Sicherheitszonen.
- «Motiv vor Titel» und Pop-out sind bis zum Freistellen normale Fotorahmen. Eine Zeile «Credits» gibt es nicht.
- Ein neues Projekt beginnt ohne Startvorlage (siehe 8).

## 8. Funktionsumfang

### Ein Modus für alle (Phase 4c)
- Es gibt keinen Schalter «Einfach/Erweitert» mehr. Alles ist sichtbar: Ebenen mit Sperren und Ausblenden, freie Elemente aus der Bibliothek, Bildregler, Deckkraft, Text-Feineinstellung, Verlauf-Reichweite. Positionsfelder (X, Y, B, H, Drehung) gibt es nicht; verschoben wird per Ziehen und Pfeiltasten. Ein früher im Browser gespeicherter Modus wird beim Start verworfen (er stand nie in der Projektdatei).
- Sicherheitszonen sind zuschaltbar. Farben und Schriften bleiben auf das Designsystem beschränkt.

### Projekt und Slides
- **Startseite:** Knöpfe «Post 4:5 anlegen» und «Story 9:16 anlegen», darunter die lokalen Projekte. Pro Zeile «Öffnen» (Icon + Text) und Icon-Aktionen Duplizieren, Als Story/Post kopieren, Löschen (mit Rückfrage). Während ein Projekt angelegt wird, ist die Startseite gesperrt. Vorschaubilder kommen in Phase 5.
- **Duplizieren:** Kopie «Name (Kopie)», Medien werden geteilt, nicht doppelt gespeichert.
- **Neues Projekt:** eine leere Slide, die Layout-Wahl ist offen und hat den Fokus. Die Wahl gilt für Slide 1 (ein Undo-Schritt), Esc lässt die Slide leer. Es gibt keine Startvorlage. Ein vorhandenes Projekt öffnet ohne Layout-Wahl.
- **Slides:** hinzufügen (Popover mit Layout-Auswahl, 3 Spalten, «Leer» steht nie allein), duplizieren, löschen, umsortieren per Ziehen oder Alt + ←/→. Es gibt keine Pfeil-Knöpfe; der Tooltip der Kachel nennt die Wege. Maximal 20 Slides (Instagram-Limit), am Limit erscheint eine Meldung.
- **Slide-Leiste** unter der Leinwand: Kacheln, dann die Ansicht (Sicherheitszonen, Zoomgruppe mit Verkleinern, Prozent, Vergrössern, Einpassen, dazu die Unterlage), dann die Slide-Aktionen. Die Leiste ist einzeilig, die Kacheln scrollen innerhalb der Leiste; «Slide hinzufügen» und «Slide löschen» zeigen das Wort ab 1536 px, darunter nur das Icon mit Tooltip. Der Ring der aktuellen Kachel liegt innen. Ein Paar rollt beim Wechsel ganz in den Blick.
- **Nahtlos:** Alle Slides liegen auf einer durchgehenden Leinwand, jedes Element darf über Nähte reichen. Ein Element gehört zur Slide, auf der seine Mitte liegt; liegt sie genau auf einer Naht, zur linken. Beim Umsortieren wandert es mit dieser Slide.
- **Verknüpfte Slides:** Die Slides einer Vorlage mit mehreren Slides (Panorama) sind automatisch verknüpft (`Slide.link`, gemeinsame Id; `groupOf` liefert die Gruppe). Verschieben, Duplizieren und Löschen wirken auf die ganze Gruppe («2 Slides löschen», ein Undo stellt alles her). Eine einzelne Slide springt über eine Gruppe hinweg und landet nie dazwischen. Duplizieren legt eine Gruppe mit neuer Id direkt dahinter an und beachtet das Limit. Die Leiste zeigt die Gruppe zusammenhängend. Ein Layout mit nur einer Slide löst die Gruppe auf (Undo stellt sie her). Verknüpfen von Hand ist eine spätere Erweiterung.
- **Slide-Hintergrund** (Eigenschaft der Slide, kein Element, nimmt keine Klicks an): Ohne Auswahl zeigt der Inspector «Hintergrund» mit den vier Farben, darunter «Effekte» wie am Foto: Korn (Drehregler «Stärke», Standard 40 %) und Verlauf, je ein Undo-Schritt. Freie Farbflächen gibt es nicht.
- **Klickfläche Hintergrund (Phase 4c.5):** Steht der Zeiger über oder unter einer Slide in ihrer Spalte, wächst über und unter ihr ein Schatten von der Kante nach aussen (200 ms, nur Ansicht, auf «Dunkel» hell). Ein Klick dort wählt den Hintergrund dieser Slide. Auf der Slide selbst zieht er sich zur Kante zurück und wird schwächer (der Klick gilt dem Inhalt); neben den Slides, beim Ziehen, in Ausschnitt, Pinsel, Text-Bearbeitung, mit offenem Dialog oder Popover und ausserhalb der Leinwand verschwindet er.
- Kein React-Render und kein Store-Schreiben pro Mausbewegung; Reduced Motion schaltet ohne Animation, Geräte ohne Hover zeigen ihn nicht.
- **Kanal** Instagram/LinkedIn (im Inspector bei gewähltem CTA, im Projekt): Der Wechsel ändert nur CTAs, deren Text dem Standard des anderen Kanals entspricht («LINK IN BIO» ↔ «BBZB.LU.CH»); eigener CTA-Text bleibt. Der Schalter hat den Hinweis «Gilt für alle CTA im Projekt.». Danach meldet die Meldungsleiste «1 Link-Hinweis angepasst.», «2 Link-Hinweise angepasst.» oder «Kein Link-Hinweis mit Standardtext gefunden.».
- **Format fest.** «Als Story kopieren» bzw. «Als Post kopieren» legt ein neues Projekt im anderen Format an, das Original bleibt. Die Kopie heisst «Name (Story 9:16)» bzw. «Name (Post 4:5)», eine frühere Format-Endung wird ersetzt. Platzhalter-Inhalte nehmen den Rahmen der Layout-Variante, Text- und Fotoeinstellungen bleiben. Freie Elemente (Scribbles, Texte, Tags) werden relativ zur Slide-Mitte übernommen und in die Sicherheitszone geschoben. Ein freies Foto über die ganze Slide bleibt randabfallend; ein sehr breites Element über einer Naht behält seine Lage, nur seine Mitte bleibt in der eigenen Slide. Betroffene Slides tragen den Hinweis «Bitte prüfen» (Kachel und Inspector), bis «Geprüft» gedrückt wird (ein Undo-Schritt). Der Hinweis erscheint nie im Export, bleibt aber in der Projektdatei.
- **Layout wechseln auf einer Slide mit Inhalt:** Die Slide merkt sich das zuletzt angewendete Layout (`Slide.layout`, nur ein Hinweis). Ein Element des alten Layouts gilt als unverändert, wenn es Rolle, Reihenfolge, Werte und Rahmen der Vorlage hat (ein Beispieltext mit einem geänderten Zeichen zählt als Inhalt). Unveränderte Beispieltexte, Tags und Dekor werden ohne Rückfrage ersetzt. Geändertes, Dupliziertes und Hinzugefügtes bleibt: Fotos und Texte ziehen in passende Platzhalter, der Rest bleibt frei liegen, nichts wird gelöscht. Ein Text im Platzhalter übernimmt den Stil des neuen Layouts. Hintergrund, Korn und der Rahmen der Fotos werden mit umgestellt. Ein Foto behält einen selbst gewählten Verlauf (auch «Aus»); entspricht sein Verlauf dem Wert des alten Platzhalters, übernimmt es den des neuen. Ein Scribble in Orange gilt als unverändert, wo das Layout `akzent` setzt. Ein Undo-Schritt stellt Elemente und Slide zusammen wieder her.

### Elemente (je ein Modul in der Element-Registry)
| Typ | Fähigkeiten |
|---|---|
| Foto | Rahmen + Ausschnitt (Doppelklick zum Verschieben/Zoomen), BBZB-Look an/aus, Helligkeit, Kontrast, Sättigung, Wärme, Korn mit Stärke, Rahmen an/aus, Verläufe, Freistellen, «als Sticker», Spiegeln |
| Video | Foto-Element mit Feld `video` (Entscheide Phase 3): Rahmen, Ausschnitt, BBZB-Look, Verlauf, Korn; Start/Ende kürzen, Ton an/aus, Vorschau abspielen. Video-Slides zeigen ein Video-Symbol |
| Text | Stil-Preset (Titel/Kommentar), Farbe aus Palette, Grösse, Ausrichtung, mehrzeilig, direkt auf der Leinwand editierbar (Doppelklick, im Text-Inspector erwähnt) |
| Tag | Schul-Tag (Standort), Ort-Tag (Freitext) oder CTA (orange Fläche, warmweisse Versalschrift, Werte aus `components.cta` der PSD) |
| Scribble/Icon | aus Brand Library, Farbe aus Palette, drehen, skalieren, spiegeln |
| Sticker | Freisteller mit Kontur + Schatten |

Gemeinsam für alle: verschieben, skalieren, drehen, Deckkraft, Ebene hoch/runter, duplizieren, löschen, sperren, ausblenden (Sperren und Ausblenden im Ebenen-Panel und im Rechtsklickmenü). Hilfslinien und Einrasten an Rändern (72 px), Slide-Mitten, Nähten, Kanten und Mitten anderer Elemente und Sicherheitszonen. Duplizieren (Strg + D, Knopf, Menü) legt die Kopie 40 px versetzt direkt über das Original und wählt sie; «An gleicher Stelle duplizieren» (Knopf im Abschnitt «Ebene», Menüpunkt danach) legt sie deckungsgleich ab. Dafür gibt es kein Tastenkürzel, Edge belegt Strg + Umschalt + D.
/
**Auswahl:** Hintergrund und Verläufe sind nie im Weg. Fotoplatzhalter, Scribbles, Texte und Tags lassen sich mit einem Klick auf die sichtbare Mitte wählen (auf allen 16 Vorlagen getestet). Klick und gleich danach Doppelklick hebt die Auswahl nicht auf. Von jedem Verlauf nimmt nur der gemalte Teil Klicks an.

**Einrasten:** ab 6 Bildschirm-px, unabhängig vom Zoom. Mit gedrückter Strg-Taste rastet nichts ein (Alt ist für den Zoom belegt).

**Skalieren:** Eckgriffe skalieren proportional (bei Fotos wächst der Inhalt mit). Mit Shift an den Ecken und immer an den Seitengriffen skaliert der Rahmen frei; das Bild bleibt im Rahmen zentriert und füllt ihn («cover»), der Zoom des Inhalts bleibt. Den Ausschnitt setzt man danach per Doppelklick.

**Einfügen:** Fotos kommen im Originalformat: auf Slide-Breite, bei höherem Format ganz sichtbar eingepasst, jeweils zentriert. Ein Foto, das in einen Platzhalter gezogen wird, füllt ihn («cover»).

**Ansicht:** Zoom per Ctrl/Alt + Mausrad, Pinch und Buttons «Vergrössern», «Verkleinern», «Einpassen» (Strg +, Strg −, Strg 0), 25 bis 800 % des Einpass-Massstabs. Leinwand verschieben mit Leertaste + Ziehen (Hand-Cursor; auch nach einem Mausklick auf einen Button; in Textfeldern tippt die Leertaste normal; ein per Tastatur fokussierter Button löst weiter mit der Leertaste aus) und mit mittlerer Maustaste. Beides ist reine Ansicht: nicht im Undo, nicht im Projekt, Export unverändert. Die Slides stehen zentriert, beim Zoomen gibt es Arbeitsfläche rundherum.

#### Foto-Details
- **Neue Fotos:** BBZB-Look an, Korn aus, Rahmen aus. Layout-Platzhalter tragen `grain: true`; ein leerer Platzhalter schaltet das Korn beim Füllen aus, «Foto ersetzen» behält es. Fotos aus Projekten vor dem BBZB-Look öffnen ohne Korn und Look.
- **BBZB-Look:** Annäherung aus `psd-geometry.json` → `components.bildlook` (Fotofilter «Erwärmen» `#EC8A00`, Dichte 12 %, Luminanz erhalten, Dynamik +5, Sättigung −5). Die Werte liegen nur an einer Stelle (Effekt-Definition bzw. Tokens), damit ein Lightroom-Preset sie später ersetzen kann. Abnahme durch die Kommunikation BBZB.
- **Bildregler:** Helligkeit, Kontrast, Sättigung, Wärme je −50 bis +50, 0 = neutral; Stärke am Anschlag in `imageAdjust.strength` (Tokens). Beim Ziehen zeigt die Leinwand eine Vorschau mit höchstens 540 px, nach dem Loslassen rechnet sie voll. Sind alle Regler neutral und der Look aus, läuft kein Filter. Reihenfolge der Effekte: Look, Bildregler, Verlauf, Korn.
- **Korn:** Foto 14 % Overlay (auf dem Slide-Hintergrund 40 %), Textur `brand/textures/film-grain-03.jpg`. Die Stärke (`filmkorn.contrast` = 6 in `src/tokens.ts`) ist an Beispiel 05 und 07 kalibriert, ein e2e-Test vergleicht die Streuung. Verläufe am Foto haben kein Korn.
- **Korn-Stärke (4c.1):** `grainStrength` 0 bis 100 = Deckkraft des Overlays in Prozent, linear, an Foto und Slide. Fehlt = Standard (Foto 14, Slide 40) und ergibt genau die bisherigen Pixel; alte Projekte laden und exportieren unverändert. 0 = kein Korn. «+» fügt Korn mit Standard hinzu, der Papierkorb entfernt es samt Stärke. Ein Layout ohne Korn löscht die Stärke mit, eines mit Korn behält sie.
- **Rahmen:** warmweisse Kontur mit Schatten in Blauschwarz wie in der PSD (Collage). Sie legt sich als Umriss um den sichtbaren Inhalt (Alpha-Silhouette) und liegt ausserhalb: das Foto bleibt so gross wie die Box, der Rahmen ragt 24 px darüber hinaus (`photoFrame.inset`, in Beispiel 05 gemessen). Bei einem Rechteck ergibt das einen Rechteckrahmen, bei einem Freisteller folgt er der Form. Auswahlrahmen und Transformer sitzen an der Box. Die Kontur rechnet eine exakte euklidische Distanztransformation auf dem Alpha (einmal je Bild, Ausschnitt und Box, höchstens 2048 px lang), der Export wartet darauf. Ältere Projekte mit Rahmen behalten die Innen-Darstellung (Feld `frameOutside` fehlt), bis der Rahmen neu gesetzt wird. Die Layouts (Collage) sind so umgerechnet, dass die Exporte pixelgleich bleiben.
- **Leerer Platzhalter:** Im Export erscheint er als Hintergrundfläche, mit Rahmen als warmweisse Karte. Der Editor-Hinweis «Foto hierher ziehen» wählt Blauschwarz oder Warmweiss nach Kontrast zur Fläche darunter (bei Rahmen der warmweisse Rahmen, bei einem Panorama die Slide unter der Rahmenmitte). `placeholderStyle.fillAlpha` ist 0.08. Das betrifft nur den Editor.
- **Spiegeln:** Scribble und Icon nur waagrecht (links/rechts). Das Foto zusätzlich senkrecht (Feld `flipY`, seit 4c): im Abschnitt «Bild» zwei Icon-Knöpfe, im Rechtsklickmenü das Untermenü «Spiegeln» mit beiden Richtungen. Am Video gibt es kein Spiegeln.

#### Verläufe (Scrims)
- Ein Verlauf ist ein Foto-Effekt: `scrims: Scrim[]` am Foto, fehlt = keiner (den Slide-Verlauf am Hintergrund regeln die «Entscheide Phase 2.8»). Das alte einzelne `scrim` liest sich als erster Eintrag.
- Der Verlauf folgt dem Foto bei Verschieben, Drehen, Spiegeln (die gewählte Seite bleibt, das Bild dreht sich darunter), Ausschnitt und Rahmen und läuft bei einem Panorama über beide Slides. Er liegt im Foto, Texte, Tags und Scribbles werden nie abgedunkelt.
- Bedienung (seit 4c): Abschnitt «Effekte», das «+» öffnet die Effekt-Auswahl; «Verlauf» legt einen Verlauf an der ersten freien Seite an. Pro Verlauf eine eingerückte Zeile mit gedrehtem Richtungs-Icon, Seite (belegte gesperrt), **Dunkel|Hell**, Stärke (Leicht, Mittel, Stark), Reichweite (Standard 56 %, 30 bis 100 %, immer sichtbar) und Entfernen. Höchstens vier Verläufe, danach ist der Eintrag gesperrt mit Hinweis. Jede Wahl und jede Regler-Geste ist ein Undo-Schritt.
- Werte nur in `src/tokens.ts`: «leicht» 0.11 (PSD `verlaufOben`, Alpha 0.45 × Deckkraft 0.25), «mittel» 0.35 (eigene Wahl, nicht aus der PSD), «stark» 0.7 (PSD `verlaufUnten`). Dunkel ist Blauschwarz (die PSD nennt `#0B2A3C`, das ist kein Token), Hell ist Warmweiss.
- Die Vorlagen Titel und Vollbild setzen den Verlauf am Foto (Golden-Toleranz höchstens 0.14 %).

#### Akzentfarbe nach Standort
- Projektfeld `accentMode`: `fix` (fehlt = Standard, Orange) oder `standort`. Schalter «Fixe Akzentfarbe» / «Standortabhängig» im Dialog «Einstellungen» (Kopfzeile). Bestehende Projekte ändern sich nie von allein.
- Farbwert **«Akzent»** (Token `akzent`, kein Hexwert, wird beim Zeichnen und Exportieren in `src/model/accent.ts` aufgelöst, `accentFor`, `resolveColor`). Tag, CTA, Scribbles, Pfeile, Icons aus der Bibliothek und der Orts-Pin setzen «Akzent». Eine von Hand gesetzte Palettenfarbe bleibt. Ältere Projekte behalten ihr `orange`; im fixen Modus ist «Akzent» = Orange.
- Standortfarben: Bahnhof `#008C7E`, Heimbach `#4C5EBD` (seit 2.6, vorher `#8ED8F8`), Weggismatt `#FF4E00`, Dagmersellen `#D81E3A`, BM `#D84FC3` und «BBZB» `#009FE2` (seit 2.6).
- **Pro Slide:** Es zählt der erste sichtbare Schul-Tag in Ebenenreihenfolge (versteckte zählen nicht). Ohne Schul-Tag gilt `lastTagLocation` des Projekts, sonst Orange. Bei einem Panorama gilt die erste Slide der Gruppe.
- Schrift auf der Akzentfläche wählt Warmweiss oder Blauschwarz nach Kontrast, Schwelle 3:1 für grosse Schrift (`accentTextContrast`; Tag- und CTA-Schrift ist 28/34 px fett).
- Die Farbwahl zeigt «Akzent» als Kachel nur im Standortmodus; bei `akzent` im fixen Modus ist die Orange-Kachel gewählt.
- Schul-Tag: Der zuletzt gewählte Standort wird im Projekt gemerkt (`lastTagLocation`) und ist Standard für neue Schul-Tags. Ein Schul-Tag aus einem Layout nimmt ihn, wenn der Platzhalter frisch ist; übernommener Text bleibt.
- Heimbach-Scribbles auf Warmweiss haben nur etwa 1.5:1 Kontrast (offen, siehe Roadmap).

#### Entscheide Phase 2.6 «Tags und Standorte» (26.10.2026)
- **Standorte:** Liste `BBZB` (kein Standort, Blau `#009FE2`, Schrift Blauschwarz nach `onAccent`), Bahnhof, Heimbach (neu Indigo `#4C5EBD`, Schrift Warmweiss), Weggismatt, Dagmersellen, BM (Berufsmatura, Magenta `#D84FC3`, Schrift Warmweiss). Im Modus «Akzent nach Standort» ist der Akzent bei «BBZB» Blau.
- **Standort-Tag** (Variante bleibt `schul` im Code, Beschriftung «Standort-Tag»): zeigt «BBZB» allein oder «BBZB <STANDORT>». Ein neuer Tag aus der Bibliothek zeigt «BBZB». Layout-Platzhalter nehmen weiter `lastTagLocation`, wenn frisch.
- **Fachbereich als zweite Zeile** im gleichen Kasten (Schalter im Inspector, Auswahl aus den Fachbereichen des Standorts; bei «BBZB» kein Schalter). Wechselt der Standort, verschwindet ein nicht passender Fachbereich. Kasten höher, die Breite folgt der längeren Zeile.
- **Fachbereich-Tag** (neue Variante `fach`): alleinstehend, alle 17 Fachbereiche wählbar (Liste nach Standort gruppiert), Farbe = Farbe des Standorts, unter dem er gewählt wurde (gespeichert, weil «Bautechnik» bei Heimbach und Dagmersellen vorkommt).
- **Freier Tag** (neue Variante `frei`): eigener Text (höchstens 60 Zeichen), Farbe aus Palette (Blau, Orange, Warmweiss, Blauschwarz, Akzent) und den fünf Standortfarben, kein freier Hexwert. Schrift nach `onAccent`.
- **Akzent:** nur der Standort-Tag bestimmt den Akzent der Slide; Fachbereich-Tag und freier Tag färben nur sich selbst.
- **Fachbereiche:** Bahnhof: Automobiltechnik, Gebäudetechnik, Fahrzeugbau und Strassentransport, Zimmerleute. Heimbach: Bautechnik, Coiffeure, Visuelle Gestaltung, Bühnentänzer/innen, Gastronomie, Zeichner ZFA/ZFI. Dagmersellen: Bautechnik, Steinmetze. Weggismatt: Elektrotechnik EI/ME, Maler, Elektrotechnik EP/GIN/NE. BM: BM-Tals, BM Arte.
- Neue Projektfelder (`dept`, `color`) sind optional, kein `schemaVersion`-Wechsel; Altprojekte sehen aus wie vorher (ausser Heimbach: neue Farbe).

#### Entscheide Phase 2.7 «Tabler-Icons» (26.10.2026)
- **Das bisherige Icon-Paket fiel ganz weg**, auch die 5 Markenicons und der Pin im Ort-Tag. Ersatz ist Tabler (`@tabler/icons`, MIT-Lizenz), nur der Stil **Outline** (5184 Icons), Strich 2 wie bisher.
- **Oberfläche:** Das alte React-Paket wurde durch `@tabler/icons-react` ersetzt (Einzelimport, 18 px, `aria-hidden`, wie bisher). 43 Icons in 14 Dateien.
- **Bibliothek, Tab «Icons»:** Suchleiste oben. Ohne Suche stehen die 5 Markenicons (Tabler-Versionen, gleiche Ids), mit Suche bis zu 120 Treffer aus allen Tabler-Icons. Die Suche versteht nur Englisch (Name und Tabler-Stichwörter); ein Hinweis unter der Suchleiste sagt das («Suche auf Englisch, z. B. house, arrow, camera»).
- **Auslieferung:** Die 5184 Icons liegen als eine Datei (`brand/tabler/outline.json`, Pfaddaten plus Stichwörter, etwa 1.4 MB, wenige hundert KB komprimiert), die erst beim ersten Fokus auf die Suchleiste oder beim Öffnen eines Projekts mit Tabler-Icons geladen wird. Eigene Herkunft, kein CDN; das Hauptpaket wächst nicht.
- **Im Projekt** steht nur die Id `tabler-<name>` (Element `brand`, Farbe wie bei Scribbles, Standard Akzent). Beim Öffnen eines Projekts mit solchen Icons lädt die App die Datei vor dem ersten Zeichnen; der Export wartet darauf. Fehlt ein Name (ein künftiges Tabler-Update hat ihn entfernt), gilt der normale Platzhalter mit Meldung.
- **Altprojekte:** Die Ids `icon-bike`, `icon-map-pin`, `icon-mountain`, `icon-tree-pine`, `icon-waves` bleiben, die Bilder dahinter sind jetzt Tabler und sehen leicht anders aus.
- Eigene Werte (zu prüfen): Treffer höchstens 120, Suche nach 150 ms Pause, Rangfolge exakter Name, Namensanfang, Name enthält, Stichwort.

#### Entscheide Phase 2.8 «Oberfläche aufräumen» (27.10.2026)
- **Wort «Tag» bleibt.** Nur die Vorschau in der Bibliothek verliert es: «Standort», «Fachbereich», «Frei», «Ort», «CTA». Ebenennamen und Tab «Tags» bleiben.
- **Icons:** Spiegeln nutzt `IconFlipHorizontal` (die Aktion tauscht links und rechts), Korn überall `IconGrain` (Foto und Slide). Das Ort-Tag zeigt in der Bibliotheksvorschau den Pin vor dem Text.
- **Kanal-Schalter** (Instagram/LinkedIn) fällt aus der Kopfzeile. Er steht im Inspector, wenn ein CTA-Tag gewählt ist, und bleibt projektweit (alle CTA mit Standardtext folgen, ein Undo-Schritt).
- **Slide-Einstellungen:** Layouts erst hinter dem Knopf «Layout ändern» (eingeklappt, bei Slidewechsel wieder zu). Unter «Hintergrund» stehen Korn und «Verlauf hinzufügen» (gleiche Auswahl wie am Foto, bis zu vier, Dunkel/Hell, Stärke, Reichweite). Das Slide-Modell bekommt `scrims` (fehlt = keine, Altprojekte laden unverändert). Verlauf liegt über der Farbe, unter dem Korn, im Export gleich wie im Editor.
- **Einstellungen:** Knopf mit Zahnrad (`IconSettings`) in der Kopfzeile öffnet einen Dialog «Projekteinstellungen». Inhalt vorerst die Akzentfarbe (zieht aus dem Abschnitt «Projekt» der Slide-Einstellungen hierher, dort fällt der Abschnitt weg).
- **Tabler-Hinweis:** unter der Icon-Suche «Icons von Tabler» mit Logo (`brand/ui/tabler-icons.png`) und Link auf tabler.io/icons. Kein Laufzeit-Request, das Logo liegt im Bündel.

#### Entscheide Phase 2.9 «Doodles» (27.10.2026)
- **Zweite Bildersammlung «Doodles»** (Khushmeen, CC0, kein Hinweis nötig, Alexej will ihn trotzdem: unter der Liste «Doodles von Khushmeen» als Link auf khushmeen.com, nur Text; Herkunft in `brand/doodles/README.md`): 451 handgezeichnete SVG, **ohne die Kategorie «files»** (24) bleiben 427 in 14 Kategorien. Logos (Apple, Instagram usw.) bleiben auf Wunsch von Alexej drin.
- **Eigener Tab «Doodles»** in der Bibliothek (4. Tab), mit Suche (Name, englisch) und Auswahl der Kategorie. Höchstens 120 Treffer, darüber ein Hinweis, die Suche einzugrenzen.
- **Im Projekt** Element `brand`, Id `doodle-<kategorie>-<name>`, einfärbbar wie Scribbles (Standard Akzent), Einfügegrösse wie Icons. Die Daten liegen als eine Datei (`brand/doodles/doodles.json`, nur Pfade) in einem eigenen Chunk, der beim ersten Öffnen des Tabs oder beim Öffnen eines Projekts mit Doodles lädt; Verhalten bei Ladefehler wie bei Tabler (Platzhalter, Meldung, Export bricht ab).

#### Entscheide Phase 2.10 «Bedienung wie Figma» (27.10.2026)
- **Mehrfachauswahl:** Shift-Klick (Leinwand und Ebenen-Panel, nochmal Klick nimmt heraus), Aufziehrahmen auf leerer Fläche (wählt berührte, sichtbare, nicht gesperrte Elemente der aktuellen Slide), Strg + A (alles Wählbare der aktuellen Slide), Pfeiltasten verschieben um 1 px, mit Shift um 10 px. Alt + Pfeil bleibt Browser-Navigation und wird abgefangen wie bisher.
- **Gemeinsam bearbeiten:** Verschieben und Skalieren mit einer gemeinsamen Box; Löschen, Duplizieren, Sperren, Ausblenden wirken auf die ganze Auswahl, je ein Undo-Schritt. Call von Claude: Drehen der Mehrfachauswahl und Foto-Ausschnitt/Textbearbeitung gehen nur bei einem Element; Hilfslinien rasten an der gemeinsamen Box ein.
- **Kopieren und Einfügen:** Strg + C, X, V innerhalb des Projekts, auch auf andere Slides (Einfügen auf der aktuellen Slide an gleicher Position relativ zur Slide, danach um 40 px versetzt bei wiederholtem Einfügen). Zusätzlich Bild aus der Systemzwischenablage (Screenshot, kopiertes Foto) als Foto-Element, gleiche Regeln wie beim Foto-Import. Eingefügte Elemente verhalten sich wie Duplikate (Rolle `role` wie bei `duplicateElement`).
- **Rechtsklickmenü** auf Leinwand und Ebenen-Panel: Kopieren, Ausschneiden, Einfügen, Duplizieren, An gleicher Stelle duplizieren; Nach vorne, Nach hinten; Sperren, Ausblenden, Löschen; elementspezifisch (Foto: Ausschnitt bearbeiten, Maske bearbeiten, Spiegeln; Text: Text bearbeiten). Eigenes eckiges Menü, Tastatur bedienbar, `role="menu"`; Edge-Menü wird unterdrückt.
- **Kontextleiste (Phase 4c.5):** Im Ausschnitt- und im Maskenmodus schwebt eine eckige Leiste unten mittig knapp über der waagrechten Bildlaufleiste (oben, wenn sie sonst das Foto verdeckt; die Leinwand ändert sich nicht, nur die Leiste fängt Zeigerereignisse). Ausschnitt: Titel, Hinweis, «Fertig». Maske: Titel, Ausblenden/Einblenden, Grösse, Härte (dieselben Werte wie im Inspektor, dort steht auch die Ansicht «Rote Folie»/«Ergebnis») und «Fertig», ohne Hinweistext. Im Inspektor stehen die Pinselwerte eingerückt unter «Maske bearbeiten». Eingang über Inspektor oder Rechtsklickmenü.
- **Kontextleiste, weitere Fälle (Phase 4c.6):** Immer höchstens eine Leiste, Vorrang: Ausschnitt, Maske, Text bearbeiten, KI läuft, Mehrfachauswahl, Video, Bitte prüfen, Rückgängig-Hinweis. Text: «Strg + Enter übernimmt, Esc verwirft» und «Fertig». Rückgängig nach Löschen oder Layoutwechsel mit Inhalt, nur solange die Aktion die letzte ist (etwa 6 s). Ansagen über eine gemeinsame Live-Region.
- **Eigenes Menü überall (2.10.1):** Rechtsklick (auch Menütaste, Umschalt + F10) öffnet im ganzen Editor unser Menü statt dem des Browsers: auf einer Slide-Kachel Duplizieren, Nach links/rechts, Löschen; sonst Rückgängig, Wiederholen, Projektdatei sichern, Exportieren. In Textfeldern (2.10.2) zeigt es Ausschneiden, Kopieren, Einfügen und Alles auswählen fürs Feld (Einfügen über `navigator.clipboard.readText`, abgelehnt: Hinweis «Einfügen: drücke Strg + V.»); der Fokus wechselt ins Menü, die Markierung des Felds bleibt erhalten (bei offenem Menü nicht sichtbar), beim Schliessen geht der Fokus ans Feld zurück; Öffnen übernimmt keinen Entwurf, Bearbeiten und Umbenennen bleiben offen. Auf Auswahlfeldern und Eingaben ohne Text, auf der Startseite und in Dialogen bleibt das Menü des Browsers.
- **Entsperren und Einblenden per Rechtsklick (2.10.1):** Rechtsklick irgendwo auf einer Slide listet oben im Menü alle gesperrten oder ausgeblendeten Elemente dieser Slide («Foto 1 entsperren», «Foto 2 einblenden», beides: «… entsperren und einblenden»), oberstes zuerst; ein Undo-Schritt, das Element wird gewählt. Sperren und Ausblenden stehen im Ebenen-Panel und im Rechtsklickmenü des Elements.
- **Zahlenfeld (2.10.1, 4c):** Pfeiltaste im Feld gilt sofort, nur Tippen ist ein Entwurf; die Anzeige folgt immer dem echten Wert. Eigene +/−-Knöpfe gibt es seit 4c nicht mehr.
- **Kompakter:** Abstände und Zeilen im Inspector enger bei gleicher Struktur; Slide-Leiste bleibt bei 1280 px in einer Zeile.
- **Nicht in 2.10:** Gruppieren, Ausrichten, Kopieren zwischen Projekten, dichteres Ebenen-Panel, schmalere Bibliothek.

#### Entscheide Phase 3 «Video» (27.10.2026)
- **Einfügen:** «Foto hinzufügen» heisst «Foto oder Video» (Call von Claude), Drop und Dateiwahl nehmen beides, auch in leere Platzhalter. Videos: MP4 und MOV. Beim Import prüft die App, ob Edge die Datei dekodiert (iPhone-HEVC braucht auf Windows die HEVC-Erweiterung oder eine passende Grafikeinheit); sonst Meldung mit Anleitung («auf dem iPhone ‹Kompatibel› wählen»). **HEIC-Fotos** werden im Browser in JPEG umgewandelt (WASM-Bibliothek in eigenem Chunk, lädt erst beim ersten HEIC).
- **Modell (Call von Claude):** Ein Video ist ein `photo`-Element mit optionalem Feld `video { start, end, sound, duration }` in Sekunden. `assetId` zeigt auf die Videodatei (`AssetMeta.mime` `video/…`, Breite und Höhe nach Drehung), so laufen Platzhalter, Layoutwechsel, Ausschnitt, Kopieren und Duplizieren unverändert. Kein zweiter Elementtyp. `ElementType.timeBased` entfällt zugunsten einer Prüfung am Element.
- **Speichern:** Videodatei als Blob in OPFS wie Fotos. Asset-Id = SHA-256 über die ersten und letzten 4 MB plus Dateigrösse (Call: eine ganze 500-MB-Datei zu hashen braucht den ganzen Speicher).
- **Grenzen:** Warnung beim Import ab 60 s oder 500 MB («Export und Vorschau werden langsam»), der Import klappt. Export: höchstens 60 s je Slide.
- **Effekte am Video:** BBZB-Look, Verlauf, Korn (gleiche Effekt-Registry und Reihenfolge wie beim Foto). Bildregler, Rahmen und Spiegeln gibt es am Video nicht, Freistellen auch nicht. Die Zugriffe `adjustOf`, `flipOf` und `frameOf` liefern für ein Video neutrale Werte.
- **Kürzen:** Im Inspector ein Bereichsregler mit Start- und End-Klammer (seit 4c, vorher zwei Regler), Sekundenfelder, mindestens 1 s Abstand. Beim Ziehen zeigen zwei kleine Vorschaubilder das erste und das letzte Bild des gewählten Stücks. Die Leinwand zeigt das Startbild mit allen Effekten. Eine Zeitleiste ist eine spätere Erweiterung.
- **Ton:** Standard aus, Schalter «Ton» je Video. Der Export nimmt den Ton des ersten sichtbaren Videos der Slide mit Ton an (AAC). Kann Edge nicht AAC kodieren, bricht der Export mit Meldung ab, statt still ohne Ton zu liefern.
- **Vorschau:** Play-Knopf im Inspector spielt das gekürzte Stück als Schleife auf der Leinwand, mit Look, Verlauf und Korn in höchstens 540 px Breite. Sie endet bei Pause, Auswahl- oder Slidewechsel. Nie im Undo, nie im Export.
- **Export:** Slides mit sichtbarem Video werden MP4 (H.264, 1080 breit, 30 fps), die übrigen Bild wie gewählt, alles im selben ZIP (`_02.mp4`). Fortschritt je Slide in Prozent und ein Knopf «Abbrechen» (Call). Fehlt in Edge ein H.264-Encoder, bricht der Export mit Meldung ab. Hinweis im Dialog bei Video-Slides: «LinkedIn erlaubt keine Videos in einem Bildkarussell.» (unabhängig vom Kanal).
- **Projektdatei:** Videos sind vorerst **nicht** in der `.bbzbsocial` (die Datei bleibt klein, sie packt alles im Speicher, ein Bild darf höchstens 100 MB). Die Entscheidung steckt in `packsAsset` (`projectFile.ts`). Umlegen allein genügt später nicht: `unpackProject` prüft einen SHA-256 über die ganze Datei, und `StartPage.importFile` hasht beim Einlesen neu (`put(blob)`); beide müssen für Videos `videoAssetId` nutzen. Beim Öffnen ohne Video zeigt das Element den Platzhalter «Video fehlt, füge es neu ein», der Export bricht mit dieser Meldung ab, «Foto ersetzen» setzt ein neues Video (Kürzung wird zurückgesetzt). Beim Sichern erscheint eine Meldung, dass Videos nicht in der Datei sind.
- **Exportqualität (3.2, 28.10.2026):** Projektfeld `exportQuality` (`klein`, `standard`, `hoch`; fehlt = standard), Auswahl in den Projekteinstellungen. Steuert die Video-Bitrate (4, 8, 14 Mbit/s) und die JPEG-Qualität (0.80, 0.92, 0.97); PNG und Auflösung bleiben (1080 px breit, 30 fps). Werte in `exportQuality` in `src/tokens.ts`. Der Dialog nennt «Video etwa N MB pro Minute». Es gibt keine Dateigrössen-Grenze im Export; Bilder in doppelter Auflösung stehen im Ideenspeicher.
- **Nicht in Phase 3:** Panorama-Video, Zeitleiste, Bildregler/Rahmen/Spiegeln am Video, LinkedIn-Set, Videos in der Projektdatei, Vorab-Umwandlung grosser Videos.

#### Text, Scribbles, Sicherheitszonen
- **Text-Feineinstellung:** Zeilenabstand 0.8 bis 1.3 × Stilwert, Laufweite ±20/1000 em um den Stilwert. Standard ist der Stilwert.
- **Ebenenname:** Wechselt ein Text zwischen Kommentar und Titel, folgt sein Name («Kommentar 2» wird «Titel 2»), solange er der automatische ist. Ein von Hand gesetzter Name bleibt.
- **Scribbles in Layouts** werden über die Id im Manifest angesprochen (der Pfeil aus der PSD ist `scribble-05`, gedreht oder gespiegelt); das Layout-Element trägt den beschreibenden Namen («Pfeil», «Strahlen», «Funkeln»).
- **Fehlendes Markenbild:** Fehlt ein Scribble, ein Icon oder der Pin im Ort-Tag, zeigt die Leinwand einen blauschwarzen Platzhalter und die Meldung «Ein Scribble oder Icon fehlt. Lösche es und füge es aus der Bibliothek neu ein.». Der Export bricht mit derselben Meldung ab.
- **Sicherheitszonen und Ränder** (Schalter «Sicherheitszonen», Standard aus, nie im Export, fangen keine Klicks): Story 9:16: oben 250 px und unten 340 px frei (strengste gängige Instagram-Richtwerte). Post 4:5: Linien für den Zuschnitt im Profilraster (3:4, je etwa 34 px links und rechts). Zusätzlich die 72-px-Ränder der PSD auf allen vier Seiten (auch bei der Story), als blauschwarze gepunktete Linie auf warmweisser Unterlage. Elemente rasten an Zonen und Rändern ein.

### Ebenen
Reiter «Ebenen» neben «Bibliothek» im Fach links (seit 4c), mit allen Elementen der aktuellen Slide (inkl. der Elemente, die hineinragen), Reihenfolge per Drag, Auge, Schloss, Umbenennen per Doppelklick. Gruppen sind kein Muss für die erste Version.

### Brand Library
- Reiter «Bibliothek» im Fach links, darin Unterreiter in einer Zeile (nur Text, aktiv unterstrichen): **Scribbles**, **Icons**, **Tags**, **Doodles**, später **Meine Sticker** (lokal gespeicherte Freisteller, kommt mit dem Freistellen). Es gibt keine Tabs «Hintergründe» und «Farben».
- Darüber, über den Reitern, die Knöpfe «Foto oder Video» und «Text» (aus der Registry befüllt über `ElementType.add` mit optionalem `icon`).
- Tastatur: Pfeiltasten, Pos1 und Ende wechseln den Tab, Enter oder Leertaste fügt ein. Klick setzt das Asset in die Mitte der aktuellen Slide, Drag an die Zielposition. Der Tooltip einer Kachel nimmt den Namen aus `aria-label`.
- Inhalt kommt aus einem **Manifest** (`brand/manifest.json` o. ä.). Ein neues Asset braucht nur Datei plus Manifest-Eintrag, keinen Code. Fehlt eine Datei oder ist ein Eintrag ungültig, zeigt die Bibliothek die übrigen Assets und darüber eine Meldung mit der Liste der Fehler.
- **Pflege im Repo:** Neue Layouts und Assets kommen als Dateien ins Repo und werden neu veröffentlicht. Es gibt keine Layout-Bearbeitung und keinen Import von Asset-Paketen in der App.

### Masken und KI-Freistellen
- **Ein Maskensystem (Entscheid Alexej, 28.10.2026):** Die Maske ist eine Eigenschaft des Fotos: ein Schwarz-Weiss-Bild, das sich immer genau wie das Foto verändert (Verschieben, Drehen, proportional und unproportional Skalieren, Ausschnitt) und nie verrutscht. Die KI-Freistellung und der Pinsel schreiben in dieselbe Maske, es gibt keine zweite Logik und keine zusammengeklebte Lösung. Woher die Maske stammt (KI oder von Hand), ist egal; man kann auch ohne KI eine Maske malen und mit KI beginnen und von Hand nachbessern.
- **Maske bearbeiten (Entscheide Phase 4a, 28.10.2026):** einfacher Pinsel mit zwei Knöpfen «Ausblenden» und «Einblenden» (Taste X tauscht sie), Härte als Regler von weich bis hart, Grösse als Regler plus Tastenkürzel (kein Mausrad, das ist für Zoom belegt). Beim Malen zeigt eine rote, durchscheinende Folie die ausgeblendeten Bereiche, das Foto bleibt sichtbar. Dazu: Maske umkehren, Maske zurücksetzen (alles einblenden) und Maske weich zeichnen (Regler für weiche Kante). Ein Strich ist ein Undo-Schritt.
- **Reihenfolge (Entscheid Alexej):** 4a Maske und Pinsel ohne KI (keine neuen Requests), 4b KI-Freistellen schreibt in dieselbe Maske (eigener Plan nach dem Live-Test von 4a, Modell erst nach Lizenzprüfung und Vergleich), 4.1 Klick-Auswahl. Klick auf «Freistellen» setzt standardmässig die Maske am Foto; Sticker und «Motiv vor Titel» sind weitere Knöpfe.
- **Entscheide Phase 4b (28.10.2026):**
  - **Umfang (Alexej):** Hintergrund entfernen als Maske, Sticker und «Motiv vor Titel» alles in 4b. Ein Tab «Meine Sticker» (projektübergreifend, gespeichert) ist nicht Teil von 4b und fürs BBZB nicht relevant (dafür gibt es Doodles und Scribbles); ein Sticker ist nur ein Element im Projekt.
  - **Modellquelle (Alexej):** Hugging Face, Quelle in der Konfiguration (`tokens.ts`), Umstellen auf eigenen Host bleibt möglich. **Download (Alexej):** startet beim ersten Klick sofort, mit Fortschritt («Einmalig ca. X MB») und Abbrechen, danach im Browser gecacht.
  - **Sticker (Alexej):** freigestelltes Foto als Kopie, das Original bleibt. Es gibt keinen Elementtyp «Sticker»: ein Bild mit Maske bleibt ein Foto, auch bei einem späteren Tab «Meine Sticker» (Bilder mit oder ohne Alphakanal).
  - **Calls von Claude, von Alexej zu prüfen:** Sticker und «Motiv vor Titel» brauchen schon eine Maske am Foto (Knopf inaktiv mit Erklärung, sonst wäre es zweimal dieselbe Logik); der Sticker liegt wie «Duplizieren» versetzt und oben, «Motiv vor Titel» liegt deckungsgleich direkt über dem Titel der Slide. Eine bestehende Maske wird beim Freistellen ersetzt (ein Undo-Schritt). Gefunden wird nur ein Motiv (alles leer oder alles voll: Meldung «Kein Motiv gefunden», Maske bleibt). Die Modell-Laufzeitdateien (WASM) liegen auf der eigenen Herkunft, kein Laufzeit-CDN. Einziger neuer Host in `connect-src` sind die Modell-Hosts von Hugging Face.
  - **Modell (Alexej, 28.10.2026, nach Vergleich `docs/research/2026-10-28-freistellen-modellvergleich.md`):** ISNet general use (`imgly/isnet-general-onnx`, `onnx/model_fp16.onnx`, Eingabe 1024 px, 88 MB, MIT bzw. Apache-2.0). RMBG-2.0 ist nicht-kommerziell lizenziert, BiRefNet und BiRefNet_lite brechen in Edge mit Speicherfehler ab, MODNet hat unbrauchbare Kanten. Offen: die Nutzungsbedingungen der Trainingsdaten (DIS5K) hat niemand mit Rechtswissen gelesen. transformers.js bleibt auf 3.8.x (4.3.2 scheitert mit einem WebGPU-Shaderfehler). Die Ausgabe wird min-max normalisiert. Auf Windows-Schulgeräten ungetestet, steht in der Checkliste.
- **Nachbesserung 4b.1 (Alexej, 28.10.2026, Calls von Claude):** Im Pinselmodus schaltet ein Umschalter zwischen «Rote Folie» (heute, Standard) und «Ergebnis»: Das Foto zeigt dann live die echte Maske (ausgeblendete Bereiche durchsichtig, wie im Export), der Pinsel malt weiter. Die Wahl ist Ansicht (nicht in der History, gilt für die Sitzung, auch nach Verlassen und neuem Öffnen des Modus; Standard «Rote Folie»). Im Ausschnitt-Modus zeigt eine dünne Linie den Rand des Ausschnitts; der abgedunkelte Bereich ausserhalb bleibt.
- **Ausschnitt-Leiste (4c.5):** schwebt unten mittig über der Leinwand, 0.75 rem über der waagrechten Bildlaufleiste, ohne die Leinwand zu verkleinern; läge sie auf dem Rahmen des Fotos, steht sie oben mittig.
- **Ein Klick «Freistellen»** auf einem Foto: Das Modell erzeugt die Maske. Ergebnis wahlweise als Maske am Foto, als neuer Sticker oder als «Motiv vor Titel» (Kopie über dem Titel, deckungsgleich). Bis dahin sind «Motiv vor Titel» und Pop-out normale Fotorahmen der Layouts.
- **Klick-Auswahl:** Punkte setzen (einschliessen/ausschliessen), um bei Gruppenfotos genau eine Person oder ein Objekt zu wählen.
- Läuft in einem **Web Worker**, WebGPU mit WASM-Fallback. Fortschrittsanzeige beim ersten Modell-Download («einmalig ca. X MB»).
- **Modellwahl:** das stärkste, das in Edge zuverlässig läuft. Zuerst ein kurzer Vergleich (RMBG-2.0, BiRefNet, BiRefNet_lite) an den Referenzfotos (Kriterien: Kantenqualität bei Haaren/Helmen, Laufzeit auf einem Schul-Laptop). Das Modell steckt hinter einer `AiTool`-Schnittstelle und ist austauschbar.

### Bedienung der Oberfläche
Seit Phase 4c nach dem Pen-Entwurf `docs/design/editor.pen`. Werte stehen nur in `src/ui/theme.ts` (Oberfläche) und `src/tokens.ts` (Slides), die Gestaltungsregeln in `DESIGN.md`.
- **Akzentfarbe der App:** das Blau des Kantons Luzern aus dem Entwurf (Token `accent`, ersetzt das Logo-Blau) für Exportieren, gewählte Kacheln und Aktives; nie als Slide-Farbe angeboten. Jede Farbe hat eine Rolle: Akzent für Auswahl, Tinte invers für «gewählt/an», Senf nur für «Bitte prüfen», eigene Farbe für Gesperrtes. Auf der Leinwand bleiben Auswahl, Anker, Hilfslinien und Sicherheitszonen orange. Der Fokusring ist Tinte (2 px), auf dunklen Flächen Papier.
- **Formen und Tiefe:** eckig, flach. Harter Schattenversatz nur an Tasten in Ruhe und an Overlays (Menüs, Popover, Dialoge, Meldungen); Reiter, Abschnittsleisten, Kacheln und Menüeinträge haben nie Schatten. Animationen nur auf Transform und Opazität, mit `prefers-reduced-motion` aus.
- **Bewegung:** Wechselt die Auswahl in einer Gruppe (Umschalter, Reiter links, Kategorie-Reiter), gleitet die schwarze Fläche in ca. 220 ms zum neuen Knopf; die Schrift in Papier steckt als Kopie in der Fläche, ist also nie auf hellem Grund. Die Zahl am Regler gleitet bei jedem neuen Wert kurz von unten herein, auch beim Ziehen (100 ms, Neustart je Bild, nur die Ziffern; nicht beim Tippen).
- **Platz:** Ohne horizontales Scrollen und ohne Scrollen der Seite bedienbar bei 1536 × 864 (Full HD, 125 %) bis hinunter zu 1280 × 720. Der Inspector scrollt in sich. Knopfhöhe 2.5 rem, Icons 18 px. Nichts liegt über der Leinwand ausser Meldungen und Overlays.
- **Kopfzeile:** links Logo (ab 1100 px), Übersicht (`IconHome`), Projektname; rechts Rückgängig, Wiederholen, Projektdatei sichern, Einstellungen, Exportieren (einziger Knopf in Akzentfarbe).
- **Fach links:** oben «Foto oder Video» und «Text», darunter die Reiter «Bibliothek» und «Ebenen» (Pfeiltasten wechseln, das inaktive Panel ist ausgeblendet).
- **Slide-Leiste:** Kacheln, Sicherheitszonen, Zoomgruppe (Verkleinern, Prozent, Vergrössern, Einpassen) und Unterlage, dann die Slide-Aktionen. Zoom und Ansicht sitzen hier, damit sie die Leinwand nie verdecken.
- **Unterlage:** Farbe des Tisches um die Slides (Grau, Dunkel, Grün, Blau), Popover in der Slide-Leiste. Nur Ansicht: im Browser gemerkt, nie im Projekt, nie im Undo, nie im Export. Eine Haarlinie zeigt den Slide-Rand.
- **Schreibmatte** wie im Entwurf: Lineal über den Slides (Teilstriche je 1/20 Slide-Breite, jeder fünfte lang, folgen dem Zoom) und Passermarken an den vier Ecken der Arbeitsfläche. Nur Ansicht, nie im Export; dunkel auf Grau, hell auf den dunklen Unterlagen.
- **Icons:** Tabler (MIT) über `@tabler/icons-react` mit fester Version, Einzelimporte, lokal gebündelt, 18 px, `currentColor`, `aria-hidden`. Keine Unicode-Zeichen oder Emojis als Icons. Spiegeln waagrecht `IconFlipHorizontal`, senkrecht `IconFlipVertical`: Tabler zeichnet bei `IconFlipHorizontal` die Achse senkrecht, das Symbol zeigt also die Achse, an der gespiegelt wird (wie im Entwurf). Gleiche Symbole im Untermenü «Spiegeln».
- **Beschriftung:** Icon + Text nur bei Hauptaktionen (Exportieren, Foto oder Video, Text, Slide hinzufügen, Ersetzen, Ausschnitt, BBZB-Look). Alles andere ist ein Icon-Knopf (2.5 rem quadratisch) mit Tooltip. **Löschen behält das Wort** (im Inspector; in der Slide-Leiste wie «Slide hinzufügen» erst ab 1536 px). Jeder Icon-Knopf hat einen zugänglichen Namen (`aria-label`) und `data-tip`; ein Architekturtest und `e2e/icons-a11y.spec.ts` halten das fest. Kein `title=`.
- **Tooltips** (`src/ui/Tooltip.tsx`): eckig, Papier auf Tinte, Name und Kürzel als Taste («Strg») rechts. 400 ms Verzögerung bei Maus und Tastaturfokus (`:focus-visible`), 800 ms Nachlauf, beides in `tokens.tooltip`. Esc, Klick, Scrollen und Verlassen schliessen ihn; er bleibt im Fenster und verdeckt den Knopf nicht. Längere Erklärungen hängen zusätzlich als `aria-describedby` am Knopf. Deaktivierte Knöpfe nutzen `aria-disabled` mit Guard im Handler, damit der Tooltip erklärt, warum; die Knöpfe der Slide-Leiste bleiben nativ `disabled`.
- **Kürzel:** Strg + Z, Strg + Umschalt + Z (auch Strg + Y), Strg + D, Entf, Strg + A (alles), Strg + C/X/V (Elemente, Foto aus der Zwischenablage), Pfeiltasten (1 px, mit Umschalt 10 px), Rechtsklick (Kontextmenü), Umschalt-Klick und Aufziehrahmen (Mehrfachauswahl), Strg + Plus/Minus/0, Esc, Alt + ←/→, Leertaste ziehen, **Strg + S** (Projektdatei sichern) und **Strg + E** (Exportieren). Strg + S/E fangen die Edge-Belegung immer ab, auch beim Tippen und bei offenem Dialog. `KEYS` in `src/ui/keys.ts` speist die Tooltips, `shortcuts.ts` bleibt die Quelle der Handler. Esc im Projektnamen verwirft die Eingabe, ein zweites Esc hebt die Auswahl auf. Esc in einem offenen Menü oder Popover schliesst nur dieses.
- **Inspector:** Abschnitte (`Section`, Prop `heading`) mit grauer Leiste, einklappbar; sie starten zu, ausser «Ebene» (Duplizieren, An gleicher Stelle duplizieren, Nach vorne, Nach hinten, Löschen) und «Darstellung» (Deckkraft). Jeder Abschnitt öffnet unabhängig, der Zustand gilt pro Abschnitt für die Sitzung, auch über Auswahlwechsel. Reihenfolge Ebene, Darstellung, dann je Element (Foto: Bild, Maske, Effekte). Positions- und Grössenfelder gibt es nicht. Unterabschnitte («Erweitert» mit den Bildreglern und Zurücksetzen, Einstellungen pro Effekt) sind eingerückt.
- **Effekte:** «+» öffnet ein Menü mit allen Effekten (Foto: Rahmen, Korn, Verlauf; Slide: Korn, Verlauf); die Einstellungen pro Effekt stehen darunter, mit Entfernen.
- **Bedienelemente:** Ja/Nein ist ein Schalter, eine Wahl aus mehreren eine Auswahlreihe (gewählt Tinte invers). Farbfelder zuerst Akzent, dann ein Abstand, dann die Markenfarben.
- **Regler:** eine Komponente `src/ui/Slider.tsx` (Grösse, Zeilenabstand, Laufweite, Deckkraft, Bildregler, Reichweite): Bahn mit Teilstrichen (Enden und Mitte lang), Griff wie das Bauteil «Fader» im Entwurf (eckig, Papier, Akzentstrich, kein Schatten; ein eigenes Element über dem unsichtbaren Browser-Griff, damit er in jedem Browser gleich aussieht), Zahlenfeld mit Einheit rechts, keine +/−-Knöpfe. Bildregler haben die Nullstelle in der Mitte und Beschriftungen an beiden Enden. Doppelklick auf den Griff = Standardwert, Tastatur (Pfeile, Pos1/Ende), eine Geste = ein Undo-Schritt. Video kürzt mit einem Bereichsregler (`RangeSlider`) wie das Bauteil «Bereichsregler» (Klammern, Schiene mit Rand, Auswahl in Tinte). Der Drehregler (`Knob`) stellt die Korn-Stärke ein (Zahl links, Knopf rechts, senkrecht ziehen).
- **Rechtsklickmenü:** eckig, Tastatur bedienbar, `role="menu"`; Untermenüs (Foto: «Spiegeln» mit Waagrecht und Senkrecht) öffnen per Hover, Klick oder Pfeil rechts.
- **Meldungen:** schweben unter der Kopfzeile oben mittig über der Leinwand. Fehler und Info unterscheiden sich durch Symbol und Randbreite, nicht nur durch Farbe. Infos schliessen nach 8 s, ausser Maus oder Fokus liegt darauf; Fehler bleiben bis zum Schliessen. `role="alert"`, Schliessen mit X-Icon.
- **Schriften der Oberfläche:** Host Grotesk (400, 600, 700) zum Bedienen, Newsreader (400) nur für Hinweise, beide OFL, lokal unter `public/fonts/`, Lizenztexte unter `public/licenses/` und im Lizenzen-Dialog. Sie laden vor dem ersten Render höchstens 1.5 s; fehlen sie, greift die Systemschrift ohne Hinweis und der Export bleibt frei. Segoe UI und Braveold sind nur für Slides und Exporte.
- **Dokumente:** `PRODUCT.md` und `DESIGN.md` (mit `.impeccable/design.json`, erzeugt aus der gebauten Oberfläche) beschreiben die Oberfläche; spätere Phasen bauen im selben Stil.

### Export
- Dialog: Liste der Slides mit erkanntem Typ (Bild/Video), Format JPEG (Standard, Qualität 0.92) oder PNG.
- **Video-Slides:** Jede Slide, die ein sichtbares Video-Element schneidet, wird MP4 (H.264, 1080 breit, 30 fps). Die Dauer richtet sich nach dem längsten gekürzten Video der Slide, maximal 60 s. Statische Elemente werden in jedes Frame gerendert. Ton: der des ersten sichtbaren Videos mit Ton an. Kein Panorama-Video (Entscheid Alexej): reicht ein Video über eine Naht, wird jede berührte Slide ein MP4 ab Sekunde 0, ohne Sonderlogik. Der Kanal ändert den Videoexport nicht.
- Ausgabe: ZIP-Download `<projektname>_01.jpg`, `_02.mp4` … oder, in Edge, direkt in einen gewählten Ordner (File System Access API).
- Export in exakt 1080 px Breite, sRGB, ohne UI-Elemente (Auswahl, Hilfslinien, Sicherheitszonen, Ränder, «Bitte prüfen»).

### Speichern
- **Autosave** lokal: Dokument-JSON in IndexedDB (Dexie), Medien als Blob in OPFS, referenziert über Asset-ID (Hash). Kein Base64 im Dokument.
- **Projektdatei** `.bbzbsocial` (ZIP: `project.json` mit Schema-Version und `assets/`) zum Sichern und Weitergeben. Das ist die verlässliche Sicherung, weil Browser-Speicher geräumt werden kann.
- Neue Dokumentfelder sind optional, der Standard wird beim Lesen gesetzt; die Schema-Version bleibt 1. Unbekannte alte Felder werden ignoriert.
- Undo/Redo (Strg + Z / Strg + Umschalt + Z), ein Schritt pro Geste.

## 9. Architektur (Vorgaben)
- **Stack:** React 19, Vite, TypeScript (strict), Konva/react-konva, zustand + immer + zundo, Mediabunny, transformers.js, Dexie, fflate. Begründung: `docs/research/2026-10-21-stack-recherche.md`.
- **Dokumentmodell** ist reines TypeScript ohne React-Abhängigkeit: `Project { schemaVersion, format, slides[], elements: Record<id, Element>, order: id[], assets }`. Elemente in globalen Koordinaten.
- **Registries** als einzige Erweiterungspunkte, je ein Ordner pro Modul:
  - `ElementType` (Render-Komponente, Inspector-Panel, Standardwerte, Export-Verhalten, z. B. «ist zeitbasiert»)
  - `LayoutPreset` (Daten)
  - `AssetPack` (Manifest)
  - `Exporter` (JPEG, PNG, MP4, ZIP, Ordner)
  - `AiTool` (Freistellen, Klick-Auswahl)
  - `Effect` (Korn, BBZB-Look, Kontur/Schatten)
  - `FormatPreset` (4:5, 9:16)

  Der Kern importiert keine Module direkt. Module registrieren sich über eine zentrale `plugins/index.ts`.
- **Rendering für den Export** nutzt denselben Szenengraph wie der Editor (kein zweiter Renderer). Für Video-Frames wird die Bühne pro Zeitpunkt mit decodierten Frames (Mediabunny) gerendert.
- **CSP** im `index.html`/Host: `connect-src 'self'` plus die Modell-Quelle (vorerst Hugging Face, später eigener Host). `img-src`/`media-src` erlauben `blob:` und `data:`.
- Keine Analytics, kein Tracking, keine externen Fonts/CDNs zur Laufzeit.

## 10. Qualität und Tests
- **Unit (Vitest):** Dokumentmodell, Slide-Zuordnung, Layout-Instanziierung, Export-Zuschnitt-Mathematik, Manifest-Laden.
- **E2E (Playwright mit `channel: 'msedge'`):** Projekt anlegen, Foto in Platzhalter ziehen, Text ändern, exportieren, ZIP prüfen.
- **Pixel-Tests:** Ein Testprojekt mit einem Foto über der Naht exportieren und prüfen, dass die letzte Pixelspalte von Slide n und die erste von Slide n+1 lückenlos anschliessen. Golden Images für die Layout-Presets mit Toleranz.
- **MP4-Test:** Exportierte Datei hat die erwartete Dauer, Auflösung und Bildrate (via Mediabunny auslesen).
- **Netzwerk-Test:** Während eines kompletten Ablaufs (Import, Freistellen mit gecachtem Modell, Export) gibt es keinen Request mit Bilddaten. Playwright prüft alle Requests: nur GET auf erlaubte Hosts.

## 11. Ausbauphasen (Reihenfolge)
Offene Features und Reihenfolge: GitHub-Issues mit Label `social-studio`.

1. **Grundgerüst** (erledigt): Projekt, Formate, Slides, Foto + Text, Ebenen, nahtlose Leinwand, JPEG/PNG-ZIP-Export, Autosave, Projektdatei, Undo, Modus-Schalter, Deployment mit CSP.
2. **BBZB-Look** (erledigt, 2a bis 2.5): Tokens, Textstile, Tags, Brand Library, Layout-Presets mit Story-Varianten, Korn, Verläufe, Rahmen, Hilfslinien, Sicherheitszonen, verknüpfte Slides, Akzentfarbe nach Standort, Gestaltung der App.
3. **Video** (erledigt): Import (auch HEIC-Fotos), Vorschau, Kürzen, Ton, MP4-Export.
4. **Maske, KI und Redesign** (4a, 4b, 4c erledigt): Maske und Pinsel, Freistellen, Sticker, Motiv vor Titel, neue Oberfläche nach dem Pen-Entwurf. Offen: 4.1 Klick-Auswahl, Pop-out.
5. **Feinschliff** (offen): Vorschaubilder auf der Startseite, Usability-Test mit jemandem aus dem Sekretariat.

Nach jeder Phase ist die App benutzbar.

## 12. Entscheide aus der Spezifikationsprüfung (Calls von Claude, vom Auftraggeber zu prüfen)
- **Projektdatei früh:** Export/Import der `.bbzbsocial`-Datei kommt in Phase 1, nicht erst in Phase 5. Falls Browser-Profile auf Schulrechnern beim Abmelden gelöscht werden, ist sie die einzige Sicherung.
- **Fehlende Brand-Schrift blockiert den Export.** Lädt eine Brand-Schrift nicht, zeigt der Editor eine deutliche Warnung, und der Export bricht mit einer verständlichen Meldung ab. Ein stiller Fallback auf eine andere Schrift ist nicht erlaubt.
- **Modellquelle konfigurierbar:** Die URL der KI-Modelle steht in einer Konfiguration (Standard Hugging Face, alternativ eigener Pfad unter `/models/`). Ist Hugging Face im Schulnetz gesperrt, genügt ein Umstellen.
- **HEVC/HEIC:** Beim Import wird geprüft, ob Edge die Datei decodieren kann (`VideoDecoder.isConfigSupported`, Test-Decode). Falls nicht, erscheint eine klare Meldung mit Anleitung («auf dem iPhone ‹Kompatibel› wählen» bzw. konvertieren). HEIC-Fotos werden im Browser konvertiert (z. B. `heic2any`/libheif-WASM).
- **Layout-Geometrie aus der PSD:** Positionen, Schriftgrössen, Rahmen-, Kontur- und Schattenwerte der Presets werden aus der Original-PSD ausgelesen (Photoshop-MCP) und als `docs/reference/psd-geometry.json` abgelegt. Golden-Image-Tests vergleichen mit Toleranz (mittlere Abweichung pro Kanal ≤ 2 %), die Referenz sind die eigenen ersten abgenommenen Exporte, nicht die JPGs mit Platzhalterfotos.

- **Kanal Instagram/LinkedIn:** Das Projekt hat eine Kanal-Einstellung. Sie tauscht den CTA auf der Abschluss-Slide («Link in Bio» bzw. «bbzb.lu.ch»). Ein «LinkedIn-Set» mit Standbildern gibt es nicht (Entscheid Phase 3): Videos werden immer als MP4 exportiert, der Export-Dialog weist bei Video-Slides darauf hin, dass LinkedIn Video und Bild nicht in einem Karussell mischt. Ein PDF-Dokument-Carousel ist eine spätere Erweiterung.
- **BBZB-Look:** Gibt es ein Lightroom-Preset (`.xmp`), wird es als 3D-LUT nachgebaut. Sonst gilt eine Annäherung aus der PSD (Fotofilter «Erwärmen» + Dynamik), die die Kommunikation BBZB abnimmt.

## 13. Dem Builder überlassen
Ordnerstruktur im Detail, UI-Bibliothek für Panels (schlicht, eckig, passend zum CI), Tastenkürzel, Detail-Interaktionen, wie Story-Layouts genau aussehen (Daumenregel: wie 4:5, Platz in den Sicherheitszonen frei lassen), Benennung im Code (Englisch erlaubt, UI-Texte Deutsch).

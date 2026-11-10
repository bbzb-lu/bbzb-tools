# Archiv: Live-Test-Fragen Phase 2a bis 2.4

Erledigt oder abgenommen. Nur zum Nachschlagen, nicht Teil des Plans.

## Live-Test Phase 2.4: Alexej entscheidet (auf dem Windows-Gerät in Edge)
- **Tooltips:** Fühlen sich 400 ms Verzögerung und 800 ms Nachlauf (direkt der nächste) richtig an, oder zu träge oder zu hektisch? Beide Werte stehen in `tokens.tooltip`.
- **Icons verständlich?** «Rahmen» (Frame) sieht aus wie ein Doppelkreuz. «Spiegeln» (FlipHorizontal2) und die Kopier-Icons der Startseite (Bild = als Post, Smartphone = als Story): Erkennen Lernende sie ohne den Tooltip?
- **Strg + S und Strg + E** auf dem Windows-Laptop in Edge: Sichern und Exportieren öffnen sich, Edge zeigt weder «Seite speichern» noch ein anderes Fenster, auch beim Tippen im Projektnamen.
- **Logo bei 1280 px:** Es erscheint jetzt ab 1100 px. Wirkt die Kopfzeile bei 1280 px (und 125 %/150 % Skalierung) zu voll?
- **Slide-Leiste bei 1280 px:** Alle Kacheln sind sichtbar, die Aktionen stehen dafür in einer zweiten Zeile. Stört das, oder lieber wieder eine Zeile mit gescrollten Kacheln?
- **Startseite:** Verständlich mit «Post 4:5 anlegen», den Icon-Aktionen und der Sperre beim Anlegen? Zwei blaue Primärknöpfe: zu laut?
- **Hybride Beschriftung:** Stimmt die Auswahl, was mit Wort und was nur als Icon erscheint (Entscheid 2.4)? Fehlt irgendwo ein Wort?
- **Esc:** schliesst den Tooltip und hebt die Auswahl auf (der Tooltip verschluckt Esc nicht). So gewollt?
- **Platzhalter-Hinweis** auf Blauschwarz, Orange und Blau lesbar (nur Editor)?

## Live-Test Phase 2.3: von Alexej am 23.10.2026 getestet, abgeschlossen (Verlauf und Sicherheitszonen funktionieren, Punkte unten so angenommen)
- Beim Zuschneiden (Doppelklick) und beim Skalieren eines Fotos verschwinden Verlauf, Look und Korn kurz und kommen beim Loslassen zurück. Stört das beim Titel?
- **Verlauf-Stärken:** «Leicht» (0.11, Wert der PSD) ist sehr schwach, kaum zu sehen. Reicht das, oder soll es kräftiger sein? «Mittel» (0.35) ist meine eigene Wahl zwischen leicht und stark. Passt der Wert?
- **Aufhellen:** Sieht der warmweisse Verlauf auf dunklen Fotos gut aus (Profi-Modus)?
- **Layout-Wechsel (R2):** Ein Foto behält einen selbst gewählten Verlauf (auch «Aus»), nimmt aber den Verlauf des neuen Layouts, wenn seiner dem alten Platzhalter gleicht. Ein von Hand gesetzter Verlauf, der genau dem Vorlagenwert entspricht, gilt als unverändert. So gewollt, oder soll das Foto seinen Verlauf immer behalten? (Eine Stelle: `sameScrim` in `photo/index.tsx`.)
- **Ränder:** «Sicherheitszonen» zeigt die 72-px-Linien. Sind sie auf Blau, auf Fotos und in den Bändern der Story gut sichtbar, und stören sie beim Arbeiten nicht?
- **Reichweite:** Der Name ist Fachjargon. Verstehen Lernende ihn, oder besser «Wie weit ins Bild»?
- **Alte Testprojekte:** Slide-Verläufe aus 2.1 und 2.2 fallen beim Öffnen weg, sie werden nicht umgewandelt.

## Live-Test Phase 2.2: Alexej entscheidet (auf dem Windows-Gerät in Edge)
- **Panorama:** Verschieben (Ziehen, Pfeile, Alt + Pfeil), Duplizieren und Löschen («2 Slides löschen», Undo) bewegen beide Hälften zusammen. Fühlt sich die Gruppe in der Slide-Leiste richtig an?
- **Leinwand verschieben:** Leertaste + Ziehen und mittlere Maustaste, auch nach einem Klick auf einen Button. Bei der mittleren Maustaste prüfen, ob Edge den Autoscroll-Kreis zeigt.
- **Kanal-Meldung:** Passen Erklärung und Wortlaut der Meldungen («1 Link-Hinweis angepasst.», «Kein Link-Hinweis mit Standardtext gefunden.»)? Die Erklärung ist nur Tooltip (Maus über der Kanal-Gruppe) und Screenreader-Beschreibung der Buttons, nicht sichtbar in der Kopfzeile.
- **Neue Akzentfarbe:** Logo-Blau `#405FB7` statt Orange auf Startseite und im Editor. Passt der Look zum Logo?
- **Alte Testprojekte:** Panoramas aus 2.1 sind nicht verknüpft (R1) und teilen sich weiter beim Verschieben und Löschen. Neu anlegen.
- **Leinwand-Overlays** (Auswahl, Hilfslinien, Sicherheitszonen) bleiben orange (R2). Soll das auch blau werden?

## Live-Test Phase 2.1: von Alexej am 22.10.2026 getestet (UI deutlich besser, Verlauf/Korn als Schalter, Snapping, Format-Kopie und Vorlagen gut; Rückmeldungen in Phase 2.2)
- **Platz auf dem Laptop:** Passt alles ohne waagrechtes Scrollen, auch mit gewähltem Foto im Profi-Modus? Falls noch etwas überläuft: Fensterbreite, Anzeige-Skalierung (125 % / 150 %) und Windows-Textgrösse notieren. Die Kopfzeile hat bei 1280 px nur etwa 60 px Reserve; das Logo erscheint erst ab 1400 px.
- **Auswahl:** Fotoplatzhalter und Scribbles auf jeder Vorlage mit einem Klick wählbar, auch auf Slides mit Verlauf.
- **Slide-Hintergrund:** Farbe, «Korn», «Verlauf oben» und «Verlauf unten» ohne Auswahl im Eigenschaften-Panel schalten, in beiden Modi; Undo.
- **Fotorahmen:** Look der Collage mit Beispiel_05 vergleichen (Rand 24 px ringsum, gemessen im Referenzbild statt aus der PSD; Schatten). Rahmen an und aus, Ausschnitt und Spiegeln mit Rahmen.
- **Neues Projekt:** Die Layout-Wahl öffnet sich gleich für Slide 1. Ist das klar, und fehlt die frühere Startvorlage «Carousel»?
- **Foto über einem Text** bekommt den Verlauf nicht (R3: Texte, Tags und Scribbles werden nie abgedunkelt, deshalb liegt der Verlauf darunter). So gewollt?
- **Freies Foto als Sticker** auf einer Slide mit Verlauf wird oben bzw. unten mit abgedunkelt (R1). So gewollt?
- **Vorher:** Projekte aus dem 2b-Test mit Flächen vorher löschen (Flächen sind dort unsichtbar, Projektdatei lässt sich nicht mehr importieren).
- **Profi:** Slide-Schalter liegen bei 1536 × 864 unter dem sichtbaren Bereich (Inspector scrollt senkrecht).

## Live-Test Phase 2b: Alexej entscheidet
- **Golden Images der Layouts abnehmen:** jede Vorlage (Post und Story) mit Beispielfotos exportieren und mit `docs/reference/layouts/` vergleichen. Was nicht passt, korrigieren und die Goldens neu erzeugen. Bekannt: der Pfeil auf «Vollbild» ist flacher als in der Referenz.
- **Story-Ableitung:** Die Story ist der Post, um 240 px nach unten geschoben, Vollbild-Fotos wachsen auf 1920 px. Passt das, oder braucht jede Story eigene Masse?
- **Abschluss-Freisteller in der Story:** Der Rahmen (361 × 1150) schneidet das Foto schmaler zu als im Post.
- **Collage-Sticker** deckt in der Story mehr vom Rahmenfoto ab als im Post.
- **Leerer Fotorahmen** erscheint im Export als blosse Hintergrundfläche. Der Export-Dialog zeigt jetzt «2 Fotorahmen sind noch leer.» und exportiert trotzdem. Reicht das? *In Phase 2.1 ersetzt:* Ein leerer Platzhalter mit Rahmen erscheint als warmweisse Karte.
- **Korn und Look bei alten Fotos:** Ein Layout auf ein Foto aus Phase 1 anwenden schaltet Korn und Look ein (das Foto zieht in einen Platzhalter). Die Format-Kopie tut das nicht. So gewollt?
- **Textstil beim Layout-Wechsel:** Ein Text, der in einen Platzhalter zieht, übernimmt den Stil des neuen Layouts (eigene Profi-Einstellungen gehen verloren, Undo stellt sie wieder her).
- **«Bitte prüfen»** verschwindet nur mit «Geprüft», nicht beim Ansehen oder Bearbeiten. Im Inspector ist der Hinweis nur ohne Auswahl sichtbar (die Markierung an der Kachel bleibt).
- **15-Minuten-Probelauf von Hand:** ein Carousel mit eigenen Fotos auf einem Schul-Laptop in Edge bauen und exportieren, Zeit messen, Stolpersteine notieren. Der gespielte Ablauf (`e2e/beginner-trial.spec.ts`) braucht etwa 10 s und ersetzt das nicht.
- **Text bearbeiten braucht einen Doppelklick**, und nichts auf der Leinwand sagt das. Finden Lernende das ohne Hilfe? Sonst Hinweis im Inspector («Doppelklick zum Bearbeiten»).
- **Schatten des Fotorahmens** (Blur 30) beim Ziehen auf einem Windows-Schulgerät prüfen: auf dem Mac mit 4× Drosselung kein messbarer Unterschied (p95 10.1 ms mit und ohne).
## Live-Test Phase 2a: von Alexej am 22.10.2026 getestet, funktioniert (Punkte unten so angenommen)
- Korn-Stärke (`filmkorn.contrast`) und BBZB-Look an echten Fotos mit den Referenzbildern vergleichen; Golden-Images bei Bedarf neu erzeugen.
- Alte Fotos öffnen ohne Korn und Look, neue mit beidem. Korn auf alten Fotos geht nur im Profi-Modus an.
- «Spiegeln» und «Duplizieren» einer bestehenden Fläche gibt es auch im Einfach-Modus. *Hinfällig seit Phase 2.1 (Fläche entfällt).*
- Die Slide-Leiste zeigt nur noch Pfeile «←» «→» statt «← Nach links» und «Nach rechts →» (Platz bei 1280 px). Verständlich genug?
- Hintergründe nur im Profi-Modus; Tab heisst «Hintergründe» statt «Texturen/Hintergründe».
- Bei 1280 px Breite (Full HD mit 150 %) prüfen, ob Bibliothek, Leinwand und Inspector genug Platz haben. Die Tabs der Bibliothek brauchen im Profi-Modus drei Zeilen.

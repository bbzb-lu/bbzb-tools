# Was wir aus ZeroSeams lernen

ZeroSeams (`~/Documents/GitHub/ZeroSeams`) ist eine Electron-App desselben Autors für nahtlose Carousels. Diese App hier wird **unabhängig** gebaut. Kein Code wird kopiert, nur Ideen übernommen.

## Übernehmen (als Idee)
- **Eine lange Leinwand:** Slides liegen bei `x = index × slideBreite`. Elemente haben globale Koordinaten und dürfen über Nähte laufen. Beim Export wird pro Slide ausgeschnitten. Nahtlose Fotos brauchen so keine Sonderlogik, genau wie in der PSD.
- **Flaches Dokument:** `elements: Record<id, Element>` plus `order: id[]` für die Stapelreihenfolge. Slides sind nur Metadaten.
- **Rahmen und Inhalt getrennt:** Bildrahmen (Position, Grösse) und Bildinhalt (Versatz, Skalierung) sind getrennt. Doppelklick verschiebt den Ausschnitt, wie in InDesign.
- **Zugehörigkeit zur Slide** wird über den Mittelpunkt der Bounding Box bestimmt, z. B. beim Umsortieren von Slides.
- **Drag-Muster:** Start, Live-Update ohne History, Commit bei Mouseup. So entsteht pro Geste genau ein Undo-Schritt.
- **Export:** Bühne auf Massstab 1 zurücksetzen, UI-Ebenen (Transformer, Hilfslinien) ausblenden, einmal rendern, zuschneiden.
- **Effekt-Registry:** eine Datei pro Effekt, Registrierung über `registerEffect(def)`.
- **Filter-Pipeline**, die bei unbearbeiteten Bildern nichts tut, Ergebnisse cachen.

## Vermeiden
- Ein Store mit 2000 Zeilen und eine Bühnen-Komponente mit 1500 Zeilen. Stattdessen kleine Module pro Element-Typ.
- Eine CLAUDE.md mit 30 KB Sonderfällen. Lieber Tests als Invarianten-Prosa.
- Umwandlungen zwischen Bildrahmen, Form und Rasterzelle, freie Clip-Pfade.
- ffmpeg.wasm mit COOP/COEP. Stattdessen WebCodecs über Mediabunny.
- Volle Lightroom-Pipeline mit 12 Reglern. Hier reichen ein BBZB-Look und wenige Regler.
- Base64-Bilder im Dokument. Medien gehören als Blob in OPFS, das Dokument referenziert nur die Asset-ID.

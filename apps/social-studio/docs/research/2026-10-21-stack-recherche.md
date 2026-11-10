# Stack-Recherche (21.10.2026)

Grundlage für die Technologie-Entscheide in der Spezifikation. Versionen und Lizenzen vor dem Installieren nochmals prüfen.

## Harte Randbedingung
Fotos und Videos verlassen den Browser nie. Kein Upload, keine Cloud-Speicherung. Die App ist statisch (lokal via `npm run dev`/`preview` oder später statisch gehostet). Zielbrowser: **Microsoft Edge** (Chromium), Windows und macOS.

## Empfehlung

| Bereich | Wahl | Lizenz | Begründung |
|---|---|---|---|
| Framework | React 19 + Vite + TypeScript | MIT | grösstes Editor-Ökosystem, react-konva |
| Leinwand | Konva 10 + react-konva 19 | MIT | Szenengraph, Transformer, `toCanvas` mit Ausschnitt, Video als `Konva.Image` mit `HTMLVideoElement` |
| State / Undo | zustand 5 + immer + zundo | MIT | normalisiertes JSON-Dokument, Undo per `partialize` ohne Auswahl/Viewport |
| MP4-Export | Mediabunny (WebCodecs) | MPL-2.0 | Hardware-Encoding, kein SharedArrayBuffer nötig, exakte Frames via `VideoSampleSink` |
| Freistellen | transformers.js 4 im Web Worker, WebGPU mit WASM-Fallback | Apache-2.0 | Modelle siehe unten |
| Speichern | Dexie 4 (IndexedDB) für Metadaten, OPFS für Medien-Blobs | Apache-2.0 | `navigator.storage.persist()` anfordern |
| Projektdatei / ZIP | fflate | MIT | schneller und kleiner als JSZip, streamt |
| Speichern in Ordner | File System Access API | Browser | in Edge verfügbar |
| Offline | vite-plugin-pwa | MIT | App precachen, Modelle lazy cachen |

### Verworfen
- **Fabric.js 7:** gut für Text-Editing, aber imperativ und schwächer mit React. Plan B, falls Inline-Textbearbeitung in Konva zu mühsam wird.
- **PixiJS 8:** schnell, aber die ganze Editor-UX müsste man selbst bauen.
- **Polotno SDK:** Konva-basiert und sehr passend, aber kommerziell (ca. USD 199 bis 899 pro Monat) und mit Lizenzschlüssel-Check.
- **ffmpeg.wasm:** 10 bis 50 Mal langsamer, braucht COOP/COEP für Multithreading. Höchstens als Notfall-Fallback.

## Freistellen: Modellkandidaten
Vorgabe vom 21.10.2026: Für den Testdurchlauf zählt die **Qualität**, Lizenzen werden vor einer Verbreitung neu geprüft. Trotzdem hier vermerkt:

| Modell | Lizenz | Notiz |
|---|---|---|
| BRIA RMBG-2.0 | CC BY-NC 4.0 (nicht kommerziell) | basiert auf BiRefNet, gilt als Spitze bei allgemeinen Motiven. ONNX-Dateien vorhanden |
| BiRefNet / BiRefNet_lite / BiRefNet_HR | MIT | offizielle ONNX-Exporte, läuft in onnxruntime-web. Bester Kandidat für die spätere lizenzierte Lösung |
| BRIA RMBG-1.4 | nicht kommerziell | älter, schwächer als 2.0 |
| @imgly/background-removal | AGPL-3.0 | in ZeroSeams verwendet. Würde Offenlegung des ganzen Codes erzwingen |
| MODNet | Apache-2.0 | klein, nur Porträts |
| SlimSAM / SAM 2 (transformers.js) | Apache-2.0 | Klick-Auswahl. Löst Gruppenfotos, an denen «Motiv auswählen» scheitert |

Modelle werden einmal von Hugging Face **heruntergeladen** und im Cache Storage/OPFS gehalten. Es werden keine Bilder hochgeladen. Später können die Modelle auf dem eigenen Host liegen.

## Schriften
- Braveold (Envato) und Segoe UI Black dürfen laut Kommunikation BBZB (21.10.2026) im Projekt liegen, solange es ein interner Testdurchlauf ist. Repo deshalb **privat**.
- Segoe UI Black ist auf dem Mac nur über Adobe Fonts installiert, die Datei ist nicht kopierbar. Eine Datei `seguibl.ttf` (Windows: `C:\Windows\Fonts\`) muss nach `brand/fonts/` gelegt werden. Bis dahin Fallback per CSS `local("Segoe UI Black")`, das auf den Windows-Rechnern der Schule greift.

## Risiken
1. **HEVC-Videos vom iPhone:** WebCodecs-Decoding von HEVC hängt von Hardware und Windows-Erweiterung ab. Früh mit echten iPhone-Clips in Edge testen.
2. **Modellgrösse und WebGPU** auf Schul-Laptops. Für die Inferenz auf ca. 1024 px herunterskalieren, Maske dann hochskalieren.
3. **Ligaturen bei Braveold:** Canvas 2D hat keine Ligatur-Steuerung. Lösungsansätze testen: `ctx.letterSpacing` ≠ 0 (Chromium schaltet Ligaturen dann ab), oder ZWNJ (U+200C) zwischen «s» und «t» einfügen.
4. **Browser-Speicher kann geräumt werden:** Projektdatei als ZIP-Export ist die verlässliche Sicherung.
5. **Video-Seeking** über `HTMLVideoElement` ist ungenau. Für den Export Frames über Mediabunny decodieren.

## Links
- Konva: https://konvajs.org · react-konva: https://github.com/konvajs/react-konva
- Mediabunny: https://mediabunny.dev
- WebCodecs (MDN): https://developer.mozilla.org/docs/Web/API/WebCodecs_API
- transformers.js: https://github.com/huggingface/transformers.js
- RMBG-2.0: https://huggingface.co/briaai/RMBG-2.0
- BiRefNet: https://github.com/ZhengPeng7/BiRefNet
- SlimSAM: https://huggingface.co/Xenova/slimsam-77-uniform
- File System Access: https://developer.chrome.com/articles/file-system-access

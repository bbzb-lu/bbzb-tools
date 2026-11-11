# Freistellen: Modellvergleich (Phase 4b, Task 1)

Gemessen in Edge 150 auf macOS (14 Kerne, WebGPU vorhanden), transformers.js 3.8.1, 5 Testfotos (Porträt mit Haaren, Helm, Gruppe, Objekt, Layout). Skripte: `scripts/model-vergleich/`.

| Modell | Lizenz (Quelle) | Darf BBZB es ausliefern? | Dateien | Ergebnis in Edge |
|---|---|---|---|---|
| RMBG-2.0 | CC BY-NC 4.0, «Model weights are open source for non commercial use only» ([Karte](https://huggingface.co/briaai/RMBG-2.0)); Kommerziell: «Requires agreement» | Nein | 366 bis 1024 MB | nicht getestet (ausgeschlossen) |
| BiRefNet | MIT ([Repo](https://github.com/ZhengPeng7/BiRefNet), [ONNX](https://huggingface.co/onnx-community/BiRefNet-ONNX)) | Ja (Gewichte), Trainingsdaten nicht geprüft | fp16 490 MB | läuft nicht: Speicherabbruch (WebGPU und WASM) |
| BiRefNet_lite | MIT ([ONNX](https://huggingface.co/onnx-community/BiRefNet_lite-ONNX)) | Ja (Gewichte), wie oben | fp16 115 MB, fp32 224 MB | läuft nicht: Speicherabbruch bei 5 bis 9 GB, Eingabe fest 1024, auch mit ORT 1.23 |
| MODNet | Apache-2.0 ([Repo](https://github.com/ZHKKKe/MODNet), [ONNX](https://huggingface.co/Xenova/modnet)) | Ja | q8 6 MB, fp32 26 MB | läuft schnell (0,1 bis 0,4 s), aber Kanten unbrauchbar ausser bei Porträts, auch dort lückenhaft |
| ISNet general use | MIT auf der [Karte](https://huggingface.co/imgly/isnet-general-onnx) (`license: mit`), Upstream [xuebinqin/DIS](https://github.com/xuebinqin/DIS) Apache-2.0 | Ja für Gewichte und Code; unklar nur bei den Trainingsdaten (DIS5K hat eigene Nutzungsbedingungen) | fp16 88 MB, fp32 176 MB | läuft, 1024 px |

## Messung ISNet (Median je 5 Fotos, warm)

| Variante | Mac | 4x CPU-Drosselung | Browser-Speicher über Leerlauf |
|---|---|---|---|
| fp16, WebGPU | 0,2 s | 0,5 s | ca. 1,2 GB |
| fp32, WebGPU | 0,25 s | 0,5 s | ca. 1,6 GB |
| fp16, WASM | 4,1 s | 7,4 s | ca. 2,3 GB |
| fp32, WASM | 1,8 s | 6,9 s | ca. 1,8 GB |

## Empfehlung

`imgly/isnet-general-onnx`, `onnx/model_fp16.onnx`, Eingabe 1024x1024, 88 MB. Auf WebGPU und WASM lauffähig, Kanten bei Haaren, Helm, Gruppe und Objekt brauchbar, fp16 und fp32 sehen gleich aus. Schwäche: Das Modell wählt «das auffälligste Objekt», im Helm-Foto kam die Maschine neben den Arbeitern mit (schwach transparent).

## Grenzen der Messung

- CPU-Drosselung gilt nur für den Hauptthread, die WebGPU-Zeit bildet das nicht ab. Echte Schulgeräte (Windows, Intel-Grafik) sind nicht getestet.
- Speicher = Summe aller Browser-Prozesse, nicht nur das Modell.
- transformers.js 4.3.2 mit ORT-Dev-Build scheiterte in dieser Umgebung bei allen Modellen mit einem WebGPU-Shaderfehler (auch bei WASM); deshalb 3.8.1.
- ISNet kennt transformers.js nicht als Modelltyp, es läuft über den generischen Weg. Min-Max-Normalisierung der Ausgabe nötig.
- Lizenz: kein Rechtsgutachten. Die DIS5K-Bedingungen sollte jemand mit Rechtswissen lesen.

## Echtlauf im Studio (Task 6, 28.10.2026)

Edge 150, Mac, Build mit CSP, ganzer Ablauf über «Hintergrund entfernen» bis Export. Speicher = Spitze aller Edge-Prozesse über dem Stand vor dem Klick.

| Lauf | Dauer | Speicher | Hauptthread längste Pause |
|---|---|---|---|
| WebGPU, leeres Profil (Download 88 MB) | 24 s | +1,1 GB | 42 ms |
| WebGPU, Modell im Cache (Porträt, Helm) | 0,55 s | +0,65 GB | 50 ms |
| WebGPU, 4x Drosselung | 1,0 bis 1,8 s | +0,7 GB | 190 ms |
| WASM erzwungen (einfädig, ohne COOP/COEP) | 6,9 s | +1,4 GB | 50 ms |
| WASM erzwungen, 4x Drosselung | 7,3 s | +1,4 GB | 160 ms |

- Die Drosselung bremst nur den Hauptthread, nicht den Worker. Echte Zeiten auf schwachen Windows-Geräten bleiben offen.
- Während des WASM-Laufs mit Drosselung: Projektname tippen (17 Zeichen) 0,1 s, Text ziehen 0,12 s, Lauf lief danach weiter.
- Export und Leinwand stimmen überein. Porträt sauber; beim Helm wird der hintere Arbeiter teils durchsichtig und die Maschine kommt halb mit, bei der Gruppe werden hintere Reihen blass.

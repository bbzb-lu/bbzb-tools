#!/bin/sh
# Erzeugt alle Testvideos (keine echten Aufnahmen) nach e2e/fixtures/video/ (git-ignoriert), vorhandene bleiben. Braucht ffmpeg.
set -eu
FF=${FFMPEG:-ffmpeg}
OUT=$(dirname "$0")/../e2e/fixtures/video
mkdir -p "$OUT"
# need <Datei>: Clip fehlt noch
need() { [ ! -f "$OUT/$1" ]; }
ff() { "$FF" -hide_banner -loglevel error -y "$@"; }
# Bild mit Zähler und Ton (Sinus) als Quelle, 10 s, 30 fps
src() { echo "testsrc2=size=$1:rate=30:duration=${2:-10}"; }
tone="sine=frequency=440:sample_rate=48000:duration=10"
h264="-c:v libx264 -pix_fmt yuv420p -profile:v high -preset veryfast -crf 28 -movflags +faststart"
aac="-c:a aac -b:a 128k"

# Hochformat wie vom Handy, H.264 + AAC
need portrait-h264-aac.mp4 && ff -f lavfi -i "$(src 1080x1920)" -f lavfi -i "$tone" $h264 $aac -shortest "$OUT/portrait-h264-aac.mp4"
# Querformat
need landscape-h264-aac.mp4 && ff -f lavfi -i "$(src 1920x1080)" -f lavfi -i "$tone" $h264 $aac -shortest "$OUT/landscape-h264-aac.mp4"
# Wie vom iPhone: Querformat-Pixel mit Drehmetadaten 90° (zeigt hochkant), MOV
if need rotated-90.mov; then
  ff -f lavfi -i "$(src 1920x1080)" -f lavfi -i "$tone" $h264 $aac -shortest "$OUT/.rot-tmp.mov"
  ff -display_rotation 90 -i "$OUT/.rot-tmp.mov" -c copy "$OUT/rotated-90.mov"
  rm -f "$OUT/.rot-tmp.mov"
fi

# Bildwechsel für die Specs: 2 s Rot, 2 s Blau, beide mittelhell (Korn wirkt im Modus «overlay» nicht auf reine Farben)
color() { echo "-f lavfi -i color=c=$1:s=320x400:r=30:d=$2"; }
need two-tone.mp4 && ff $(color 0xB03030 2) $(color 0x3030B0 2) -filter_complex '[0][1]concat=n=2:v=1:a=0[v]' -map '[v]' \
  -c:v libx264 -pix_fmt yuv420p -g 15 "$OUT/two-tone.mp4"
# Wie two-tone, aber mit Ton
need two-tone-aac.mp4 && ff -i "$OUT/two-tone.mp4" -f lavfi -i sine=frequency=440:sample_rate=48000:duration=4 -c:v copy -c:a aac -shortest "$OUT/two-tone-aac.mp4"
# Querformat mit feinem Gitter (2 px Linien alle 8 px): Unschärfe durch zu kleines Dekodieren fällt sofort auf
need landscape-grid.mp4 && ff -f lavfi -i color=c=black:s=1920x1080:r=30:d=3,drawgrid=w=8:h=8:t=2:c=white \
  -c:v libx264 -pix_fmt yuv420p -crf 18 "$OUT/landscape-grid.mp4"
# Ton als Opus statt AAC: muss neu kodiert werden
need opus-audio.mp4 && ff -f lavfi -i testsrc2=size=320x400:rate=30:duration=3 -f lavfi -i sine=frequency=440:sample_rate=48000:duration=3 \
  -c:v libx264 -pix_fmt yuv420p -c:a libopus -shortest "$OUT/opus-audio.mp4"
# Farbbalken mit BT.709-Angaben im Container (die übrigen Testclips haben keine Farbangaben)
need tagged-bt709.mp4 && ff -f lavfi -i testsrc2=size=640x360:rate=30:duration=3 -c:v libx264 -pix_fmt yuv420p \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv "$OUT/tagged-bt709.mp4"
# Viel Rauschen: der Encoder schöpft die Bitrate aus (ein einfarbiges Video bliebe bei jeder Stufe winzig)
need noise.mp4 && ff -f lavfi -i testsrc2=size=1080x1350:rate=30:duration=3,noise=alls=60:allf=t -c:v libx264 -pix_fmt yuv420p -crf 10 "$OUT/noise.mp4"
# 6 s: bei Sekunde 3 wechselt das Bild von Rot auf Blau und ein Ton (1 kHz) setzt ein
need beep-flash.mp4 && ff $(color 0xB03030 3) $(color 0x3030B0 3) -f lavfi -i 'sine=frequency=1000:sample_rate=48000:duration=3,adelay=3000:all=1' \
  -filter_complex '[0][1]concat=n=2:v=1:a=0[v]' -map '[v]' -map 2:a -c:v libx264 -pix_fmt yuv420p -g 15 -c:a aac "$OUT/beep-flash.mp4"
# Naht-Test: Dreieckswelle in x (Steigung 0.55 Stufen je Pixel, Periode 400 px), die pro Bild um 30 px wandert: Nachbarspalten
# und aufeinanderfolgende Bilder unterscheiden sich messbar, nur Helligkeit (grau, kein Chroma-Rauschen). Phase 92: an der Naht
# (Quellspalte 768) und bei Bild 0 bis 17 liegt im Umkreis von 40 px keine Spitze der Welle (Spitzen bei Vielfachen von 200)
need seam-ramp.mp4 && ff -f lavfi -i "color=c=black:s=1920x1080:r=30:d=3,geq=lum='16+0.55*abs(mod(X+92+30*N,400)-200)':cb=128:cr=128" \
  -c:v libx264 -pix_fmt yuv420p -crf 18 "$OUT/seam-ramp.mp4"
# letzte Zeile sonst Exit 1, wenn der letzte Clip schon da ist (need liefert 1)
true

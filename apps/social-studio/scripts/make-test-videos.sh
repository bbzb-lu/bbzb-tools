#!/bin/sh
# Erzeugt kleine Testvideos (keine echten Aufnahmen) nach e2e/fixtures/video/ (git-ignoriert). Braucht ffmpeg.
set -eu
FF=${FFMPEG:-ffmpeg}
OUT=$(dirname "$0")/../e2e/fixtures/video
mkdir -p "$OUT"
ff() { "$FF" -hide_banner -loglevel error -y "$@"; }
# Bild mit Zähler und Ton (Sinus) als Quelle, 10 s, 30 fps
src() { echo "testsrc2=size=$1:rate=30:duration=${2:-10}"; }
tone="sine=frequency=440:sample_rate=48000:duration=10"
h264="-c:v libx264 -pix_fmt yuv420p -profile:v high -preset veryfast -crf 28 -movflags +faststart"
aac="-c:a aac -b:a 128k"

# Hochformat wie vom Handy, H.264 + AAC
ff -f lavfi -i "$(src 1080x1920)" -f lavfi -i "$tone" $h264 $aac -shortest "$OUT/portrait-h264-aac.mp4"
# Querformat
ff -f lavfi -i "$(src 1920x1080)" -f lavfi -i "$tone" $h264 $aac -shortest "$OUT/landscape-h264-aac.mp4"
# Variable Framerate: 3 s mit 30 fps, 3 s mit 10 fps, 4 s mit 60 fps, Zeitstempel unverändert übernommen
ff -f lavfi -i "$(src 1080x1920 3),fps=30" -f lavfi -i "testsrc2=size=1080x1920:rate=10:duration=3" \
  -f lavfi -i "testsrc2=size=1080x1920:rate=60:duration=4" \
  -filter_complex "[0][1][2]concat=n=3:v=1:a=0[v]" -map "[v]" -fps_mode vfr $h264 "$OUT/vfr-h264.mp4"
# Wie vom iPhone: Querformat-Pixel mit Drehmetadaten 90° (zeigt hochkant), MOV
ff -f lavfi -i "$(src 1920x1080)" -f lavfi -i "$tone" $h264 $aac -shortest "$OUT/.rot-tmp.mov"
ff -display_rotation 90 -i "$OUT/.rot-tmp.mov" -c copy "$OUT/rotated-90.mov"
rm -f "$OUT/.rot-tmp.mov"
# HEVC (iPhone-Standard), für die Fehlerprüfung
ff -f lavfi -i "$(src 1080x1920)" -f lavfi -i "$tone" -c:v libx265 -tag:v hvc1 -pix_fmt yuv420p -preset veryfast -crf 30 \
  -x265-params log-level=error $aac -shortest "$OUT/portrait-hevc.mov"
ls -l "$OUT"

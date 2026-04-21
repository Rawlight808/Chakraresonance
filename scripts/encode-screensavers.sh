#!/usr/bin/env bash
set -euo pipefail

# Re-encode the FINAL CHAKRA SCREENSAVER source videos into web-friendly
# H.264 MP4 loops that live in public/screensavers/. Sizes/bitrates are
# tuned to match the look of the existing screensavers while keeping
# payloads small enough for the web.

SRC="/Volumes/MICAH 2TB D/CHAKRA BACKGROUNDS/FINAL CHAKRA SCREENSAVER"
DST="$(cd "$(dirname "$0")/.." && pwd)/public/screensavers"

if [[ ! -d "$SRC" ]]; then
  echo "Source folder not found: $SRC" >&2
  exit 1
fi

mkdir -p "$DST"

# source file -> destination chakra slug
pairs=(
  "1st CHAKRA .mp4|root"
  "2nd CHAKRA .mov|sacral"
  "3rd Chakra E.mp4|solar-plexus"
  "4th Chakra.mov|heart"
  "5th Chakra G sharp.mov|throat"
  "6th Chakra.mov|third-eye"
  "7th Chakra.mov|crown"
)

for pair in "${pairs[@]}"; do
  src_name="${pair%%|*}"
  slug="${pair##*|}"
  src_path="$SRC/$src_name"
  dst_path="$DST/$slug.mp4"

  if [[ ! -f "$src_path" ]]; then
    echo "Missing source: $src_path" >&2
    exit 1
  fi

  echo "→ Encoding $src_name → $slug.mp4"
  ffmpeg -y -hide_banner -loglevel warning -stats \
    -i "$src_path" \
    -an \
    -vf "scale='min(1920,iw)':'-2':flags=lanczos,format=yuv420p" \
    -c:v libx264 -preset slow -crf 23 \
    -profile:v high -level 4.1 \
    -pix_fmt yuv420p \
    -movflags +faststart \
    "$dst_path"
done

echo "Done. Output:"
ls -lh "$DST"

#!/usr/bin/env bash
set -eo pipefail

MUSIC_SRC="/Users/micah/music/chakra music suno"
PUBLIC_AUDIO="$(cd "$(dirname "$0")/.." && pwd)/public/audio"

convert_folder() {
  local src_folder="$1"
  local chakra_id="$2"
  local src_dir="$MUSIC_SRC/$src_folder"
  local dest_dir="$PUBLIC_AUDIO/$chakra_id"

  if [ ! -d "$src_dir" ]; then
    echo "SKIP: $src_dir not found"
    return
  fi

  mkdir -p "$dest_dir"

  for wav in "$src_dir"/*.wav; do
    [ -f "$wav" ] || continue
    local basename_no_ext
    basename_no_ext="$(basename "$wav" .wav)"
    local mp3="$dest_dir/$basename_no_ext.mp3"

    if [ -f "$mp3" ]; then
      echo "EXISTS: $mp3"
      continue
    fi

    echo "CONVERT: $basename_no_ext -> $chakra_id/"
    ffmpeg -y -i "$wav" -codec:a libmp3lame -b:a 192k -ar 44100 "$mp3" 2>/dev/null
  done
}

convert_folder "root"          "root"
convert_folder "2nd chakra"    "sacral"
convert_folder "3rd CHAKRA"    "solar_plexus"
convert_folder "HEART CHAKRA"  "heart"
convert_folder "5th CHAKRA"    "throat"
convert_folder "6th Chakra"    "third_eye"
convert_folder "CROWN "        "crown"

echo "Done. Converted files in $PUBLIC_AUDIO"

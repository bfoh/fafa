#!/usr/bin/env bash
#
# Resize iPhone screenshots to the App Store Connect 6.7" portrait size
# (1290 x 2796), which Apple accepts for the required 6.7"/6.9" slot.
#
# macOS only — uses the built-in `sips` (no install needed).
# Scales each image to COVER the frame, then centre-crops to the exact size,
# so there is no stretching/distortion (a little edge may be trimmed).
#
# Usage:
#   bash scripts/resize-appstore-screenshots.sh shot1.png shot2.png ...
#   bash scripts/resize-appstore-screenshots.sh ~/Desktop/didi-shots/*.png
#
# Output: ./appstore-screenshots/<original-name>  at 1290 x 2796.

set -euo pipefail

W=1290   # target width  (6.7")
H=2796   # target height (6.7")
OUT="appstore-screenshots"

if [ "$#" -eq 0 ]; then
  echo "Usage: bash $0 <image1> [image2 ...]" >&2
  exit 1
fi

mkdir -p "$OUT"

for f in "$@"; do
  [ -f "$f" ] || { echo "skip (not a file): $f" >&2; continue; }
  name="$(basename "$f")"
  tmp="$OUT/.tmp-$name"

  w=$(sips -g pixelWidth  "$f" | awk '/pixelWidth/{print $2}')
  h=$(sips -g pixelHeight "$f" | awk '/pixelHeight/{print $2}')

  # Scale to cover: if the image is wider than the target aspect, match the
  # height and let width overflow; otherwise match the width.
  if [ $(( w * H )) -gt $(( h * W )) ]; then
    sips --resampleHeight "$H" "$f" --out "$tmp" >/dev/null
  else
    sips --resampleWidth  "$W" "$f" --out "$tmp" >/dev/null
  fi

  # Centre-crop to the exact required size.
  sips -c "$H" "$W" "$tmp" --out "$OUT/$name" >/dev/null
  rm -f "$tmp"
  echo "OK  $OUT/$name  ->  ${W} x ${H}"
done

echo ""
echo "Done. Upload the files in ./$OUT to App Store Connect (iPhone 6.7\")."

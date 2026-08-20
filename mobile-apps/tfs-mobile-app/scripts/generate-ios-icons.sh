#!/bin/bash
# Generates opaque, no-alpha, 1024x1024 iOS icon masters from the existing
# Android adaptive-icon foreground images. iOS app icons cannot have
# transparency - Apple's asset compiler silently fails to produce a valid
# alternate-icon asset from an image with an alpha channel, which is what
# caused the ITMS-90032 "no image found" errors (the Info.plist entry got
# written, but the actual asset never did).
#
# Background is white (#ffffff) - explicitly NOT the per-branch brand
# color, since these source images were cropped as adaptive-icon
# foregrounds (assumed to be masked into a shape), not as full square
# icons, so compositing them onto a solid brand color would look wrong.
#
# Run from the project root: bash scripts/generate-ios-icons.sh
# Requires ImageMagick (`brew install imagemagick` on macOS).

set -e

SRC_DIR="assets/icons"
OUT_DIR="assets/icons/ios"
BG="#ffffff"
SIZE=1024

mkdir -p "$OUT_DIR"

for slug in dundee vryheid ladysmith; do
  src="$SRC_DIR/tfs-$slug.png"
  out="$OUT_DIR/tfs-$slug-ios.png"

  if [ ! -f "$src" ]; then
    echo "⚠️  Skipping $slug - source not found at $src"
    continue
  fi

  convert "$src" \
    -background "$BG" -flatten \
    -resize "${SIZE}x${SIZE}" \
    -gravity center -extent "${SIZE}x${SIZE}" \
    -alpha off \
    "$out"

  echo "✅  Generated $out"
done

echo ""
echo "Done. Verify each file has no alpha channel with:"
echo "  identify -format '%[channels]' assets/icons/ios/tfs-dundee-ios.png"
echo "(should print 'srgb', NOT 'srgba')"
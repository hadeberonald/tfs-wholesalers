// Generates opaque, no-alpha, 1024x1024 iOS icon masters from the
// existing Android adaptive-icon foreground images, on a white
// (#ffffff) background.
//
// iOS app icons cannot have transparency - Apple's asset compiler
// silently fails to produce a valid alternate-icon asset from an image
// with an alpha channel, which is what caused the ITMS-90032 "no image
// found" errors (the Info.plist entry got written, but the actual asset
// never did).
//
// Uses `sharp` instead of ImageMagick's convert/magick CLI specifically
// to avoid the Windows `convert.exe` name collision and any PATH/installer
// hassle - this runs identically on Windows, macOS, and Linux with just
// `npm install`.
//
// Setup (once):   npm install --save-dev sharp
// Run:             node scripts/generate-ios-icons.js

const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const SRC_DIR = path.join(__dirname, '..', 'assets', 'icons');
const OUT_DIR = path.join(SRC_DIR, 'ios');
const BG = { r: 255, g: 255, b: 255, alpha: 1 }; // white, opaque
const SIZE = 1024;

const slugs = ['dundee', 'vryheid', 'ladysmith'];

async function run() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const slug of slugs) {
    const src = path.join(SRC_DIR, `tfs-${slug}.png`);
    const out = path.join(OUT_DIR, `tfs-${slug}-ios.png`);

    if (!fs.existsSync(src)) {
      console.warn(`⚠️  Skipping ${slug} - source not found at ${src}`);
      continue;
    }

    await sharp(src)
      .resize(SIZE, SIZE, { fit: 'contain', background: BG })
      .flatten({ background: BG }) // bakes out any transparency
      .removeAlpha() // guarantees no alpha channel in the output
      .png()
      .toFile(out);

    console.log(`✅  Generated ${out}`);
  }

  console.log('\nDone. Sanity-check any file has no alpha channel with:');
  console.log('  node -e "require(\'sharp\')(\'assets/icons/ios/tfs-dundee-ios.png\').metadata().then(m => console.log(m.hasAlpha))"');
  console.log('(should print false)');
}

run().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
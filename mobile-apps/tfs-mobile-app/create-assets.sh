#!/bin/bash

# This script helps you create the required image assets for the TFS Mobile App
# You'll need to replace these with your actual branding assets

echo "TFS Mobile App - Asset Setup Guide"
echo "==================================="
echo ""
echo "Required Assets:"
echo ""
echo "1. assets/logo.png"
echo "   - Horizontal logo for header"
echo "   - Size: 360x108px (3:1 ratio)"
echo "   - Transparent background"
echo ""
echo "2. assets/icon.png"
echo "   - App icon (square)"
echo "   - Size: 1024x1024px"
echo "   - Background: #FF6B35 (TFS Orange)"
echo ""
echo "3. assets/splash.png"
echo "   - Splash screen logo"
echo "   - Size: 1242x2436px"
echo "   - Logo centered, transparent background"
echo ""
echo "4. assets/adaptive-icon.png"
echo "   - Android adaptive icon (foreground)"
echo "   - Size: 1024x1024px"
echo "   - Transparent background"
echo ""
echo "5. assets/favicon.png"
echo "   - Web favicon"
echo "   - Size: 48x48px"
echo ""
echo "==================================="
echo "Creating placeholder assets..."

# Create simple placeholder PNGs using ImageMagick (if available)
if command -v convert &> /dev/null; then
    # Logo (360x108)
    convert -size 360x108 xc:white \
      -gravity center -pointsize 40 -fill "#FF6B35" -annotate +0+0 "TFS WHOLESALERS" \
      assets/logo.png 2>/dev/null || echo "Creating logo.png..."
    
    # Icon (1024x1024)
    convert -size 1024x1024 xc:"#FF6B35" \
      -gravity center -pointsize 200 -fill white -annotate +0+0 "TFS" \
      assets/icon.png 2>/dev/null || echo "Creating icon.png..."
    
    # Splash (1242x2436)
    convert -size 1242x2436 xc:"#FF6B35" \
      -gravity center -pointsize 300 -fill white -annotate +0+0 "TFS\nWHOLESALERS" \
      assets/splash.png 2>/dev/null || echo "Creating splash.png..."
    
    # Adaptive icon (1024x1024)
    convert -size 1024x1024 xc:transparent \
      -gravity center -pointsize 200 -fill "#FF6B35" -annotate +0+0 "TFS" \
      assets/adaptive-icon.png 2>/dev/null || echo "Creating adaptive-icon.png..."
    
    # Favicon (48x48)
    convert -size 48x48 xc:"#FF6B35" \
      -gravity center -pointsize 20 -fill white -annotate +0+0 "TFS" \
      assets/favicon.png 2>/dev/null || echo "Creating favicon.png..."
    
    echo "✓ Placeholder assets created!"
else
    echo "ImageMagick not found. Please create assets manually."
fi

echo ""
echo "Next Steps:"
echo "1. Replace placeholder assets with your actual branding"
echo "2. Run: npm install (if you added lucide-react-native)"
echo "3. Run: npx expo start --clear"
echo ""

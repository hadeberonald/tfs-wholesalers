# TFS Wholesalers Mobile Apps

React Native apps for warehouse pickers and delivery drivers, built with Expo and configured for EAS Build.

## 🎯 What's Included

### Picker App (`tfs-picker-app`)
- Login for warehouse pickers
- View pending orders
- Barcode scanning for products
- Multi-package creation
- QR code assignment per package
- Real-time progress tracking

### Delivery App (`tfs-delivery-app`)
- Login for delivery drivers  
- View ready-for-delivery orders
- Package QR scanning (must scan ALL)
- Google Maps navigation
- Customer contact (call from app)
- Delivery confirmation

## 🚀 Quick Start

### Prerequisites
```bash
npm install -g expo-cli eas-cli
```

### Setup Picker App

```bash
cd tfs-picker-app
npm install
```

**CRITICAL:** Edit API URLs in these files:
- `src/stores/authStore.ts`
- `src/stores/ordersStore.ts`

Change:
```typescript
const API_URL = 'YOUR_API_URL';
```

To:
```typescript
// Local development (use your computer's IP):
const API_URL = 'http://192.168.1.5:3000';

// OR Production:
const API_URL = 'https://your-domain.com';
```

### Initialize EAS

```bash
eas login
eas build:configure
```

This creates a project ID and updates `app.json`.

### Run Development

```bash
npm start
```

Scan QR code with Expo Go app on your phone.

### Build APK for Testing

```bash
eas build --platform android --profile preview
```

Downloads APK when complete - install directly on Android.

### Build for Production

```bash
# Android App Bundle (Google Play)
eas build --platform android --profile production

# iOS (TestFlight/App Store)  
eas build --platform ios --profile production

# Both platforms
eas build --platform all --profile production
```

## 📱 Development Tips

### Finding Your Local IP

**Mac:**
```bash
ipconfig getifaddr en0
```

**Windows:**
```bash
ipconfig
# Look for IPv4 Address
```

**Linux:**
```bash
hostname -I | awk '{print $1}'
```

### Clear Cache

If you get weird errors:
```bash
npx expo start -c
```

### Update Dependencies

```bash
npm install expo@latest
npx expo install --fix
```

## 🔧 Configuration Files

### `app.json`
- App name, version, icons
- Platform-specific settings
- Camera permissions
- Bundle identifiers

### `eas.json`
- Build profiles (development, preview, production)
- Platform-specific build settings

### `package.json`
- Dependencies
- Scripts
- Expo SDK version

## 📦 Key Dependencies

- `expo` - Development platform
- `expo-camera` - Camera access for scanning
- `expo-barcode-scanner` - Barcode scanning
- `react-navigation` - App navigation
- `zustand` - State management
- `axios` - API calls
- `expo-haptics` - Vibration feedback

## 🎨 Customization

### Changing App Name

Edit `app.json`:
```json
{
  "expo": {
    "name": "Your Company Picker",
    "slug": "your-company-picker"
  }
}
```

### Changing Colors

Edit StyleSheets in screen files:
- Primary: `#FF6B35` (Orange)
- Success: `#10B981` (Green)
- Error: `#EF4444` (Red)

### Adding Logo

Replace files in `assets/`:
- `icon.png` - App icon (1024x1024)
- `splash.png` - Splash screen (1242x2436)
- `adaptive-icon.png` - Android adaptive icon (1024x1024)

## 🐛 Common Issues

### "Network request failed"
- Use computer's local IP, not localhost
- Ensure phone and computer on same WiFi
- Check firewall isn't blocking port 3000

### "Camera permission denied"
- Phone Settings → Expo Go → Enable Camera
- Restart app

### "Unable to resolve module"
```bash
rm -rf node_modules
npm install
npx expo start -c
```

### Build fails on EAS
- Ensure `app.json` is valid JSON
- Run `eas build:configure` 
- Check EAS dashboard for logs

## 📖 Code Structure

```
src/
├── screens/          ← UI screens
│   ├── LoginScreen.tsx
│   ├── OrdersListScreen.tsx
│   ├── PickingScreen.tsx
│   └── ...
│
├── stores/          ← State management
│   ├── authStore.ts      ← Login/logout
│   └── ordersStore.ts    ← Orders data
│
└── components/      ← Reusable components
    └── ...
```

## 🔐 Security

- JWT tokens stored in AsyncStorage
- Tokens expire after 30 days
- Role-based access (pickers can't access driver features)
- All API requests authenticated

## 📱 Testing

### Login Credentials
After creating users in web admin (`/admin/users`):
- Picker: `picker@tfs.com`
- Driver: `driver@tfs.com`

### Test Flow
1. Login with picker account
2. Should see pending orders
3. Pick an order
4. Scan products (use test barcodes)
5. Create packages with QR codes
6. Switch to driver app
7. Scan packages to collect
8. Deliver

## 🚀 Deployment

### Internal Testing (Recommended)

Build preview APK:
```bash
eas build --platform android --profile preview
```

Share APK with team for testing.

### Google Play Store

1. Build production bundle:
```bash
eas build --platform android --profile production
```

2. Download AAB file
3. Upload to Google Play Console
4. Fill out store listing
5. Submit for review

### Apple App Store

1. Build production IPA:
```bash
eas build --platform ios --profile production
```

2. Submit to TestFlight
3. Test with team
4. Submit to App Store review

## 📞 Support

- EAS Docs: https://docs.expo.dev/build/introduction/
- Expo Forums: https://forums.expo.dev/
- Issue? Check INSTALLATION_GUIDE.md

---

Built with ❤️ using React Native + Expo

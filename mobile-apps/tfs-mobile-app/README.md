# TFS Wholesalers Mobile App

React Native mobile app for TFS Wholesalers built with Expo SDK 54.

## Features

- ✅ Branch selection on first launch
- ✅ Featured categories carousel on home screen
- ✅ Product browsing with search and category filters
- ✅ Shopping cart with quantity management
- ✅ User authentication (login/logout)
- ✅ Multi-branch support
- ✅ Product variants support
- ✅ Special pricing display

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Expo CLI: `npm install -g expo-cli` or `npm install -g eas-cli`
- Expo Go app on your phone (for development)
- Android Studio or Xcode (for building native apps)

## Setup Instructions

### 1. Install Dependencies

```bash
cd mobile-apps/tfs-mobile-app
npm install
```

### 2. Configure API URL

Open `lib/api.ts` and update the `API_URL`:

**For Development (Expo Go on physical device):**
```typescript
export const API_URL = 'http://YOUR_LOCAL_IP:3000';
// Find your IP: 
// - macOS/Linux: ifconfig | grep inet
// - Windows: ipconfig
// Example: 'http://192.168.1.100:3000'
```

**For Production:**
```typescript
export const API_URL = 'https://tfs-wholesalers.onrender.com';
```

### 3. Start Development Server

```bash
npm start
```

This will start the Expo development server. You'll see a QR code in your terminal.

### 4. Run on Your Device

**Option A: Expo Go (Easiest)**
1. Install Expo Go from App Store (iOS) or Play Store (Android)
2. Scan the QR code with your camera (iOS) or Expo Go app (Android)
3. The app will load on your device

**Option B: Development Build**
```bash
# iOS Simulator (requires macOS with Xcode)
npm run ios

# Android Emulator (requires Android Studio)
npm run android
```

## Project Structure

```
tfs-mobile-app/
├── app/                    # App screens (Expo Router)
│   ├── (tabs)/            # Tab navigation
│   │   ├── index.tsx      # Home screen
│   │   ├── shop.tsx       # Shop screen
│   │   ├── cart.tsx       # Cart screen
│   │   └── menu.tsx       # Menu screen
│   ├── index.tsx          # Splash screen
│   ├── branch-select.tsx  # Branch selection
│   ├── login.tsx          # Login screen
│   └── _layout.tsx        # Root layout
├── lib/                    # Utilities
│   ├── api.ts             # API client
│   ├── store.ts           # Zustand state management
│   └── types.ts           # TypeScript types
├── assets/                 # Images, fonts, etc.
├── app.json               # Expo configuration
└── package.json           # Dependencies
```

## Key Files to Customize

1. **lib/api.ts** - Update API URL for your backend
2. **app.json** - Update app name, icon, splash screen
3. **lib/store.ts** - Modify global state if needed

## Building for Production

### Using EAS Build (Recommended)

1. Install EAS CLI:
```bash
npm install -g eas-cli
```

2. Login to Expo:
```bash
eas login
```

3. Configure project:
```bash
eas build:configure
```

4. Build for Android:
```bash
eas build --platform android
```

5. Build for iOS:
```bash
eas build --platform ios
```

### Local Builds

**Android APK:**
```bash
eas build -p android --profile preview
```

**iOS (requires Apple Developer account):**
```bash
eas build -p ios --profile preview
```

## Testing

### Test User Credentials
Use the existing users from your database or create new ones via the API.

### Test Branch Selection
The app will fetch active branches from `/api/mobile/branches`

## API Endpoints Used

- `GET /api/mobile/branches` - List all active branches
- `GET /api/mobile/branches/:slug` - Get branch details
- `GET /api/categories?branchId=X&featured=true` - Featured categories
- `GET /api/products?branchId=X&category=Y` - Products by category
- `GET /api/search?q=...&branchId=X` - Search products
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

## Environment Variables

Create a `.env` file if you need environment-specific configs:

```env
API_URL=https://tfs-wholesalers.onrender.com
```

Note: Expo uses `process.env` which works differently than Next.js. Use `app.config.js` for dynamic configs if needed.

## Troubleshooting

### "Network request failed"
- Ensure your backend is running
- Check that `API_URL` in `lib/api.ts` is correct
- If using local development, make sure your phone and computer are on the same WiFi network

### "Cannot connect to Metro"
- Restart the Expo dev server: `npm start --clear`
- Ensure ports 8081 and 19000 are not blocked by firewall

### "Module not found"
- Clear cache: `expo start --clear`
- Reinstall dependencies: `rm -rf node_modules && npm install`

### CORS Issues
- Your backend must allow requests from mobile origins
- In development, the API should accept requests from any origin
- Make sure your Next.js API routes don't have strict CORS policies

## Deployment

### Google Play Store
1. Build AAB: `eas build --platform android --profile production`
2. Download the `.aab` file
3. Upload to Google Play Console
4. Fill in store listing details
5. Submit for review

### Apple App Store
1. Build IPA: `eas build --platform ios --profile production`
2. Upload to App Store Connect via Transporter
3. Fill in app information
4. Submit for review

## Updates

### OTA Updates (Expo Updates)
```bash
eas update --branch production
```

This allows you to push updates without rebuilding the app (for JS changes only).

## Notes

- The app uses Zustand for state management (simpler than Redux)
- AsyncStorage is used for local data persistence
- Expo Router handles navigation (file-based routing)
- The app requires SDK 54+ for latest features

## Support

For issues or questions:
- Check Expo documentation: https://docs.expo.dev
- Check React Native docs: https://reactnative.dev

## License

Proprietary - TFS Wholesalers

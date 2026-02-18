# TFS Mobile App - Polished UI Version

## ✅ What's Included

This archive contains your mobile app with professional UI improvements:

### 1. **Updated Dependencies** (`package.json`)
- Added `lucide-react-native`: ^0.469.0
- Added `react-native-svg`: 15.12.1

### 2. **New Component** (`components/Header.tsx`)
Professional header with:
- Logo on left (when not showing back button)
- Back button with title (when showBack=true)
- Shopping cart icon with badge
- Hamburger menu icon
- Respects SafeAreaView insets

### 3. **Placeholder Assets** (`assets/`)
Created placeholder branding images:
- `logo.png` - Horizontal logo for header (360x108)
- `icon.png` - App icon (1024x1024)
- `splash.png` - Splash screen (1242x2436)
- `adaptive-icon.png` - Android adaptive icon (1024x1024)
- `favicon.png` - Web favicon (48x48)

**IMPORTANT:** Replace these with your actual TFS branding!

### 4. **Updated Screens**
- ✅ **Home Screen** (`app/(tabs)/index.tsx`)
  - Integrated Header component
  - Replaced emojis with Lucide icons (ShoppingBag, Package)
  - Added SafeAreaView wrapper
  - Professional styling maintained

## 🔧 Installation

###1. Extract Archive
```bash
cd C:\Users\ronal\tfs-wholesalers\mobile-apps
# Extract tfs-mobile-app-polished.tar.gz here
```

### 2. Install New Dependencies
```bash
cd tfs-mobile-app
npm install --legacy-peer-deps
```

### 3. Replace Placeholder Assets
Replace these files in `assets/` folder with your actual branding:
- `logo.png` - Your TFS horizontal logo
- `icon.png` - Your TFS app icon
- `splash.png` - Your TFS splash screen
- `adaptive-icon.png` - Your TFS adaptive icon
- `favicon.png` - Your TFS favicon

### 4. Update Remaining Screens

I've updated the home screen as an example. Now update the remaining screens following the same pattern:

#### Pattern to Follow:

```tsx
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '@/components/Header';
import { IconName } from 'lucide-react-native'; // Import needed icons

export default function YourScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Header /> {/* or <Header showBack title="Title" /> */}
      
      {/* Your screen content */}
      {/* Replace all emojis with Lucide icons */}
      {/* Example: 🔍 → <Search color="#6b7280" size={20} /> */}
      
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  // ... rest of styles
});
```

#### Screens to Update:

**Shop Screen** (`app/(tabs)/shop.tsx`):
```tsx
import { Search, Filter, Package } from 'lucide-react-native';

// Add at top:
<SafeAreaView style={styles.container} edges={['bottom']}>
  <Header />
  
// Replace 🔍 with <Search color="#6b7280" size={20} />
// Replace filter emoji with <Filter color="#6b7280" size={20} />
// Replace 📦 with <Package color="#9ca3af" size={40} />
```

**Cart Screen** (`app/(tabs)/cart.tsx`):
```tsx
import { Trash2, ShoppingCart, ChevronRight } from 'lucide-react-native';

// Add at top:
<SafeAreaView style={styles.container} edges={['bottom']}>
  <Header />
  
// Replace 🗑️ with <Trash2 color="#ef4444" size={20} />
// Replace empty cart emoji with <ShoppingCart color="#9ca3af" size={60} />
// Replace → with <ChevronRight color="#fff" size={20} />
```

**Menu Screen** (`app/(tabs)/menu.tsx`):
```tsx
import { User, LogOut, MapPin, Home, ShoppingCart, ChevronRight } from 'lucide-react-native';

// Add at top:
<SafeAreaView style={styles.container} edges={['bottom']}>
  <Header />
  
// ADD NEW MENU ITEMS after sign-in section:
<TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(tabs)')}>
  <Home color="#1f2937" size={24} />
  <Text style={styles.menuItemText}>Home</Text>
  <ChevronRight color="#9ca3af" size={20} />
</TouchableOpacity>

<TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(tabs)/cart')}>
  <ShoppingCart color="#1f2937" size={24} />
  <Text style={styles.menuItemText}>Cart</Text>
  <ChevronRight color="#9ca3af" size={20} />
</TouchableOpacity>

// Replace 👤 with <User color="#1f2937" size={60} />
// Replace 📍 with <MapPin color="#1f2937" size={20} />
// Replace logout emoji with <LogOut color="#ef4444" size={20} />
```

**Branch Select** (`app/branch-select.tsx`):
```tsx
import { MapPin } from 'lucide-react-native';

// Add at top:
<SafeAreaView style={styles.container} edges={['bottom']}>
  <Header />
  
// Replace 📍 with <MapPin color="#FF6B35" size={24} />
```

**Login Screen** (`app/login.tsx`):
```tsx
import { Lock, Mail } from 'lucide-react-native';

// Add at top:
<SafeAreaView style={styles.container} edges={['bottom']}>
  <Header showBack />
  
// Replace 🔒 with <Lock color="#FF6B35" size={60} />
// Optionally add <Mail /> icon in email input
```

### 5. Start App
```bash
npx expo start --clear
```

## 🎨 Design System

### Colors
- **Primary:** `#FF6B35` (TFS Orange)
- **Text:** `#1f2937` (Dark gray)
- **Secondary:** `#6b7280` (Medium gray)
- **Background:** `#f9fafb` (Light gray)
- **White:** `#ffffff`
- **Border:** `#e5e7eb`
- **Error:** `#ef4444`

### Common Lucide Icons
Import from `lucide-react-native`:
- `Home` - Home navigation
- `ShoppingCart` - Cart
- `ShoppingBag` - Shopping/categories
- `Package` - Product placeholder
- `Search` - Search functionality
- `Filter` - Filter button
- `Plus, Minus` - Quantity controls
- `Trash2` - Delete
- `User` - Profile
- `LogOut` - Sign out
- `MapPin` - Location/branch
- `ChevronRight` - Navigation arrows
- `ArrowLeft` - Back button
- `Menu` - Hamburger menu
- `Lock, Mail` - Auth screens

### Icon Usage
```tsx
<IconName 
  color="#1f2937"  // Text color
  size={24}        // Default size
  strokeWidth={2}  // Optional: line thickness
/>
```

## 📱 Header Component API

```tsx
<Header />                              // Logo + Cart + Menu
<Header showBack />                     // Back + Cart + Menu
<Header showBack title="Page Title" />  // Back + Title + Cart + Menu
```

The Header automatically:
- Respects safe area insets (notches)
- Shows cart badge with item count
- Handles navigation
- Applies consistent styling

## 🚀 Features Maintained

All existing functionality preserved:
- ✅ Branch selection on first launch
- ✅ Product carousel with auto-scroll
- ✅ Search and filtering
- ✅ Shopping cart with variants
- ✅ User authentication
- ✅ Multi-branch support

## ⚠️ Important Notes

1. **Don't break SafeAreaView:** All screens MUST wrap content in:
   ```tsx
   <SafeAreaView style={styles.container} edges={['bottom']}>
   ```

2. **Header goes first:** Always place `<Header />` immediately after SafeAreaView

3. **No emoji exceptions:** Replace ALL emojis with Lucide icons for professional look

4. **Logo requirement:** Replace `assets/logo.png` with actual TFS logo (360x108px, transparent background)

5. **Consistent styling:** Use the color palette defined above

## 🐛 Troubleshooting

### Icons not showing
```bash
npm install --legacy-peer-deps
npx expo start --clear
```

### "Cannot find module '@/components/Header'"
Check that `components/Header.tsx` exists in project root.

### Logo not displaying
Check that `assets/logo.png` exists and is a valid PNG file.

### Layout issues
Ensure all screens use SafeAreaView with edges={['bottom']}.

## 📞 Next Steps

1. Install dependencies
2. Replace placeholder assets with real branding
3. Update remaining 5 screens following the patterns above
4. Test all functionality
5. Build production APK

The home screen is your complete reference implementation!

// app/(tabs)/_layout.tsx  (customer app — Expo Router)
// Unchanged from your original — new screens live outside (tabs) in _layout.tsx.
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Header from '@/components/Header';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb', paddingTop: insets.top }}>
      {/* Sticky header at the top */}
      <Header />

      {/* Content below */}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#f9fafb' },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="shop" />
        <Stack.Screen name="cart" />
      </Stack>
    </View>
  );
}
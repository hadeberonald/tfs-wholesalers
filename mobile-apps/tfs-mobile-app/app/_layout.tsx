import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Application from 'expo-application';
import { useStore } from '@/lib/store';
import {
  setNotificationRouter,
  registerForPushNotifications,
  addNotificationListeners,
} from '@/lib/notificationService';
import DeliveryNpsModal from './DeliveryNpsModal';
import ForceUpdateModal from '@/components/ForceUpdateModal';
import { usePendingDeliveryReview } from '../hooks/usePendingDeliveryReview';

// This branch is only ever published as a runtimeVersion "1.0.0" OTA update.
// Because app.json here uses runtimeVersion policy "appVersion", it can only
// ever be delivered to native installs that were built with version "1.0.0" —
// anyone who has already updated to the 1.1.0 native build is compiled with
// runtimeVersion "1.1.0" and will never fetch or apply this bundle. The check
// below is a belt-and-suspenders backstop on top of that server-side isolation,
// reading the real native version (which OTA can never change).
function needsForceUpdate() {
  const current = Application.nativeApplicationVersion; // e.g. "1.0.0"
  if (!current) return false; // fail-open if we can't determine it
  return current.startsWith('1.0.');
}

export default function RootLayout() {
  const router = useRouter();
  const [isHydrated, setIsHydrated] = useState(useStore.persist.hasHydrated());

  const { pendingReview, dismiss } = usePendingDeliveryReview();

  // useStore is wrapped in zustand's `persist` middleware (lib/store.ts),
  // which restores user/branch/cart/wishlist from AsyncStorage on its own.
  // We just wait for that to finish rather than re-reading AsyncStorage
  // manually here — doing both was racing two separate restores of the
  // same data.
  useEffect(() => {
    if (useStore.persist.hasHydrated()) {
      setIsHydrated(true);
      return;
    }
    const unsub = useStore.persist.onFinishHydration(() => setIsHydrated(true));
    return unsub;
  }, []);

  useEffect(() => { setNotificationRouter(router); }, [router]);
  useEffect(() => {
    registerForPushNotifications().catch(() => {});
    const cleanup = addNotificationListeners();
    return cleanup;
  }, []);

  // Checked before hydration on purpose — this is a synchronous native-version
  // read with no async cost, and an out-of-date install should never even
  // reach the store hydration / notification registration paths above.
  if (needsForceUpdate()) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <ForceUpdateModal />
      </SafeAreaProvider>
    );
  }

  if (!isHydrated) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' }}>
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />

      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#f9fafb' } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="shop" />
        <Stack.Screen name="specials" />
        <Stack.Screen name="catalogues" />
        <Stack.Screen name="cart" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="wishlist" />
        <Stack.Screen name="addresses" />
        <Stack.Screen name="payment-methods" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="product/[slug]" />
        <Stack.Screen name="special/[slug]" />
        <Stack.Screen name="combo/[slug]" />
        <Stack.Screen name="checkout" />
        <Stack.Screen name="address-picker" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="payment" options={{ gestureEnabled: false }} />
        <Stack.Screen name="order-preparing" options={{ gestureEnabled: false }} />
        <Stack.Screen name="order-ready" options={{ gestureEnabled: false }} />
        <Stack.Screen name="order-on-the-way" options={{ gestureEnabled: false }} />
        <Stack.Screen name="order-delivered" options={{ gestureEnabled: false }} />
        <Stack.Screen name="orders" />
        <Stack.Screen name="order-being-picked" />
      </Stack>

      <DeliveryNpsModal pendingReview={pendingReview} onDismiss={dismiss} />
    </SafeAreaProvider>
  );
}
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from '@/lib/store';
import api from '@/lib/api';
import {
  setNotificationRouter,
  registerForPushNotifications,
  addNotificationListeners,
} from '@/lib/notificationService';

export default function RootLayout() {
  const router    = useRouter();
  const setUser   = useStore((state) => state.setUser);
  const setBranch = useStore((state) => state.setBranch);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredData();
  }, []);

  useEffect(() => {
    setNotificationRouter(router);
  }, [router]);

  useEffect(() => {
    registerForPushNotifications().catch(() => {});
    const cleanup = addNotificationListeners();
    return cleanup;
  }, []);

  const loadStoredData = async () => {
    try {
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        setUser(JSON.parse(userStr));
      }

      const branchSlug = await AsyncStorage.getItem('selectedBranch');
      if (branchSlug) {
        // Always fetch fresh from API — never trust the persisted branch in
        // AsyncStorage for settings, since delivery pricing / store location
        // can be updated by admin at any time.
        const response = await api.get(`/api/mobile/branches/${branchSlug}`);
        if (response.data.success && response.data.branch) {
          setBranch(response.data.branch);
          console.log('[layout] Branch refreshed:', response.data.branch.slug,
            'pricing:', response.data.branch.settings?.deliveryPricing);
        } else {
          await AsyncStorage.removeItem('selectedBranch');
        }
      }
    } catch (error) {
      console.error('[ROOT LAYOUT] Failed to load stored data:', error);
      await AsyncStorage.removeItem('selectedBranch');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' }}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#f9fafb' } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="branch-select" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="shop" />
        <Stack.Screen name="specials" />
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
    </>
  );
}
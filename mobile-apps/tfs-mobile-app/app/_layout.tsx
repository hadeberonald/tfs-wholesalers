// app/_layout.tsx  (customer app — Expo Router)
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from '@/lib/store';
import api from '@/lib/api';

export default function RootLayout() {
  const setUser = useStore((state) => state.setUser);
  const setBranch = useStore((state) => state.setBranch);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredData();
  }, []);

  const loadStoredData = async () => {
    try {
      console.log('[ROOT LAYOUT] Loading stored data...');

      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        setUser(JSON.parse(userStr));
        console.log('[ROOT LAYOUT] User loaded');
      }

      const branchSlug = await AsyncStorage.getItem('selectedBranch');
      console.log('[ROOT LAYOUT] Saved branch slug:', branchSlug);

      if (branchSlug) {
        const response = await api.get(`/api/mobile/branches/${branchSlug}`);
        console.log('[ROOT LAYOUT] Branch API response:', response.data);

        if (response.data.success && response.data.branch) {
          setBranch(response.data.branch);
          console.log('[ROOT LAYOUT] Branch loaded:', response.data.branch.name);
        } else {
          console.log('[ROOT LAYOUT] Branch not found, clearing storage');
          await AsyncStorage.removeItem('selectedBranch');
        }
      }
    } catch (error) {
      console.error('[ROOT LAYOUT] Failed to load stored data:', error);
      await AsyncStorage.removeItem('selectedBranch');
    } finally {
      setIsLoading(false);
      console.log('[ROOT LAYOUT] Loading complete');
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
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#f9fafb' },
        }}
      >
        {/* ── existing screens (unchanged) ── */}
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

        {/* ── checkout & payment ── */}
        <Stack.Screen name="checkout" />
        <Stack.Screen
          name="address-picker"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="payment"
          options={{ gestureEnabled: false }}
        />

        {/* ── order tracking flow ── */}
        {/* Step 1: pending → confirmed → picking */}
        <Stack.Screen
          name="order-preparing"
          options={{ gestureEnabled: false }}
        />
        {/* Step 2: packaging → ready (driver being assigned) */}
        <Stack.Screen
          name="order-ready"
          options={{ gestureEnabled: false }}
        />
        {/* Step 3: out_for_delivery | collecting (live map) */}
        <Stack.Screen
          name="order-on-the-way"
          options={{ gestureEnabled: false }}
        />
        {/* Step 4: delivered (confetti + rating) */}
        <Stack.Screen
          name="order-delivered"
          options={{ gestureEnabled: false }}
        />

        {/* ── legacy / misc order screens ── */}
        <Stack.Screen name="orders" />
        <Stack.Screen name="order-being-picked" />
      </Stack>
    </>
  );
}
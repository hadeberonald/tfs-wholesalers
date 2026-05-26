import { View } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '@/components/Header';

export default function TabsLayout() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }} edges={['top']}>
      <Header />
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
    </SafeAreaView>
  );
}
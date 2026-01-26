import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Import screens
import DeliveryScreen from './src/screens/DeliveryScreen';
import OrderPickingScreen from './src/screens/OrderPickingScreen';
import PackagingScreen from './src/screens/PackagingScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  // Mock order data for testing
  const mockOrder = {
    _id: '123',
    orderNumber: 'ORD-2024-001',
    customerInfo: {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+27 82 123 4567',
    },
    shippingAddress: {
      address: '123 Main Street, Durban, KZN, 4001',
      lat: -29.8587,
      lng: 31.0218,
    },
    items: [
      {
        productId: '1',
        name: 'Product A',
        sku: 'SKU001',
        quantity: 2,
        price: 150.00,
      },
      {
        productId: '2',
        name: 'Product B',
        sku: 'SKU002',
        quantity: 1,
        price: 300.00,
      },
    ],
    packages: [
      {
        qrCode: 'PKG001-ORD-2024-001',
        packageNumber: 1,
        totalPackages: 2,
        items: ['1'],
      },
      {
        qrCode: 'PKG002-ORD-2024-001',
        packageNumber: 2,
        totalPackages: 2,
        items: ['2'],
      },
    ],
    deliveryNotes: 'Please call before delivery. Gate code: 1234',
    total: 600.00,
    status: 'ready_for_delivery',
  };

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Delivery"
          screenOptions={{
            headerShown: false,
          }}
        >
          <Stack.Screen 
            name="Delivery" 
            component={DeliveryScreen}
            initialParams={{
              orderId: '123',
              order: mockOrder,
            }}
          />
          <Stack.Screen 
            name="OrderPicking" 
            component={OrderPickingScreen} 
          />
          <Stack.Screen 
            name="Packaging" 
            component={PackagingScreen} 
          />
        </Stack.Navigator>
        <StatusBar style="auto" />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
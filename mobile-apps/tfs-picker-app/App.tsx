import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Package, ClipboardList, User, Settings, Car, Archive } from 'lucide-react-native';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import OrdersListScreen from './src/screens/OrdersListScreen';
import PickingScreen from './src/screens/PickingScreen';
import PackagingScreen from './src/screens/PackagingScreen';
import BarcodeLinkingScreen from './src/screens/BarcodeLinkingScreen';
import DeliveriesListScreen from './src/screens/DeliveriesListScreen';
import DeliveryCollectionScreen from './src/screens/DeliveryCollectionScreen';
import DeliveryScreen from './src/screens/DeliveryScreen';
import { useAuthStore } from './src/stores/authStore';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#FF6B35',
        tabBarInactiveTintColor: '#666',
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Orders"
        component={OrdersListScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <ClipboardList color={color} size={size} />
          ),
        }}
      />
      
      <Tab.Screen
        name="Deliveries"
        component={DeliveriesListScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Car color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Products"
        component={BarcodeLinkingScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Archive color={color} size={size} />
          ),
        }}
      />
      {/* <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <User color={color} size={size} />
          ),
        }}
      />*/}
    </Tab.Navigator>
  );
}

export default function App() {
  const { user } = useAuthStore();

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="Picking" component={PickingScreen} />
            <Stack.Screen name="Packaging" component={PackagingScreen} />
            <Stack.Screen name="DeliveryCollection" component={DeliveryCollectionScreen} />
            <Stack.Screen name="DeliveryDetail" component={DeliveryScreen} />
            <Stack.Screen name="DeliveriesList" component={DeliveriesListScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
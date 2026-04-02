// App.tsx - adds StockCount tab to MainTabs and registers the screen in the stack

import 'react-native-gesture-handler';
import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { Package, ClipboardList, Settings, Car, MapPin, ClipboardCheck } from 'lucide-react-native';

import LoginScreen           from './src/screens/LoginScreen';
import OrdersListScreen      from './src/screens/OrdersListScreen';
import PickingScreen         from './src/screens/PickingScreen';
import PackagingScreen       from './src/screens/PackagingScreen';
import BarcodeLinkingScreen  from './src/screens/BarcodeLinkingScreen';
import DeliveriesListScreen  from './src/screens/DeliveriesListScreen';
import DeliveryCollectionScreen from './src/screens/DeliveryCollectionScreen';
import DeliveryScreen        from './src/screens/DeliveryScreen';
import BranchSelectScreen    from './src/screens/BranchSelectScreen';
import StockCountScreen      from './src/screens/StockCountScreen'; // <- NEW

import { useAuthStore } from './src/stores/authStore';
import {
  setNavigationRef,
  addNotificationListeners,
  registerForPushNotifications,
} from './src/services/NotificationService';

const Stack = createStackNavigator();
const Tab   = createBottomTabNavigator();

function MainTabs({ navigation }: any) {
  const { activeBranch } = useAuthStore();

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor:   '#FF6B35',
        tabBarInactiveTintColor: '#666',
        headerShown:  true,
        headerStyle:  { backgroundColor: '#fff' },
        headerTitleStyle: { fontWeight: '700', color: '#1a1a1a' },
        headerRight: () => (
          <TouchableOpacity
            style={tabStyles.branchBtn}
            onPress={() => navigation.navigate('BranchSelect')}
          >
            <MapPin size={14} color="#FF6B35" />
            <Text style={tabStyles.branchBtnText} numberOfLines={1}>
              {activeBranch?.name || 'Branch'}
            </Text>
          </TouchableOpacity>
        ),
      }}
    >
      <Tab.Screen
        name="Orders"
        component={OrdersListScreen}
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, size }) => <ClipboardList color={color} size={size} />,
        }}
      />
      {/* -- NEW: Stock Counts tab -- */}
      <Tab.Screen
        name="StockCount"
        component={StockCountScreen}
        options={{
          title: 'Stock Count',
          tabBarIcon: ({ color, size }) => <ClipboardCheck color={color} size={size} />,
          // Show a badge if there are OOS verifications pending
          // (badge state would need a global store - left as an exercise)
        }}
      />
      <Tab.Screen
        name="Products"
        component={BarcodeLinkingScreen}
        options={{
          title: 'Products',
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Deliveries"
        component={DeliveriesListScreen}
        options={{
          title: 'Deliveries',
          tabBarIcon: ({ color, size }) => <Car color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );
}

const tabStyles = StyleSheet.create({
  branchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 16,
    backgroundColor: '#fff7f3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#fed7aa',
    maxWidth: 140,
  },
  branchBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF6B35',
    flex: 1,
  },
});

export default function App() {
  const { user, activeBranch, loadUser } = useAuthStore();
  const navigationRef = useRef<any>(null);

  useEffect(() => { loadUser(); }, []);

  useEffect(() => {
    if (navigationRef.current) setNavigationRef(navigationRef.current);
  }, [navigationRef.current]);

  useEffect(() => {
    if (!user) return;
    registerForPushNotifications().catch(() => {});
    const cleanup = addNotificationListeners();
    return cleanup;
  }, [user]);

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen
              name="BranchSelect"
              component={BranchSelectScreen}
              options={{ presentation: activeBranch ? 'modal' : 'card' }}
            />
            <Stack.Screen name="Main"               component={MainTabs} />
            <Stack.Screen name="Picking"            component={PickingScreen} />
            <Stack.Screen name="Packaging"          component={PackagingScreen} />
            <Stack.Screen name="DeliveryCollection" component={DeliveryCollectionScreen} />
            <Stack.Screen name="DeliveryDetail"     component={DeliveryScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
// App.tsx  (picker & delivery app — React Navigation)
// Changes from original:
//   1. NavigationContainer gets a ref → passed to NotificationService
//   2. Push notification listeners wired up in useEffect
//   3. loadUser() called on mount to restore session
//   4. Branch-aware: !activeBranch → BranchSelect screen (always first in stack)
//   5. "Change Branch" button added to MainTabs header
//   6. BranchSelectScreen accessible from both the gate and the header
//   FIX: All screens always registered in navigator; BranchSelect just comes
//        first when no branch is selected, avoiding conditional stack swap issues.

import 'react-native-gesture-handler';
import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { Package, ClipboardList, Settings, Car, MapPin } from 'lucide-react-native';

// ── existing screens ──────────────────────────────────────────────────────────
import LoginScreen from './src/screens/LoginScreen';
import OrdersListScreen from './src/screens/OrdersListScreen';
import PickingScreen from './src/screens/PickingScreen';
import PackagingScreen from './src/screens/PackagingScreen';
import BarcodeLinkingScreen from './src/screens/BarcodeLinkingScreen';
import DeliveriesListScreen from './src/screens/DeliveriesListScreen';
import DeliveryCollectionScreen from './src/screens/DeliveryCollectionScreen';
import DeliveryScreen from './src/screens/DeliveryScreen';

// ── new screens ───────────────────────────────────────────────────────────────
import BranchSelectScreen from './src/screens/BranchSelectScreen';
// import DeliveryCompletionScreen from './src/screens/DeliveryCompletionScreen';

// ── stores & services ─────────────────────────────────────────────────────────
import { useAuthStore } from './src/stores/authStore';
import {
  setNavigationRef,
  addNotificationListeners,
  registerForPushNotifications,
} from './src/services/NotificationService';

const Stack = createStackNavigator();
const Tab   = createBottomTabNavigator();

// ─── Main tab navigator ───────────────────────────────────────────────────────
function MainTabs({ navigation }: any) {
  const { activeBranch } = useAuthStore();

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#FF6B35',
        tabBarInactiveTintColor: '#666',
        headerShown: true,
        headerStyle: { backgroundColor: '#fff' },
        headerTitleStyle: { fontWeight: '700', color: '#1a1a1a' },
        // "Change Branch" button in every tab header
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

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  const { user, activeBranch, loadUser } = useAuthStore();
  const navigationRef = useRef<any>(null);

  // ── Restore session on cold start ──────────────────────────────────────────
  useEffect(() => {
    loadUser();
  }, []);

  // ── Wire up notification service once navigation is ready ─────────────────
  useEffect(() => {
    if (navigationRef.current) {
      setNavigationRef(navigationRef.current);
    }
  }, [navigationRef.current]);

  // ── Register for push notifications + subscribe to events ─────────────────
  useEffect(() => {
    if (!user) return; // only register once logged in

    // Register device (non-blocking)
    registerForPushNotifications().catch(() => {});

    // Subscribe to foreground + tap events
    const cleanup = addNotificationListeners();
    return cleanup;
  }, [user]);

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          // ── Not logged in ────────────────────────────────────────────────
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          // ── Logged in: always register all screens so the stack is stable.
          // BranchSelect is listed first so it appears as the initial screen
          // when no branch is chosen yet. Once a branch is selected,
          // BranchSelectScreen calls navigation.reset() to push Main.
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
            {/* <Stack.Screen name="DeliveryCompletion" component={DeliveryCompletionScreen} /> */}
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
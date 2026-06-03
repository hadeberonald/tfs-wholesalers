import 'react-native-gesture-handler';
import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { TouchableOpacity, Text, StyleSheet, View, ActivityIndicator } from 'react-native';
import { ClipboardList, Settings, Car, MapPin, ClipboardCheck } from 'lucide-react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import LoginScreen              from './src/screens/LoginScreen';
import OrdersListScreen         from './src/screens/OrdersListScreen';
import PickingScreen            from './src/screens/PickingScreen';
import PackagingScreen          from './src/screens/PackagingScreen';
import BarcodeLinkingScreen     from './src/screens/BarcodeLinkingScreen';
import DeliveriesListScreen     from './src/screens/DeliveriesListScreen';
import DeliveryCollectionScreen from './src/screens/DeliveryCollectionScreen';
import DeliveryScreen           from './src/screens/DeliveryScreen';
import BranchSelectScreen       from './src/screens/BranchSelectScreen';
import StockCountScreen         from './src/screens/StockCountScreen';

import { useAuthStore } from './src/stores/authStore';
import {
  setNavigationRef,
  addNotificationListeners,
  registerForPushNotifications,
} from './src/services/NotificationService';
import { attachSyncListeners, flushQueue } from './src/services/offlineSync';
import { AppModalProvider } from './src/components/AppModal';

const Stack = createStackNavigator();
const Tab   = createBottomTabNavigator();

function MainTabs({ navigation }: any) {
  const { activeBranch, user } = useAuthStore();

  const isPicker   = user?.role === 'picker'   || user?.role === 'admin';
  const isDelivery = user?.role === 'delivery' || user?.role === 'admin';

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor:   '#FF6B35',
        tabBarInactiveTintColor: '#666',
        headerShown:      true,
        headerStyle:      { backgroundColor: '#fff' },
        headerTitleStyle: { fontWeight: '700', color: '#1a1a1a' },
        tabBarStyle:      { display: 'none' },
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
      {isPicker && (
        <Tab.Screen name="Orders" component={OrdersListScreen}
          options={{ title: 'Orders', tabBarIcon: ({ color, size }) => <ClipboardList color={color} size={size} /> }}
        />
      )}
      {isPicker && (
        <Tab.Screen name="StockCount" component={StockCountScreen}
          options={{ title: 'Stock Count', tabBarIcon: ({ color, size }) => <ClipboardCheck color={color} size={size} /> }}
        />
      )}
      {isPicker && (
        <Tab.Screen name="Products" component={BarcodeLinkingScreen}
          options={{ title: 'Products', tabBarIcon: ({ color, size }) => <Settings color={color} size={size} /> }}
        />
      )}
      {isDelivery && (
        <Tab.Screen name="Deliveries" component={DeliveriesListScreen}
          options={{ title: 'Deliveries', tabBarIcon: ({ color, size }) => <Car color={color} size={size} /> }}
        />
      )}
    </Tab.Navigator>
  );
}

const tabStyles = StyleSheet.create({
  branchBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginRight: 16, backgroundColor: '#fff7f3',
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: '#fed7aa', maxWidth: 140,
  },
  branchBtnText: { fontSize: 12, fontWeight: '700', color: '#FF6B35', flex: 1 },
});

// ─── Authenticated navigator ──────────────────────────────────────────────────
// Key insight: initialRouteName is decided ONCE when this component mounts,
// based on whether we already have a branch saved.  After that, BranchSelect
// calls navigation.reset({ routes: [{ name: 'Main' }] }) to swap to Main,
// so we never need to re-evaluate it.
function AuthenticatedNavigator() {
  const { activeBranch } = useAuthStore();

  // If we have a branch already (restored from AsyncStorage) go straight to
  // Main.  If not, land on BranchSelect first.
  const initialRoute = activeBranch ? 'Main' : 'BranchSelect';

  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName={initialRoute}
    >
      <Stack.Screen name="BranchSelect" component={BranchSelectScreen}
        // When reached from the header button it slides up as a modal.
        // The initial card presentation is handled by initialRouteName above.
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen name="Main"               component={MainTabs} />
      <Stack.Screen name="Picking"            component={PickingScreen} />
      <Stack.Screen name="Packaging"          component={PackagingScreen} />
      <Stack.Screen name="DeliveryCollection" component={DeliveryCollectionScreen} />
      <Stack.Screen name="DeliveryDetail"     component={DeliveryScreen} />
    </Stack.Navigator>
  );
}

// ─── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  const { user, appReady, loadUser } = useAuthStore();
  const navigationRef = useRef<any>(null);

  useEffect(() => { loadUser(); }, []);

  useEffect(() => {
    if (navigationRef.current) setNavigationRef(navigationRef.current);
  }, [navigationRef.current]);

  useEffect(() => {
    if (!user) return;
    registerForPushNotifications().catch(() => {});
    const cleanupNotifications = addNotificationListeners();
    const cleanupSync = attachSyncListeners();
    flushQueue().catch(() => {});
    return () => {
      cleanupNotifications();
      cleanupSync();
    };
  }, [user]);

  // Block render until AsyncStorage has been read — prevents the 1-frame
  // flash where activeBranch is null even though it was persisted.
  if (!appReady) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AppModalProvider>
        <NavigationContainer ref={navigationRef}>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            {!user ? (
              <Stack.Screen name="Login" component={LoginScreen} />
            ) : (
              <Stack.Screen name="Authenticated" component={AuthenticatedNavigator} />
            )}
          </Stack.Navigator>
        </NavigationContainer>
      </AppModalProvider>
    </SafeAreaProvider>
  );
}
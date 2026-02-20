// src/services/NotificationService.ts
// Registers the device for Expo push notifications and wires up
// foreground / background / tap handlers.
//
// Usage: call NotificationService.register() once on app start (after
// the user is logged in and a branch is selected).
//
// Requirements:
//   expo install expo-notifications expo-device expo-constants
//   Add the expo-notifications plugin to app.json (see app.json output)

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform, Alert } from 'react-native';
import { useAuthStore } from '../stores/authStore';

// ─── Notification behaviour while app is in the foreground ────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ─── Types ────────────────────────────────────────────────────────────────────
export type NotificationPayload = {
  type:
    | 'new_order'          // a new order needs picking
    | 'order_update'       // status changed on an existing order
    | 'ready_for_delivery' // order packed, driver needs to collect
    | 'message';           // generic message from admin
  orderId?: string;
  orderNumber?: string;
  message?: string;
};

// ─── Navigation ref (set this from App.tsx) ───────────────────────────────────
// We store it here so the service can navigate without prop drilling.
let _navigationRef: any = null;
export function setNavigationRef(ref: any) {
  _navigationRef = ref;
}

// ─── Register & request permission ───────────────────────────────────────────
export async function registerForPushNotifications(): Promise<string | null> {
  // Push notifications only work on real devices
  if (!Device.isDevice) {
    console.log('[Notifications] Skipping registration on emulator/simulator');
    return null;
  }

  // Android: create a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('orders', {
      name: 'Order Notifications',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF6B35',
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('deliveries', {
      name: 'Delivery Notifications',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#10B981',
      sound: 'default',
    });
  }

  // Request permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    Alert.alert(
      'Notifications Disabled',
      'Enable notifications in your device settings to receive order alerts.'
    );
    return null;
  }

  // Get the Expo push token
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  if (!projectId) {
    console.warn('[Notifications] No EAS project ID found in app config');
    return null;
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const pushToken = tokenData.data;
    console.log('[Notifications] Expo push token:', pushToken);

    // Store in authStore (which will also send to the server)
    useAuthStore.getState().setExpoPushToken(pushToken);

    return pushToken;
  } catch (error) {
    console.error('[Notifications] Failed to get push token:', error);
    return null;
  }
}

// ─── Notification tap handler (notification received while app is closed/bg) ─
export function handleNotificationResponse(
  response: Notifications.NotificationResponse
) {
  const data = response.notification.request.content.data as NotificationPayload;
  routeNotification(data);
}

// ─── Foreground notification received ─────────────────────────────────────────
export function handleForegroundNotification(
  notification: Notifications.Notification
) {
  const data = notification.request.content.data as NotificationPayload;

  // Show an in-app alert for new orders so the picker can jump straight there
  if (data.type === 'new_order') {
    Alert.alert(
      '🛒 New Order!',
      `Order #${data.orderNumber} is ready to pick.`,
      [
        { text: 'Dismiss', style: 'cancel' },
        {
          text: 'Open Order',
          onPress: () => routeNotification(data),
        },
      ]
    );
  }
}

// ─── Route to the correct screen based on payload ────────────────────────────
function routeNotification(data: NotificationPayload) {
  if (!_navigationRef) return;

  switch (data.type) {
    case 'new_order':
      // Go to the orders list so the picker sees the new order
      _navigationRef.navigate('Main', { screen: 'Orders' });
      break;

    case 'order_update':
      if (data.orderId) {
        _navigationRef.navigate('Picking', { orderId: data.orderId });
      }
      break;

    case 'ready_for_delivery':
      // Go to deliveries tab
      _navigationRef.navigate('Main', { screen: 'Deliveries' });
      break;

    case 'message':
      Alert.alert('Message', data.message || 'You have a new message');
      break;

    default:
      _navigationRef.navigate('Main', { screen: 'Orders' });
  }
}

// ─── Subscribe helpers (call from App.tsx useEffect) ─────────────────────────
export function addNotificationListeners() {
  const foregroundSub = Notifications.addNotificationReceivedListener(
    handleForegroundNotification
  );

  const responseSub = Notifications.addNotificationResponseReceivedListener(
    handleNotificationResponse
  );

  // Return cleanup function
  return () => {
    foregroundSub.remove();
    responseSub.remove();
  };
}
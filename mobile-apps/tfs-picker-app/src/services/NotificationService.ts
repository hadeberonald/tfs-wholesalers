import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { useAuthStore } from '../stores/authStore';

const API_BASE_URL = 'https://tfs-wholesalers-ifad.onrender.com';

// ─── Types ───────────────────────────────────────────────────────────────────

export type NotificationPayload = {
  type: 'new_order' | 'order_update' | 'ready_for_delivery' | 'message';
  orderId?: string;
  orderNumber?: string;
  message?: string;
};

// ─── Foreground notification behaviour ───────────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert:  true,
    shouldPlaySound:  true,
    shouldSetBadge:   true,
    shouldShowBanner: true,   // ✅ required by newer expo-notifications
    shouldShowList:   true,   // ✅ required by newer expo-notifications
  }),
});

// ─── Navigation ref ──────────────────────────────────────────────────────────

let _navigationRef: any = null;

export function setNavigationRef(ref: any) {
  _navigationRef = ref;
}

// ─── Save token to backend ───────────────────────────────────────────────────

async function saveTokenToBackend(token: string): Promise<void> {
  try {
    const { token: authToken } = useAuthStore.getState(); // ✅ token is on the store, not user
    if (!authToken) return;

    const res = await fetch(`${API_BASE_URL}/api/users/push-token`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        pushToken: token,
        platform:  Platform.OS,
      }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    console.log('[Notifications] Token saved');
  } catch (err) {
    console.error('[Notifications] Failed to save token:', err);
  }
}

// ─── Register ────────────────────────────────────────────────────────────────

export async function registerForPushNotifications(): Promise<string | null> {
  try {
    if (!Device.isDevice) {
      console.log('[Notifications] Skipped — not a physical device');
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name:             'Default',
        importance:       Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor:       '#FF6B35',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Notifications] Permission denied');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '7355e9c9-4afe-4f0b-b808-2488fd7a1ff8',
    });

    const token = tokenData.data;
    console.log('[Notifications] Token:', token);

    // Save to store + backend
    useAuthStore.getState().setExpoPushToken(token);
    await saveTokenToBackend(token);

    return token;
  } catch (err) {
    console.error('[Notifications] Registration failed:', err);
    return null;
  }
}

// ─── Listeners ───────────────────────────────────────────────────────────────

export function addNotificationListeners() {
  const receivedSub = Notifications.addNotificationReceivedListener(notification => {
    console.log('[Notifications] Received:', notification);
  });

  const responseSub = Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data as NotificationPayload;
    handleNotificationTap(data);
  });

  return () => {
    receivedSub.remove();
    responseSub.remove();
  };
}

// ─── Handle tap → navigate to order ─────────────────────────────────────────

function handleNotificationTap(data: NotificationPayload) {
  if (!_navigationRef) return;

  if (data?.orderId) {
    _navigationRef.navigate('Picking', { orderId: data.orderId });
  } else {
    _navigationRef.navigate('Main', { screen: 'Orders' });
  }
}

// ─── Remove token on logout ───────────────────────────────────────────────────

export async function unregisterPushNotifications(): Promise<void> {
  try {
    const { token: authToken } = useAuthStore.getState(); // ✅ token is on the store
    if (!authToken) return;

    await fetch(`${API_BASE_URL}/api/users/push-token`, {
      method:  'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` },
    });

    console.log('[Notifications] Token removed');
  } catch (err) {
    console.error('[Notifications] Failed to remove token:', err);
  }
}
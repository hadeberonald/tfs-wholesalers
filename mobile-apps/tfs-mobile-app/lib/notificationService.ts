import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://tfs-wholesalers-ifad.onrender.com';

// ─── Foreground behaviour ─────────────────────────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert:  true,
    shouldPlaySound:  true,
    shouldSetBadge:   true,
    shouldShowBanner: true,
    shouldShowList:   true,
  }),
});

// ─── Navigation ref ───────────────────────────────────────────────────────────

let _router: any = null;

export function setNotificationRouter(router: any) {
  _router = router;
}

// ─── Save token to backend ────────────────────────────────────────────────────

export async function saveTokenToBackend(
  token: string,
  userId?: string | null
): Promise<void> {
  try {
    const authToken = await AsyncStorage.getItem('auth_token');

    await fetch(`${API_URL}/api/users/push-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify({
        pushToken: token,
        platform:  Platform.OS,
        userId:    userId ?? null,
      }),
    });

    console.log('[Notifications] Customer token saved');
  } catch (err) {
    console.error('[Notifications] Failed to save token:', err);
  }
}

// ─── Register ─────────────────────────────────────────────────────────────────

export async function registerForPushNotifications(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;

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

    if (finalStatus !== 'granted') return null;

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '47538bb9-6325-44d1-ab12-95a5c7027d18',
    });

    const token = tokenData.data;
    await AsyncStorage.setItem('push_token', token);

    const userStr = await AsyncStorage.getItem('user');
    const user    = userStr ? JSON.parse(userStr) : null;

    await saveTokenToBackend(token, user?.id ?? null);
    return token;
  } catch (err) {
    console.error('[Notifications] Registration failed:', err);
    return null;
  }
}

// ─── Link token to user after login ──────────────────────────────────────────

export async function linkPushTokenAfterLogin(userId: string): Promise<void> {
  try {
    const token = await AsyncStorage.getItem('push_token');
    if (!token) return;
    await saveTokenToBackend(token, userId);
    console.log('[Notifications] Token linked to user:', userId);
  } catch (err) {
    console.error('[Notifications] Failed to link token after login:', err);
  }
}

// ─── Listeners ────────────────────────────────────────────────────────────────

export function addNotificationListeners(): () => void {
  const receivedSub = Notifications.addNotificationReceivedListener(notification => {
    console.log('[Notifications] Received:', notification);
  });

  const responseSub = Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data as any;
    handleNotificationTap(data);
  });

  return () => {
    receivedSub.remove();
    responseSub.remove();
  };
}

// ─── Tap handler ─────────────────────────────────────────────────────────────

function handleNotificationTap(data: any) {
  if (!_router) return;

  if (data?.orderId) {
    const status = data?.status;
    if (status === 'out_for_delivery' || status === 'collecting') {
      _router.push({ pathname: '/order-on-the-way', params: { orderId: data.orderId } });
    } else if (status === 'delivered') {
      _router.push({ pathname: '/order-delivered', params: { orderId: data.orderId } });
    } else if (status === 'packaging' || status === 'ready_for_delivery') {
      _router.push({ pathname: '/order-ready', params: { orderId: data.orderId } });
    } else {
      _router.push({ pathname: '/order-preparing', params: { orderId: data.orderId } });
    }
  } else {
    _router.push('/orders');
  }
}

// ─── Remove token on logout ───────────────────────────────────────────────────

export async function unregisterPushNotifications(): Promise<void> {
  try {
    const authToken = await AsyncStorage.getItem('auth_token');
    if (!authToken) return;

    await fetch(`${API_URL}/api/users/push-token`, {
      method:  'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });

    await AsyncStorage.removeItem('push_token');
    console.log('[Notifications] Customer token removed');
  } catch (err) {
    console.error('[Notifications] Failed to remove token:', err);
  }
}
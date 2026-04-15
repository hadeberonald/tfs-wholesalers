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
  userId?: string | null,
): Promise<void> {
  try {
    // Always re-read auth token from storage so we have the latest value.
    // This is critical for linkPushTokenAfterLogin — by the time it calls
    // this function, auth_token is already written to AsyncStorage.
    const authToken = await AsyncStorage.getItem('auth_token');

    const res = await fetch(`${API_URL}/api/users/push-token`, {
      method:  'POST',
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

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      console.error('[Notifications] Token save failed:', res.status, json);
    } else {
      console.log('[Notifications] Token saved OK — userId:', userId ?? 'guest');
    }
  } catch (err) {
    console.error('[Notifications] saveTokenToBackend error:', err);
  }
}

// ─── Register ─────────────────────────────────────────────────────────────────

export async function registerForPushNotifications(): Promise<string | null> {
  try {
    if (!Device.isDevice) {
      console.log('[Notifications] Skipping — not a physical device');
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
      console.warn('[Notifications] Permission not granted');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '47538bb9-6325-44d1-ab12-95a5c7027d18',
    });

    const token = tokenData.data;
    await AsyncStorage.setItem('push_token', token);

    // At registration time the user may not be logged in yet.
    // Save as guest — linkPushTokenAfterLogin will upgrade it after login.
    const userStr = await AsyncStorage.getItem('user');
    const user    = userStr ? JSON.parse(userStr) : null;

    await saveTokenToBackend(token, user?.id ?? null);
    return token;
  } catch (err) {
    console.error('[Notifications] Registration failed:', err);
    return null;
  }
}

// ─── Link token after login ───────────────────────────────────────────────────
//
// ⚠️  IMPORTANT — call this AFTER both storage writes are complete:
//
//   await AsyncStorage.setItem('auth_token', token);
//   await AsyncStorage.setItem('user', JSON.stringify(user));
//   await linkPushTokenAfterLogin(user.id);   ← must be last
//
// If you call it before auth_token is in AsyncStorage, the Bearer header
// will be missing and the token will be saved as a guest (userId: null).

export async function linkPushTokenAfterLogin(userId: string): Promise<void> {
  try {
    const token = await AsyncStorage.getItem('push_token');
    if (!token) {
      console.warn('[Notifications] linkPushTokenAfterLogin: no push token stored yet');
      return;
    }
    // auth_token is now in storage — saveTokenToBackend will pick it up
    await saveTokenToBackend(token, userId);
    console.log('[Notifications] Token linked to userId:', userId);
  } catch (err) {
    console.error('[Notifications] linkPushTokenAfterLogin error:', err);
  }
}

// ─── Listeners ────────────────────────────────────────────────────────────────

export function addNotificationListeners(): () => void {
  const receivedSub = Notifications.addNotificationReceivedListener(notification => {
    console.log('[Notifications] Received in foreground:', notification.request.content.title);
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

// ─── Tap routing ─────────────────────────────────────────────────────────────

function handleNotificationTap(data: any) {
  if (!_router) {
    console.warn('[Notifications] handleNotificationTap: router not set');
    return;
  }

  if (!data?.orderId) {
    _router.push('/orders');
    return;
  }

  const status = data?.status;

  if (status === 'out_for_delivery' || status === 'collecting') {
    _router.push({ pathname: '/order-on-the-way', params: { orderId: data.orderId } });
  } else if (status === 'delivered') {
    _router.push({ pathname: '/order-delivered',  params: { orderId: data.orderId } });
  } else if (status === 'packaging' || status === 'ready_for_delivery') {
    _router.push({ pathname: '/order-ready',      params: { orderId: data.orderId } });
  } else {
    _router.push({ pathname: '/order-preparing',  params: { orderId: data.orderId } });
  }
}

// ─── Logout ───────────────────────────────────────────────────────────────────

export async function unregisterPushNotifications(): Promise<void> {
  try {
    const [authToken, pushToken] = await Promise.all([
      AsyncStorage.getItem('auth_token'),
      AsyncStorage.getItem('push_token'),
    ]);

    if (!authToken) return;

    await fetch(`${API_URL}/api/users/push-token`, {
      method:  'DELETE',
      headers: {
        Authorization:  `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      // Send specific token so only this device is removed, not all devices
      body: JSON.stringify({ pushToken }),
    });

    await AsyncStorage.removeItem('push_token');
    console.log('[Notifications] Token removed on logout');
  } catch (err) {
    console.error('[Notifications] unregisterPushNotifications error:', err);
  }
}
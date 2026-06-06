import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setPendingDeliveryReview } from '../hooks/usePendingDeliveryReview';

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

export async function linkPushTokenAfterLogin(userId: string): Promise<void> {
  try {
    const token = await AsyncStorage.getItem('push_token');
    if (!token) {
      console.warn('[Notifications] linkPushTokenAfterLogin: no push token stored yet');
      return;
    }
    await saveTokenToBackend(token, userId);
    console.log('[Notifications] Token linked to userId:', userId);
  } catch (err) {
    console.error('[Notifications] linkPushTokenAfterLogin error:', err);
  }
}

// ─── Queue delivery review from a push notification data payload ──────────────
// Called from both the foreground receive listener AND the tap handler so the
// review is queued regardless of whether the customer taps the notification or
// just has the app open when the push arrives.

async function maybeQueueDeliveryReview(data: any): Promise<void> {
  if (data?.type === 'order_update' && data?.status === 'delivered' && data?.orderId) {
    try {
      await setPendingDeliveryReview({
        orderId:     data.orderId,
        orderNumber: data.orderNumber ?? '',
        branchSlug:  data.branchSlug  ?? '',
        deliveredAt: new Date().toISOString(),
      });
      console.log('[Notifications] Delivery review queued for order:', data.orderId);
    } catch (err) {
      console.error('[Notifications] Failed to queue delivery review:', err);
    }
  }
}

// ─── Listeners ────────────────────────────────────────────────────────────────

export function addNotificationListeners(): () => void {
  // Fires when a push arrives while the app is in the foreground.
  // We queue the review here so it's captured even if the customer never taps.
  const receivedSub = Notifications.addNotificationReceivedListener(async notification => {
    console.log('[Notifications] Received in foreground:', notification.request.content.title);
    const data = notification.request.content.data as any;
    await maybeQueueDeliveryReview(data);
  });

  // Fires when the customer taps a notification (foreground or background).
  const responseSub = Notifications.addNotificationResponseReceivedListener(async response => {
    const data = response.notification.request.content.data as any;
    await maybeQueueDeliveryReview(data);
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
      body: JSON.stringify({ pushToken }),
    });

    await AsyncStorage.removeItem('push_token');
    console.log('[Notifications] Token removed on logout');
  } catch (err) {
    console.error('[Notifications] unregisterPushNotifications error:', err);
  }
}
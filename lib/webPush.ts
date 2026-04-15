// lib/webPush.ts
// Client-side Web Push utilities for the TFS Wholesalers web store.
//
// Usage:
//   import { registerWebPush, unregisterWebPush } from '@/lib/webPush';
//
//   // After user logs in:
//   await registerWebPush(user.id);
//
//   // After user logs out:
//   await unregisterWebPush();
//
// Required env var (NEXT_PUBLIC_ so it's available in the browser):
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY  — get from `npx web-push generate-vapid-keys`
//
// Server env vars (for sending):
//   VAPID_PUBLIC_KEY
//   VAPID_PRIVATE_KEY
//   VAPID_SUBJECT  — e.g. mailto:admin@tfswholesalers.com

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
const SW_PATH          = '/sw.js';
const API_BASE         = ''; // same origin

// ── urlBase64ToUint8Array ─────────────────────────────────────────────────────
// Converts a base64url VAPID key string to the Uint8Array needed by
// PushManager.subscribe().

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from(rawData, c => c.charCodeAt(0));
}

// ── isSupported ───────────────────────────────────────────────────────────────

export function isWebPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

// ── registerWebPush ───────────────────────────────────────────────────────────
// Call this after the user logs in (or on page load if already logged in).
// Safe to call multiple times — it's idempotent.

export async function registerWebPush(userId?: string | null): Promise<boolean> {
  try {
    if (!isWebPushSupported()) {
      console.log('[WebPush] Not supported in this browser');
      return false;
    }

    if (!VAPID_PUBLIC_KEY) {
      console.error('[WebPush] NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set');
      return false;
    }

    // 1. Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('[WebPush] Permission denied:', permission);
      return false;
    }

    // 2. Register service worker
    const registration = await navigator.serviceWorker.register(SW_PATH, { scope: '/' });
    await navigator.serviceWorker.ready;
    console.log('[WebPush] Service worker registered');

    // 3. Subscribe to push
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    // 4. Save subscription to backend
    const res = await fetch(`${API_BASE}/api/users/web-push-subscription`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ subscription, userId: userId ?? null }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[WebPush] Failed to save subscription:', err);
      return false;
    }

    console.log('[WebPush] Subscription saved — userId:', userId ?? 'guest');
    return true;
  } catch (err) {
    console.error('[WebPush] registerWebPush error:', err);
    return false;
  }
}

// ── unregisterWebPush ─────────────────────────────────────────────────────────
// Call on logout. Removes the subscription from both the browser and the server.

export async function unregisterWebPush(): Promise<void> {
  try {
    if (!isWebPushSupported()) return;

    const registration = await navigator.serviceWorker.getRegistration(SW_PATH);
    if (!registration) return;

    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    // Tell server to remove it first
    await fetch(`${API_BASE}/api/users/web-push-subscription`, {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ endpoint: subscription.endpoint }),
    }).catch(() => {});

    // Then unsubscribe in the browser
    await subscription.unsubscribe();
    console.log('[WebPush] Unsubscribed');
  } catch (err) {
    console.error('[WebPush] unregisterWebPush error:', err);
  }
}
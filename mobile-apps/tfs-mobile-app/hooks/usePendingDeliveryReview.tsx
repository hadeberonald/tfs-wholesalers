// hooks/usePendingDeliveryReview.ts
//
// Three-layer approach so the modal fires regardless of how the app was opened:
//
// Layer 1 — Push listeners (notificationService.ts)
//   Writes to AsyncStorage when a "delivered" push arrives while the app is
//   open (foreground receive) or when the customer taps the notification.
//   Misses: customer swipes the notification away and opens the app manually.
//
// Layer 2 — Backend poll on every app open / foreground
//   On mount and on every AppState → active transition, hits
//   GET /api/orders?userId=...&needsReview=true. If the server finds a
//   delivered order with no NPS response, it writes to AsyncStorage here.
//   Catches every case Layer 1 misses — cold open, swipe-dismissed push,
//   reinstalled app, etc.
//
// Layer 3 — AsyncStorage read
//   After Layers 1 or 2 write, this layer reads the stored value and surfaces
//   it to the root layout so DeliveryNpsModal can render.
//
// The server-side NPS route already deduplicates on orderId, so double-writes
// from concurrent layers are harmless.

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';

const API_URL = 'https://tfs-wholesalers-ifad.onrender.com';
const STORAGE_KEY = 'pendingDeliveryReview';

export interface PendingReview {
  orderId:     string;
  orderNumber: string;
  branchSlug:  string;
  deliveredAt: string;
}

// ── Write helpers (called externally by notificationService + order-delivered) ─

export async function setPendingDeliveryReview(review: PendingReview): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(review));
  console.log('[NPS] Pending review queued — orderId:', review.orderId);
}

export async function clearPendingDeliveryReview(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
  console.log('[NPS] Pending review cleared');
}

// ── Layer 2: backend poll ─────────────────────────────────────────────────────
// Asks the server for the most recent delivered order that has no NPS response.
// Only runs when the user is logged in (auth_token present).
// Silently no-ops on network failure — Layer 1 and Layer 3 are the fallback.

async function pollServerForPendingReview(): Promise<void> {
  try {
    const [authToken, userStr] = await Promise.all([
      AsyncStorage.getItem('auth_token'),
      AsyncStorage.getItem('user'),
    ]);

    if (!authToken || !userStr) {
      // Not logged in — nothing to poll
      return;
    }

    const user = JSON.parse(userStr);
    if (!user?.id) return;

    // Check if we already have a pending review stored — skip the network
    // call if we do, since the modal is about to show anyway.
    const existing = await AsyncStorage.getItem(STORAGE_KEY);
    if (existing) {
      console.log('[NPS] Poll skipped — review already queued locally');
      return;
    }

    console.log('[NPS] Polling server for unreviewed delivered orders...');

    const res = await fetch(
      `${API_URL}/api/orders?userId=${user.id}&needsNpsReview=true`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );

    if (!res.ok) {
      console.warn('[NPS] Poll response not OK:', res.status);
      return;
    }

    const json = await res.json();

    // The endpoint returns { orders: [...] } filtered to delivered orders
    // with no existing nps_delivery_responses document.
    // We take the most recent one.
    const orders: any[] = json?.orders ?? [];
    const delivered = orders.find(o => o.status === 'delivered');

    if (!delivered) {
      console.log('[NPS] Poll — no unreviewed delivered orders found');
      return;
    }

    console.log('[NPS] Poll found unreviewed delivered order:', delivered.orderNumber);

    await setPendingDeliveryReview({
      orderId:     delivered._id,
      orderNumber: delivered.orderNumber,
      branchSlug:  delivered.branchSlug ?? '',
      deliveredAt: delivered.deliveredAt ?? delivered.updatedAt ?? new Date().toISOString(),
    });
  } catch (err) {
    // Non-fatal — the push listener or socket are the fallback
    console.warn('[NPS] Server poll failed (non-fatal):', err);
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function usePendingDeliveryReview() {
  const [pendingReview, setPending] = useState<PendingReview | null>(null);
  const [checked, setChecked] = useState(false);

  // Reads AsyncStorage and updates state. Called after every potential write.
  const readStorage = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      console.log('[NPS] Storage check —', raw ? `found orderId ${JSON.parse(raw).orderId}` : 'empty');
      setPending(raw ? (JSON.parse(raw) as PendingReview) : null);
    } catch (err) {
      console.warn('[NPS] Storage read failed:', err);
      setPending(null);
    } finally {
      setChecked(true);
    }
  }, []);

  // Full check: poll server first, then read storage.
  // Server poll writes to storage if it finds something, then readStorage
  // picks it up — so both layers feed into the same state update.
  const checkAll = useCallback(async () => {
    await pollServerForPendingReview();
    await readStorage();
  }, [readStorage]);

  // On mount — covers cold open, reinstall, and "queued in a previous session"
  useEffect(() => {
    checkAll();
  }, [checkAll]);

  // On foreground — covers swipe-dismissed notifications and background→active
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        console.log('[NPS] App foregrounded — running full check');
        checkAll();
      }
    });
    return () => sub.remove();
  }, [checkAll]);

  const dismiss = useCallback(async () => {
    await clearPendingDeliveryReview();
    setPending(null);
  }, []);

  // Return null until the first full check completes so the modal never
  // flashes before we know whether there's a review pending.
  return { pendingReview: checked ? pendingReview : null, dismiss };
}
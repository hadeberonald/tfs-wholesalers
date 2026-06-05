// hooks/usePendingDeliveryReview.ts
// Checks AsyncStorage on app focus for any orders marked as delivered
// but not yet reviewed. Returns the pending review so the root layout
// can trigger the NPS modal.

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';

export interface PendingReview {
  orderId: string;
  orderNumber: string;
  branchSlug: string;
  deliveredAt: string;
}

const STORAGE_KEY = 'pendingDeliveryReview';

// ── Write helpers (called from order-delivered screen or push handler) ────────

export async function setPendingDeliveryReview(review: PendingReview) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(review));
}

export async function clearPendingDeliveryReview() {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function usePendingDeliveryReview() {
  const [pendingReview, setPending] = useState<PendingReview | null>(null);
  const [checked, setChecked]       = useState(false);

  const check = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        setPending(JSON.parse(raw) as PendingReview);
      }
    } catch {
      // silently ignore
    } finally {
      setChecked(true);
    }
  }, []);

  // Check on mount
  useEffect(() => { check(); }, []);

  // Also re-check whenever the app comes back to the foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') check();
    });
    return () => sub.remove();
  }, [check]);

  const dismiss = useCallback(async () => {
    await clearPendingDeliveryReview();
    setPending(null);
  }, []);

  return { pendingReview: checked ? pendingReview : null, dismiss };
}
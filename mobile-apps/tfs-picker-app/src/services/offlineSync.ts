// src/services/offlineSync.ts
// Offline-first sync for all warehouse operations.
//
// Every action (pick, OOS, package seal, delivery complete) is written to an
// AsyncStorage queue FIRST, then we attempt an immediate API flush. If the
// network is unavailable the item stays in the queue and is flushed:
//   • automatically when NetInfo reports the device is back online
//   • when the app comes back to the foreground (AppState change)
//   • when the caller explicitly calls flushQueue()
//
// Hard-close survival: because we write to AsyncStorage before hitting the
// network, an action is never lost even if the user force-quits the app.

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { AppState, AppStateStatus } from 'react-native';
import axios from 'axios';

const API_URL = 'https://tfs-wholesalers-ifad.onrender.com';

// ─── Types ────────────────────────────────────────────────────────────────────

export type OfflineActionType =
  // ── Picking ──────────────────────────────────────────────────────────────
  | 'picking_started'     // PickingScreen — mark order as picking + assign picker
  | 'item_picked'         // PickingScreen — increment pick count for one item
  | 'item_oos'            // PickingScreen — mark item as out of stock
  | 'order_cancelled'     // PickingScreen — all items OOS, cancel the order
  | 'packaging_started'   // PickingScreen → PackagingScreen transition
  // ── Packaging ────────────────────────────────────────────────────────────
  | 'package_sealed'      // PackagingScreen — QR scanned, package committed
  | 'packaging_completed' // PackagingScreen — all packages done, move to collecting
  // ── Delivery (collection) ─────────────────────────────────────────────────
  | 'package_collected'   // DeliveryCollectionScreen — driver scans a package
  | 'delivery_started'    // DeliveryCollectionScreen — all packages collected, going out
  // ── Delivery (dropoff) ───────────────────────────────────────────────────
  | 'package_verified'    // DeliveryScreen — driver scans at customer door (local-only)
  | 'delivery_completed'; // DeliveryScreen — final mark-as-delivered

export interface OfflineAction {
  id: string;             // uuid-ish — timestamp + random
  type: OfflineActionType;
  orderId: string;
  payload: Record<string, unknown>;
  createdAt: string;      // ISO timestamp
  attempts: number;       // retry counter — gives up after MAX_ATTEMPTS
}

const QUEUE_KEY      = 'offline_action_queue';
const MAX_ATTEMPTS   = 10;
const RETRY_DELAY_MS = 2000;

// ─── Internal helpers ─────────────────────────────────────────────────────────

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function readQueue(): Promise<OfflineAction[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as OfflineAction[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: OfflineAction[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

// ─── Apply a single action to the API ─────────────────────────────────────────

async function applyAction(action: OfflineAction, token: string): Promise<void> {
  const { type, orderId, payload } = action;

  switch (type) {
    // ── Picking actions ─────────────────────────────────────────────────────
    case 'picking_started': {
      // payload: { status, pickingStartedAt, assignedPickerId, assignedPickerName }
      await axios.patch(
        `${API_URL}/api/orders/${orderId}`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      break;
    }

    case 'item_picked': {
      // payload: { sku, productId, scanKey }
      // POST to the scan-item endpoint — server increments server-side count
      await axios.post(
        `${API_URL}/api/orders/${orderId}/scan-item`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      break;
    }

    case 'item_oos': {
      // payload: { sku, productId, variantId, scanKey, refundAmount, itemName }
      await axios.post(
        `${API_URL}/api/orders/${orderId}/item-oos`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      break;
    }

    case 'order_cancelled': {
      // payload: { status: 'cancelled', cancelledAt, cancellationReason }
      await axios.patch(
        `${API_URL}/api/orders/${orderId}`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      break;
    }

    case 'packaging_started': {
      // payload: { status: 'packaging', packagingStartedAt }
      await axios.patch(
        `${API_URL}/api/orders/${orderId}`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      break;
    }

    // ── Packaging actions ───────────────────────────────────────────────────
    case 'package_sealed': {
      // payload: { packages: Package[] }  — full packages array (idempotent overwrite)
      await axios.patch(
        `${API_URL}/api/orders/${orderId}`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      break;
    }

    case 'packaging_completed': {
      // payload: { status: 'collecting', packagingCompletedAt }
      await axios.patch(
        `${API_URL}/api/orders/${orderId}`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      break;
    }

    // ── Delivery (collection) ───────────────────────────────────────────────
    case 'package_collected': {
      // payload: { collectedPackages: string[] }
      await axios.patch(
        `${API_URL}/api/orders/${orderId}`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      break;
    }

    case 'delivery_started': {
      // payload: { status: 'out_for_delivery', deliveryStartedAt }
      await axios.patch(
        `${API_URL}/api/orders/${orderId}`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      break;
    }

    // ── Delivery (dropoff) ──────────────────────────────────────────────────
    case 'package_verified': {
      // Package verification is local-only — nothing to push for individual scans.
      // The server only needs the final 'delivered' event.
      break;
    }

    case 'delivery_completed': {
      // payload: { status: 'delivered', deliveredAt }
      await axios.patch(
        `${API_URL}/api/orders/${orderId}`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      break;
    }

    default: {
      // Unknown action type — log and skip (don't retry forever)
      console.warn(`[OfflineSync] Unknown action type: ${type} — skipping`);
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Enqueue an offline action and immediately attempt to flush it. */
export async function enqueueAction(
  type: OfflineActionType,
  orderId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const action: OfflineAction = {
    id: makeId(),
    type,
    orderId,
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };

  const queue = await readQueue();
  queue.push(action);
  await writeQueue(queue);

  // Fire-and-forget — don't await so the UI stays snappy
  flushQueue().catch(() => {});
}

/** How many unsynced actions are pending. */
export async function getPendingCount(): Promise<number> {
  const queue = await readQueue();
  return queue.length;
}

let _flushing = false;

/** Process the queue, sending each action to the API. Safe to call concurrently. */
export async function flushQueue(): Promise<void> {
  if (_flushing) return;
  _flushing = true;

  try {
    const netState: NetInfoState = await NetInfo.fetch();
    if (!netState.isConnected) return;

    const token = await AsyncStorage.getItem('auth_token');
    if (!token) return;

    let queue = await readQueue();
    if (!queue.length) return;

    const failed: OfflineAction[] = [];

    for (const action of queue) {
      try {
        await applyAction(action, token);
        // success — drop from queue (don't add to failed)
      } catch (err: any) {
        const updatedAction = { ...action, attempts: action.attempts + 1 };
        if (updatedAction.attempts < MAX_ATTEMPTS) {
          failed.push(updatedAction);
        } else {
          console.error(
            `[OfflineSync] Giving up on action ${action.id} (${action.type}) after ${MAX_ATTEMPTS} attempts`,
            err?.message
          );
        }
      }
    }

    await writeQueue(failed);
  } finally {
    _flushing = false;
  }
}

// ─── Order cache ──────────────────────────────────────────────────────────────
// Cache the full order object so screens can render while offline.

const ORDER_CACHE_PREFIX = 'order_cache:';

export async function cacheOrder(order: Record<string, unknown>): Promise<void> {
  try {
    const key = `${ORDER_CACHE_PREFIX}${order._id}`;
    await AsyncStorage.setItem(key, JSON.stringify(order));
  } catch {
    // non-fatal
  }
}

export async function getCachedOrder(
  orderId: string
): Promise<Record<string, unknown> | null> {
  try {
    const raw = await AsyncStorage.getItem(`${ORDER_CACHE_PREFIX}${orderId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ─── Background listeners (call once at app start) ────────────────────────────

let _listenersAttached = false;

export function attachSyncListeners(): () => void {
  if (_listenersAttached) return () => {};
  _listenersAttached = true;

  // Flush when network comes back
  const unsubscribeNet = NetInfo.addEventListener((state: NetInfoState) => {
    if (state.isConnected) {
      setTimeout(() => flushQueue().catch(() => {}), RETRY_DELAY_MS);
    }
  });

  // Flush when app comes back to foreground (covers hard-close + reopen)
  const appStateSub = AppState.addEventListener(
    'change',
    (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        flushQueue().catch(() => {});
      }
    }
  );

  return () => {
    unsubscribeNet();
    appStateSub.remove();
    _listenersAttached = false;
  };
}
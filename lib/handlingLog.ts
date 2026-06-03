// lib/handlingLog.ts
// Thin client utility used by PickingScreen, PackagingScreen, DeliveryCollectionScreen,
// and DeliveryDetailScreen to post accountability events without touching the order API.

const API_URL = 'https://tfs-wholesalers-ifad.onrender.com';

export type HandlingEventType =
  | 'item_picked_barcode'
  | 'item_picked_manual'
  | 'item_oos'
  | 'package_sealed'
  | 'package_collected'
  | 'delivery_started'
  | 'delivery_completed';

export interface LogEventPayload {
  eventType:   HandlingEventType;
  itemSku?:    string;
  itemName?:   string;
  scanKey?:    string;
  packageQr?:  string;
  packageNum?: number;
  meta?:       Record<string, unknown>;
}

/**
 * Fire-and-forget — never throws, never blocks the UI.
 * Pass the auth token from useAuthStore().
 */
export async function logHandlingEvent(
  orderId: string,
  payload: LogEventPayload,
  token: string | null,
): Promise<void> {
  try {
    await fetch(`${API_URL}/api/orders/${orderId}/handling-log`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    // Non-fatal — accountability log failure should never disrupt the picker/driver flow
    console.warn('[handlingLog] event post failed (non-fatal):', err);
  }
}
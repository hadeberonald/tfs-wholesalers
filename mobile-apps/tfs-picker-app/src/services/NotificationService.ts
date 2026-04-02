// src/services/NotificationService.ts
// NOTIFICATIONS DISABLED - stubbed out, safe to re-enable later

export type NotificationPayload = {
  type: 'new_order' | 'order_update' | 'ready_for_delivery' | 'message';
  orderId?: string;
  orderNumber?: string;
  message?: string;
};

export function setNavigationRef(_ref: any) {}

export async function registerForPushNotifications(): Promise<string | null> {
  return null;
}

export function addNotificationListeners() {
  // Return a no-op cleanup
  return () => {};
}
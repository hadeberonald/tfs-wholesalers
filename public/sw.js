// public/sw.js
// Web Push service worker for TFS Wholesalers web store.
// This file must live at /public/sw.js so it's served at /sw.js (root scope).
//
// Registration happens in lib/webPush.ts (client-side).
// Push messages arrive here from the server via Web Push Protocol.

self.addEventListener('install', (event) => {
  console.log('[SW] Installed');
  self.skipWaiting(); // Activate immediately without waiting for old tabs to close
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activated');
  event.waitUntil(self.clients.claim()); // Take control of all open tabs immediately
});

// ── Push event — fired when server sends a Web Push message ──────────────────
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { title: 'TFS Wholesalers', body: event.data?.text() ?? 'New notification' };
  }

  const title   = data.title   ?? 'TFS Wholesalers';
  const options = {
    body:    data.body    ?? '',
    icon:    '/favicon.ico',
    badge:   '/favicon.ico',
    data:    data.data    ?? {},
    tag:     data.tag     ?? 'tfs-notification',   // collapses duplicate notifications
    renotify: true,
    requireInteraction: data.requireInteraction ?? false,
  };

  console.log('[SW] Push received:', title, options.body);
  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification click — open or focus the relevant page ─────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data      = event.notification.data ?? {};
  const orderId   = data.orderId;
  const status    = data.status;
  const baseUrl   = self.location.origin;

  let targetUrl = baseUrl;

  if (orderId) {
    if (status === 'out_for_delivery' || status === 'collecting') {
      targetUrl = `${baseUrl}/orders/${orderId}/track`;
    } else if (status === 'delivered') {
      targetUrl = `${baseUrl}/orders/${orderId}`;
    } else {
      targetUrl = `${baseUrl}/orders/${orderId}`;
    }
  } else if (data.type === 'new_order') {
    // For admin/picker web users
    targetUrl = `${baseUrl}/admin/orders`;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // If there's already a tab open on this origin, focus it and navigate
      for (const client of clients) {
        if (client.url.startsWith(baseUrl) && 'focus' in client) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      // No tab open — open a new one
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
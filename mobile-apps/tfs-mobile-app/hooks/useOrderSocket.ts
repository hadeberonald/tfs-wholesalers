// hooks/useOrderSocket.ts  (tfs-mobile-app)
// Used by all 4 order tracking screens to replace polling.
//
// Usage:
//   useOrderSocket(orderId, (order) => {
//     if (navigate(order.orderStatus)) return;
//     setOrder(order);
//     setLoading(false);
//   });

import { useEffect, useRef } from 'react';
import { connectSocket, joinOrderRoom } from '@/lib/socket';  // ← correct path
import api from '@/lib/api';

interface OrderPayload {
  order: any;
  status: string;
}

export function useOrderSocket(orderId: string, onUpdate: (order: any) => void) {
  // Ref pattern so we never need to re-register the socket listener
  // when the callback changes (e.g. when navigate() closes over new state)
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!orderId) return;

    // 1. Initial HTTP fetch — screen is populated immediately without waiting
    //    for a socket event
    api.get(`/api/orders/${orderId}`)
      .then(res => onUpdateRef.current(res.data.order))
      .catch(() => {});

    // 2. Connect + join the order's room
    const socket = connectSocket();
    joinOrderRoom(orderId);

    // 3. Live updates — fires every time the picker/driver changes the status
    const handleUpdate = (payload: OrderPayload) => {
      console.log(`[Socket] order:updated → ${payload.status}`);
      onUpdateRef.current(payload.order);
    };
    socket.on('order:updated', handleUpdate);

    // 4. Reconnect recovery — re-join room + re-fetch to catch anything missed
    //    while the phone was offline
    const handleReconnect = () => {
      console.log('[Socket] Reconnected — rejoining order room');
      joinOrderRoom(orderId);
      api.get(`/api/orders/${orderId}`)
        .then(res => onUpdateRef.current(res.data.order))
        .catch(() => {});
    };
    socket.on('connect', handleReconnect);

    return () => {
      socket.off('order:updated', handleUpdate);
      socket.off('connect', handleReconnect);
      // Note: we intentionally do NOT disconnect the socket here.
      // The singleton stays connected across screen navigations so we
      // receive the event that triggers the navigation to the next screen.
    };
  }, [orderId]);
}
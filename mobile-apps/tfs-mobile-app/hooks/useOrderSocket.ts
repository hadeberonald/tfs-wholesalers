// hooks/useOrderSocket.ts  (tfs-mobile-app)
// Now handles both order:updated (status changes) and item:scanned (per-item
// picking progress) so the customer tracking screen updates in real time.

import { useEffect, useRef } from 'react';
import { connectSocket, joinOrderRoom } from '@/lib/socket';
import api from '@/lib/api';

interface OrderPayload {
  order: any;
  status: string;
}

interface ItemScannedPayload {
  orderId:   string;
  scanKey:   string;
  sku:       string;
  productId: string;
  name:      string;
  itemIndex: number;
  order:     any;   // full updated order
  status:    string;
}

export function useOrderSocket(
  orderId: string,
  onUpdate: (order: any) => void,
  onItemScanned?: (payload: ItemScannedPayload) => void,
) {
  const onUpdateRef     = useRef(onUpdate);
  const onItemScanRef   = useRef(onItemScanned);
  onUpdateRef.current   = onUpdate;
  onItemScanRef.current = onItemScanned;

  useEffect(() => {
    if (!orderId) return;

    // 1. Initial HTTP fetch
    api.get(`/api/orders/${orderId}`)
      .then(res => onUpdateRef.current(res.data.order))
      .catch(() => {});

    // 2. Connect + join room
    const socket = connectSocket();
    joinOrderRoom(orderId);

    // 3. order:updated — status transitions
    const handleUpdate = (payload: OrderPayload) => {
      console.log(`[Socket] order:updated → ${payload.status}`);
      onUpdateRef.current(payload.order);
    };

    // 4. item:scanned — a picker just scanned/confirmed one item
    const handleItemScanned = (payload: ItemScannedPayload) => {
      console.log(`[Socket] item:scanned → ${payload.name} (index ${payload.itemIndex})`);
      if (onItemScanRef.current) {
        onItemScanRef.current(payload);
      } else {
        // If no specific handler, fall back to a full order update
        // so the screen at least stays fresh
        onUpdateRef.current(payload.order);
      }
    };

    socket.on('order:updated',  handleUpdate);
    socket.on('item:scanned',   handleItemScanned);

    // 5. Reconnect recovery
    const handleReconnect = () => {
      console.log('[Socket] Reconnected — rejoining order room');
      joinOrderRoom(orderId);
      api.get(`/api/orders/${orderId}`)
        .then(res => onUpdateRef.current(res.data.order))
        .catch(() => {});
    };
    socket.on('connect', handleReconnect);

    return () => {
      socket.off('order:updated',  handleUpdate);
      socket.off('item:scanned',   handleItemScanned);
      socket.off('connect',        handleReconnect);
    };
  }, [orderId]);
}
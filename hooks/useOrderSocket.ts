// hooks/useOrderSocket.ts  (tfs-mobile-app)

import { useEffect, useRef } from 'react';
import { connectSocket, joinOrderRoom } from '@/lib/socket';
import api from '@/lib/api';

interface ItemScannedPayload {
  orderId:   string;
  scanKey:   string;
  sku:       string;
  productId: string;
  name:      string;
  itemIndex: number;
  order:     any;
  status:    string;
}

export function useOrderSocket(
  orderId: string,
  onUpdate: (order: any) => void,
  onItemScanned?: (payload: ItemScannedPayload) => void,
) {
  const onUpdateRef   = useRef(onUpdate);
  const onItemScanRef = useRef(onItemScanned);
  onUpdateRef.current   = onUpdate;
  onItemScanRef.current = onItemScanned;

  useEffect(() => {
    if (!orderId) return;

    const fetchCurrentState = () => {
      api.get(`/api/orders/${orderId}`)
        .then(res => onUpdateRef.current(res.data.order))
        .catch(() => {});
    };

    // 1. Fetch immediately so screen has data right away
    fetchCurrentState();

    let socket: any = null;

    // 2. Connect socket (now async — reads token from AsyncStorage)
    connectSocket().then((s) => {
      socket = s;

      const handleOrderUpdate = (payload: any) => {
        console.log(`[Socket] order:updated → ${payload.status}`);
        onUpdateRef.current(payload.order);
      };

      const handleItemScanned = (payload: ItemScannedPayload) => {
        console.log(`[Socket] item:scanned → ${payload.name}`);
        if (onItemScanRef.current) {
          onItemScanRef.current(payload);
        } else {
          onUpdateRef.current(payload.order);
        }
      };

      // 3. On (re)connect: rejoin room AND re-fetch to catch any missed events
      const handleConnect = () => {
        console.log('[Socket] Connected — joining order room and syncing state');
        joinOrderRoom(orderId);
        fetchCurrentState();
      };

      socket.on('order:updated', handleOrderUpdate);
      socket.on('item:scanned',  handleItemScanned);
      socket.on('connect',       handleConnect);

      // 4. If already connected when this hook mounts, join immediately
      if (socket.connected) {
        joinOrderRoom(orderId);
      }
    });

    return () => {
      if (socket) {
        socket.off('order:updated');
        socket.off('item:scanned');
        socket.off('connect');
      }
    };
  }, [orderId]);
}

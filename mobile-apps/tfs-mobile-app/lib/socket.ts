// lib/socket.ts  (tfs-mobile-app)

import { io, Socket } from 'socket.io-client';

const API_URL = 'https://tfs-wholesalers.onrender.com';

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(): Socket {
  if (socket?.connected) return socket;

  socket = io(API_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on('connect', () => {
    console.log('[Socket] Customer connected:', socket?.id);
  });
  socket.on('disconnect', (reason) => {
    console.log('[Socket] Customer disconnected:', reason);
  });
  socket.on('connect_error', (err) => {
    console.warn('[Socket] Customer connect error:', err.message);
  });

  return socket;
}

export function joinOrderRoom(orderId: string) {
  const s = connectSocket();
  s.emit('join:order', { orderId });
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
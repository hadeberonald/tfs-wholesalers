// lib/socket.ts  (tfs-mobile-app)
// Singleton Socket.IO client. Uses the same base URL as lib/api.ts.

import { io, Socket } from 'socket.io-client';

// Mirror exactly how api.ts defines this
const API_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://tfs-wholesalers.onrender.com'
    : 'http://192.168.0.100:3000';

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
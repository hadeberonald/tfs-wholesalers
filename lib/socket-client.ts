// lib/socket-client.ts
// Browser-side Socket.IO client for the web app (customer order tracking).
// Import this ONLY from hooks/components — never from API routes.
// API routes use lib/socket.ts (getIO/setIO) instead.

import { io, Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(): Socket {
  if (socket?.connected) return socket;

  // Auth token is in an httpOnly cookie — the browser sends it automatically
  // with every request, so we don't need to pass it explicitly here.
  // Socket.IO will include cookies on the handshake request.
  socket = io(API_URL, {
    transports: ['websocket', 'polling'],
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on('connect', () => {
    console.log('[Socket] Web client connected:', socket?.id);
  });
  socket.on('disconnect', (reason) => {
    console.log('[Socket] Web client disconnected:', reason);
  });
  socket.on('connect_error', (err) => {
    console.warn('[Socket] Web client connect error:', err.message);
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

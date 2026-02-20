// src/services/socketService.ts  (tfs-picker-app)
// Singleton Socket.IO client. Uses the same base URL as the axios instance.

import { io, Socket } from 'socket.io-client';

// Same URL used in your existing axios calls
const API_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://tfs-wholesalers.onrender.com'
    : 'http://192.168.0.100:3000';

let socket: Socket | null = null;
let currentBranchId: string | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function connectPickerSocket(branchId: string): Socket {
  // Already connected to this branch — reuse
  if (socket?.connected && currentBranchId === branchId) return socket;

  // Switching branches — drop the old connection first
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  currentBranchId = branchId;

  socket = io(API_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  // Re-join branch room on every (re)connect automatically
  socket.on('connect', () => {
    console.log('[Socket] Picker connected:', socket?.id);
    socket?.emit('join:branch', { branchId });
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Picker disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.warn('[Socket] Picker connect error:', err.message);
  });

  return socket;
}

export function disconnectPickerSocket() {
  socket?.disconnect();
  socket = null;
  currentBranchId = null;
}
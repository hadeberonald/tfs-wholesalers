// lib/socket.ts  (tfs-mobile-app)
//
// ⚠️  IMPORTANT: This URL must match api.ts exactly.
// api.ts uses: https://tfs-wholesalers-ifad.onrender.com

import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://tfs-wholesalers-ifad.onrender.com';

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export async function connectSocket(): Promise<Socket> {
  if (socket?.connected) return socket;

  const token = await AsyncStorage.getItem('auth_token');

  socket = io(API_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    auth: token ? { token } : undefined,
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

export async function joinOrderRoom(orderId: string) {
  const s = await connectSocket();
  s.emit('join:order', { orderId });
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

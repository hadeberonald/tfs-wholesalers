// lib/socket.ts
// Thin singleton wrapper so any API route can call getIO() to emit events.
// The actual `io` instance is set by server.ts at startup.

import type { Server as SocketIOServer } from 'socket.io';

// Use globalThis so the reference survives Next.js hot-reload in dev
const g = globalThis as any;

export function setIO(instance: SocketIOServer) {
  g.__socketIO = instance;
}

export function getIO(): SocketIOServer | null {
  return g.__socketIO ?? null;
}
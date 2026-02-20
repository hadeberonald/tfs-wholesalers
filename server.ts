// server.ts  (project root)
// Custom Node.js server that wraps Next.js and attaches Socket.IO.
// Run: npx ts-node server.ts
// package.json: "start": "ts-node server.ts", "dev": "ts-node server.ts"
//
// Also also emit new-order events from the POST /api/orders route by
// calling getIO() from lib/socket.ts.

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { setIO } from './lib/socket';   // ← makes io available to API routes

const dev  = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3000', 10);

const app    = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  // ── Create Socket.IO server ─────────────────────────────────────────────────
  const io = new SocketIOServer(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling'],
  });

  // Register globally so API routes can call getIO()
  setIO(io);

  // ── Rooms & events ──────────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    // Picker/driver app joins its branch room
    socket.on('join:branch', ({ branchId }: { branchId: string }) => {
      const room = `branch:${branchId}`;
      socket.join(room);
      console.log(`[Socket] ${socket.id} → ${room}`);
    });

    // Customer app joins the room for a specific order
    socket.on('join:order', ({ orderId }: { orderId: string }) => {
      const room = `order:${orderId}`;
      socket.join(room);
      console.log(`[Socket] ${socket.id} → ${room}`);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Disconnected: ${socket.id}`);
    });
  });

  httpServer.listen(port, () => {
    console.log(`\n> Ready on http://localhost:${port} (${dev ? 'dev' : 'prod'})`);
    console.log('> Socket.IO listening\n');
  });
});
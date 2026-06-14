// server.ts  (project root)
// Custom Node.js server that wraps Next.js and attaches Socket.IO.

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { setIO } from './lib/socket';
import { verifyEmailTransport } from './lib/sendPushNotification';
import jwt from 'jsonwebtoken';

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

  // ── Auth middleware ─────────────────────────────────────────────────────────
  // Two tiers:
  //   - Staff (mobile apps)  → must pass { auth: { token } }, get full access
  //   - Customers (web app)  → no token required, can only join order rooms
  //     (they only know their own order ID, so room access is self-limiting)
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;

    if (!token) {
      // Allow connection but mark as guest — join:branch will be blocked below
      (socket as any).user = { role: 'guest' };
      return next();
    }

    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) return next(new Error('Server misconfiguration'));

    try {
      const decoded = jwt.verify(token, secret) as any;
      (socket as any).user = decoded;
      next();
    } catch {
      next(new Error('Unauthorized: invalid or expired token'));
    }
  });

  setIO(io);

  // ── Verify SMTP on startup ──────────────────────────────────────────────────
  verifyEmailTransport();

  // ── Rooms & events ──────────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    const user = (socket as any).user;
    console.log(`[Socket] Connected: ${socket.id} (${user?.role ?? 'unknown'})`);

    socket.on('join:branch', ({ branchId }: { branchId: string }) => {
      // Branch rooms are staff-only — guests and customers are blocked
      if (!['admin', 'picker', 'delivery', 'super-admin'].includes(user?.role)) {
        socket.emit('error', 'Forbidden');
        return;
      }
      const room = `branch:${branchId}`;
      socket.join(room);
      console.log(`[Socket] ${socket.id} → ${room}`);
    });

    socket.on('join:order', ({ orderId }: { orderId: string }) => {
      // Any connected client (including guests) can track a specific order.
      // Security: they can only receive events for rooms they know the ID of,
      // and order IDs are MongoDB ObjectIds — not guessable.
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

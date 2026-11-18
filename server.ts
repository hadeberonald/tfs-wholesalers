// ═══════════════════════════════════════════════════════════════════════════
// DESTINATION: server.ts        (REPLACES the existing file, project root)
// Changes: (1) `request as httpRequest` added to the http import,
//          (2) payment reconciler timer added inside httpServer.listen().
// ═══════════════════════════════════════════════════════════════════════════

import { createServer, request as httpRequest } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { setIO } from './lib/socket';
import { verifyEmailTransport } from './lib/sendPushNotification';

const whatsappWebhookRouter = require('./whatsapp-bot/src/routes/webhook');
const whatsappAnalyticsRouter = require('./whatsapp-bot/src/routes/analytics');
const express = require('express');
const { connectDB } = require('./whatsapp-bot/src/config/db');

// Ladysmith (branch2) — separate router, separate Mongo connection (see
// whatsapp-bot-branch2/src/config/db.js for why this can't share Dundee's
// mongoose.connect() call), mounted at different paths on the same domain
// so Meta's webhook config just needs a different path, not a new service.
const ladysmithWebhookRouter = require('./whatsapp-bot-branch2/src/routes/webhook');
const ladysmithAnalyticsRouter = require('./whatsapp-bot-branch2/src/routes/analytics');
const { connectDB: connectLadysmithDB } = require('./whatsapp-bot-branch2/src/config/db');

const whatsappApp = express();
whatsappApp.use(express.json());
whatsappApp.use('/whatsapp-webhook', whatsappWebhookRouter);
whatsappApp.use('/analytics', whatsappAnalyticsRouter);
whatsappApp.use('/whatsapp-webhook-ladysmith', ladysmithWebhookRouter);
whatsappApp.use('/analytics-ladysmith', ladysmithAnalyticsRouter);

const dev  = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3000', 10);

const app    = next({ dev });
const handle = app.getRequestHandler();

Promise.all([app.prepare(), connectDB(), connectLadysmithDB()])
  .then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);

    if (
      parsedUrl.pathname?.startsWith('/whatsapp-webhook') ||
      parsedUrl.pathname?.startsWith('/analytics')
    ) {
      return whatsappApp(req, res);
    }

    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling'],
  });

  setIO(io);

  verifyEmailTransport();

  io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    socket.on('join:branch', ({ branchId }: { branchId: string }) => {
      const room = `branch:${branchId}`;
      socket.join(room);
      console.log(`[Socket] ${socket.id} -> ${room}`);
    });

    socket.on('join:order', ({ orderId }: { orderId: string }) => {
      const room = `order:${orderId}`;
      socket.join(room);
      console.log(`[Socket] ${socket.id} -> ${room}`);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Disconnected: ${socket.id}`);
    });
  });

  httpServer.listen(port, () => {
    console.log(`Ready on http://localhost:${port} (${dev ? 'dev' : 'prod'})`);
    console.log('Socket.IO listening');
    console.log(`Dundee webhook mounted at /whatsapp-webhook`);
    console.log(`Dundee analytics mounted at /analytics`);
    console.log(`Ladysmith webhook mounted at /whatsapp-webhook-ladysmith`);
    console.log(`Ladysmith analytics mounted at /analytics-ladysmith`);

    // ── Payment safety net ───────────────────────────────────────────────────
    // Every 3 minutes ask Paystack about any order that is still unpaid and mark
    // it paid if the money actually arrived (also re-sends any paid-order
    // notifications that never went out). Calls the Next route over localhost so
    // it runs inside the normal Next build. Needs CRON_SECRET in the env.
    const triggerReconcile = () => {
      const secret = process.env.CRON_SECRET;
      if (!secret) return;
      const req = httpRequest(
        {
          host: '127.0.0.1',
          port,
          path: '/api/cron/reconcile-payments',
          method: 'POST',
          headers: { Authorization: `Bearer ${secret}` },
        },
        (res) => { res.resume(); }
      );
      req.on('error', (e) => console.error('[Reconcile] trigger failed:', e.message));
      req.end();
    };
    setTimeout(triggerReconcile, 60_000);
    setInterval(triggerReconcile, 3 * 60 * 1000);
    console.log('Payment reconciler scheduled (every 3 min)');
  });
})
.catch((err) => {
  // Without this, a failed connectDB()/connectLadysmithDB() (e.g. a
  // missing or unreachable Mongo URI) rejects silently and the server
  // just hangs with no open port until Render's deploy times out —
  // with no clue in the logs as to why. This makes the real cause show up.
  console.error('Fatal error during server startup:', err);
  process.exit(1);
});
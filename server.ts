import { createServer } from 'http';
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

Promise.all([app.prepare(), connectDB(), connectLadysmithDB()]).then(() => {
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
  });
});
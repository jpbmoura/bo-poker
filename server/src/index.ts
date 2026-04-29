import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { registerSocketHandlers } from './socket/handlers.js';
import { RoomManager } from './rooms/RoomManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', rooms: RoomManager.size() });
});

const clientDist = resolve(__dirname, '..', '..', 'client', 'dist');
const clientIndex = join(clientDist, 'index.html');
if (existsSync(clientIndex)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/socket.io') || req.path === '/health') return next();
    res.sendFile(clientIndex);
  });
  console.log(`[bo-poker] serving client from ${clientDist}`);
}

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: config.corsOrigin,
    credentials: true,
  },
});

registerSocketHandlers(io);

setInterval(() => {
  const removed = RoomManager.cleanup();
  if (removed > 0) {
    console.log(`[cleanup] removed ${removed} stale room(s)`);
  }
}, config.cleanupIntervalMs);

httpServer.listen(config.port, () => {
  console.log(`[bo-poker] server listening on port ${config.port}`);
});

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { config } from './config.js';
import { registerSocketHandlers } from './socket/handlers.js';
import { RoomManager } from './rooms/RoomManager.js';

const app = express();
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', rooms: RoomManager.size() });
});

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
  console.log(`[bo-poker] server listening on http://localhost:${config.port}`);
});

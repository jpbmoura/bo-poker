import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { toNodeHandler } from 'better-auth/node';
import { config } from './config.js';
import { auth, pool } from './auth.js';
import { registerSocketHandlers, broadcastRoomState } from './socket/handlers.js';
import { createRoomsRouter } from './routes/rooms.js';
import { createCaptureRouter } from './routes/capture.js';
import { createGuessRouter } from './routes/guess.js';
import { createTrainerRouter } from './routes/trainer.js';
import { RoomManager } from './rooms/RoomManager.js';
import { TrainerCache } from './trainers/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors({ origin: config.corsOrigin, credentials: true }));

// ORDEM CRÍTICA: o handler do Better Auth precisa vir ANTES de express.json().
// Body parsers consomem o stream da request antes do handler e quebram o login
// sem erro claro. Também precisa vir antes do fallback de SPA mais abaixo.
app.all('/api/auth/*', toNodeHandler(auth));

app.use(express.json());

// O `io` precisa existir ANTES das rotas porque o router de salas usa ele para
// avisar quem esta na mesa que a sala foi excluida. Por isso o httpServer sobe
// aqui em cima, e nao no fim do arquivo.
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: config.corsOrigin,
    credentials: true,
  },
  // Defaults (25s/20s) levam ate ~45s para detectar um socket morto, o que
  // deixaria o fantasma na mesa por muito mais tempo que o periodo de graca.
  // Valores agressivos geram mais desconexoes falsas em rede ruim -- e isso e
  // inofensivo porque o rejoin virou idempotente (upsert religa o assento).
  pingInterval: 10_000,
  pingTimeout: 10_000,
});

// ORDEM CRITICA: tem que vir ANTES do fallback de SPA la embaixo. Como aquele
// fallback e um `app.get('*')`, esquecer isto quebraria SO o GET /api/rooms
// (que voltaria index.html) enquanto POST/PATCH/DELETE seguiriam funcionando --
// uma falha bem dificil de diagnosticar.
app.use('/api/rooms', createRoomsRouter(io));
app.use('/api/trainer', createTrainerRouter(io));
app.use('/api/capture', createCaptureRouter(io));
app.use('/api/guess', createGuessRouter(io));

/**
 * Liveness puro: responde 200 enquanto o processo estiver vivo.
 *
 * NÃO pode falhar por causa do Postgres. O railway.json aponta o healthcheck
 * para cá com restartPolicyType ON_FAILURE, e o estado das salas vive em
 * memória — uma oscilação do banco reiniciaria o app e destruiria todas as
 * rodadas em andamento, por uma dependência que só importa no login. O status
 * do banco vai como campo informativo.
 */
let dbHealthy: boolean | null = null;
const probeDb = () => {
  pool
    .query('SELECT 1')
    .then(() => {
      dbHealthy = true;
    })
    .catch(() => {
      dbHealthy = false;
    });
};
probeDb();
setInterval(probeDb, 30_000).unref();

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    rooms: RoomManager.size(),
    db: dbHealthy === null ? 'unknown' : dbHealthy ? 'up' : 'down',
  });
});

const clientDist = resolve(__dirname, '..', '..', 'client', 'dist');
const clientIndex = join(clientDist, 'index.html');
if (existsSync(clientIndex)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (
      req.path.startsWith('/socket.io') ||
      req.path.startsWith('/api/') ||
      req.path === '/health'
    ) {
      return next();
    }
    res.sendFile(clientIndex);
  });
  console.log(`[bo-poker] serving client from ${clientDist}`);
}

registerSocketHandlers(io);

// Varredura unica: aplica o periodo de graca aos offline, coleta salas vazias
// e as vencidas pelo TTL. A politica em si vive em Room/RoomManager (puras,
// com relogio injetado); aqui fica so o agendamento, para os testes nunca
// iniciarem um timer.
setInterval(() => {
  const { changed, removedRooms } = RoomManager.sweep(
    Date.now(),
    config.playerGraceMs,
    config.roomTtlMs,
  );
  for (const room of changed) broadcastRoomState(io, room);
  if (removedRooms > 0) {
    console.log(`[sweep] removed ${removedRooms} stale room(s)`);
  }

  // Persistencia do XP: o reveal so mexe na memoria (para o broadcast sair
  // rapido) e deixa o delta pendente aqui. Falha de escrita mantem o pendente e
  // tenta de novo no proximo ciclo.
  void TrainerCache.flush().catch((err) => {
    console.error('[sweep] flush de XP falhou:', (err as Error).message);
  });

  // Auto-cura das leituras degradadas: sem isto, quem conectou com o banco fora
  // ficaria de Pokebola ate a proxima reconexao.
  void TrainerCache.reconcile()
    .then((healed) => {
      for (const userId of healed) {
        const state = TrainerCache.peek(userId);
        const active = state ? TrainerCache.activePokemon(state) : null;
        for (const room of RoomManager.roomsWithIdentity(`user:${userId}`)) {
          room.refreshTrainer(`user:${userId}`, active);
          broadcastRoomState(io, room);
        }
      }
    })
    .catch(() => undefined);
}, config.sweepIntervalMs);

httpServer.listen(config.port, () => {
  console.log(`[bo-poker] server listening on port ${config.port}`);
});

import { Router, type NextFunction, type Request, type Response } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import type { Server } from 'socket.io';
import { auth } from '../auth.js';
import { config } from '../config.js';
import { Events } from '../socket/events.js';
import { RoomManager } from '../rooms/RoomManager.js';
import * as roomStore from '../rooms/roomStore.js';
import { broadcastRoomState } from '../socket/handlers.js';
import {
  normalizeRoomId,
  normalizeRoomName,
  type RoomClosedPayload,
} from '../types/index.js';

/**
 * O que a home consome. NÃO vive no `wire.ts`: aquele arquivo é o contrato do
 * socket e precisa continuar byte-idêntico entre os pacotes. Este DTO é HTTP e
 * o espelho dele está em `client/src/services/rooms.ts`.
 */
interface RoomSummary {
  id: string;
  name: string;
  isOwner: boolean;
  isFavorite: boolean;
  onlineCount: number;
  createdAt: string;
}

interface AuthedRequest extends Request {
  userId?: string;
  userName?: string;
}

/**
 * Quantos estão online AGORA — vem da memória, não do banco. Sala que não foi
 * materializada (ninguém entrou desde o último restart) simplesmente tem zero.
 */
function onlineCount(roomId: string): number {
  const room = RoomManager.get(roomId);
  if (!room) return 0;
  return room.allPlayers().filter((p) => p.online).length;
}

function toSummary(
  row: { id: string; name: string; ownerId: string; createdAt: Date },
  userId: string,
  isFavorite: boolean,
): RoomSummary {
  return {
    id: row.id,
    name: row.name,
    isOwner: row.ownerId === userId,
    isFavorite,
    onlineCount: onlineCount(row.id),
    createdAt: row.createdAt.toISOString(),
  };
}

function defaultRoomName(userName: string): string {
  const first = (userName ?? '').trim().split(/\s+/)[0];
  return normalizeRoomName(first ? `Sala do ${first}` : 'Nova sala');
}

/**
 * Distingue "não achei" de "o banco piscou". Sem isso, uma oscilação do
 * Postgres apareceria para o usuário como "essa sala não existe" — e ele
 * apagaria o link achando que a sala tinha sumido.
 */
function dbError(res: Response, err: unknown, context: string): void {
  console.error(`[rooms] ${context}:`, (err as Error).message);
  res.status(503).json({ error: 'DB_UNAVAILABLE' });
}

/**
 * Mesma expressão dos `trustedOrigins` em auth.ts. Precisa incluir a
 * `betterAuthUrl`: o scripts/smoke.mjs manda `Origin: http://localhost:3001`, e
 * sem ela toda chamada REST dele tomaria 403 por um motivo que não se parece em
 * nada com a causa.
 */
const trustedOrigins = new Set([config.betterAuthUrl, ...config.corsOrigin]);

/**
 * As mutações são autenticadas por COOKIE, então valem uma checagem de origem.
 * O `cors()` já barra PATCH/DELETE e POST com JSON (todos passam por preflight),
 * mas um POST `form-urlencoded` de outro site não é pré-verificado — este
 * middleware fecha essa fresta.
 */
function requireTrustedOrigin(req: Request, res: Response, next: NextFunction): void {
  const origin = req.get('origin');
  if (!origin || !trustedOrigins.has(origin)) {
    res.status(403).json({ error: 'FORBIDDEN_ORIGIN' });
    return;
  }
  next();
}

export function createRoomsRouter(io: Server): Router {
  const router = Router();

  const requireUser = async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });
      if (!session?.user) {
        res.status(401).json({ error: 'UNAUTHENTICATED' });
        return;
      }
      req.userId = session.user.id;
      req.userName = session.user.name;
      next();
    } catch (err) {
      dbError(res, err, 'falha ao resolver sessão');
    }
  };

  router.use(requireUser as never);

  /** Id da rota, já canonicalizado. Responde 400 e devolve null se for inválido. */
  const routeRoomId = (req: Request, res: Response): string | null => {
    const id = normalizeRoomId(req.params.id ?? '');
    if (!id) {
      res.status(400).json({ error: 'INVALID_ROOM' });
      return null;
    }
    return id;
  };

  // Salas que eu criei ou favoritei.
  router.get('/', async (req: AuthedRequest, res) => {
    const userId = req.userId!;
    try {
      const rows = await roomStore.listForUser(userId);
      res.json(rows.map((r) => toSummary(r, userId, r.isFavorite)));
    } catch (err) {
      dbError(res, err, 'falha ao listar salas');
    }
  });

  router.post('/', requireTrustedOrigin, async (req: AuthedRequest, res) => {
    const userId = req.userId!;
    const raw = typeof req.body?.name === 'string' ? req.body.name : '';
    const name = normalizeRoomName(raw) || defaultRoomName(req.userName ?? '');
    try {
      const room = await roomStore.create(name, userId);
      res.status(201).json(toSummary(room, userId, false));
    } catch (err) {
      dbError(res, err, 'falha ao criar sala');
    }
  });

  router.get('/:id', async (req: AuthedRequest, res) => {
    const userId = req.userId!;
    const id = routeRoomId(req, res);
    if (!id) return;
    try {
      const room = await roomStore.findByIdForUser(id, userId);
      if (!room) {
        res.status(404).json({ error: 'ROOM_NOT_FOUND' });
        return;
      }
      res.json(toSummary(room, userId, room.isFavorite));
    } catch (err) {
      dbError(res, err, `falha ao buscar sala ${id}`);
    }
  });

  router.patch('/:id', requireTrustedOrigin, async (req: AuthedRequest, res) => {
    const userId = req.userId!;
    const id = routeRoomId(req, res);
    if (!id) return;
    const name = normalizeRoomName(typeof req.body?.name === 'string' ? req.body.name : '');
    if (!name) {
      res.status(400).json({ error: 'INVALID_NAME' });
      return;
    }
    try {
      const current = await roomStore.findByIdForUser(id, userId);
      if (!current) {
        res.status(404).json({ error: 'ROOM_NOT_FOUND' });
        return;
      }
      if (current.ownerId !== userId) {
        res.status(403).json({ error: 'NOT_OWNER' });
        return;
      }
      const updated = await roomStore.rename(id, name);
      if (!updated) {
        res.status(404).json({ error: 'ROOM_NOT_FOUND' });
        return;
      }
      // O nome também vive na instância em memória: sem este espelho, quem já
      // está na mesa só veria o nome novo depois que a sala fosse recriada.
      const live = RoomManager.get(id);
      if (live) {
        live.name = name;
        broadcastRoomState(io, live);
      }
      res.json(toSummary(updated, userId, current.isFavorite));
    } catch (err) {
      dbError(res, err, `falha ao renomear sala ${id}`);
    }
  });

  router.delete('/:id', requireTrustedOrigin, async (req: AuthedRequest, res) => {
    const userId = req.userId!;
    const id = routeRoomId(req, res);
    if (!id) return;
    try {
      const current = await roomStore.findById(id);
      if (!current) {
        res.status(404).json({ error: 'ROOM_NOT_FOUND' });
        return;
      }
      if (current.ownerId !== userId) {
        res.status(403).json({ error: 'NOT_OWNER' });
        return;
      }
      await roomStore.remove(id);

      // A sala deixou de existir: quem está dentro precisa saber AGORA, senão
      // continuaria votando numa mesa que já não pode ser reaberta.
      const live = RoomManager.get(id);
      if (live) {
        const payload: RoomClosedPayload = { roomId: id, reason: 'deleted' };
        io.to(id).emit(Events.ROOM_CLOSED, payload);
        RoomManager.delete(id);
      }
      res.status(204).end();
    } catch (err) {
      dbError(res, err, `falha ao excluir sala ${id}`);
    }
  });

  router.put('/:id/favorite', requireTrustedOrigin, async (req: AuthedRequest, res) => {
    const userId = req.userId!;
    const id = routeRoomId(req, res);
    if (!id) return;
    try {
      const room = await roomStore.findById(id);
      if (!room) {
        res.status(404).json({ error: 'ROOM_NOT_FOUND' });
        return;
      }
      await roomStore.addFavorite(id, userId);
      res.status(204).end();
    } catch (err) {
      dbError(res, err, `falha ao favoritar sala ${id}`);
    }
  });

  router.delete('/:id/favorite', requireTrustedOrigin, async (req: AuthedRequest, res) => {
    const userId = req.userId!;
    const id = routeRoomId(req, res);
    if (!id) return;
    try {
      await roomStore.removeFavorite(id, userId);
      res.status(204).end();
    } catch (err) {
      dbError(res, err, `falha ao desfavoritar sala ${id}`);
    }
  });

  return router;
}

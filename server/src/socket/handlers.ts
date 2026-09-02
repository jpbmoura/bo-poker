import type { Server, Socket } from 'socket.io';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth.js';
import { Events } from './events.js';
import { RoomManager } from '../rooms/RoomManager.js';
import type { Room } from '../rooms/Room.js';
import { getForcedPokemon } from '../utils/forcedPokemon.js';
import { config } from '../config.js';
import {
  normalizePlayerName,
  normalizeRoomId,
  PLAYER_NAME_MAX_LENGTH,
  type CardValue,
  type JoinPayload,
  type Player,
  type PlayerRole,
  type Pokemon,
  type RoomError,
} from '../types/index.js';

interface AuthedUser {
  id: string;
  name: string;
  login: string | null;
}

interface SocketData {
  roomId?: string;
  playerId?: string;
  user?: AuthedUser;
  sessionExpiresAt?: number;
}

function isValidPokemon(p: unknown): p is Pokemon {
  if (!p || typeof p !== 'object') return false;
  const obj = p as Record<string, unknown>;
  return (
    typeof obj.id === 'number' &&
    typeof obj.name === 'string' &&
    typeof obj.sprite === 'string'
  );
}

/**
 * Emite o estado da sala socket a socket, porque cada jogador recebe uma visão
 * diferente (só ele enxerga o próprio voto antes do reveal).
 */
export function broadcastRoomState(io: Server, room: Room): void {
  for (const player of room.allPlayers()) {
    if (player.socketIds.size === 0) continue;
    const state = room.serializeFor(player.id);
    for (const socketId of player.socketIds) {
      io.to(socketId).emit(Events.ROOM_STATE, state);
    }
  }
}

function emitError(socket: Socket, error: RoomError): void {
  socket.emit(Events.ROOM_ERROR, error);
}

/**
 * Autorização: identidade vem SEMPRE da sessão do socket, nunca do payload.
 * Fecha duas coisas: membership obsoleta (jogador removido pela graça ou pela
 * limpeza manual) e sessão expirada — o `io.use()` roda uma única vez, no
 * handshake, então sem esta checagem uma sessão que vence no meio da rodada
 * deixaria o socket privilegiado até a próxima queda de rede.
 */
function requireMember(socket: Socket): { room: Room; player: Player } | null {
  const data = socket.data as SocketData;
  if (!data.sessionExpiresAt || data.sessionExpiresAt <= Date.now()) {
    emitError(socket, { code: 'SESSION_EXPIRED', message: 'Sua sessão expirou.' });
    socket.disconnect(true);
    return null;
  }
  if (!data.roomId || !data.playerId) return null;
  const room = RoomManager.get(data.roomId);
  if (!room) return null;
  const player = room.getPlayer(data.playerId);
  if (!player) return null;
  if (!player.socketIds.has(socket.id)) return null;
  return { room, player };
}

/**
 * Saida DELIBERADA da sala (sair pelo botao ou trocar de sala pela URL): libera
 * o assento na hora. Só queda involuntária passa pelo periodo de graca — quem
 * escolheu sair nao deve ficar como fantasma na mesa.
 */
function detachFromRoom(socket: Socket, now: number): Room | null {
  const data = socket.data as SocketData;
  if (!data.roomId) return null;
  const room = RoomManager.get(data.roomId);
  const playerId = data.playerId;
  data.roomId = undefined;
  data.playerId = undefined;
  if (!room) return null;
  room.unbindSocket(socket.id, now);
  if (playerId) room.removePlayer(playerId);
  socket.leave(room.id);
  if (room.isEmpty()) {
    RoomManager.delete(room.id);
    return null;
  }
  return room;
}

export function registerSocketHandlers(io: Server): void {
  // Handshake autenticado: sem sessão válida o socket nem chega a conectar.
  io.use(async (socket, next) => {
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(socket.request.headers),
      });
      if (!session?.user) {
        next(new Error('UNAUTHENTICATED'));
        return;
      }
      const data = socket.data as SocketData;
      const user = session.user as { id: string; name: string; login?: string | null };
      data.user = { id: user.id, name: user.name, login: user.login ?? null };
      data.sessionExpiresAt = new Date(session.session.expiresAt).getTime();
      next();
    } catch {
      next(new Error('UNAUTHENTICATED'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const data = socket.data as SocketData;

    socket.on(Events.ROOM_JOIN, (payload: JoinPayload) => {
      // Toda a validação acontece ANTES do getOrCreate: um join rejeitado não
      // pode deixar uma sala vazia ocupando memória.
      if (!payload || typeof payload.roomId !== 'string') {
        emitError(socket, { code: 'INVALID_ROOM', message: 'Sala inválida.' });
        return;
      }
      const roomId = normalizeRoomId(payload.roomId);
      if (!roomId) {
        emitError(socket, { code: 'INVALID_ROOM', message: 'Sala inválida.' });
        return;
      }
      const name = normalizePlayerName(payload.name ?? '');
      if (name.length < 1 || name.length > PLAYER_NAME_MAX_LENGTH) {
        emitError(socket, {
          code: 'INVALID_NAME',
          message: `Nome deve ter entre 1 e ${PLAYER_NAME_MAX_LENGTH} caracteres.`,
        });
        return;
      }
      if (!isValidPokemon(payload.pokemon)) {
        emitError(socket, { code: 'INVALID_POKEMON', message: 'Pokémon inválido.' });
        return;
      }
      const role: PlayerRole = payload.role === 'spectator' ? 'spectator' : 'voter';
      const user = data.user;
      if (!user) {
        emitError(socket, { code: 'NOT_IN_ROOM', message: 'Sessão inválida.' });
        return;
      }
      const now = Date.now();

      // Trocar de sala pela URL não desmonta a página no cliente: sem isto o
      // jogador ficaria online para sempre na sala anterior, que nunca seria
      // coletada.
      const previous = data.roomId !== roomId ? detachFromRoom(socket, now) : null;

      const room = RoomManager.getOrCreate(roomId);
      if (!room) {
        emitError(socket, { code: 'INVALID_ROOM', message: 'Sala inválida.' });
        if (previous) broadcastRoomState(io, previous);
        return;
      }

      // Override de pokémon para nomes forçados, independente do que o cliente enviou.
      const finalPokemon = getForcedPokemon(name) ?? payload.pokemon;

      const result = room.upsertPlayer({
        // Identidade autenticada: dois "Ana" são duas pessoas, e a mesma pessoa
        // reencontra o assento em qualquer aba ou máquina.
        identityKey: `user:${user.id}`,
        socketId: socket.id,
        name,
        login: user.login,
        pokemon: finalPokemon,
        role,
        now,
      });

      data.roomId = room.id;
      data.playerId = result.player.id;
      socket.join(room.id);

      socket.emit(Events.ROOM_JOINED, {
        playerId: result.player.id,
        role: result.player.role,
      });
      broadcastRoomState(io, room);
      if (previous && previous.id !== room.id) broadcastRoomState(io, previous);
    });

    socket.on(Events.ROOM_LEAVE, () => {
      if (!requireMember(socket)) return;
      const room = detachFromRoom(socket, Date.now());
      if (room) broadcastRoomState(io, room);
    });

    socket.on(Events.VOTE_CAST, (payload: { value: CardValue }) => {
      const member = requireMember(socket);
      if (!member) {
        emitError(socket, { code: 'NOT_IN_ROOM', message: 'Você não está mais na sala.' });
        return;
      }
      const { room, player } = member;
      if (!payload || typeof payload.value !== 'string') return;
      const ok = room.setVote(player.id, payload.value);
      if (ok) {
        broadcastRoomState(io, room);
      } else {
        // Voto recusado (rodada já revelada, espectador, valor inválido):
        // devolve a verdade para quem clicou em vez de deixar a UI mentindo.
        socket.emit(Events.ROOM_STATE, room.serializeFor(player.id));
      }
    });

    socket.on(Events.VOTE_REVEAL, () => {
      const member = requireMember(socket);
      if (!member) {
        emitError(socket, { code: 'NOT_IN_ROOM', message: 'Você não está mais na sala.' });
        return;
      }
      if (member.room.reveal()) broadcastRoomState(io, member.room);
    });

    socket.on(Events.VOTE_RESET, () => {
      const member = requireMember(socket);
      if (!member) {
        emitError(socket, { code: 'NOT_IN_ROOM', message: 'Você não está mais na sala.' });
        return;
      }
      member.room.reset();
      broadcastRoomState(io, member.room);
    });

    socket.on(Events.ROOM_CLEAR_INACTIVE, () => {
      const member = requireMember(socket);
      if (!member) return;
      const removed = member.room.removeInactive(
        Date.now(),
        config.clearInactiveMinOfflineMs,
      );
      if (removed.length > 0) broadcastRoomState(io, member.room);
    });

    socket.on(Events.PLAYER_SET_ROLE, (payload: { role: PlayerRole }) => {
      const member = requireMember(socket);
      if (!member) return;
      if (!payload || (payload.role !== 'voter' && payload.role !== 'spectator')) return;
      const ok = member.room.setRole(member.player.id, payload.role);
      if (ok) broadcastRoomState(io, member.room);
    });

    socket.on('disconnect', () => {
      if (!data.roomId) return;
      const room = RoomManager.get(data.roomId);
      data.roomId = undefined;
      data.playerId = undefined;
      if (!room) return;
      const result = room.unbindSocket(socket.id, Date.now());
      // Só rebroadcasta se o jogador realmente ficou offline; fechar uma aba
      // duplicada não muda nada para os outros.
      if (result?.wentOffline) broadcastRoomState(io, room);
    });
  });
}

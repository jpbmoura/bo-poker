import type { Server, Socket } from 'socket.io';
import { Events } from './events.js';
import { RoomManager } from '../rooms/RoomManager.js';
import { getForcedPokemon } from '../utils/forcedPokemon.js';
import type { CardValue, PlayerRole, Pokemon, RoomError } from '../types/index.js';

interface JoinPayload {
  roomId: string;
  name: string;
  pokemon: Pokemon;
  role: PlayerRole;
}

interface SocketData {
  roomId?: string;
  playerId?: string;
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

function broadcastRoomState(io: Server, roomId: string): void {
  const room = RoomManager.get(roomId);
  if (!room) return;
  io.to(roomId).emit(Events.ROOM_STATE, room.serialize());
}

function emitError(socket: Socket, error: RoomError): void {
  socket.emit(Events.ROOM_ERROR, error);
}

export function registerSocketHandlers(io: Server): void {
  io.on('connection', (socket: Socket) => {
    const data = socket.data as SocketData;

    socket.on(Events.ROOM_JOIN, (payload: JoinPayload) => {
      if (!payload || typeof payload.roomId !== 'string' || payload.roomId.length === 0) {
        emitError(socket, { code: 'INVALID_NAME', message: 'Sala inválida.' });
        return;
      }
      const name = (payload.name ?? '').trim();
      if (name.length < 1 || name.length > 20) {
        emitError(socket, { code: 'INVALID_NAME', message: 'Nome deve ter entre 1 e 20 caracteres.' });
        return;
      }
      if (!isValidPokemon(payload.pokemon)) {
        emitError(socket, { code: 'INVALID_POKEMON', message: 'Pokémon inválido.' });
        return;
      }
      const role: PlayerRole = payload.role === 'spectator' ? 'spectator' : 'voter';

      const room = RoomManager.getOrCreate(payload.roomId);

      if (room.hasOnlinePlayerWithName(name)) {
        emitError(socket, { code: 'NAME_TAKEN', message: 'Já existe um jogador online com esse nome.' });
        return;
      }

      // Override pokemon for forced names regardless of what client sent.
      const finalPokemon = getForcedPokemon(name) ?? payload.pokemon;

      const player = room.addPlayer({
        id: socket.id,
        name,
        pokemon: finalPokemon,
        role,
      });

      data.roomId = room.id;
      data.playerId = player.id;
      socket.join(room.id);

      socket.emit(Events.ROOM_JOINED, { playerId: player.id });
      broadcastRoomState(io, room.id);
    });

    socket.on(Events.ROOM_LEAVE, () => {
      if (!data.roomId || !data.playerId) return;
      const room = RoomManager.get(data.roomId);
      if (!room) return;
      room.removePlayer(data.playerId);
      socket.leave(data.roomId);
      const roomId = data.roomId;
      data.roomId = undefined;
      data.playerId = undefined;
      if (room.isEmpty()) {
        RoomManager.delete(roomId);
      } else {
        broadcastRoomState(io, roomId);
      }
    });

    socket.on(Events.VOTE_CAST, (payload: { value: CardValue }) => {
      if (!data.roomId || !data.playerId) return;
      const room = RoomManager.get(data.roomId);
      if (!room) return;
      if (!payload || typeof payload.value !== 'string') return;
      const ok = room.setVote(data.playerId, payload.value);
      if (ok) broadcastRoomState(io, room.id);
    });

    socket.on(Events.VOTE_REVEAL, () => {
      if (!data.roomId) return;
      const room = RoomManager.get(data.roomId);
      if (!room) return;
      room.reveal();
      broadcastRoomState(io, room.id);
    });

    socket.on(Events.VOTE_RESET, () => {
      if (!data.roomId) return;
      const room = RoomManager.get(data.roomId);
      if (!room) return;
      room.reset();
      broadcastRoomState(io, room.id);
    });

    socket.on(Events.ROOM_CLEAR_INACTIVE, () => {
      if (!data.roomId) return;
      const room = RoomManager.get(data.roomId);
      if (!room) return;
      const removed = room.removeInactive();
      if (removed > 0) broadcastRoomState(io, room.id);
    });

    socket.on(Events.PLAYER_SET_ROLE, (payload: { role: PlayerRole }) => {
      if (!data.roomId || !data.playerId) return;
      const room = RoomManager.get(data.roomId);
      if (!room) return;
      if (!payload || (payload.role !== 'voter' && payload.role !== 'spectator')) return;
      const ok = room.setRole(data.playerId, payload.role);
      if (ok) broadcastRoomState(io, room.id);
    });

    socket.on('disconnect', () => {
      if (!data.roomId || !data.playerId) return;
      const room = RoomManager.get(data.roomId);
      if (!room) return;
      room.markOffline(data.playerId);
      broadcastRoomState(io, data.roomId);
    });
  });
}

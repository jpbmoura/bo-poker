import { Room, type RoomMeta } from './Room.js';
import { normalizeRoomId } from '../types/index.js';

export interface SweepResult {
  /** Salas que mudaram e precisam de novo broadcast. */
  changed: Room[];
  removedRooms: number;
}

export class RoomManagerImpl {
  private rooms = new Map<string, Room>();

  /**
   * Materializa a sala em memória. O `meta` vem do Postgres e é OPCIONAL: quem
   * chama já verificou que a sala existe, e uma sala viva nunca é recriada, então
   * o metadado só importa na primeira materialização.
   */
  getOrCreate(roomId: string, meta?: RoomMeta): Room | undefined {
    const id = normalizeRoomId(roomId);
    if (!id) return undefined;
    let room = this.rooms.get(id);
    if (!room) {
      room = new Room(id, meta);
      this.rooms.set(id, room);
    }
    return room;
  }

  get(roomId: string): Room | undefined {
    const id = normalizeRoomId(roomId);
    if (!id) return undefined;
    return this.rooms.get(id);
  }

  delete(roomId: string): void {
    const id = normalizeRoomId(roomId);
    if (!id) return;
    this.rooms.delete(id);
  }

  /**
   * Passada única: remove jogadores offline que venceram a graça, apaga salas
   * que esvaziaram e as que passaram do TTL com todo mundo offline.
   */
  sweep(now: number, graceMs: number, roomTtlMs: number): SweepResult {
    const changed: Room[] = [];
    let removedRooms = 0;

    for (const [id, room] of this.rooms) {
      const reaped = room.reapOffline(now, graceMs);

      if (room.isEmpty()) {
        this.rooms.delete(id);
        removedRooms++;
        continue;
      }

      const allOfflineSince = room.allOfflineSince();
      if (allOfflineSince !== null && now - allOfflineSince > roomTtlMs) {
        this.rooms.delete(id);
        removedRooms++;
        continue;
      }

      if (reaped.length > 0) changed.push(room);
    }

    return { changed, removedRooms };
  }

  /**
   * Salas vivas onde esta identidade está sentada. Varredura linear porque não
   * há índice por usuário — são poucas salas, e concentrar a busca aqui evita
   * espalhá-la pelas rotas que precisam rebroadcastar depois de mexer na conta.
   */
  roomsWithIdentity(identityKey: string): Room[] {
    const found: Room[] = [];
    for (const room of this.rooms.values()) {
      if (room.hasIdentity(identityKey)) found.push(room);
    }
    return found;
  }

  size(): number {
    return this.rooms.size;
  }
}

export const RoomManager = new RoomManagerImpl();

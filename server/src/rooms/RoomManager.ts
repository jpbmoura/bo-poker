import { Room } from './Room.js';
import { normalizeRoomId } from '../types/index.js';

export interface SweepResult {
  /** Salas que mudaram e precisam de novo broadcast. */
  changed: Room[];
  removedRooms: number;
}

export class RoomManagerImpl {
  private rooms = new Map<string, Room>();

  getOrCreate(roomId: string): Room | undefined {
    const id = normalizeRoomId(roomId);
    if (!id) return undefined;
    let room = this.rooms.get(id);
    if (!room) {
      room = new Room(id);
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

  size(): number {
    return this.rooms.size;
  }
}

export const RoomManager = new RoomManagerImpl();

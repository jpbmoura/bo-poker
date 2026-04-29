import { Room } from './Room.js';
import { config } from '../config.js';

class RoomManagerImpl {
  private rooms = new Map<string, Room>();

  getOrCreate(roomId: string): Room {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = new Room(roomId);
      this.rooms.set(roomId, room);
    }
    return room;
  }

  get(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  delete(roomId: string): void {
    this.rooms.delete(roomId);
  }

  cleanup(): number {
    const now = Date.now();
    let removed = 0;
    for (const [id, room] of this.rooms) {
      const allOfflineSince = room.allOfflineSince();
      if (allOfflineSince !== null && now - allOfflineSince > config.roomTtlMs) {
        this.rooms.delete(id);
        removed++;
      }
    }
    return removed;
  }

  size(): number {
    return this.rooms.size;
  }
}

export const RoomManager = new RoomManagerImpl();

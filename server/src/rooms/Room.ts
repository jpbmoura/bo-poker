import {
  CARD_SEQUENCE,
  type CardValue,
  type Player,
  type PlayerRole,
  type Pokemon,
  type RoomState,
  type SerializedPlayer,
} from '../types/index.js';

export class Room {
  readonly id: string;
  readonly createdAt: number;
  revealed = false;
  topic?: string;
  private players = new Map<string, Player>();

  constructor(id: string) {
    this.id = id;
    this.createdAt = Date.now();
  }

  addPlayer(input: {
    id: string;
    name: string;
    pokemon: Pokemon;
    role: PlayerRole;
  }): Player {
    const now = Date.now();
    const player: Player = {
      id: input.id,
      name: input.name,
      pokemon: input.pokemon,
      role: input.role,
      vote: null,
      online: true,
      joinedAt: now,
      lastSeenAt: now,
    };
    this.players.set(player.id, player);
    return player;
  }

  removePlayer(playerId: string): void {
    this.players.delete(playerId);
  }

  removeInactive(): number {
    let removed = 0;
    for (const [id, player] of this.players) {
      if (!player.online) {
        this.players.delete(id);
        removed++;
      }
    }
    return removed;
  }

  markOffline(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player) return;
    player.online = false;
    player.lastSeenAt = Date.now();
  }

  getPlayer(playerId: string): Player | undefined {
    return this.players.get(playerId);
  }

  hasOnlinePlayerWithName(name: string): boolean {
    const normalized = name.trim().toLowerCase();
    for (const player of this.players.values()) {
      if (player.online && player.name.trim().toLowerCase() === normalized) {
        return true;
      }
    }
    return false;
  }

  setVote(playerId: string, value: CardValue): boolean {
    const player = this.players.get(playerId);
    if (!player) return false;
    if (this.revealed) return false;
    if (player.role !== 'voter') return false;
    if (!CARD_SEQUENCE.includes(value)) return false;
    player.vote = value;
    return true;
  }

  reveal(): void {
    this.revealed = true;
  }

  reset(): void {
    this.revealed = false;
    for (const player of this.players.values()) {
      player.vote = null;
    }
  }

  setRole(playerId: string, role: PlayerRole): boolean {
    const player = this.players.get(playerId);
    if (!player) return false;
    player.role = role;
    if (role === 'spectator') {
      player.vote = null;
    }
    return true;
  }

  isEmpty(): boolean {
    return this.players.size === 0;
  }

  allOfflineSince(): number | null {
    if (this.players.size === 0) return this.createdAt;
    let lastActivity = 0;
    for (const player of this.players.values()) {
      if (player.online) return null;
      if (player.lastSeenAt > lastActivity) lastActivity = player.lastSeenAt;
    }
    return lastActivity || this.createdAt;
  }

  serialize(): RoomState {
    const players: SerializedPlayer[] = Array.from(this.players.values()).map((p) => {
      let vote: SerializedPlayer['vote'];
      if (this.revealed) {
        vote = p.vote;
      } else if (p.vote === null) {
        vote = null;
      } else {
        vote = 'HIDDEN';
      }
      return {
        id: p.id,
        name: p.name,
        pokemon: p.pokemon,
        role: p.role,
        online: p.online,
        joinedAt: p.joinedAt,
        vote,
      };
    });

    return {
      id: this.id,
      createdAt: this.createdAt,
      revealed: this.revealed,
      cardSequence: CARD_SEQUENCE,
      players,
      topic: this.topic,
    };
  }
}

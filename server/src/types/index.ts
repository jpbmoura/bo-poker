export * from './wire.js';

import type { CardValue, PlayerRole, Pokemon } from './wire.js';

/**
 * Estado interno do jogador. NÃO é serializado direto para o wire — o
 * `SerializedPlayer` é declarado à parte em wire.ts e construído campo a campo
 * em `Room.serializeFor`, para que nada interno vaze por acidente.
 */
export interface Player {
  /** Id opaco e estável enquanto o jogador existir na sala. */
  id: string;
  /** Identidade autenticada (`user:<id>`), vinda da sessão do socket. */
  identityKey: string;
  name: string;
  /** Handle do GitHub, só da sessão. */
  login: string | null;
  pokemon: Pokemon;
  role: PlayerRole;
  vote: CardValue | null;
  online: boolean;
  /** Sockets vivos ligados a esta identidade (abas duplicadas compartilham assento). */
  socketIds: Set<string>;
  joinedAt: number;
  /** Carimbado quando `socketIds` esvazia. */
  lastSeenAt: number;
}

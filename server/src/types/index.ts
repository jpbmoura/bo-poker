export * from './wire.js';

import type { CardValue, PlayerRole } from './wire.js';
import type { PokemonState } from '../trainers/trainerCache.js';

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
  /** Id do usuário do Better Auth. Endereça o cache de treinadores. */
  userId: string;
  name: string;
  /** Handle do GitHub, só da sessão. */
  login: string | null;
  /**
   * Referência VIVA ao Pokémon ativo no cache — não é uma cópia. Por isso XP
   * ganho numa sala aparece na hora noutra onde a mesma pessoa esteja sentada,
   * sem nenhum código de sincronização. Null quando ainda não escolheu (ou
   * quando a leitura do banco falhou e o estado está degradado).
   */
  trainer: PokemonState | null;
  /**
   * Estágio EXIBIDO na mesa, e não o derivado do XP. Fica ADIADO de propósito:
   * sem isto o `room:state` do reveal já trocaria o sprite e entregaria a
   * evolução segundos antes de a animação tocar. Re-sincroniza no `reset()`, ou
   * seja, a forma nova aterrissa junto com a rodada nova.
   */
  shownStage: number;
  shownBranchId: number | null;
  role: PlayerRole;
  vote: CardValue | null;
  online: boolean;
  /** Sockets vivos ligados a esta identidade (abas duplicadas compartilham assento). */
  socketIds: Set<string>;
  joinedAt: number;
  /** Carimbado quando `socketIds` esvazia. */
  lastSeenAt: number;
}

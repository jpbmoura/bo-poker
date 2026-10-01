import type { Server } from 'socket.io';
import { refreshTrainerRooms } from '../routes/trainerView.js';
import type { Pokemon } from '../types/index.js';
import { TrainerCache } from './index.js';
import { formAt, isPendingChoice, liveStage } from './species.js';

export type Evolution = { from: Pokemon; to: Pokemon };

/**
 * Credita XP num Pokémon da coleção fora da mesa (batalha, repetido capturado,
 * palpite certo). O XP vai pelo cache, como o da rodada: crédito em memória
 * agora, gravação no próximo flush. Devolve a evolução, se houve.
 */
export function creditXp(
  io: Server,
  userId: string,
  pokemonId: string | null,
  xp: number,
): Evolution | null {
  if (!pokemonId || xp === 0) return null;
  const applied = TrainerCache.applyXp(userId, xp, pokemonId);
  if (!applied) return null;

  const beforeStage = liveStage(applied.before);
  const afterStage = liveStage(applied.after);
  let evolution: Evolution | null = null;
  // Mesma regra do award da rodada: ramificado pendente não evolui sozinho.
  if (afterStage > beforeStage && !isPendingChoice(applied.after)) {
    const from = formAt(applied.before, beforeStage, applied.before.branchId);
    const to = formAt(applied.after, afterStage, applied.after.branchId);
    if (from && to) evolution = { from, to };
  }
  if (applied.after.isActive) refreshTrainerRooms(io, userId, evolution ?? undefined);
  return evolution;
}

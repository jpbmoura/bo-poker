import type { Room } from '../rooms/Room.js';
import type { EvolutionEvent, Player, RoundResultPayload } from '../types/index.js';
import { TrainerCache } from './index.js';
import { formAt, isPendingChoice, liveStage } from './species.js';
import { scoreRound, type Ballot } from './xp.js';

export interface AwardedRound {
  result: RoundResultPayload;
  evolutions: EvolutionEvent[];
}

/**
 * Aplica o XP da rodada. SÍNCRONO e só em memória: a persistência é o
 * `pendingXp` + o `flush()` do sweep, então o reveal não espera o banco.
 *
 * Chamado UMA vez por rodada porque o `Room.reveal()` é one-shot — é dele que
 * vem a garantia de exatamente-uma-vez, não de nada daqui.
 */
export function applyRoundXp(room: Room): AwardedRound {
  const voters = room.allPlayers().filter((p) => p.role === 'voter');
  const ballots: Ballot[] = voters.map((p) => ({
    playerId: p.id,
    vote: p.vote,
    online: p.online,
  }));

  const score = scoreRound(ballots);
  const evolutions: EvolutionEvent[] = [];
  const xp: RoundResultPayload['xp'] = [];

  const credit = (player: Player, gained: number): void => {
    // Quem não tem Pokémon (nunca escolheu, ou leitura degradada) não tem linha
    // para avançar. Entra no payload com 0 em vez de sumir da mesa.
    const applied = gained > 0 ? TrainerCache.applyXp(player.userId, gained) : null;

    if (applied) {
      const beforeStage = liveStage(applied.before);
      const afterStage = liveStage(applied.after);
      // Eevee que cruza o limiar NÃO evolui sozinho: fica pendente até a pessoa
      // escolher a pedra, e é a escolha que dispara a animação.
      if (afterStage > beforeStage && !isPendingChoice(applied.after)) {
        const from = formAt(applied.before, beforeStage, applied.before.branchId);
        const to = formAt(applied.after, afterStage, applied.after.branchId);
        if (from && to) {
          evolutions.push({
            playerId: player.id,
            playerName: player.name,
            from,
            to,
            seq: evolutions.length,
          });
        }
      }
    }

    xp.push({
      playerId: player.id,
      gained: applied ? gained : 0,
      total: player.trainer?.xp ?? 0,
    });
  };

  for (const player of voters) {
    const gained = score.gainByPlayerId.get(player.id);
    if (gained === undefined) continue;
    credit(player, gained);
  }

  // Espectador ganha pelo acerto da mesa. Só quem está online: uma aba
  // esquecida numa sala movimentada não pode virar farm.
  if (score.spectatorXp > 0) {
    for (const player of room.allPlayers()) {
      if (player.role === 'spectator' && player.online) credit(player, score.spectatorXp);
    }
  }

  return {
    result: {
      awarded: score.awarded,
      consensus: score.consensus,
      targetIndex: score.targetIndex,
      xp,
    },
    evolutions,
  };
}

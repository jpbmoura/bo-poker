import { Router, type Response } from 'express';
import type { Server } from 'socket.io';
import {
  EEVEE_LINE_ID,
  MAX_POKEMON_PER_USER,
  findLine,
  findBranch,
  isValidLineId,
} from '../data/pokedex.js';
import { RoomManager } from '../rooms/RoomManager.js';
import { Events } from '../socket/events.js';
import { broadcastRoomState } from '../socket/handlers.js';
import { TrainerCache, trainerStore } from '../trainers/index.js';
import type { PokemonState } from '../trainers/trainerCache.js';
import {
  formAt,
  isPendingChoice,
  liveStage,
  progressAt,
} from '../trainers/species.js';
import type { EvolutionEvent, Pokemon, TrainerProgress } from '../types/index.js';
import { dbError, requireUser, type AuthedRequest } from './session.js';

/**
 * O que o cliente consome. NÃO vive no `wire.ts`: aquele arquivo é o contrato do
 * socket e precisa continuar byte-idêntico entre os pacotes. Este DTO é HTTP e o
 * espelho dele está em `client/src/services/trainer.ts`.
 *
 * É uma COLEÇÃO desde já. Hoje ela tem no máximo um item, mas a forma da API é
 * a parte que mais custaria retrofitar depois — e custa nada agora.
 */
interface TrainerPokemonDTO {
  id: string;
  isActive: boolean;
  /** Espécie exibida FORA da mesa: aqui não há adiamento de cerimônia. */
  form: Pokemon;
  progress: TrainerProgress;
}

interface TrainerDTO {
  pokemon: TrainerPokemonDTO[];
  activeId: string | null;
  maxPokemon: number;
}

function toDTO(p: PokemonState): TrainerPokemonDTO | null {
  const stage = liveStage(p);
  const form = formAt(p, stage, p.branchId);
  const progress = progressAt(p, stage);
  if (!form || !progress) return null;
  return { id: p.id, isActive: p.isActive, form, progress };
}

const trainerTag = 'trainer';

export function createTrainerRouter(io: Server): Router {
  const router = Router();
  router.use(requireUser(trainerTag) as never);

  /**
   * Reflete na mesa uma mudança de conta. Sem adiamento: a pessoa acabou de
   * clicar, não há animação a preservar.
   *
   * Repare que NINGUÉM é expulso da sala quando a coleção esvazia. O servidor
   * falha macio: sem Pokémon o jogador segue sentado, aparece com a Pokébola e
   * ganha 0 XP até escolher outro inicial — que o portão do cliente pede na hora.
   */
  function refreshRooms(
    userId: string,
    /**
     * Quando a mudança É uma evolução (a escolha da pedra do Eevee), a mesa
     * inteira também recebe a animação. Sem isto a evolução do Eevee seria a
     * única silenciosa — ela não passa pelo award do reveal.
     */
    evolution?: { from: Pokemon; to: Pokemon },
  ): void {
    const identityKey = `user:${userId}`;
    const state = TrainerCache.peek(userId);
    const active = state ? TrainerCache.activePokemon(state) : null;
    for (const room of RoomManager.roomsWithIdentity(identityKey)) {
      room.refreshTrainer(identityKey, active);
      broadcastRoomState(io, room);
      if (!evolution) continue;
      const player = room.findByIdentity(identityKey);
      if (!player) continue;
      const payload: EvolutionEvent = {
        playerId: player.id,
        playerName: player.name,
        from: evolution.from,
        to: evolution.to,
        seq: 0,
      };
      io.to(room.id).emit(Events.POKEMON_EVOLVED, payload);
    }
  }

  function respond(res: Response, userId: string): void {
    const state = TrainerCache.peek(userId);
    const pokemon = (state?.pokemon ?? [])
      .map(toDTO)
      .filter((p): p is TrainerPokemonDTO => p !== null);
    const body: TrainerDTO = {
      pokemon,
      activeId: pokemon.find((p) => p.isActive)?.id ?? null,
      maxPokemon: MAX_POKEMON_PER_USER,
    };
    res.json(body);
  }

  /**
   * Coleção vazia responde **200 com lista vazia**, não 404: uma coleção vazia é
   * uma resposta legítima. Isso mantém o 404 significando "essa rota não existe"
   * e preserva a distinção entre "não tem Pokémon" e "o banco caiu" (503) — que é
   * o que o portão do cliente precisa para não acusar perda de progresso num blip.
   */
  router.get('/', async (req: AuthedRequest, res) => {
    const userId = req.userId!;
    try {
      // Cache primeiro, banco só se estiver frio — mesma regra do room:join.
      if (!TrainerCache.peek(userId)) await TrainerCache.resolve(userId);
      respond(res, userId);
    } catch (err) {
      dbError(res, err, trainerTag, 'falha ao ler treinador');
    }
  });

  router.post('/pokemon', async (req: AuthedRequest, res) => {
    const userId = req.userId!;
    const lineId = typeof req.body?.lineId === 'string' ? req.body.lineId : '';
    if (!isValidLineId(lineId)) {
      res.status(400).json({ error: 'INVALID_LINE' });
      return;
    }
    try {
      const state = TrainerCache.peek(userId) ?? (await TrainerCache.resolve(userId));
      if (state.pokemon.length >= MAX_POKEMON_PER_USER) {
        res.status(409).json({ error: 'POKEMON_LIMIT' });
        return;
      }
      const row = await trainerStore.create(userId, lineId, state.pokemon.length === 0);
      TrainerCache.put(userId, row);
      refreshRooms(userId);
      respond(res, userId);
    } catch (err) {
      dbError(res, err, trainerTag, 'falha ao adicionar pokémon');
    }
  });

  /** Hoje é sempre no-op (só existe um), mas é o ponto da troca no futuro. */
  router.post('/pokemon/:id/active', async (req: AuthedRequest, res) => {
    const userId = req.userId!;
    const id = req.params.id;
    try {
      const state = TrainerCache.peek(userId) ?? (await TrainerCache.resolve(userId));
      if (!state.pokemon.some((p) => p.id === id)) {
        res.status(404).json({ error: 'POKEMON_NOT_FOUND' });
        return;
      }
      await trainerStore.setActive(userId, id);
      const row = await trainerStore.findById(id);
      if (row) TrainerCache.put(userId, row);
      refreshRooms(userId);
      respond(res, userId);
    } catch (err) {
      dbError(res, err, trainerTag, 'falha ao trocar o pokémon ativo');
    }
  });

  router.post('/pokemon/:id/branch', async (req: AuthedRequest, res) => {
    const userId = req.userId!;
    const id = req.params.id;
    const dexId = Number(req.body?.dexId);
    try {
      const state = TrainerCache.peek(userId) ?? (await TrainerCache.resolve(userId));
      const owned = state.pokemon.find((p) => p.id === id);
      if (!owned) {
        res.status(404).json({ error: 'POKEMON_NOT_FOUND' });
        return;
      }
      const line = findLine(owned.lineId);
      if (!line || line.id !== EEVEE_LINE_ID || !findBranch(line, dexId)) {
        res.status(400).json({ error: 'INVALID_BRANCH' });
        return;
      }
      if (!isPendingChoice(owned)) {
        res.status(409).json({ error: 'BRANCH_UNAVAILABLE' });
        return;
      }
      // O `branchId IS NULL` na cláusula faz a finalidade ser garantida pelo
      // BANCO: duas abas clicando ao mesmo tempo não escolhem duas pedras.
      const row = await trainerStore.setBranch(id, dexId);
      if (!row) {
        res.status(409).json({ error: 'BRANCH_UNAVAILABLE' });
        return;
      }
      const updated = TrainerCache.put(userId, row);
      const from = formAt(owned, 0, null);
      const to = formAt(updated, liveStage(updated), updated.branchId);
      refreshRooms(userId, from && to ? { from, to } : undefined);
      respond(res, userId);
    } catch (err) {
      dbError(res, err, trainerTag, 'falha ao escolher a evolução');
    }
  });

  /** Liberar. Hoje é o "resetar": solta o único e a coleção volta a ficar vazia. */
  router.delete('/pokemon/:id', async (req: AuthedRequest, res) => {
    const userId = req.userId!;
    const id = req.params.id;
    try {
      const state = TrainerCache.peek(userId) ?? (await TrainerCache.resolve(userId));
      if (!state.pokemon.some((p) => p.id === id)) {
        res.status(404).json({ error: 'POKEMON_NOT_FOUND' });
        return;
      }
      await trainerStore.remove(id);
      TrainerCache.drop(userId, id);
      // Sobrou algum? Promove no banco também, para o cache não divergir.
      const promoted = TrainerCache.peek(userId)?.pokemon.find((p) => p.isActive);
      if (promoted) await trainerStore.setActive(userId, promoted.id);
      refreshRooms(userId);
      respond(res, userId);
    } catch (err) {
      dbError(res, err, trainerTag, 'falha ao liberar o pokémon');
    }
  });

  return router;
}

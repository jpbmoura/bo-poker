import { Router } from 'express';
import type { Server } from 'socket.io';
import { findBranch, findLine, isStarterLine } from '../data/pokedex.js';
import { TrainerCache, trainerStore } from '../trainers/index.js';
import { formAt, isPendingChoice, liveStage } from '../trainers/species.js';
import { dbError, requireUser, type AuthedRequest } from './session.js';
import { refreshTrainerRooms, respondTrainer } from './trainerView.js';

const trainerTag = 'trainer';

export function createTrainerRouter(io: Server): Router {
  const router = Router();
  router.use(requireUser(trainerTag) as never);

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
      respondTrainer(res, userId);
    } catch (err) {
      dbError(res, err, trainerTag, 'falha ao ler treinador');
    }
  });

  /**
   * Escolha do INICIAL. É a única porta de entrada de graça, então só vale com a
   * coleção vazia e só para as linhas da tela de escolha — qualquer outro
   * Pokémon se ganha capturando (`/api/capture`).
   */
  router.post('/pokemon', async (req: AuthedRequest, res) => {
    const userId = req.userId!;
    const lineId = typeof req.body?.lineId === 'string' ? req.body.lineId : '';
    if (!isStarterLine(lineId)) {
      res.status(400).json({ error: 'INVALID_LINE' });
      return;
    }
    try {
      const state = TrainerCache.peek(userId) ?? (await TrainerCache.resolve(userId));
      if (state.pokemon.length > 0) {
        res.status(409).json({ error: 'POKEMON_LIMIT' });
        return;
      }
      const row = await trainerStore.create(userId, lineId, state.pokemon.length === 0);
      TrainerCache.put(userId, row);
      refreshTrainerRooms(io, userId);
      respondTrainer(res, userId);
    } catch (err) {
      dbError(res, err, trainerTag, 'falha ao adicionar pokémon');
    }
  });

  /** Troca o Pokémon que aparece na mesa. */
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
      refreshTrainerRooms(io, userId);
      respondTrainer(res, userId);
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
      if (!line?.branches || !findBranch(line, dexId)) {
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
      const from = formAt(owned, liveStage(owned), null);
      const to = formAt(updated, liveStage(updated), updated.branchId);
      refreshTrainerRooms(io, userId, from && to ? { from, to } : undefined);
      respondTrainer(res, userId);
    } catch (err) {
      dbError(res, err, trainerTag, 'falha ao escolher a evolução');
    }
  });

  /** Liberar. Soltar o último esvazia a coleção e o portão do inicial volta. */
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
      refreshTrainerRooms(io, userId);
      respondTrainer(res, userId);
    } catch (err) {
      dbError(res, err, trainerTag, 'falha ao liberar o pokémon');
    }
  });

  return router;
}

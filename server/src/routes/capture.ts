import { randomInt } from 'node:crypto';
import { Router } from 'express';
import type { Server } from 'socket.io';
import { CAPTURE_ATTEMPTS, CAPTURE_CHANCE, spriteUrl, type Tier } from '../data/pokedex.js';
import { config } from '../config.js';
import * as captureStore from '../capture/captureStore.js';
import { dayKey, isDayKey, nextReset, spawnFor } from '../capture/dailySpawn.js';
import { TrainerCache } from '../trainers/index.js';
import type { Pokemon } from '../types/index.js';
import { dbError, requireUser, type AuthedRequest } from './session.js';
import { refreshTrainerRooms, trainerDTO, type TrainerDTO } from './trainerView.js';

/**
 * - `available`: ainda dá para tentar.
 * - `caught`: capturou hoje.
 * - `fled`: gastou as tentativas sem sucesso.
 * - `owned`: já tem essa linha — captura bloqueada.
 */
type CaptureStatus = 'available' | 'caught' | 'fled' | 'owned';

/** Espelho em `client/src/services/capture.ts`. */
interface CaptureDTO {
  day: string;
  species: Pokemon;
  lineId: string;
  stage: number;
  tier: Tier;
  /** Chance (%) de cada tentativa. */
  chance: number;
  attempts: number;
  maxAttempts: number;
  status: CaptureStatus;
  /** ISO do instante em que aparece o próximo. */
  resetsAt: string;
}

interface AttemptDTO {
  success: boolean;
  capture: CaptureDTO;
  trainer: TrainerDTO;
}

const captureTag = 'capture';

function statusOf(
  attempts: number,
  caught: boolean,
  ownsLine: boolean,
): CaptureStatus {
  if (caught) return 'caught';
  if (ownsLine) return 'owned';
  if (attempts >= CAPTURE_ATTEMPTS) return 'fled';
  return 'available';
}

export function createCaptureRouter(io: Server): Router {
  const router = Router();
  router.use(requireUser(captureTag) as never);

  async function buildCapture(userId: string, now: Date): Promise<CaptureDTO> {
    const day = dayKey(now);
    const species = spawnFor(day, config.captureSalt);
    const [record, state] = await Promise.all([
      captureStore.getDay(userId, day),
      TrainerCache.peek(userId) ?? TrainerCache.resolve(userId),
    ]);
    const attempts = record?.attempts ?? 0;
    const ownsLine = state.pokemon.some((p) => p.lineId === species.lineId);
    return {
      day,
      species: { id: species.entry.id, name: species.entry.name, sprite: spriteUrl(species.entry.id) },
      lineId: species.lineId,
      stage: species.stage,
      tier: species.tier,
      chance: CAPTURE_CHANCE[species.tier],
      attempts,
      maxAttempts: CAPTURE_ATTEMPTS,
      status: statusOf(attempts, record?.caught ?? false, ownsLine),
      resetsAt: nextReset(now).toISOString(),
    };
  }

  router.get('/today', async (req: AuthedRequest, res) => {
    try {
      res.json(await buildCapture(req.userId!, new Date()));
    } catch (err) {
      dbError(res, err, captureTag, 'falha ao ler a captura do dia');
    }
  });

  /**
   * Uma Pokébola. O sorteio é AQUI, nunca no cliente — lá qualquer um trocaria
   * o resultado pelo DevTools. O cliente só toca a animação do que voltar.
   *
   * O body leva o `day` que o drawer está mostrando: se o dia virou com o drawer
   * aberto, a tentativa NÃO pode cair no Pokémon de amanhã sem a pessoa ver.
   */
  router.post('/today/attempt', async (req: AuthedRequest, res) => {
    const userId = req.userId!;
    const now = new Date();
    const day = dayKey(now);
    if (!isDayKey(req.body?.day)) {
      res.status(400).json({ error: 'INVALID_DAY' });
      return;
    }
    if (req.body.day !== day) {
      res.status(409).json({ error: 'DAY_CHANGED' });
      return;
    }

    const species = spawnFor(day, config.captureSalt);
    const chance = CAPTURE_CHANCE[species.tier];
    const roll = (): boolean =>
      config.captureForce ? config.captureForce === 'success' : randomInt(100) < chance;

    try {
      // Garante o cache quente antes: o `put` do sucesso precisa da coleção
      // inteira em memória, não só do Pokémon novo.
      if (!TrainerCache.peek(userId)) await TrainerCache.resolve(userId);

      const outcome = await captureStore.attempt(userId, day, species, roll);
      if (outcome.kind === 'owned') {
        res.status(409).json({ error: 'ALREADY_OWNED' });
        return;
      }
      if (outcome.kind === 'exhausted') {
        res.status(409).json({ error: 'NO_ATTEMPTS' });
        return;
      }

      if (outcome.pokemon) {
        TrainerCache.put(userId, outcome.pokemon);
        // Só muda a mesa se ele virou o ativo (coleção estava vazia).
        if (outcome.pokemon.isActive) refreshTrainerRooms(io, userId);
      }

      const body: AttemptDTO = {
        success: outcome.success,
        capture: await buildCapture(userId, now),
        trainer: trainerDTO(userId),
      };
      res.json(body);
    } catch (err) {
      dbError(res, err, captureTag, 'falha ao lançar a pokébola');
    }
  });

  return router;
}

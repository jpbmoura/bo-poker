import { Router } from 'express';
import { PNG } from 'pngjs';
import type { Server } from 'socket.io';
import { normalizeName, spriteUrl, wildSpecies } from '../data/pokedex.js';
import { config } from '../config.js';
import { dayKey, nextReset } from '../capture/dailySpawn.js';
import { GUESS_XP, guessFor } from '../guess/dailyGuess.js';
import * as guessStore from '../guess/guessStore.js';
import { TrainerCache } from '../trainers/index.js';
import { creditXp, type Evolution } from '../trainers/creditXp.js';
import type { Pokemon } from '../types/index.js';
import { requestDay } from './day.js';
import { dbError, requireUser, type AuthedRequest } from './session.js';
import { trainerDTO, type TrainerDTO } from './trainerView.js';

/**
 * - `open`: ainda não chutou hoje.
 * - `correct` / `wrong`: chutou; a resposta já pode ir para o cliente.
 */
type GuessStatus = 'open' | 'correct' | 'wrong';

/** Espelho em `client/src/services/guess.ts`. */
interface GuessDTO {
  day: string;
  status: GuessStatus;
  /** Só depois do palpite: antes disso o cliente vê apenas a silhueta. */
  answer: Pokemon | null;
  guess: string | null;
  /** XP que cada Pokémon da coleção ganhou (0 se errou ou ainda não chutou). */
  xpGained: number;
  /** XP de um acerto, para o drawer anunciar antes do palpite. */
  reward: number;
  /** ISO do instante em que aparece o próximo. */
  resetsAt: string;
}

interface SubmitDTO {
  guess: GuessDTO;
  trainer: TrainerDTO;
  evolutions: Evolution[];
}

const guessTag = 'guess';
const MAX_GUESS_LENGTH = 40;

/** Nome canônico de cada espécie da natureza pelo nome normalizado. */
let namesCache: Map<string, string> | null = null;
function canonicalName(input: string): string | null {
  namesCache ??= new Map(wildSpecies().map((s) => [normalizeName(s.entry.name), s.entry.name]));
  return namesCache.get(normalizeName(input)) ?? null;
}

/**
 * A silhueta do dia, pintada de preto AQUI. Mandar o sprite e escurecer no CSS
 * entregaria a resposta a qualquer um com o DevTools aberto (a URL tem o id).
 * Só um dia fica em memória: o PNG é pequeno e muda à meia-noite.
 */
let silhouetteCache: { day: string; png: Buffer } | null = null;
async function silhouette(day: string, dexId: number): Promise<Buffer> {
  if (silhouetteCache?.day === day) return silhouetteCache.png;
  const res = await fetch(spriteUrl(dexId));
  if (!res.ok) throw new Error(`sprite ${dexId}: HTTP ${res.status}`);
  const image = PNG.sync.read(Buffer.from(await res.arrayBuffer()));
  for (let i = 0; i < image.data.length; i += 4) {
    image.data[i] = 0;
    image.data[i + 1] = 0;
    image.data[i + 2] = 0;
    // Alpha binário: a borda semitransparente do sprite não denuncia cores.
    image.data[i + 3] = image.data[i + 3] > 0 ? 255 : 0;
  }
  const png = PNG.sync.write(image);
  silhouetteCache = { day, png };
  return png;
}

export function createGuessRouter(io: Server): Router {
  const router = Router();
  router.use(requireUser(guessTag) as never);

  async function buildGuess(userId: string, now: Date): Promise<GuessDTO> {
    const day = dayKey(now);
    const record = await guessStore.getDay(userId, day);
    const species = guessFor(day, config.captureSalt);
    return {
      day,
      status: !record ? 'open' : record.correct ? 'correct' : 'wrong',
      answer: record ? { ...species.entry, sprite: spriteUrl(species.entry.id) } : null,
      guess: record?.guess ?? null,
      xpGained: record?.xpGained ?? 0,
      reward: GUESS_XP,
      resetsAt: nextReset(now).toISOString(),
    };
  }

  router.get('/today', async (req: AuthedRequest, res) => {
    try {
      res.json(await buildGuess(req.userId!, new Date()));
    } catch (err) {
      dbError(res, err, guessTag, 'falha ao ler o palpite do dia');
    }
  });

  router.get('/today/silhouette.png', async (_req, res) => {
    const now = new Date();
    const day = dayKey(now);
    try {
      const png = await silhouette(day, guessFor(day, config.captureSalt).entry.id);
      const maxAge = Math.max(0, Math.floor((nextReset(now).getTime() - now.getTime()) / 1000));
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', `private, max-age=${maxAge}`);
      res.send(png);
    } catch (err) {
      console.error(`[${guessTag}] falha ao gerar a silhueta:`, (err as Error).message);
      res.status(502).json({ error: 'SPRITE_UNAVAILABLE' });
    }
  });

  /**
   * O palpite único do dia. A comparação é AQUI: o cliente não sabe a resposta
   * até o palpite estar gravado.
   */
  router.post('/today/guess', async (req: AuthedRequest, res) => {
    const userId = req.userId!;
    const now = new Date();
    const day = requestDay(req, res, now);
    if (!day) return;

    const raw: unknown = req.body?.guess;
    if (typeof raw !== 'string' || !raw.trim() || raw.length > MAX_GUESS_LENGTH) {
      res.status(400).json({ error: 'INVALID_GUESS' });
      return;
    }
    const guess = canonicalName(raw) ?? raw.trim();
    const species = guessFor(day, config.captureSalt);
    const correct = normalizeName(guess) === normalizeName(species.entry.name);
    const xp = correct ? GUESS_XP : 0;

    try {
      // Cache quente antes do insert: o crédito abaixo precisa da coleção inteira.
      const state = TrainerCache.peek(userId) ?? (await TrainerCache.resolve(userId));

      const record = await guessStore.submit(userId, day, guess, correct, xp);
      if (!record) {
        res.status(409).json({ error: 'ALREADY_GUESSED' });
        return;
      }

      const evolutions: Evolution[] = [];
      if (correct) {
        for (const p of [...state.pokemon]) {
          const evolution = creditXp(io, userId, p.id, xp);
          if (evolution) evolutions.push(evolution);
        }
      }

      const body: SubmitDTO = {
        guess: await buildGuess(userId, now),
        trainer: trainerDTO(userId),
        evolutions,
      };
      res.json(body);
    } catch (err) {
      dbError(res, err, guessTag, 'falha ao registrar o palpite');
    }
  });

  return router;
}

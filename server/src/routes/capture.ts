import { randomInt } from 'node:crypto';
import { Router } from 'express';
import type { Server } from 'socket.io';
import {
  CAPTURE_ATTEMPTS,
  CAPTURE_CHANCE,
  DUPLICATE_XP,
  spriteUrl,
  type Tier,
} from '../data/pokedex.js';
import { config } from '../config.js';
import * as captureStore from '../capture/captureStore.js';
import { dayKey, nextReset, spawnFor } from '../capture/dailySpawn.js';
import {
  BATTLE_XP,
  battleBonus,
  captureChance,
  playerLevel,
  wildLevel,
} from '../battle/balance.js';
import * as battleStore from '../battle/battleStore.js';
import {
  BattleError,
  createBattle,
  forfeit,
  hpRatio,
  playCard,
  type BattleEvent,
} from '../battle/engine.js';
import { speciesData } from '../battle/deck.js';
import { effectiveness } from '../battle/typeChart.js';
import type { TypeName } from '../battle/types.js';
import { battleDTO, type BattleDTO } from '../battle/view.js';
import {
  TrainerCache,
  duplicateTarget,
  formAt,
  liveStage,
} from '../trainers/index.js';
import type { Pokemon } from '../types/index.js';
import { creditXp, type Evolution } from '../trainers/creditXp.js';
import { requestDay } from './day.js';
import { dbError, requireUser, type AuthedRequest } from './session.js';
import { refreshTrainerRooms, trainerDTO, type TrainerDTO } from './trainerView.js';

/**
 * - `available`: ainda dá para tentar.
 * - `caught`: capturou hoje.
 * - `fled`: gastou as tentativas sem sucesso.
 */
type CaptureStatus = 'available' | 'caught' | 'fled';

/** Espelho em `client/src/services/capture.ts`. */
interface CaptureDTO {
  day: string;
  species: Pokemon;
  lineId: string;
  stage: number;
  tier: Tier;
  /** Chance (%) do tier, sem o bônus da batalha. */
  baseChance: number;
  /** Chance (%) de cada tentativa, já com o bônus (teto em MAX_CAPTURE_CHANCE). */
  chance: number;
  battle: BattleSummary;
  attempts: number;
  maxAttempts: number;
  status: CaptureStatus;
  /**
   * Já tem a linhagem: capturar vira `xp` para esse Pokémon em vez de um
   * exemplar novo. Null = a captura cria um Pokémon. Ver `duplicateTarget`.
   */
  duplicate: { pokemonId: string; name: string; xp: number } | null;
  /** ISO do instante em que aparece o próximo. */
  resetsAt: string;
}

/** Um Pokémon da coleção visto como lutador contra o selvagem de hoje. */
interface FighterOption {
  pokemonId: string;
  level: number;
  types: TypeName[];
  /** Nível que o selvagem teria contra ele. */
  wildLevel: number;
  /** Melhor multiplicador dos tipos dele contra o selvagem (2 = vantagem). */
  attack: number;
  /** Melhor multiplicador dos tipos do selvagem contra ele (2 = risco). */
  defense: number;
}

/** `none` = ainda não batalhou hoje. */
interface BattleSummary {
  status: 'none' | battleStore.BattleStatus;
  bonus: number;
  wildTypes: TypeName[];
  /** Para o seletor: o cliente não tem tipos nem a fórmula de nível. */
  fighters: FighterOption[];
}

interface PlayDTO {
  battle: BattleDTO;
  events: BattleEvent[];
  /** Só quando a batalha acabou neste turno. */
  capture?: CaptureDTO;
  trainer?: TrainerDTO;
  evolution?: Evolution | null;
}

interface AttemptDTO {
  success: boolean;
  capture: CaptureDTO;
  trainer: TrainerDTO;
  /** Repetido capturado: XP creditado no Pokémon da linhagem. */
  xpGained?: number;
  evolution?: Evolution | null;
}

const captureTag = 'capture';

function statusOf(attempts: number, caught: boolean): CaptureStatus {
  if (caught) return 'caught';
  if (attempts >= CAPTURE_ATTEMPTS) return 'fled';
  return 'available';
}

export function createCaptureRouter(io: Server): Router {
  const router = Router();
  router.use(requireUser(captureTag) as never);

  async function buildCapture(userId: string, now: Date): Promise<CaptureDTO> {
    const day = dayKey(now);
    const species = spawnFor(day, config.captureSalt);
    const [record, state, battle] = await Promise.all([
      captureStore.getDay(userId, day),
      TrainerCache.peek(userId) ?? TrainerCache.resolve(userId),
      battleStore.getDay(userId, day),
    ]);
    const attempts = record?.attempts ?? 0;
    const target = duplicateTarget(state.pokemon, species.lineId);
    const targetForm = target ? formAt(target, liveStage(target), target.branchId) : null;
    const baseChance = CAPTURE_CHANCE[species.tier];
    const bonus = battle?.status === 'won' ? battle.bonus : 0;
    const wildTypes = speciesData(species.entry.id).types;
    const best = (attackers: TypeName[], defenders: TypeName[]) =>
      Math.max(...attackers.map((t) => effectiveness(t, defenders)));
    const fighters: FighterOption[] = state.pokemon.flatMap((p) => {
      const form = formAt(p, liveStage(p), p.branchId);
      if (!form) return [];
      const types = speciesData(form.id).types;
      const level = playerLevel(p.xp);
      return [
        {
          pokemonId: p.id,
          level,
          types,
          wildLevel: wildLevel(species.tier, level),
          attack: best(types, wildTypes),
          defense: best(wildTypes, types),
        },
      ];
    });
    return {
      day,
      species: { id: species.entry.id, name: species.entry.name, sprite: spriteUrl(species.entry.id) },
      lineId: species.lineId,
      stage: species.stage,
      tier: species.tier,
      baseChance,
      chance: captureChance(baseChance, bonus),
      battle: { status: battle?.status ?? 'none', bonus, wildTypes, fighters },
      attempts,
      maxAttempts: CAPTURE_ATTEMPTS,
      status: statusOf(attempts, record?.caught ?? false),
      duplicate:
        target && targetForm
          ? { pokemonId: target.id, name: targetForm.name, xp: DUPLICATE_XP[species.tier] }
          : null,
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
    const day = requestDay(req, res, now);
    if (!day) return;

    const species = spawnFor(day, config.captureSalt);

    try {
      // A batalha vencida é terminal: o bônus lido aqui não muda até o roll.
      const battle = await battleStore.getDay(userId, day);
      const bonus = battle?.status === 'won' ? battle.bonus : 0;
      const chance = captureChance(CAPTURE_CHANCE[species.tier], bonus);
      const roll = (): boolean =>
        config.captureForce ? config.captureForce === 'success' : randomInt(100) < chance;

      // Garante o cache quente antes: o `put` do sucesso precisa da coleção
      // inteira em memória, não só do Pokémon novo, e o alvo do repetido sai dela.
      const state = TrainerCache.peek(userId) ?? (await TrainerCache.resolve(userId));
      const target = duplicateTarget(state.pokemon, species.lineId);

      const outcome = await captureStore.attempt(userId, day, species, target?.id ?? null, roll);
      if (outcome.kind === 'exhausted') {
        res.status(409).json({ error: 'NO_ATTEMPTS' });
        return;
      }

      if (outcome.pokemon) {
        TrainerCache.put(userId, outcome.pokemon);
        // Só muda a mesa se ele virou o ativo (coleção estava vazia).
        if (outcome.pokemon.isActive) refreshTrainerRooms(io, userId);
      }

      let evolution: Evolution | null = null;
      let xpGained: number | undefined;
      if (outcome.duplicateOf) {
        xpGained = DUPLICATE_XP[species.tier];
        evolution = creditXp(io, userId, outcome.duplicateOf, xpGained);
      }

      const body: AttemptDTO = {
        success: outcome.success,
        capture: await buildCapture(userId, now),
        trainer: trainerDTO(userId),
        xpGained,
        evolution,
      };
      res.json(body);
    } catch (err) {
      dbError(res, err, captureTag, 'falha ao lançar a pokébola');
    }
  });

  /** A batalha de hoje, para retomar depois de fechar o modal ou recarregar. */
  router.get('/today/battle', async (req: AuthedRequest, res) => {
    try {
      const record = await battleStore.getDay(req.userId!, dayKey(new Date()));
      if (!record) {
        res.status(404).json({ error: 'NO_BATTLE' });
        return;
      }
      res.json(battleDTO(record.state, record));
    } catch (err) {
      dbError(res, err, captureTag, 'falha ao ler a batalha');
    }
  });

  /**
   * Começa a batalha do dia com um Pokémon da coleção. Uma por dia, ganhando ou
   * perdendo — quem garante é a chave primária do `daily_battle`.
   */
  router.post('/today/battle', async (req: AuthedRequest, res) => {
    const userId = req.userId!;
    const now = new Date();
    const day = requestDay(req, res, now);
    if (!day) return;
    const pokemonId: unknown = req.body?.pokemonId;
    if (typeof pokemonId !== 'string') {
      res.status(400).json({ error: 'INVALID_POKEMON' });
      return;
    }

    try {
      const capture = await buildCapture(userId, now);
      if (capture.battle.status !== 'none') {
        res.status(409).json({ error: 'BATTLE_USED' });
        return;
      }
      if (capture.status !== 'available') {
        res.status(409).json({ error: 'NOT_AVAILABLE' });
        return;
      }
      // O buildCapture já deixou o cache quente.
      const mine = TrainerCache.peek(userId)?.pokemon.find((p) => p.id === pokemonId);
      const form = mine ? formAt(mine, liveStage(mine), mine.branchId) : null;
      if (!mine || !form) {
        res.status(400).json({ error: 'INVALID_POKEMON' });
        return;
      }

      const level = playerLevel(mine.xp);
      const state = createBattle(
        { dexId: form.id, name: form.name, level },
        {
          dexId: capture.species.id,
          name: capture.species.name,
          level: wildLevel(capture.tier, level),
        },
        randomInt(2 ** 31),
      );
      const record = await battleStore.start(userId, day, mine.id, state);
      if (!record) {
        res.status(409).json({ error: 'BATTLE_USED' });
        return;
      }
      res.json(battleDTO(record.state, record));
    } catch (err) {
      dbError(res, err, captureTag, 'falha ao começar a batalha');
    }
  });

  router.post('/today/battle/play', async (req: AuthedRequest, res) => {
    const userId = req.userId!;
    const now = new Date();
    const day = requestDay(req, res, now);
    if (!day) return;
    const cardUid: unknown = req.body?.cardUid;
    if (typeof cardUid !== 'string') {
      res.status(400).json({ error: 'INVALID_CARD' });
      return;
    }

    try {
      // O tier sai do Pokémon do dia, não do estado: é ele quem define o XP.
      const tier = spawnFor(day, config.captureSalt).tier;
      if (!TrainerCache.peek(userId)) await TrainerCache.resolve(userId);

      const outcome = await battleStore.turn(userId, day, (record) => {
        const { state, events } = playCard(record.state, cardUid);
        if (state.outcome === 'active') return { state, result: events };
        const won = state.outcome === 'won';
        return {
          state,
          result: events,
          finish: {
            status: state.outcome,
            bonus: won ? battleBonus(hpRatio(state)) : 0,
            xpGained: won && record.pokemonId ? BATTLE_XP[tier] : 0,
          },
        };
      });
      if (!outcome) {
        res.status(409).json({ error: 'NO_ACTIVE_BATTLE' });
        return;
      }

      const { record, result: events } = outcome;
      const body: PlayDTO = { battle: battleDTO(record.state, record), events };
      if (record.status !== 'active') {
        body.evolution = creditXp(io, userId, record.pokemonId, record.xpGained);
        body.capture = await buildCapture(userId, now);
        body.trainer = trainerDTO(userId);
      }
      res.json(body);
    } catch (err) {
      if (err instanceof BattleError) {
        res.status(409).json({ error: err.code });
        return;
      }
      dbError(res, err, captureTag, 'falha ao jogar a carta');
    }
  });

  router.post('/today/battle/forfeit', async (req: AuthedRequest, res) => {
    const userId = req.userId!;
    const now = new Date();
    const day = requestDay(req, res, now);
    if (!day) return;

    try {
      const outcome = await battleStore.turn(userId, day, (record) => ({
        state: forfeit(record.state),
        result: null,
        finish: { status: 'lost', bonus: 0, xpGained: 0 },
      }));
      if (!outcome) {
        res.status(409).json({ error: 'NO_ACTIVE_BATTLE' });
        return;
      }
      res.json({
        battle: battleDTO(outcome.record.state, outcome.record),
        capture: await buildCapture(userId, now),
      });
    } catch (err) {
      dbError(res, err, captureTag, 'falha ao desistir da batalha');
    }
  });

  return router;
}

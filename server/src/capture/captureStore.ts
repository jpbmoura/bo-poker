import { pool } from '../auth.js';
import { CAPTURE_ATTEMPTS, xpForStage, type WildSpecies } from '../data/pokedex.js';
import * as trainerStore from '../trainers/trainerStore.js';
import type { PokemonRecord } from '../trainers/trainerStore.js';

/** Linha da tabela `daily_capture`. */
export interface DailyCaptureRecord {
  attempts: number;
  caught: boolean;
}

export async function getDay(userId: string, day: string): Promise<DailyCaptureRecord | null> {
  const { rows } = await pool.query<DailyCaptureRecord>(
    `SELECT "attempts", "caught" FROM "daily_capture"
      WHERE "userId" = $1 AND "day" = $2`,
    [userId, day],
  );
  return rows[0] ?? null;
}

export type AttemptOutcome =
  | { kind: 'exhausted' }
  | {
      kind: 'thrown';
      attempts: number;
      success: boolean;
      /** Pokémon novo criado pela captura. Null em falha ou em repetido. */
      pokemon: PokemonRecord | null;
      /** Repetido: o id de quem recebe o XP. O crédito é do caller, pelo cache. */
      duplicateOf: string | null;
    };

/**
 * Uma Pokébola lançada, numa transação só:
 *
 * 1. Gasta a tentativa com um upsert CONDICIONAL. O `where attempts < N and not
 *    caught` faz o limite ser garantido pelo banco: duas abas clicando juntas
 *    nunca conseguem a 4ª.
 * 2. Só então sorteia. Acertou: a linha do dia fica marcada como `caught` e,
 *    se não for repetido, o Pokémon nasce no estágio em que foi capturado.
 *
 * `roll` é injetado para o route decidir (sorteio de verdade ou CAPTURE_FORCE).
 * `duplicateOf` também vem do route: o XP mora no cache, então é lá que se sabe
 * quem absorve o repetido (ver `duplicateTarget`).
 */
export async function attempt(
  userId: string,
  day: string,
  species: WildSpecies,
  duplicateOf: string | null,
  roll: () => boolean,
): Promise<AttemptOutcome> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const spent = await client.query<{ attempts: number }>(
      `INSERT INTO "daily_capture" ("userId", "day", "attempts")
       VALUES ($1, $2, 1)
       ON CONFLICT ("userId", "day") DO UPDATE
          SET "attempts" = "daily_capture"."attempts" + 1, "updatedAt" = now()
        WHERE "daily_capture"."attempts" < $3 AND NOT "daily_capture"."caught"
       RETURNING "attempts"`,
      [userId, day, CAPTURE_ATTEMPTS],
    );
    const attempts = spent.rows[0]?.attempts;
    if (attempts === undefined) {
      await client.query('ROLLBACK');
      return { kind: 'exhausted' };
    }

    const success = roll();
    let pokemon: PokemonRecord | null = null;
    if (success) {
      if (!duplicateOf) {
        const hasAny = await client.query(
          'SELECT 1 FROM "trainer_pokemon" WHERE "userId" = $1 LIMIT 1',
          [userId],
        );
        pokemon = await trainerStore.create(
          userId,
          species.lineId,
          (hasAny.rowCount ?? 0) === 0,
          { xp: xpForStage(species.stage), branchId: species.branchId },
          client,
        );
      }
      await client.query(
        `UPDATE "daily_capture"
            SET "caught" = true, "caughtPokemonId" = $3, "updatedAt" = now()
          WHERE "userId" = $1 AND "day" = $2`,
        [userId, day, pokemon?.id ?? duplicateOf],
      );
    }

    await client.query('COMMIT');
    return { kind: 'thrown', attempts, success, pokemon, duplicateOf: success ? duplicateOf : null };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

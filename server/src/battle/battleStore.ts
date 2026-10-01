import { pool } from '../auth.js';
import type { BattleState } from './engine.js';

export type BattleStatus = 'active' | 'won' | 'lost';

/** Linha da tabela `daily_battle`. */
export interface BattleRecord {
  pokemonId: string | null;
  status: BattleStatus;
  bonus: number;
  xpGained: number;
  state: BattleState;
}

const COLUMNS = '"pokemonId", "status", "bonus", "xpGained", "state"';

export async function getDay(userId: string, day: string): Promise<BattleRecord | null> {
  const { rows } = await pool.query<BattleRecord>(
    `SELECT ${COLUMNS} FROM "daily_battle" WHERE "userId" = $1 AND "day" = $2`,
    [userId, day],
  );
  return rows[0] ?? null;
}

/**
 * Abre a batalha do dia. `ON CONFLICT DO NOTHING` faz do limite de uma por dia
 * uma garantia do banco: duas abas clicando "Batalhar" juntas, só uma entra.
 * Null = já existe batalha hoje.
 */
export async function start(
  userId: string,
  day: string,
  pokemonId: string,
  state: BattleState,
): Promise<BattleRecord | null> {
  const { rows } = await pool.query<BattleRecord>(
    `INSERT INTO "daily_battle" ("userId", "day", "pokemonId", "state")
     VALUES ($1, $2, $3, $4)
     ON CONFLICT ("userId", "day") DO NOTHING
     RETURNING ${COLUMNS}`,
    [userId, day, pokemonId, JSON.stringify(state)],
  );
  return rows[0] ?? null;
}

export interface TurnResult<T> {
  state: BattleState;
  /** Quando a batalha acabou neste turno. */
  finish?: { status: Exclude<BattleStatus, 'active'>; bonus: number; xpGained: number };
  result: T;
}

/**
 * Aplica um turno na batalha ATIVA do dia, numa transação com `FOR UPDATE`:
 * duas abas jogando ao mesmo tempo serializam aqui, e a segunda vê o estado que
 * a primeira gravou (ou a batalha já encerrada).
 *
 * `fn` é síncrona e pura (o motor); se ela lançar, nada é gravado.
 * Null = não há batalha ativa hoje.
 */
export async function turn<T>(
  userId: string,
  day: string,
  fn: (record: BattleRecord) => TurnResult<T>,
): Promise<{ record: BattleRecord; result: T } | null> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<BattleRecord>(
      `SELECT ${COLUMNS} FROM "daily_battle"
        WHERE "userId" = $1 AND "day" = $2 AND "status" = 'active'
        FOR UPDATE`,
      [userId, day],
    );
    const current = rows[0];
    if (!current) {
      await client.query('ROLLBACK');
      return null;
    }

    const next = fn(current);
    const status = next.finish?.status ?? 'active';
    const bonus = next.finish?.bonus ?? 0;
    const xpGained = next.finish?.xpGained ?? 0;
    await client.query(
      `UPDATE "daily_battle"
          SET "state" = $3, "status" = $4, "bonus" = $5, "xpGained" = $6, "updatedAt" = now()
        WHERE "userId" = $1 AND "day" = $2`,
      [userId, day, JSON.stringify(next.state), status, bonus, xpGained],
    );
    await client.query('COMMIT');
    return {
      record: { ...current, state: next.state, status, bonus, xpGained },
      result: next.result,
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

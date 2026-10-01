import { pool } from '../auth.js';

/** Linha da tabela `daily_guess`. */
export interface GuessRecord {
  guess: string;
  correct: boolean;
  xpGained: number;
}

const COLUMNS = '"guess", "correct", "xpGained"';

export async function getDay(userId: string, day: string): Promise<GuessRecord | null> {
  const { rows } = await pool.query<GuessRecord>(
    `SELECT ${COLUMNS} FROM "daily_guess" WHERE "userId" = $1 AND "day" = $2`,
    [userId, day],
  );
  return rows[0] ?? null;
}

/**
 * Grava o palpite do dia. `ON CONFLICT DO NOTHING` faz da chance única uma
 * garantia do banco: duas abas chutando juntas, só uma entra.
 * Null = já houve palpite hoje.
 */
export async function submit(
  userId: string,
  day: string,
  guess: string,
  correct: boolean,
  xpGained: number,
): Promise<GuessRecord | null> {
  const { rows } = await pool.query<GuessRecord>(
    `INSERT INTO "daily_guess" ("userId", "day", "guess", "correct", "xpGained")
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT ("userId", "day") DO NOTHING
     RETURNING ${COLUMNS}`,
    [userId, day, guess, correct, xpGained],
  );
  return rows[0] ?? null;
}

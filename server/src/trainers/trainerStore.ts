import { nanoid } from 'nanoid';
import type { PoolClient } from 'pg';
import { pool } from '../auth.js';

/** Linha da tabela `trainer_pokemon`. */
export interface PokemonRecord {
  id: string;
  userId: string;
  lineId: string;
  branchId: number | null;
  xp: number;
  isActive: boolean;
}

const COLUMNS = '"id", "userId", "lineId", "branchId", "xp", "isActive"';

export async function listByUser(userId: string): Promise<PokemonRecord[]> {
  const { rows } = await pool.query<PokemonRecord>(
    `SELECT ${COLUMNS} FROM "trainer_pokemon"
      WHERE "userId" = $1
      ORDER BY "caughtAt" ASC`,
    [userId],
  );
  return rows;
}

export async function findById(id: string): Promise<PokemonRecord | null> {
  const { rows } = await pool.query<PokemonRecord>(
    `SELECT ${COLUMNS} FROM "trainer_pokemon" WHERE "id" = $1`,
    [id],
  );
  return rows[0] ?? null;
}

/**
 * `start` existe para a captura: um Pokémon pego já evoluído nasce com o XP do
 * estágio (e com o ramo, se for uma forma ramificada). `db` deixa a captura
 * inserir dentro da transação dela.
 */
export async function create(
  userId: string,
  lineId: string,
  isActive: boolean,
  start: { xp: number; branchId: number | null } = { xp: 0, branchId: null },
  db: Pick<PoolClient, 'query'> = pool,
): Promise<PokemonRecord> {
  const { rows } = await db.query<PokemonRecord>(
    `INSERT INTO "trainer_pokemon" ("id", "userId", "lineId", "isActive", "xp", "branchId")
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${COLUMNS}`,
    [nanoid(12), userId, lineId, isActive, start.xp, start.branchId],
  );
  return rows[0];
}

/**
 * Escolha do ramo (a pedra do Eevee, Oddish, Wurmple…). O `branchId is null` na cláusula faz a finalidade
 * ser garantida pelo BANCO, não por uma checagem na aplicação que poderia perder
 * uma corrida entre duas abas.
 */
export async function setBranch(
  id: string,
  branchId: number,
): Promise<PokemonRecord | null> {
  const { rows } = await pool.query<PokemonRecord>(
    `UPDATE "trainer_pokemon"
        SET "branchId" = $2, "updatedAt" = now()
      WHERE "id" = $1 AND "branchId" IS NULL
      RETURNING ${COLUMNS}`,
    [id, branchId],
  );
  return rows[0] ?? null;
}

/**
 * Incremento RELATIVO, nunca um total absoluto: duas salas do mesmo usuário
 * revelando ao mesmo tempo não podem perder um award, e um flush atrasado não
 * pode ressuscitar XP de um Pokémon que já foi liberado (a linha não existe
 * mais, então o UPDATE simplesmente não pega nada).
 */
export async function addXp(id: string, delta: number): Promise<void> {
  await pool.query(
    `UPDATE "trainer_pokemon"
        SET "xp" = "xp" + $2, "updatedAt" = now()
      WHERE "id" = $1`,
    [id, delta],
  );
}

/**
 * Troca o ativo em TRANSAÇÃO. O índice parcial é checado por statement, então
 * desligar todos antes de ligar o escolhido nunca conflita.
 */
export async function setActive(userId: string, id: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE "trainer_pokemon" SET "isActive" = false, "updatedAt" = now()
        WHERE "userId" = $1 AND "isActive"`,
      [userId],
    );
    await client.query(
      `UPDATE "trainer_pokemon" SET "isActive" = true, "updatedAt" = now()
        WHERE "id" = $1 AND "userId" = $2`,
      [id, userId],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function remove(id: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    'DELETE FROM "trainer_pokemon" WHERE "id" = $1',
    [id],
  );
  return (rowCount ?? 0) > 0;
}

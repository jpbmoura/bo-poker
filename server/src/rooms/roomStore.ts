import { pool } from '../auth.js';

/** Linha da tabela `room`, já com os campos derivados do usuário que consultou. */
export interface RoomRecord {
  id: string;
  name: string;
  ownerId: string;
  createdAt: Date;
}

export interface RoomListItem extends RoomRecord {
  isFavorite: boolean;
}

/**
 * Alfabeto sem caracteres ambíguos (nada de O/0, I/1). Migrou do cliente para
 * cá quando a criação da sala virou responsabilidade do servidor — o id agora
 * é a PK de uma tabela, então quem gera precisa poder detectar colisão.
 */
const ROOM_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_ID_LENGTH = 8;
const MAX_ID_ATTEMPTS = 5;
/** Violação de unique/PK no Postgres. */
const UNIQUE_VIOLATION = '23505';

function generateRoomId(): string {
  let id = '';
  for (let i = 0; i < ROOM_ID_LENGTH; i++) {
    id += ROOM_ID_ALPHABET[Math.floor(Math.random() * ROOM_ID_ALPHABET.length)];
  }
  return id;
}

export async function findById(id: string): Promise<RoomRecord | null> {
  const { rows } = await pool.query<RoomRecord>(
    'SELECT "id", "name", "ownerId", "createdAt" FROM "room" WHERE "id" = $1',
    [id],
  );
  return rows[0] ?? null;
}

export async function findByIdForUser(
  id: string,
  userId: string,
): Promise<RoomListItem | null> {
  const { rows } = await pool.query<RoomListItem>(
    `SELECT r."id", r."name", r."ownerId", r."createdAt",
            (f."userId" IS NOT NULL) AS "isFavorite"
       FROM "room" r
       LEFT JOIN "room_favorite" f ON f."roomId" = r."id" AND f."userId" = $2
      WHERE r."id" = $1`,
    [id, userId],
  );
  return rows[0] ?? null;
}

/**
 * As salas que o usuário criou OU favoritou. Dono primeiro, depois por nome —
 * a ordenação sai do banco para a home não precisar reordenar nada.
 */
export async function listForUser(userId: string): Promise<RoomListItem[]> {
  const { rows } = await pool.query<RoomListItem>(
    `SELECT r."id", r."name", r."ownerId", r."createdAt",
            (f."userId" IS NOT NULL) AS "isFavorite"
       FROM "room" r
       LEFT JOIN "room_favorite" f ON f."roomId" = r."id" AND f."userId" = $1
      WHERE r."ownerId" = $1 OR f."userId" IS NOT NULL
      ORDER BY (r."ownerId" = $1) DESC, lower(r."name") ASC`,
    [userId],
  );
  return rows;
}

/**
 * Gera o id e insere. A colisão é improvável (32^8), mas a PK é o próprio
 * código: sem o retry, o azar viraria um 500 na cara de quem clicou em criar.
 */
export async function create(name: string, ownerId: string): Promise<RoomRecord> {
  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt++) {
    const id = generateRoomId();
    try {
      const { rows } = await pool.query<RoomRecord>(
        `INSERT INTO "room" ("id", "name", "ownerId")
         VALUES ($1, $2, $3)
         RETURNING "id", "name", "ownerId", "createdAt"`,
        [id, name, ownerId],
      );
      return rows[0];
    } catch (err) {
      if ((err as { code?: string }).code === UNIQUE_VIOLATION) continue;
      throw err;
    }
  }
  throw new Error('[roomStore] não foi possível gerar um id de sala livre');
}

export async function rename(id: string, name: string): Promise<RoomRecord | null> {
  const { rows } = await pool.query<RoomRecord>(
    `UPDATE "room" SET "name" = $2, "updatedAt" = now()
      WHERE "id" = $1
      RETURNING "id", "name", "ownerId", "createdAt"`,
    [id, name],
  );
  return rows[0] ?? null;
}

/** O `cascade` da FK leva os favoritos junto. */
export async function remove(id: string): Promise<boolean> {
  const { rowCount } = await pool.query('DELETE FROM "room" WHERE "id" = $1', [id]);
  return (rowCount ?? 0) > 0;
}

export async function addFavorite(roomId: string, userId: string): Promise<void> {
  await pool.query(
    `INSERT INTO "room_favorite" ("roomId", "userId") VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [roomId, userId],
  );
}

export async function removeFavorite(roomId: string, userId: string): Promise<void> {
  await pool.query(
    'DELETE FROM "room_favorite" WHERE "roomId" = $1 AND "userId" = $2',
    [roomId, userId],
  );
}

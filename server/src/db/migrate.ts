import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { pool } from '../auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// dist/db/migrate.js -> <server>/migrations
const MIGRATIONS_DIR = resolve(__dirname, '..', '..', 'migrations');

/**
 * Runner mínimo: aplica os .sql em ordem lexical, cada um em transação, e
 * registra o que já rodou. Com 1 réplica não há concorrência a proteger.
 */
export async function migrate(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const applied = new Set(
    (await pool.query<{ name: string }>('SELECT name FROM _migrations')).rows.map(
      (r) => r.name,
    ),
  );

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`[migrate] aplicada: ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`[migrate] falhou em ${file}: ${(err as Error).message}`);
    } finally {
      client.release();
    }
  }
}

// Executado direto (preDeployCommand do Railway / pnpm db:migrate).
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  migrate()
    .then(() => pool.end())
    .then(() => {
      console.log('[migrate] ok');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

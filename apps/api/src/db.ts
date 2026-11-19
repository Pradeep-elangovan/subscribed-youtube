import pg from 'pg';
import { config } from './config.js';
import { SCHEMA_SQL } from './schema.js';

const serverless = Boolean(process.env.VERCEL);

// Serverless instances multiply, so each one keeps very few connections.
// Use your database's pooled connection string (Neon: the one with "-pooler" in the host).
export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: serverless ? 3 : 10,
  idleTimeoutMillis: serverless ? 10_000 : 30_000,
});

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await pool.query<T>(text, params);
  return result.rows;
}

export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Creates the tables if they don't exist. Runs in one transaction with a transaction-level advisory lock,
 * so many instances starting at once don't race, and it also works behind a transaction-mode pooler.
 */
async function applySchema(): Promise<void> {
  await withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(727274)');
    await client.query(SCHEMA_SQL);
  });
}

let schemaReady: Promise<void> | null = null;

/** Applies the schema once per process; retries on the next call if it failed. */
export function ensureSchema(): Promise<void> {
  schemaReady ??= applySchema().catch((err) => {
    schemaReady = null;
    throw err;
  });
  return schemaReady;
}

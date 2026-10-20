import pg, { type PoolClient, type QueryResultRow } from 'pg';
import { loadConfig } from './config.js';

const { Pool } = pg;
// Kembalikan kolom DATE sebagai 'YYYY-MM-DD' apa adanya; parser default mengubahnya ke Date lokal lalu UTC sehingga tanggal bergeser.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);
export type Role = 'patient' | 'researcher';
export interface AccountContext { id: string; role: Role }

const config = loadConfig();
export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  statement_timeout: 10_000,
  application_name: 'moodbite-api',
  ssl: config.DB_SSL ? { rejectUnauthorized: true } : undefined,
});

export async function withAccount<T>(
  account: AccountContext,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(
      "select set_config('app.account_id', $1, true), set_config('app.role', $2, true)",
      [account.id, account.role],
    );
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function rows<T extends QueryResultRow>(
  client: PoolClient,
  sql: string,
  values: unknown[] = [],
): Promise<T[]> {
  return (await client.query<T>(sql, values)).rows;
}

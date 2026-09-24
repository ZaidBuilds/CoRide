import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

/**
 * Postgres connection pool. Presence stays in Redis; durable state (profiles,
 * friendships, blocks, reports, requests, DMs, reads) moves here off the
 * single-file store.json.
 *
 * `DATABASE_URL` gates it: when unset, the app keeps using the file store, so
 * this can land before every read/write path is migrated (that's the next
 * pieces). `isDbEnabled()` is the switch callers check.
 */

const DATABASE_URL = process.env.DATABASE_URL;

export const pool: Pool | null = DATABASE_URL
  ? new Pool({ connectionString: DATABASE_URL, max: 10, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 })
  : null;

export function isDbEnabled(): boolean {
  return pool !== null;
}

if (pool) {
  // An idle-client error must not crash the process (mirrors the Redis guard).
  pool.on('error', (err) => console.error('[db] idle client error', err));
}

/** Apply init.sql (idempotent CREATE TABLE IF NOT EXISTS) on boot. */
export async function initSchema(): Promise<void> {
  if (!pool) return;
  const sqlPath = path.join(__dirname, '..', '..', 'init.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  await pool.query(sql);
  console.log('[db] schema ensured');
}

/** Liveness probe used by the /health check and boot. */
export async function pingDb(): Promise<boolean> {
  if (!pool) return false;
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (err) {
    console.error('[db] ping failed', err);
    return false;
  }
}

/** Shutdown: release pooled connections. */
export async function closeDb(): Promise<void> {
  if (!pool) return;
  try { await pool.end(); } catch (err) { console.error('[db] close failed', err); }
}

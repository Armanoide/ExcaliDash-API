import { Pool } from 'pg'
import { config } from '../config'

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

pool.on('error', (err) => {
  console.error('[db] unexpected error on idle client:', err.message)
})

export async function initDb(): Promise<void> {
  await pool.query('SELECT 1')
  console.log('[db] connection established')
}

export async function createSessionsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS api_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      excalidash_user_id TEXT NOT NULL,
      excalidash_email TEXT NOT NULL,
      excalidash_user_name TEXT,
      cookies TEXT NOT NULL DEFAULT '[]',
      csrf_token TEXT NOT NULL DEFAULT '',
      api_jwt_sub TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL
    )
  `)
  // Migrate: drop password column if it exists (from v1)
  await pool.query(`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'api_sessions' AND column_name = 'password'
      ) THEN
        ALTER TABLE api_sessions DROP COLUMN password;
      END IF;
    END $$
  `)
  // Cleanup expired sessions
  await pool.query('DELETE FROM api_sessions WHERE expires_at < now()')
  console.log('[db] api_sessions table ready')
}

export function getPool(): Pool {
  return pool
}

export async function endPool(): Promise<void> {
  await pool.end()
}

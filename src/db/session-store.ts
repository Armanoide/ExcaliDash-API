import { Pool } from 'pg'
import { config } from '../config'
import { fetchWithTimeout } from '../utils/http'

export interface SessionData {
  userId: string
  email: string
  name: string | null
  cookies: string[]
  csrfToken: string
  password: string
}

export class SessionStore {
  constructor(private pool: Pool) {}

  async save(jwtSub: string, user: { id: string; email: string; name?: string }, password: string, cookies: string[], csrfToken: string, expiresInMs: number): Promise<void> {
    const now = new Date().toISOString()
    const expiresAt = new Date(Date.now() + expiresInMs).toISOString()
    await this.pool.query(`
      INSERT INTO api_sessions (api_jwt_sub, excalidash_user_id, excalidash_email, excalidash_user_name, cookies, csrf_token, password, expires_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (api_jwt_sub) DO UPDATE SET
        excalidash_user_id = EXCLUDED.excalidash_user_id,
        excalidash_email = EXCLUDED.excalidash_email,
        excalidash_user_name = EXCLUDED.excalidash_user_name,
        cookies = EXCLUDED.cookies,
        csrf_token = EXCLUDED.csrf_token,
        password = EXCLUDED.password,
        expires_at = EXCLUDED.expires_at,
        updated_at = EXCLUDED.updated_at
    `, [
      jwtSub,
      user.id || '',
      user.email || '',
      user.name || null,
      JSON.stringify(cookies),
      csrfToken,
      password,
      expiresAt,
      now,
      now,
    ])
  }

  async get(jwtSub: string): Promise<SessionData | null> {
    const { rows } = await this.pool.query(
      'SELECT * FROM api_sessions WHERE api_jwt_sub = $1 AND expires_at > now()',
      [jwtSub],
    )
    if (rows.length === 0) return null
    const row = rows[0]
    return {
      userId: row.excalidash_user_id,
      email: row.excalidash_email,
      name: row.excalidash_user_name,
      cookies: JSON.parse(row.cookies),
      csrfToken: row.csrf_token,
      password: row.password,
    }
  }

  async updateCookies(jwtSub: string, cookies: string[], csrfToken: string): Promise<void> {
    await this.pool.query(
      'UPDATE api_sessions SET cookies = $1, csrf_token = $2, updated_at = now() WHERE api_jwt_sub = $3',
      [JSON.stringify(cookies), csrfToken, jwtSub],
    )
  }

  async delete(jwtSub: string): Promise<void> {
    await this.pool.query('DELETE FROM api_sessions WHERE api_jwt_sub = $1', [jwtSub])
  }
}

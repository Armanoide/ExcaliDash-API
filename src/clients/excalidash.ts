import { config } from '../config'
import { fetchWithTimeout } from '../utils/http'
import { SessionStore } from '../db/session-store'

export interface ExcalidashUser {
  id: string
  email: string
  name?: string
}

export class ExcalidashClient {
  private cookies: string[] = []
  private csrfToken: string | null = null
  private csrfHeader: string = 'x-csrf-token'
  private user: ExcalidashUser | null = null

  constructor(
    private baseUrl: string,
    private jwtSub: string,
    private store: SessionStore,
  ) {}

  // ---- Public API ----

  async load(): Promise<boolean> {
    const saved = await this.store.get(this.jwtSub)
    if (saved) {
      this.cookies = saved.cookies
      this.csrfToken = saved.csrfToken
      this.user = { id: saved.userId, email: saved.email, name: saved.name || undefined }
      return true
    }
    return false
  }

  async login(email: string, password: string): Promise<ExcalidashUser> {
    await this.doLogin(email, password)
    if (!this.user) {
      throw new Error('Login failed: no user returned')
    }
    return this.user
  }

  async get(path: string): Promise<unknown> {
    return this.withRetry(async () => {
      const res = await fetchWithTimeout(`${this.baseUrl}${path}`, {
        headers: {
          Cookie: this.cookies.join('; '),
          'Content-Type': 'application/json',
        },
      })
      if (res.status === 401) throw { status: 401 }
      return this.parseJson(res, `GET ${path}`)
    })
  }

  async post(path: string, body: unknown): Promise<unknown> {
    return this.withRetry(async () => {
      await this.ensureCsrf()
      const res = await fetchWithTimeout(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: this.csrfHeaders(),
        body: JSON.stringify(body),
      })
      if (res.status === 401) throw { status: 401 }
      return this.parseJson(res, `POST ${path}`)
    })
  }

  async put(path: string, body: unknown): Promise<unknown> {
    return this.withRetry(async () => {
      await this.ensureCsrf()
      const res = await fetchWithTimeout(`${this.baseUrl}${path}`, {
        method: 'PUT',
        headers: this.csrfHeaders(),
        body: JSON.stringify(body),
      })
      if (res.status === 401) throw { status: 401 }
      return this.parseJson(res, `PUT ${path}`)
    })
  }

  async del(path: string): Promise<unknown> {
    return this.withRetry(async () => {
      await this.ensureCsrf()
      const res = await fetchWithTimeout(`${this.baseUrl}${path}`, {
        method: 'DELETE',
        headers: this.csrfHeaders(),
      })
      if (res.status === 401) throw { status: 401 }
      return this.parseJson(res, `DELETE ${path}`)
    })
  }

  getUser(): ExcalidashUser | null {
    return this.user
  }

  getCookies(): string[] {
    return this.cookies
  }

  getCsrfToken(): string | null {
    return this.csrfToken
  }

  // ---- Internal ----

  private async doLogin(email: string, password: string): Promise<void> {
    await this.ensureCsrf()
    const res = await fetchWithTimeout(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: config.frontendUrl,
        Referer: `${config.frontendUrl}/`,
        [this.csrfHeader]: this.csrfToken!,
        Cookie: this.cookies.join('; '),
      },
      body: JSON.stringify({ email, password }),
    })

    const loginCookies = res.headers.get('set-cookie')
    if (loginCookies) this.updateCookies(loginCookies)

    const data = await res.json()
    if (res.status !== 200 || !data.user) {
      throw new Error(`Login failed: ${res.status}`)
    }
    this.user = data.user
  }

  private async ensureCsrf(): Promise<void> {
    if (this.csrfToken) return
    const res = await fetchWithTimeout(`${this.baseUrl}/csrf-token`, {
      headers: {
        Origin: config.frontendUrl,
        Referer: `${config.frontendUrl}/`,
        Cookie: this.cookies.join('; '),
      },
    })
    const setCookie = res.headers.get('set-cookie')
    if (setCookie) this.updateCookies(setCookie)
    const data = await res.json()
    this.csrfToken = data.token
    this.csrfHeader = data.header || 'x-csrf-token'
  }

  private async withRetry(fn: () => Promise<unknown>): Promise<unknown> {
    try {
      const result = await fn()
      await this.persist()
      return result
    } catch (err) {
      if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 401) {
        throw new Error('Session expired, please login again')
      }
      throw err
    }
  }

  private async persist(): Promise<void> {
    await this.store.updateCookies(this.jwtSub, this.cookies, this.csrfToken || '')
  }

  private updateCookies(setCookieHeader: string): void {
    const parts = setCookieHeader.split(', excalidash-')
    for (let i = 0; i < parts.length; i++) {
      const raw = i === 0 ? parts[i] : 'excalidash-' + parts[i]
      const semiIdx = raw.indexOf(';')
      const pair = semiIdx > 0 ? raw.substring(0, semiIdx).trim() : raw.trim()
      const name = pair.split('=')[0].trim()
      if (name.includes('access-token') || name.includes('refresh-token') || name.includes('csrf-client')) {
        const idx = this.cookies.findIndex(c => c.split('=')[0].trim() === name)
        if (idx >= 0) {
          this.cookies[idx] = pair
        } else {
          this.cookies.push(pair)
        }
      }
    }
  }

  private csrfHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Origin: config.frontendUrl,
      Referer: `${config.frontendUrl}/`,
      [this.csrfHeader]: this.csrfToken || '',
      Cookie: this.cookies.join('; '),
    }
  }

  private async parseJson(res: Response, label: string): Promise<unknown> {
    const data = await res.json()
    if (!res.ok) throw new Error(`${label} failed: ${res.status}`)
    return data
  }
}

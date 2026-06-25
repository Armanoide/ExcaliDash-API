// Configuration — mirrors ExcaliDash backend/src/config.ts pattern

export interface Config {
  backend: string
  frontendUrl: string
  requestTimeout: number
  jwtSecret: string
  apiJwtExpiresIn: string
  apiRefreshExpiresIn: string
  databaseUrl: string
  port: number
}

function parseBackend(raw: string): string {
  return raw.startsWith('http') ? raw : `http://${raw}`
}

function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)(s|m|h|d)$/i)
  if (!match) return 3600000
  const [, val, unit] = match
  const n = parseInt(val)
  switch (unit.toLowerCase()) {
    case 's': return n * 1000
    case 'm': return n * 60 * 1000
    case 'h': return n * 3600 * 1000
    case 'd': return n * 86400 * 1000
    default: return 3600000
  }
}

function load(): Config {
  const backendUrl = process.env.BACKEND_URL || 'excalidash_backend:8000'
  const jwtSecret = process.env.JWT_SECRET
  const databaseUrl = process.env.DATABASE_URL

  if (!jwtSecret) {
    console.error('ERROR: JWT_SECRET environment variable is required')
    process.exit(1)
  }
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL environment variable is required')
    process.exit(1)
  }

  return {
    backend: parseBackend(backendUrl),
    frontendUrl: process.env.FRONTEND_URL || backendUrl,
    requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '15000'),
    jwtSecret,
    apiJwtExpiresIn: process.env.API_JWT_EXPIRES_IN || '1h',
    apiRefreshExpiresIn: process.env.API_REFRESH_EXPIRES_IN || '7d',
    databaseUrl,
    port: parseInt(process.env.PORT || '3000'),
  }
}

export const config = load()

// Pre-computed durations
export const jwtExpiresMs = parseDuration(config.apiJwtExpiresIn)
export const refreshExpiresMs = parseDuration(config.apiRefreshExpiresIn)

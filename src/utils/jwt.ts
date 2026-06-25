import jwt from 'jsonwebtoken'
import { config, jwtExpiresMs, refreshExpiresMs } from '../config'

export interface JwtPayload {
  sub: string
  userId?: string
  email?: string
  name?: string
  type?: string
}

export function signJwt(payload: JwtPayload, expiresIn = config.apiJwtExpiresIn): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: expiresIn as never })
}

export function signRefreshToken(sub: string): string {
  return jwt.sign({ sub, type: 'refresh' }, config.jwtSecret, { expiresIn: config.apiRefreshExpiresIn as never })
}

export function verifyJwt(token: string): JwtPayload {
  return jwt.verify(token, config.jwtSecret) as JwtPayload
}

export function jwtExpiresSeconds(): number {
  return Math.floor(jwtExpiresMs / 1000)
}

export function refreshExpiresSeconds(): number {
  return Math.floor(refreshExpiresMs / 1000)
}

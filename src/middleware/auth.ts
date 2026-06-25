import { Request, Response, NextFunction } from 'express'
import { verifyJwt, JwtPayload } from '../utils/jwt'

export interface AuthRequest extends Request {
  apiUser?: JwtPayload
  apiJwtSub?: string
}

/**
 * Verify JWT token from Authorization header.
 * Must be used before any protected route.
 */
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' })
    return
  }

  try {
    const decoded = verifyJwt(auth.substring(7))
    req.apiUser = decoded
    req.apiJwtSub = decoded.sub
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

import { Request, Response, NextFunction } from 'express'
import { safeError } from '../utils/http'

const SESSION_EXPIRED_MSG = 'Session expired, please login again'

/**
 * Centralized error handler for drawing routes.
 * Catches errors, checks for session expiry, and returns appropriate responses.
 */
export async function withDrawingHandler(
  fn: (req: Request, res: Response) => Promise<void>,
): Promise<(req: Request, res: Response, next: NextFunction) => Promise<void>> {
  return async (req, res, next) => {
    try {
      await fn(req, res)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message === SESSION_EXPIRED_MSG) {
        res.status(401).json({ error: SESSION_EXPIRED_MSG })
        return
      }
      console.error('[api] route error:', message)
      res.status(500).json({ error: safeError(err) })
    }
  }
}

/**
 * Global error handler — catches unhandled errors and Express errors.
 */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error('[api] unhandled error:', err.message)
  if (res.headersSent) return
  res.status(500).json({ error: safeError(err) })
}

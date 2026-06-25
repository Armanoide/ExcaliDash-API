import { Router, Request, Response } from 'express'
import rateLimit from 'express-rate-limit'
import { config } from '../config'
import { getPool } from '../db/pool'
import { SessionStore } from '../db/session-store'
import { ExcalidashClient } from '../clients/excalidash'
import { signJwt, signRefreshToken, verifyJwt, jwtExpiresSeconds } from '../utils/jwt'
import { AuthRequest, requireAuth } from '../middleware/auth'
import { randomUUID } from 'crypto'

const router = Router()
const store = new SessionStore(getPool())

// Re-export parseDuration from config to avoid duplication
const { parseDuration } = require('../config')

// Max JWT expiry: 24 hours
const MAX_JWT_EXPIRY_MS = 24 * 3600 * 1000

// Rate limiting: 10 requests per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later' },
})

// POST /auth/login (public)
/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login and get JWT token
 *     description: Authenticate with email/password and receive a JWT access token + refresh token. Rate limited to 10 attempts per 15 minutes.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         description: Missing email or password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       429:
 *         description: Too many login attempts
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/login', loginLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, expiresIn = config.apiJwtExpiresIn } = req.body

    if (!email || !password) {
      res.status(400).json({ error: 'email and password required' })
      return
    }

    const jwtSub = randomUUID()
    const client = new ExcalidashClient(config.backend, jwtSub, store)
    const user = await client.login(email, password)

    // Cap maximum expiration at 24 hours
    const rawExpiresIn = parseDuration(expiresIn as string)
    const parsedExpiresIn = Math.min(rawExpiresIn, MAX_JWT_EXPIRY_MS)

    await store.save(jwtSub, user, client.getCookies(), client.getCsrfToken() ?? '', parsedExpiresIn)

    const token = signJwt({
      sub: jwtSub,
      userId: user.id,
      email: user.email,
      name: user.name ?? undefined,
    }, expiresIn)

    const refreshToken = signRefreshToken(jwtSub)

    res.json({
      token,
      refreshToken,
      expiresIn: Math.floor(parsedExpiresIn / 1000),
      user: { id: user.id, email: user.email, name: user.name ?? undefined },
    })
  } catch {
    res.status(401).json({ error: 'Invalid credentials' })
  }
})

// POST /auth/refresh (public)
/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh JWT token
 *     description: Get a new access token using a valid refresh token.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshRequest'
 *     responses:
 *       200:
 *         description: Token refreshed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token: { type: string, description: 'New JWT access token' }
 *                 expiresIn: { type: integer, description: 'Expiration in seconds' }
 *       400:
 *         description: Missing or invalid refresh token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Session expired
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken: refreshTokenValue } = req.body
    if (!refreshTokenValue) {
      res.status(400).json({ error: 'refreshToken required' })
      return
    }

    const decoded = verifyJwt(refreshTokenValue)
    if (decoded.type !== 'refresh') {
      res.status(400).json({ error: 'Invalid refresh token' })
      return
    }

    const session = await store.get(decoded.sub)
    if (!session) {
      res.status(401).json({ error: 'Session expired, please login again' })
      return
    }

    const token = signJwt({
      sub: decoded.sub,
      userId: session.userId,
      email: session.email,
      name: session.name ?? undefined,
    }, config.apiJwtExpiresIn)

    res.json({
      token,
      expiresIn: jwtExpiresSeconds(),
    })
  } catch {
    res.status(401).json({ error: 'Invalid or expired refresh token' })
  }
})

// GET /auth/me (protected)
/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current user profile
 *     description: Returns the authenticated user's profile information.
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: User profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Session expired or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/me', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const session = await store.get(req.apiJwtSub!)
    if (!session) {
      res.status(401).json({ error: 'Session expired, please login again' })
      return
    }
    res.json({ id: session.userId, email: session.email, name: session.name ?? undefined })
  } catch (err) {
    const { safeError } = await import('../utils/http')
    res.status(500).json({ error: safeError(err) })
  }
})

// DELETE /auth/logout (protected)
/**
 * @swagger
 * /auth/logout:
 *   delete:
 *     summary: Logout. Destroy current session
 *     description: Invalidates the current session.
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Logged out successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: 'Logged out' }
 *       401:
 *         description: Invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete('/logout', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await store.delete(req.apiJwtSub!)
    res.json({ message: 'Logged out' })
  } catch (err) {
    const { safeError } = await import('../utils/http')
    res.status(500).json({ error: safeError(err) })
  }
})

export default router

import { Router, Request, Response, NextFunction } from 'express'
import { config } from '../config'
import { getPool } from '../db/pool'
import { SessionStore } from '../db/session-store'
import { ExcalidashClient } from '../clients/excalidash'
import { graphToElements, GraphInput } from '../converters/graph-to-elements'
import { AuthRequest } from '../middleware/auth'
import { safeError } from '../utils/http'

const router = Router()
const store = new SessionStore(getPool())

const SESSION_EXPIRED_MSG = 'Session expired, please login again'

/**
 * Helper to load user's Excalidash session.
 */
async function loadSession(jwtSub: string): Promise<ExcalidashClient | null> {
  const client = new ExcalidashClient(config.backend, jwtSub, store)
  return (await client.load()) ? client : null
}

/**
 * Wrap async route handler with error handling.
 */
function handle(fn: (req: AuthRequest, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): Promise<void> => {
    return fn(req as AuthRequest, res).catch(err => {
      const message = err instanceof Error ? err.message : String(err)
      if (message === SESSION_EXPIRED_MSG) {
        res.status(401).json({ error: SESSION_EXPIRED_MSG })
        return
      }
      console.error('[api] route error:', message)
      res.status(500).json({ error: safeError(err) })
    })
  }
}

/**
 * @swagger
 * /drawing:
 *   post:
 *     summary: Create a new diagram from GraphJSON
 *     description: |
 *       Creates a new Excalidash drawing from a GraphJSON structure.
 *       The graph is automatically laid out using the dagre library.
 *
 *       **GraphJSON format:**
 *       - `nodes`: Array of `{id, label, width?, height?, style?}`
 *       - `edges`: Array of `{id?, from, to, label?, style?}`
 *       - `direction`: 'TB' | 'LR' | 'BT' | 'RL' (default: 'TB')
 *       - `spacing`: `{node?, edge?}` (default: 30/10)
 *
 *       **Example:**
 *       ```json
 *       {
 *         "name": "My Diagram",
 *         "graph": {
 *           "nodes": [
 *             { "id": "a", "label": "Node A" },
 *             { "id": "b", "label": "Node B" }
 *           ],
 *           "edges": [
 *             { "from": "a", "to": "b", "label": "connects" }
 *           ],
 *           "direction": "TB"
 *         }
 *       }
 *       ```
 *     tags: [Drawings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateDrawingRequest'
 *     responses:
 *       200:
 *         description: Drawing created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreateDrawingResponse'
 *       400:
 *         description: Missing graph.nodes
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
router.post('/drawing', handle(async (req: AuthRequest, res: Response): Promise<void> => {
  const sess = await loadSession(req.apiJwtSub!)
  if (!sess) {
    res.status(401).json({ error: 'Session expired, please login again' })
    return
  }

  const { name, graph, collectionId } = req.body as { name?: string; graph?: GraphInput; collectionId?: string }

  if (!graph || !graph.nodes) {
    res.status(400).json({ error: 'Missing graph.nodes in request body' })
    return
  }

  const elements = graphToElements(graph)
  const fileName = name || `diagram-${Date.now()}`
  const data = await sess.post('/drawings', {
    name: fileName,
    collectionId: collectionId || null,
    elements,
    appState: { viewBackgroundColor: '#ffffff' },
  })

  res.json({ id: (data as { id: string }).id, name: fileName, elements: elements.length })
}))

/**
 * @swagger
 * /drawings:
 *   get:
 *     summary: List all drawings
 *     description: Returns a list of all drawings for the authenticated user.
 *     tags: [Drawings]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Filter drawings by name
 *       - in: query
 *         name: collectionId
 *         schema:
 *           type: string
 *         description: Filter by collection ID
 *       - in: query
 *         name: includeData
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include full drawing data (elements, appState)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Maximum number of drawings to return
 *     responses:
 *       200:
 *         description: List of drawings
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Drawing'
 *       401:
 *         description: Session expired
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/drawings', handle(async (req: AuthRequest, res: Response): Promise<void> => {
  const sess = await loadSession(req.apiJwtSub!)
  if (!sess) {
    res.status(401).json({ error: 'Session expired, please login again' })
    return
  }

  const { search, collectionId, includeData, limit } = req.query
  let path = '/drawings?'
  if (search && typeof search === 'string') path += `search=${encodeURIComponent(search)}&`
  if (collectionId && typeof collectionId === 'string') path += `collectionId=${encodeURIComponent(collectionId)}&`
  path += `includeData=${includeData === 'true'}`
  if (limit && typeof limit === 'string') path += `&limit=${limit}`

  const data = await sess.get(path)
  res.json(data)
}))

/**
 * @swagger
 * /drawing/{id}:
 *   get:
 *     summary: Get a specific drawing
 *     description: Returns the full drawing data including elements and appState.
 *     tags: [Drawings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Drawing ID
 *     responses:
 *       200:
 *         description: Drawing data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Drawing'
 *       401:
 *         description: Session expired
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Drawing not found
 *   put:
 *     summary: Update a drawing
 *     description: |
 *       Update drawing properties. Only provided fields are updated.
 *       Supports updating name, elements, appState, and collectionId.
 *     tags: [Drawings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Drawing ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateDrawingRequest'
 *     responses:
 *       200:
 *         description: Drawing updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string }
 *                 name: { type: string }
 *                 version: { type: integer }
 *       401:
 *         description: Session expired
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   delete:
 *     summary: Delete a drawing
 *     description: Permanently deletes the specified drawing.
 *     tags: [Drawings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Drawing ID
 *     responses:
 *       200:
 *         description: Drawing deleted
 *       401:
 *         description: Session expired
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/drawing/:id', handle(async (req: AuthRequest, res: Response): Promise<void> => {
  const sess = await loadSession(req.apiJwtSub!)
  if (!sess) {
    res.status(401).json({ error: 'Session expired, please login again' })
    return
  }

  const data = await sess.get(`/drawings/${req.params.id}`)
  res.json(data)
}))

router.put('/drawing/:id', handle(async (req: AuthRequest, res: Response): Promise<void> => {
  const sess = await loadSession(req.apiJwtSub!)
  if (!sess) {
    res.status(401).json({ error: 'Session expired, please login again' })
    return
  }

  const { name, elements, appState, collectionId } = req.body
  const payload: Record<string, unknown> = {}
  if (name !== undefined) payload.name = name
  if (elements !== undefined) payload.elements = elements
  if (appState !== undefined) payload.appState = appState
  if (collectionId !== undefined) payload.collectionId = collectionId

  const data = await sess.put(`/drawings/${req.params.id}`, payload)
  res.json({ id: (data as { id: string }).id, name: (data as { name: string }).name, version: (data as { version: number }).version })
}))

router.delete('/drawing/:id', handle(async (req: AuthRequest, res: Response): Promise<void> => {
  const sess = await loadSession(req.apiJwtSub!)
  if (!sess) {
    res.status(401).json({ error: 'Session expired, please login again' })
    return
  }

  const data = await sess.del(`/drawings/${req.params.id}`)
  res.json(data)
}))

/**
 * @swagger
 * /drawing/{id}/duplicate:
 *   post:
 *     summary: Duplicate a drawing
 *     description: Creates a copy of the specified drawing with the same content.
 *     tags: [Drawings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Drawing ID to duplicate
 *     responses:
 *       200:
 *         description: Drawing duplicated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string, description: 'New drawing ID' }
 *                 name: { type: string, description: 'New drawing name' }
 *       401:
 *         description: Session expired
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/drawing/:id/duplicate', handle(async (req: AuthRequest, res: Response): Promise<void> => {
  const sess = await loadSession(req.apiJwtSub!)
  if (!sess) {
    res.status(401).json({ error: 'Session expired, please login again' })
    return
  }

  const data = await sess.post(`/drawings/${req.params.id}/duplicate`, {})
  res.json({ id: (data as { id: string }).id, name: (data as { name: string }).name })
}))

/**
 * @swagger
 * /drawing/{id}/share:
 *   post:
 *     summary: Share drawing with a user
 *     description: |
 *       Grants another user access to the drawing. The target user is resolved
 *       by email or name. If multiple users match, the first match is used.
 *     tags: [Sharing]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Drawing ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ShareUserRequest'
 *     responses:
 *       200:
 *         description: Sharing granted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 drawingId: { type: string }
 *                 permission: { type: string, enum: ['view', 'edit'] }
 *                 grantee:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     name: { type: string }
 *                     email: { type: string }
 *       400:
 *         description: Missing userEmail or userName
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/drawing/:id/share', handle(async (req: AuthRequest, res: Response): Promise<void> => {
  const sess = await loadSession(req.apiJwtSub!)
  if (!sess) {
    res.status(401).json({ error: 'Session expired, please login again' })
    return
  }

  const { userEmail, userName, permission = 'view' } = req.body as { userEmail?: string; userName?: string; permission?: string }

  if (!userEmail && !userName) {
    res.status(400).json({ error: 'userEmail or userName required' })
    return
  }

  const query = userEmail || userName
    const resolved = await sess.get(`/drawings/${req.params.id}/share-resolve?q=${encodeURIComponent(String(query))}`) as { users?: { id: string; email: string; name: string }[] }

  if (!resolved.users || resolved.users.length === 0) {
    res.status(404).json({ error: 'User not found', query })
    return
  }

  const target = resolved.users.find(u => userEmail && u.email === userEmail)
    || resolved.users.find(u => userName && u.name === userName)
    || resolved.users[0]

  const data = await sess.post(`/drawings/${req.params.id}/permissions`, {
    granteeUserId: target.id,
    permission,
  }) as { permission: { permission: string; granteeUser: { id: string; name: string; email: string } } }

  res.json({
    drawingId: req.params.id,
    permission: data.permission.permission,
    grantee: data.permission.granteeUser,
  })
}))

/**
 * @swagger
 * /drawing/{id}/share-link:
 *   post:
 *     summary: Create a shareable link
 *     description: Generates a public share link for the drawing.
 *     tags: [Sharing]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Drawing ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ShareLinkRequest'
 *     responses:
 *       200:
 *         description: Share link created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 drawingId: { type: string }
 *                 permission: { type: string, enum: ['view', 'edit'] }
 *                 expiresAt: { type: string, format: date-time, nullable: true }
 *                 url: { type: string, format: uri }
 *       401:
 *         description: Session expired
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/drawing/:id/share-link', handle(async (req: AuthRequest, res: Response): Promise<void> => {
  const sess = await loadSession(req.apiJwtSub!)
  if (!sess) {
    res.status(401).json({ error: 'Session expired, please login again' })
    return
  }

  const { permission = 'view' } = req.body as { permission?: string }
  const data = await sess.post(`/drawings/${req.params.id}/link-shares`, { permission }) as { share: { permission: string; expiresAt: string | null } }

  res.json({
    drawingId: req.params.id,
    permission: data.share.permission,
    expiresAt: data.share.expiresAt,
    url: `https://draw.armanoide.net/drawing/${req.params.id}`,
  })
}))

/**
 * @swagger
 * /drawing/{id}/sharing:
 *   get:
 *     summary: Get sharing status
 *     description: Returns the current sharing configuration for the drawing (users with access and public link status).
 *     tags: [Sharing]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Drawing ID
 *     responses:
 *       200:
 *         description: Sharing status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               description: Sharing configuration (permissions list, link share status)
 *       401:
 *         description: Session expired
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/drawing/:id/sharing', handle(async (req: AuthRequest, res: Response): Promise<void> => {
  const sess = await loadSession(req.apiJwtSub!)
  if (!sess) {
    res.status(401).json({ error: 'Session expired, please login again' })
    return
  }

  const data = await sess.get(`/drawings/${req.params.id}/sharing`)
  res.json(data)
}))

export default router

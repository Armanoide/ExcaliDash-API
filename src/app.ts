import express from 'express'
import cors from 'cors'
import { config } from './config'
import { errorHandler } from './middleware/errorHandler'
import { requireAuth } from './middleware/auth'
import authRoutes from './routes/auth'
import drawingsRoutes from './routes/drawings'
import { swaggerSpec } from './config/openapi'

const app = express()

// Global middleware
app.use(cors({
  origin: config.frontendUrl,
  exposedHeaders: ['Authorization', 'Content-Length'],
  optionsSuccessStatus: 204,
}))
app.use(express.json({ limit: '1mb' }))

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// API Documentation (public, no auth required)
app.get('/docs/json', (_req, res) => {
  res.json(swaggerSpec)
})

// Scalar UI — serves the interactive API docs page
app.get('/docs', (_req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>ExcaliDash API Docs</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
  <div id="api-reference"></div>
  <script>
    document.addEventListener('DOMContentLoaded', () => {
      const config = {
        spec: { url: '/docs/json' },
        theme: 'alternate',
        darkMode: true,
        hideModels: false,
        defaultOpenAll: true,
      }
      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.27.0'
      script.onload = () => {
        Scalar.createDocument('api-reference', config)
      }
      document.head.appendChild(script)
    })
  </script>
</body>
</html>
  `.trim())
})

// Auth routes (login/refresh are public, me/logout require auth)
app.use('/auth', authRoutes)

// Drawing routes (all protected)
app.use(requireAuth)
app.use(drawingsRoutes)

// Global error handler
app.use(errorHandler)

export default app

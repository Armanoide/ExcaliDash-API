import { config } from './config'
import { initDb, createSessionsTable, endPool } from './db/pool'
import app from './app'

async function start(): Promise<void> {
  try {
    await initDb()
    await createSessionsTable()

    const server = app.listen(config.port, () => {
      console.log(`[api] listening on port ${config.port}`)
      console.log(`[api] backend: ${config.backend}`)
      console.log(`[api] frontend: ${config.frontendUrl}`)
      console.log(`[api] jwt expires: ${config.apiJwtExpiresIn}`)
    })

    process.on('SIGTERM', () => {
      console.log('[api] SIGTERM received, shutting down')
      server.close(() => { endPool().then(() => process.exit(0)) })
    })

    process.on('SIGINT', () => {
      console.log('[api] SIGINT received, shutting down')
      server.close(() => { endPool().then(() => process.exit(0)) })
    })
  } catch (err) {
    console.error('[api] failed to start:', err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
}

start()

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 }
const level = LOG_LEVELS[(process.env.LOG_LEVEL || 'info') as keyof typeof LOG_LEVELS] ?? 2

function format(level: string, ...args: unknown[]): string {
  const ts = new Date().toISOString()
  const tag = `[${ts}] [${level.toUpperCase()}]`
  return [tag, ...args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a))].join(' ')
}

export const logger = {
  error: (...args: unknown[]) => level >= 0 && console.error(format('error', ...args)),
  warn: (...args: unknown[]) => level >= 1 && console.warn(format('warn', ...args)),
  info: (...args: unknown[]) => level >= 2 && console.info(format('info', ...args)),
  debug: (...args: unknown[]) => level >= 3 && console.debug(format('debug', ...args)),
}

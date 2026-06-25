import { config } from '../config'

export function safeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  const internalPatterns = ['http://', 'excalidash_backend', 'at ']
  if (internalPatterns.some(p => msg.includes(p))) {
    return 'Backend service unavailable'
  }
  return msg
}

export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.requestTimeout)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

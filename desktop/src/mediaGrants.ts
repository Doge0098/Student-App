/**
 * Permisos de cámara y micrófono dados (o negados) por el estudiante a cada web, por tipo:
 * dejar usar el micrófono no deja usar la cámara. Un «No permitir» se recuerda un rato para que
 * una web no pueda volver a preguntar sin parar.
 */
export type MediaType = 'audio' | 'video'

export const DENIAL_MEMORY_MS = 2 * 60 * 1000

export interface MediaGrants {
  /** Qué hacer con una petición: pasa, se rechaza o hay que preguntar por estos tipos. */
  check(origin: string, types: readonly MediaType[]): { action: 'allow' } | { action: 'deny' } | { action: 'ask'; missing: MediaType[] }
  grant(origin: string, types: readonly MediaType[]): void
  deny(origin: string, types: readonly MediaType[]): void
  isGranted(origin: string, type: MediaType): boolean
}

export function normalizeMediaTypes(types: readonly string[] | undefined): MediaType[] {
  const result: MediaType[] = []
  for (const t of types ?? []) if ((t === 'audio' || t === 'video') && !result.includes(t)) result.push(t)
  return result.length > 0 ? result : ['audio']
}

export function createMediaGrants(now: () => number = Date.now): MediaGrants {
  const granted = new Set<string>()
  const denied = new Map<string, number>()
  const key = (origin: string, type: MediaType) => `${origin}|${type}`

  const wasDenied = (origin: string, type: MediaType) => {
    const until = denied.get(key(origin, type))
    if (until === undefined) return false
    if (now() < until) return true
    denied.delete(key(origin, type))
    return false
  }

  return {
    check(origin, types) {
      if (types.some((t) => wasDenied(origin, t))) return { action: 'deny' }
      const missing = types.filter((t) => !granted.has(key(origin, t)))
      return missing.length === 0 ? { action: 'allow' } : { action: 'ask', missing }
    },
    grant(origin, types) {
      for (const t of types) {
        granted.add(key(origin, t))
        denied.delete(key(origin, t))
      }
    },
    deny(origin, types) {
      for (const t of types) denied.set(key(origin, t), now() + DENIAL_MEMORY_MS)
    },
    isGranted: (origin, type) => granted.has(key(origin, type)),
  }
}

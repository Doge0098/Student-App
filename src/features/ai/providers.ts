import type { ProviderId } from './types'

export interface ProviderInfo {
  id: ProviderId
  /** Nombre que conoce el estudiante. */
  name: string
  /** Empresa que la ofrece. */
  company: string
  /** Página oficial donde se crea la clave. */
  keyUrl: string
  /** Una línea sobre el precio. */
  price: string
  /** Cómo suelen empezar sus claves (solo para avisar si se pega otra cosa). */
  keyPrefix: string
}

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  anthropic: {
    id: 'anthropic',
    name: 'Claude',
    company: 'Anthropic',
    keyUrl: 'https://platform.claude.com/settings/keys',
    price: 'De pago según lo que uses',
    keyPrefix: 'sk-ant-',
  },
  openai: {
    id: 'openai',
    name: 'ChatGPT',
    company: 'OpenAI',
    keyUrl: 'https://platform.openai.com/api-keys',
    price: 'De pago según lo que uses',
    keyPrefix: 'sk-',
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini',
    company: 'Google',
    keyUrl: 'https://aistudio.google.com/apikey',
    price: 'Tiene un plan gratis',
    keyPrefix: 'AIza',
  },
}

/** Quita espacios y comillas que se cuelan al copiar y pegar. */
export function cleanKey(raw: string): string {
  return raw.trim().replace(/^["'`]+|["'`]+$/g, '').replace(/\s+/g, '')
}

/** ¿Parece una clave de este proveedor? Solo sirve para avisar; la comprobación real la hace el proveedor. */
export function looksLikeKey(provider: ProviderId, key: string): boolean {
  const k = cleanKey(key)
  if (k.length < 20) return false
  const { keyPrefix } = PROVIDERS[provider]
  if (provider === 'openai') return k.startsWith(keyPrefix) && !k.startsWith(PROVIDERS.anthropic.keyPrefix)
  return k.startsWith(keyPrefix)
}

/** Para mostrar qué clave hay guardada sin enseñarla: «••••a1B2». */
export function maskKey(key: string): string {
  const k = cleanKey(key)
  return k.length <= 8 ? '••••' : `••••${k.slice(-4)}`
}

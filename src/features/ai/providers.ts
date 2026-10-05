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
  /** Mini manual: pasos para conseguir la clave en su web. */
  keySteps: string[]
}

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  anthropic: {
    id: 'anthropic',
    name: 'Claude',
    company: 'Anthropic',
    keyUrl: 'https://platform.claude.com/settings/keys',
    price: 'De pago según lo que uses',
    keyPrefix: 'sk-ant-',
    keySteps: [
      'Entra en platform.claude.com con tu correo (es una cuenta distinta a la de claude.ai: pagar Claude Pro no incluye la API).',
      'En «Billing» (facturación) añade un poco de saldo, por ejemplo 5 €. Es de pago según lo que uses.',
      'Ve a «Settings» → «API keys» → «Create key» y ponle un nombre (por ejemplo, LockIn).',
      'Copia la clave en el momento: solo se enseña una vez. Pégala aquí arriba.',
    ],
  },
  openai: {
    id: 'openai',
    name: 'ChatGPT',
    company: 'OpenAI',
    keyUrl: 'https://platform.openai.com/api-keys',
    price: 'De pago según lo que uses',
    keyPrefix: 'sk-',
    keySteps: [
      'Entra en platform.openai.com con tu cuenta (es distinta a la de chatgpt.com: pagar ChatGPT Plus no incluye la API).',
      'En «Billing» (facturación) añade un poco de saldo, por ejemplo 5 €. Es de pago según lo que uses.',
      'Ve a «API keys» → «Create new secret key» y ponle un nombre (por ejemplo, LockIn).',
      'Copia la clave en el momento: solo se enseña una vez. Pégala aquí arriba.',
    ],
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini',
    company: 'Google',
    keyUrl: 'https://aistudio.google.com/apikey',
    price: 'Tiene un plan gratis',
    keyPrefix: 'AIza',
    keySteps: [
      'Entra en aistudio.google.com/apikey con tu cuenta de Google.',
      'Pulsa «Crear clave de API» (Create API key) y elige un proyecto, o deja que cree uno nuevo.',
      'Copia la clave y pégala aquí arriba. Tiene un plan gratis con límites; no hace falta tarjeta para empezar.',
    ],
  },
}

/** Quita espacios y comillas que se cuelan al copiar y pegar. */
export function cleanKey(raw: string): string {
  return raw
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '') // espacios invisibles que se cuelan al copiar
    .trim()
    .replace(/^["'`“”‘’«»]+|["'`“”‘’«»]+$/g, '')
    .replace(/\s+/g, '')
}

/** Una clave solo lleva caracteres ASCII visibles: si no, no se puede enviar y es que se copió mal. */
export function hasOddCharacters(key: string): boolean {
  return /[^\x21-\x7E]/.test(key)
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

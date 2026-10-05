import { PROVIDERS } from './providers'
import type { ProviderId } from './types'

export type AiErrorKind =
  | 'auth'
  | 'forbidden'
  | 'quota'
  | 'rate'
  | 'model'
  | 'too_long'
  | 'overloaded'
  | 'refused'
  | 'truncated'
  | 'bad_output'
  | 'bad_request'
  | 'network'
  | 'aborted'
  | 'unknown'

/** Error con un mensaje en español listo para enseñar al estudiante. */
export class AiError extends Error {
  readonly kind: AiErrorKind
  /** Texto original del proveedor (sin claves), para los casos raros. */
  readonly detail: string

  constructor(kind: AiErrorKind, message: string, detail = '') {
    super(message)
    this.name = 'AiError'
    this.kind = kind
    this.detail = detail
  }
}

export interface ErrorContext {
  provider: ProviderId
  model?: string
  /** Si se conoce, se borra de cualquier texto del proveedor antes de enseñarlo. */
  apiKey?: string
}

/** Borra todo lo que parezca una clave (y la clave concreta, si se pasa). */
export function redact(text: string, apiKey = ''): string {
  let out = text
  if (apiKey.length >= 8) out = out.split(apiKey).join('••••')
  return out.replace(/\b(sk-[A-Za-z0-9_*-]{6,}|AIza[0-9A-Za-z_-]{10,})/g, '••••')
}

export function errorMessage(kind: AiErrorKind, ctx: ErrorContext): string {
  const name = PROVIDERS[ctx.provider].name
  switch (kind) {
    case 'auth':
      return `La clave de ${name} no es válida. Revísala o crea una nueva.`
    case 'forbidden':
      return `Tu clave de ${name} no tiene permiso para esto. Prueba con otro modelo o revisa tu cuenta.`
    case 'quota':
      return ctx.provider === 'gemini'
        ? 'Has gastado la cuota de Gemini por ahora. Espera un rato o prueba con otro modelo.'
        : `Tu cuenta de ${name} no tiene saldo. Añade crédito en su web para seguir.`
    case 'rate':
      return ctx.provider === 'gemini'
        ? 'Has llegado al límite de Gemini (el plan gratis tiene un máximo por minuto y por día). Espera un poco o prueba otro modelo.'
        : 'Demasiadas peticiones seguidas. Espera un momento y vuelve a probar.'
    case 'model':
      return ctx.model
        ? `El modelo «${ctx.model}» no existe o tu clave no puede usarlo. Elige otro en los ajustes de la IA.`
        : 'Ese modelo no existe o tu clave no puede usarlo. Elige otro en los ajustes de la IA.'
    case 'too_long':
      return 'El texto es demasiado largo para este modelo. Prueba con un trozo más corto.'
    case 'overloaded':
      return `${name} está saturado ahora mismo. Prueba otra vez en un momento.`
    case 'refused':
      return 'La IA no ha querido responder a esto. Prueba a decirlo de otra forma.'
    case 'truncated':
      return 'La respuesta salió demasiado larga y se cortó. Prueba con menos texto o pide menos.'
    case 'bad_output':
      return 'La IA no ha devuelto lo que se esperaba. Vuelve a intentarlo o prueba otro modelo.'
    case 'bad_request':
      return `${name} no ha aceptado la petición.`
    case 'network':
      return `No se pudo conectar con ${name}. Revisa tu conexión a internet.`
    case 'aborted':
      return 'Cancelado.'
    case 'unknown':
      return `Algo ha fallado con ${name}. Vuelve a intentarlo.`
  }
}

export function makeError(kind: AiErrorKind, ctx: ErrorContext, detail = ''): AiError {
  const clean = redact(detail, ctx.apiKey).slice(0, 300)
  // En los rechazos poco comunes, el motivo que da el proveedor ayuda a entender qué pasa.
  const message = kind === 'bad_request' && clean ? `${errorMessage(kind, ctx)} Motivo: ${clean.slice(0, 160)}` : errorMessage(kind, ctx)
  return new AiError(kind, message, clean)
}

interface ErrorFields {
  type: string
  code: string
  status: string
  reason: string
  message: string
}

const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '')

/** Junta los campos de error de los tres formatos (Anthropic, OpenAI y Google). */
function errorFields(body: unknown): ErrorFields {
  const root = Array.isArray(body) ? body[0] : body
  const r = (root && typeof root === 'object' ? root : {}) as Record<string, unknown>
  const inner = (r.error && typeof r.error === 'object' ? r.error : r) as Record<string, unknown>
  const details = Array.isArray(inner.details) ? (inner.details as Record<string, unknown>[]) : []
  return {
    type: str(inner.type),
    code: str(inner.code),
    status: str(inner.status),
    reason: details.map((d) => str(d?.reason)).find(Boolean) ?? '',
    message: str(inner.message) || (typeof r.error === 'string' ? r.error : ''),
  }
}

/**
 * Traduce un error del proveedor (respuesta HTTP o evento de error dentro del streaming)
 * a un AiError con un mensaje claro.
 */
export function classifyError(ctx: ErrorContext, status: number | undefined, body: unknown): AiError {
  const f = errorFields(body)
  const msg = f.message
  const is = (...values: string[]) => values.some((v) => v === f.type || v === f.code || v === f.status || v === f.reason)

  let kind: AiErrorKind
  if (status === 401 || is('authentication_error', 'invalid_api_key', 'API_KEY_INVALID', 'UNAUTHENTICATED') || /api key (not valid|expired|invalid)|incorrect api key/i.test(msg)) {
    kind = 'auth'
  } else if (status === 402 || is('billing_error', 'insufficient_quota', 'billing_not_active') || /credit balance|billing/i.test(msg)) {
    kind = 'quota'
  } else if (status === 403 || is('permission_error', 'PERMISSION_DENIED')) {
    kind = 'forbidden'
  } else if (status === 404 || is('not_found_error', 'model_not_found', 'NOT_FOUND')) {
    kind = 'model'
  } else if (
    status === 413 ||
    is('request_too_large', 'context_length_exceeded') ||
    /too long|context length|context window|maximum context|exceeds the maximum number of tokens|too many tokens/i.test(msg)
  ) {
    kind = 'too_long'
  } else if (status === 429 || is('rate_limit_error', 'rate_limit_exceeded', 'RESOURCE_EXHAUSTED')) {
    kind = 'rate'
  } else if (
    (status !== undefined && status >= 500) ||
    is('overloaded_error', 'api_error', 'server_error', 'UNAVAILABLE', 'INTERNAL', 'DEADLINE_EXCEEDED')
  ) {
    kind = 'overloaded'
  } else if (status === 400 || is('invalid_request_error', 'INVALID_ARGUMENT', 'FAILED_PRECONDITION')) {
    kind = 'bad_request'
  } else {
    kind = 'unknown'
  }
  return makeError(kind, ctx, msg)
}

/** Error de fetch (sin respuesta): sin conexión, bloqueo del navegador o cancelación. */
export function fetchFailure(ctx: ErrorContext, error: unknown): AiError {
  if (error instanceof AiError) return error
  if (error instanceof DOMException && error.name === 'AbortError') return makeError('aborted', ctx)
  if (error && typeof error === 'object' && (error as { name?: string }).name === 'AbortError') return makeError('aborted', ctx)
  return makeError('network', ctx, error instanceof Error ? error.message : '')
}

/**
 * Construcción de peticiones y lectura de respuestas de cada proveedor.
 * Funciones puras: no hacen fetch (eso está en client.ts), así se pueden probar sin claves.
 *
 * - Anthropic (Claude): POST /v1/messages, con la cabecera de acceso directo desde el navegador.
 * - OpenAI (ChatGPT): POST /v1/responses (API Responses), sin guardar la conversación (store: false).
 * - Google (Gemini): POST v1beta/models/{modelo}:generateContent (o :streamGenerateContent?alt=sse).
 */
import { toGeminiSchema } from './schemas'
import type { SseEvent } from './sse'
import type { AiConfig, AiRequest, ProviderId } from './types'

export const ANTHROPIC_URL = 'https://api.anthropic.com/v1'
export const ANTHROPIC_VERSION = '2023-06-01'
export const OPENAI_URL = 'https://api.openai.com/v1'
export const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta'

/** Tope de salida para Claude (max_tokens es obligatorio). Si el modelo admite menos, se usa su máximo. */
export const ANTHROPIC_MAX_TOKENS = 16000

/**
 * Modelos de Claude que pueden rechazar una petición por seguridad: con `fallbacks: "default"`
 * Anthropic la repite en otro modelo en vez de devolver el rechazo.
 */
const ANTHROPIC_FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-sonnet-5-5'])
export const ANTHROPIC_FALLBACK_BETA = 'server-side-fallback-2026-07-01'

export interface HttpRequest {
  url: string
  init: { method: 'GET' | 'POST'; headers: Record<string, string>; body?: string }
}

export interface BuildOptions {
  stream: boolean
  /** Pedir JSON con el esquema de la petición (si lo hay). */
  structured: boolean
  /** Solo Claude: no pedir la repetición automática en otro modelo. */
  noFallback?: boolean
}

export function anthropicHeaders(apiKey: string): Record<string, string> {
  return {
    'x-api-key': apiKey,
    'anthropic-version': ANTHROPIC_VERSION,
    // Necesaria para llamar a la API desde una web: la clave es del propio estudiante y no sale de su navegador.
    'anthropic-dangerous-direct-browser-access': 'true',
  }
}

export function usesAnthropicFallback(model: string): boolean {
  return ANTHROPIC_FALLBACK_MODELS.has(model)
}

/** Quita el «models/» que a veces se copia delante del nombre de un modelo de Gemini. */
export function geminiModelId(model: string): string {
  return model.trim().replace(/^models\//, '')
}

export function buildGenerateRequest(config: AiConfig, req: AiRequest, opts: BuildOptions): HttpRequest {
  const schema = opts.structured ? req.schema : undefined
  switch (config.provider) {
    case 'anthropic': {
      const limit = config.modelInfo?.maxOutputTokens
      const fallback = !opts.noFallback && usesAnthropicFallback(config.model)
      const body: Record<string, unknown> = {
        model: config.model,
        max_tokens: limit && limit > 0 ? Math.min(ANTHROPIC_MAX_TOKENS, limit) : ANTHROPIC_MAX_TOKENS,
        system: req.system,
        messages: req.messages.map((m) => ({ role: m.role, content: m.text })),
      }
      if (opts.stream) body.stream = true
      if (schema) body.output_config = { format: { type: 'json_schema', schema } }
      if (fallback) body.fallbacks = 'default'
      const headers: Record<string, string> = { 'content-type': 'application/json', ...anthropicHeaders(config.apiKey) }
      if (fallback) headers['anthropic-beta'] = ANTHROPIC_FALLBACK_BETA
      return { url: `${ANTHROPIC_URL}/messages`, init: { method: 'POST', headers, body: JSON.stringify(body) } }
    }
    case 'openai': {
      const body: Record<string, unknown> = {
        model: config.model,
        instructions: req.system,
        input: req.messages.map((m) => ({ role: m.role, content: m.text })),
        store: false,
      }
      if (opts.stream) body.stream = true
      if (schema) body.text = { format: { type: 'json_schema', name: req.schemaName ?? 'respuesta', schema, strict: true } }
      return {
        url: `${OPENAI_URL}/responses`,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${config.apiKey}` },
          body: JSON.stringify(body),
        },
      }
    }
    case 'gemini': {
      const body: Record<string, unknown> = {
        systemInstruction: { parts: [{ text: req.system }] },
        contents: req.messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.text }] })),
      }
      if (schema) body.generationConfig = { responseMimeType: 'application/json', responseSchema: toGeminiSchema(schema) }
      const model = encodeURIComponent(geminiModelId(config.model))
      const action = opts.stream ? 'streamGenerateContent?alt=sse' : 'generateContent'
      return {
        url: `${GEMINI_URL}/models/${model}:${action}`,
        // La clave va en una cabecera, no en la URL (las URL acaban en historiales y registros).
        init: { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': config.apiKey }, body: JSON.stringify(body) },
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Respuestas completas                                                */
/* ------------------------------------------------------------------ */

export type Finish = 'stop' | 'max_tokens' | 'refusal'

export interface ParsedResponse {
  text: string
  finish: Finish
}

type Obj = Record<string, unknown>
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {})
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

const GEMINI_BLOCKED = new Set(['SAFETY', 'RECITATION', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'IMAGE_SAFETY', 'LANGUAGE'])

function geminiCandidate(body: Obj): { text: string; finish?: Finish } {
  if (obj(body.promptFeedback).blockReason) return { text: '', finish: 'refusal' }
  const candidate = obj(arr(body.candidates)[0])
  const text = arr(obj(candidate.content).parts)
    .map(obj)
    .filter((p) => !p.thought && typeof p.text === 'string')
    .map((p) => p.text as string)
    .join('')
  const reason = typeof candidate.finishReason === 'string' ? candidate.finishReason : ''
  if (!reason || reason === 'FINISH_REASON_UNSPECIFIED') return { text }
  if (reason === 'MAX_TOKENS') return { text, finish: 'max_tokens' }
  if (GEMINI_BLOCKED.has(reason)) return { text, finish: 'refusal' }
  return { text, finish: 'stop' }
}

/** Lee la respuesta completa (sin streaming) de cualquier proveedor. */
export function parseGenerateResponse(provider: ProviderId, raw: unknown): ParsedResponse {
  const body = obj(raw)
  switch (provider) {
    case 'anthropic': {
      // Solo los bloques de texto: los de razonamiento o de cambio de modelo no se enseñan.
      const text = arr(body.content)
        .map(obj)
        .filter((b) => b.type === 'text' && typeof b.text === 'string')
        .map((b) => b.text as string)
        .join('')
      const stop = body.stop_reason
      return { text, finish: stop === 'refusal' ? 'refusal' : stop === 'max_tokens' ? 'max_tokens' : 'stop' }
    }
    case 'openai': {
      let text = ''
      let refused = false
      for (const item of arr(body.output).map(obj)) {
        if (item.type !== 'message') continue
        for (const part of arr(item.content).map(obj)) {
          if (part.type === 'output_text' && typeof part.text === 'string') text += part.text
          if (part.type === 'refusal') refused = true
        }
      }
      const reason = obj(body.incomplete_details).reason
      if (refused || reason === 'content_filter') return { text, finish: 'refusal' }
      if (body.status === 'incomplete' && reason === 'max_output_tokens') return { text, finish: 'max_tokens' }
      return { text, finish: 'stop' }
    }
    case 'gemini': {
      const { text, finish } = geminiCandidate(body)
      return { text, finish: finish ?? 'stop' }
    }
  }
}

/** Error que viene dentro de una respuesta 200 (OpenAI con status "failed"). */
export function embeddedError(provider: ProviderId, raw: unknown): unknown | null {
  const body = obj(raw)
  if (provider === 'openai' && body.status === 'failed' && body.error) return { error: body.error }
  return null
}

/* ------------------------------------------------------------------ */
/* Streaming                                                           */
/* ------------------------------------------------------------------ */

export interface StreamStep {
  /** Texto nuevo. */
  delta?: string
  finish?: Finish
  /** Error enviado dentro del stream (con el formato de error del proveedor). */
  error?: unknown
}

function parseData(data: string): unknown {
  try {
    return JSON.parse(data)
  } catch {
    return null
  }
}

/** Traduce un evento SSE de cada proveedor a «texto nuevo», «fin» o «error». */
export function decodeStreamEvent(provider: ProviderId, ev: SseEvent): StreamStep {
  if (ev.data === '[DONE]') return {}
  const data = obj(parseData(ev.data))
  switch (provider) {
    case 'anthropic': {
      if (data.type === 'error' || ev.event === 'error') return { error: data }
      if (data.type === 'content_block_delta') {
        const delta = obj(data.delta)
        return delta.type === 'text_delta' && typeof delta.text === 'string' ? { delta: delta.text } : {}
      }
      if (data.type === 'message_delta') {
        const stop = obj(data.delta).stop_reason
        if (stop === 'refusal') return { finish: 'refusal' }
        if (stop === 'max_tokens') return { finish: 'max_tokens' }
        if (typeof stop === 'string') return { finish: 'stop' }
      }
      return {}
    }
    case 'openai': {
      switch (data.type) {
        case 'response.output_text.delta':
          return typeof data.delta === 'string' ? { delta: data.delta } : {}
        case 'response.refusal.done':
          return { finish: 'refusal' }
        case 'response.completed':
          return { finish: 'stop' }
        case 'response.incomplete': {
          const reason = obj(obj(data.response).incomplete_details).reason
          return { finish: reason === 'content_filter' ? 'refusal' : 'max_tokens' }
        }
        case 'response.failed':
          return { error: { error: obj(obj(data.response).error) } }
        case 'error':
          return { error: data }
        default:
          return {}
      }
    }
    case 'gemini': {
      if (data.error) return { error: data }
      const { text, finish } = geminiCandidate(data)
      const step: StreamStep = {}
      if (text) step.delta = text
      if (finish) step.finish = finish
      return step
    }
  }
}

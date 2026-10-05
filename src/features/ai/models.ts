/**
 * Lista de modelos de cada proveedor, pedida con la clave del estudiante.
 * No se escriben nombres de modelos a mano (cambian a menudo): se piden al proveedor, se quitan los
 * que no sirven para conversar y se preselecciona uno sensato por patrón.
 */
import { ANTHROPIC_URL, GEMINI_URL, OPENAI_URL, anthropicHeaders, type HttpRequest } from './requests'
import type { ModelInfo, ProviderId } from './types'

export function buildListModelsRequest(provider: ProviderId, apiKey: string): HttpRequest {
  switch (provider) {
    case 'anthropic':
      return { url: `${ANTHROPIC_URL}/models?limit=1000`, init: { method: 'GET', headers: anthropicHeaders(apiKey) } }
    case 'openai':
      return { url: `${OPENAI_URL}/models`, init: { method: 'GET', headers: { authorization: `Bearer ${apiKey}` } } }
    case 'gemini':
      return { url: `${GEMINI_URL}/models?pageSize=1000`, init: { method: 'GET', headers: { 'x-goog-api-key': apiKey } } }
  }
}

type Obj = Record<string, unknown>
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {})
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const positive = (v: unknown): number | undefined => (typeof v === 'number' && v > 0 ? v : undefined)

/** Modelos de OpenAI que no son para conversar por texto (voz, imágenes, búsqueda, embeddings…). */
const OPENAI_EXCLUDE =
  /(embedding|tts|whisper|dall-e|image|audio|realtime|transcribe|moderation|search|instruct|davinci|babbage|sora|computer-use|deep-research|diarize)/
const OPENAI_CHAT = /^(gpt-|chatgpt-|o\d)/

/** Modelos de Gemini que no sirven aquí (embeddings, imagen, vídeo, voz, Gemma sin instrucciones de sistema…). */
const GEMINI_EXCLUDE =
  /(embedding|aqa|imagen|veo|tts|image|live|native-audio|audio|robotics|computer-use|gemma|learnlm|lyria|nano-banana)/

export function isChatModel(provider: ProviderId, id: string): boolean {
  const lower = id.toLowerCase()
  if (provider === 'openai') return OPENAI_CHAT.test(lower) && !OPENAI_EXCLUDE.test(lower)
  if (provider === 'gemini') return lower.startsWith('gemini') && !GEMINI_EXCLUDE.test(lower)
  return lower.startsWith('claude')
}

/** Si dos modelos se llaman igual, se añade su identificador para distinguirlos. */
function uniqueLabels(models: ModelInfo[]): ModelInfo[] {
  const count = new Map<string, number>()
  for (const m of models) count.set(m.label, (count.get(m.label) ?? 0) + 1)
  return models.map((m) => ((count.get(m.label) ?? 0) > 1 && m.label !== m.id ? { ...m, label: `${m.label} · ${m.id}` } : m))
}

/** Lee la lista de modelos y deja solo los que sirven para conversar. */
export function parseModelList(provider: ProviderId, raw: unknown): ModelInfo[] {
  const body = obj(raw)
  let models: ModelInfo[] = []
  switch (provider) {
    case 'anthropic':
      // Ya vienen ordenados: los más nuevos primero.
      models = arr(body.data)
        .map(obj)
        .filter((m) => str(m.id))
        .map((m) => {
          const caps = obj(m.capabilities)
          const structured = obj(caps.structured_outputs).supported
          const info: ModelInfo = { id: str(m.id), label: str(m.display_name) || str(m.id) }
          const max = positive(m.max_tokens)
          if (max) info.maxOutputTokens = max
          if (typeof structured === 'boolean') info.structuredOutputs = structured
          return info
        })
      break
    case 'openai':
      models = arr(body.data)
        .map(obj)
        .filter((m) => str(m.id))
        .sort((a, b) => (Number(b.created) || 0) - (Number(a.created) || 0))
        .map((m) => ({ id: str(m.id), label: str(m.id) }))
      break
    case 'gemini':
      models = arr(body.models)
        .map(obj)
        .filter((m) => arr(m.supportedGenerationMethods).includes('generateContent'))
        .map((m) => {
          const id = str(m.name).replace(/^models\//, '')
          const info: ModelInfo = { id, label: str(m.displayName) || id, structuredOutputs: true }
          const max = positive(m.outputTokenLimit)
          if (max) info.maxOutputTokens = max
          return info
        })
        .filter((m) => m.id)
      break
  }
  const seen = new Set<string>()
  return uniqueLabels(models.filter((m) => isChatModel(provider, m.id) && !seen.has(m.id) && seen.add(m.id)))
}

/** Número de versión que aparece tras el prefijo (gpt-5.1-mini → 5.1). */
function version(id: string, prefix: RegExp): number {
  const match = prefix.exec(id)
  return match ? Number(match[1]) : -1
}

const isDated = (id: string) => /-\d{4}-\d{2}-\d{2}$|-\d{8}$|-\d{2}-\d{2}$|-\d{3,4}$/.test(id)
const isPreview = (id: string) => /(preview|exp|experimental)/.test(id)

function best(ids: string[], prefix: RegExp): string | undefined {
  return [...ids].sort((a, b) => version(b, prefix) - version(a, prefix) || a.length - b.length)[0]
}

/**
 * Modelo que se preselecciona. Para Claude, el modelo actual recomendado; para ChatGPT y Gemini,
 * uno rápido y barato (el estudiante puede cambiarlo).
 */
export function pickDefaultModel(provider: ProviderId, models: ModelInfo[]): string | undefined {
  const ids = models.map((m) => m.id)
  if (ids.length === 0) return undefined
  switch (provider) {
    case 'anthropic':
      return ids.includes('claude-opus-5-5') ? 'claude-opus-5-5' : ids[0]
    case 'openai': {
      const prefix = /^gpt-(\d+(?:\.\d+)?)/
      const minis = ids.filter((id) => /^gpt-\d+(?:\.\d+)?-mini$/.test(id))
      if (minis.length) return best(minis, prefix)
      const anyMini = ids.filter((id) => id.includes('mini') && !isDated(id) && !isPreview(id))
      if (anyMini.length) return best(anyMini, prefix)
      const gpts = ids.filter((id) => prefix.test(id) && !isDated(id) && !isPreview(id))
      return gpts.length ? best(gpts, prefix) : ids[0]
    }
    case 'gemini': {
      if (ids.includes('gemini-flash-latest')) return 'gemini-flash-latest'
      const prefix = /^gemini-(\d+(?:\.\d+)?)/
      const flash = ids.filter((id) => /^gemini-\d+(?:\.\d+)?-flash$/.test(id))
      if (flash.length) return best(flash, prefix)
      const anyFlash = ids.filter((id) => id.includes('flash') && !id.includes('lite') && !isPreview(id))
      if (anyFlash.length) return best(anyFlash, prefix)
      return ids[0]
    }
  }
}

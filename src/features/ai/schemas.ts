import { AiError } from './errors'
import type { JsonSchema } from './types'

/* ------------------------------------------------------------------ */
/* Esquemas de salida (test y tarjetas)                                */
/* ------------------------------------------------------------------ */

export const QUIZ_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['questions'],
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['question', 'options', 'answer', 'explanation'],
        properties: {
          question: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
          answer: { type: 'integer', description: 'Posición de la opción correcta en options, empezando en 0' },
          explanation: { type: 'string' },
        },
      },
    },
  },
}

export const CARDS_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['cards'],
  properties: {
    cards: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['front', 'back'],
        properties: {
          front: { type: 'string', description: 'Pregunta o concepto' },
          back: { type: 'string', description: 'Respuesta corta' },
        },
      },
    },
  },
}

/** Esquema para Gemini: su formato (OpenAPI) usa tipos en mayúsculas y no admite additionalProperties. */
export interface GeminiSchema {
  type: string
  description?: string
  properties?: Record<string, GeminiSchema>
  required?: string[]
  items?: GeminiSchema
  propertyOrdering?: string[]
}

export function toGeminiSchema(schema: JsonSchema): GeminiSchema {
  const out: GeminiSchema = { type: schema.type.toUpperCase() }
  if (schema.description) out.description = schema.description
  if (schema.properties) {
    out.properties = Object.fromEntries(Object.entries(schema.properties).map(([k, v]) => [k, toGeminiSchema(v)]))
    out.propertyOrdering = Object.keys(schema.properties)
  }
  if (schema.required) out.required = [...schema.required]
  if (schema.items) out.items = toGeminiSchema(schema.items)
  return out
}

/* ------------------------------------------------------------------ */
/* Lectura robusta del JSON que devuelve el modelo                     */
/* ------------------------------------------------------------------ */

const badOutput = (detail: string) =>
  new AiError('bad_output', 'La IA no ha devuelto lo que se esperaba. Vuelve a intentarlo o prueba otro modelo.', detail)

/**
 * Saca el JSON de la respuesta aunque venga dentro de ```json … ``` o con texto alrededor.
 * Lanza un AiError amable si no hay JSON.
 */
export function extractJson(text: string): unknown {
  const attempts: string[] = []
  const trimmed = text.trim()
  attempts.push(trimmed)
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed)
  if (fence) attempts.push(fence[1].trim())
  const firstObj = trimmed.indexOf('{')
  const lastObj = trimmed.lastIndexOf('}')
  if (firstObj !== -1 && lastObj > firstObj) attempts.push(trimmed.slice(firstObj, lastObj + 1))
  const firstArr = trimmed.indexOf('[')
  const lastArr = trimmed.lastIndexOf(']')
  if (firstArr !== -1 && lastArr > firstArr) attempts.push(trimmed.slice(firstArr, lastArr + 1))

  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate)
    } catch {
      /* se prueba la siguiente forma */
    }
  }
  throw badOutput('no JSON')
}

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')

/** Busca la lista dentro del objeto (con el nombre esperado o, si no, la primera lista que haya). */
function findList(data: unknown, keys: string[]): unknown[] {
  if (Array.isArray(data)) return data
  if (!data || typeof data !== 'object') return []
  const obj = data as Record<string, unknown>
  for (const key of keys) if (Array.isArray(obj[key])) return obj[key] as unknown[]
  const first = Object.values(obj).find(Array.isArray)
  return (first as unknown[] | undefined) ?? []
}

const pick = (obj: Record<string, unknown>, keys: string[]): unknown => keys.map((k) => obj[k]).find((v) => v !== undefined)

/* ------------------------------------------------------------------ */
/* Test                                                                */
/* ------------------------------------------------------------------ */

export interface QuizQuestion {
  question: string
  options: string[]
  /** Posición de la opción correcta. */
  answer: number
  explanation: string
}

const MAX_OPTIONS = 6

function toQuestion(raw: unknown): QuizQuestion | null {
  if (!raw || typeof raw !== 'object') return null
  const q = raw as Record<string, unknown>
  const question = text(pick(q, ['question', 'pregunta', 'q']))
  const rawOptions = pick(q, ['options', 'opciones', 'choices'])
  if (!question || !Array.isArray(rawOptions)) return null
  const options = rawOptions.map(text).filter(Boolean).slice(0, MAX_OPTIONS)
  if (options.length < 2 || options.length !== Math.min(rawOptions.length, MAX_OPTIONS)) return null
  if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) return null

  const rawAnswer = pick(q, ['answer', 'correct', 'correctIndex', 'respuesta', 'correcta'])
  let answer = typeof rawAnswer === 'number' ? rawAnswer : typeof rawAnswer === 'string' && /^\d+$/.test(rawAnswer.trim()) ? Number(rawAnswer) : NaN
  // A veces el modelo pone el texto de la opción en vez de su número.
  if (Number.isNaN(answer) && typeof rawAnswer === 'string') {
    answer = options.findIndex((o) => o.toLowerCase() === rawAnswer.trim().toLowerCase())
  }
  if (!Number.isInteger(answer) || answer < 0 || answer >= options.length) return null

  const explanation = text(pick(q, ['explanation', 'explicacion', 'explicación', 'why']))
  return { question, options, answer, explanation }
}

/** Lee y valida las preguntas del test. Descarta las mal formadas; si no queda ninguna, error amable. */
export function parseQuiz(raw: string, max: number): QuizQuestion[] {
  const questions = findList(extractJson(raw), ['questions', 'preguntas'])
    .map(toQuestion)
    .filter((q): q is QuizQuestion => q !== null)
    .slice(0, max)
  if (questions.length === 0) throw badOutput('no valid questions')
  return questions
}

/* ------------------------------------------------------------------ */
/* Tarjetas                                                            */
/* ------------------------------------------------------------------ */

export interface DraftCard {
  front: string
  back: string
}

export function parseCards(raw: string, max: number): DraftCard[] {
  const seen = new Set<string>()
  const cards: DraftCard[] = []
  for (const item of findList(extractJson(raw), ['cards', 'tarjetas', 'flashcards'])) {
    if (!item || typeof item !== 'object') continue
    const c = item as Record<string, unknown>
    const front = text(pick(c, ['front', 'question', 'pregunta', 'anverso']))
    const back = text(pick(c, ['back', 'answer', 'respuesta', 'reverso']))
    const key = front.toLowerCase()
    if (!front || !back || seen.has(key)) continue
    seen.add(key)
    cards.push({ front, back })
    if (cards.length >= max) break
  }
  if (cards.length === 0) throw badOutput('no valid cards')
  return cards
}

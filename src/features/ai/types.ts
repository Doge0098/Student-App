/** Tipos comunes del asistente de IA. Sin dependencias de React: se usan también en los tests. */

export type ProviderId = 'anthropic' | 'openai' | 'gemini'

export const PROVIDER_IDS: ProviderId[] = ['anthropic', 'openai', 'gemini']

/** Modelo que ofrece el proveedor con la clave del estudiante. */
export interface ModelInfo {
  id: string
  label: string
  /** Máximo de tokens de salida que admite (si el proveedor lo dice). */
  maxOutputTokens?: number
  /** El proveedor confirma que admite salida JSON con esquema. */
  structuredOutputs?: boolean
}

/** Lo necesario para hablar con un proveedor. La clave nunca se escribe en consola ni en errores. */
export interface AiConfig {
  provider: ProviderId
  apiKey: string
  model: string
  modelInfo?: ModelInfo
}

export interface ChatTurn {
  role: 'user' | 'assistant'
  text: string
}

/** Subconjunto de JSON Schema que aceptan los tres proveedores para la salida estructurada. */
export interface JsonSchema {
  type: 'object' | 'array' | 'string' | 'integer' | 'number' | 'boolean'
  description?: string
  properties?: Record<string, JsonSchema>
  required?: string[]
  items?: JsonSchema
  additionalProperties?: false
}

export interface AiRequest {
  system: string
  messages: ChatTurn[]
  /** Si se pasa, se pide la respuesta en JSON con este esquema (si el modelo lo admite). */
  schema?: JsonSchema
  /** Nombre corto del esquema (OpenAI lo exige). */
  schemaName?: string
}

export interface AiResult {
  text: string
  /** La respuesta se cortó por llegar al máximo de longitud. */
  truncated: boolean
}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>

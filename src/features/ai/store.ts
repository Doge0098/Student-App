import { createStore, useStore } from '../../hooks/store'
import { AiError } from './errors'
import { listModels } from './client'
import { createMemoryStore } from './memoryStore'
import { pickDefaultModel } from './models'
import { cleanKey } from './providers'
import { PROVIDER_IDS, type AiConfig, type FetchLike, type ModelInfo, type ProviderId } from './types'

/**
 * Ajustes de la IA. Se guardan SOLO en este navegador (clave «ai-settings», que la copia de
 * seguridad no exporta). Cada proveedor guarda su propia clave y su modelo elegido.
 */
export interface AiSettings {
  provider: ProviderId | null
  keys: Partial<Record<ProviderId, string>>
  models: Partial<Record<ProviderId, string>>
}

export const EMPTY_SETTINGS: AiSettings = { provider: null, keys: {}, models: {} }

export const aiSettingsStore = createStore<AiSettings>('ai-settings', EMPTY_SETTINGS)

const isProvider = (v: unknown): v is ProviderId => typeof v === 'string' && (PROVIDER_IDS as string[]).includes(v)

function cleanMap(raw: unknown): Partial<Record<ProviderId, string>> {
  const out: Partial<Record<ProviderId, string>> = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [k, v] of Object.entries(raw)) if (isProvider(k) && typeof v === 'string' && v.trim()) out[k] = v.trim()
  return out
}

/** Datos de otra versión o editados a mano: nunca rompen la vista. */
export function cleanSettings(raw: unknown): AiSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<AiSettings>
  return { provider: isProvider(r.provider) ? r.provider : null, keys: cleanMap(r.keys), models: cleanMap(r.models) }
}

/* ------------------------------------------------------------------ */
/* Modelos disponibles (en memoria: se vuelven a pedir al abrir LockIn) */
/* ------------------------------------------------------------------ */

export interface ModelListState {
  status: 'loading' | 'ready' | 'error'
  models: ModelInfo[]
  error?: string
  /** Clave con la que se pidió la lista (si cambia la clave, se vuelve a pedir). */
  key: string
}

export const modelListStore = createMemoryStore<Partial<Record<ProviderId, ModelListState>>>({})

/**
 * Pide la lista de modelos con esta clave y la guarda en memoria. Lanza AiError si la clave no vale.
 * Si ya hay una lista (o se está pidiendo) para esa misma clave, no repite la petición.
 */
export async function loadModels(provider: ProviderId, apiKey: string, { force = false, fetchImpl }: { force?: boolean; fetchImpl?: FetchLike } = {}): Promise<ModelInfo[]> {
  const key = cleanKey(apiKey)
  const current = modelListStore.get()[provider]
  if (!force && current?.key === key && current.status === 'ready') return current.models
  modelListStore.set((prev) => ({ ...prev, [provider]: { status: 'loading', models: current?.key === key ? current.models : [], key } }))
  try {
    const models = await listModels(provider, key, fetchImpl)
    modelListStore.set((prev) => (prev[provider]?.key === key ? { ...prev, [provider]: { status: 'ready', models, key } } : prev))
    return models
  } catch (error) {
    const message = error instanceof AiError ? error.message : 'No se pudo cargar la lista de modelos.'
    modelListStore.set((prev) => (prev[provider]?.key === key ? { ...prev, [provider]: { status: 'error', models: [], key, error: message } } : prev))
    throw error
  }
}

/** Configuración lista para usar (proveedor activo con clave y modelo), o null si falta algo. */
export function activeConfig(settings: AiSettings, lists: Partial<Record<ProviderId, ModelListState>>): AiConfig | null {
  const provider = settings.provider
  if (!provider) return null
  const apiKey = settings.keys[provider]
  if (!apiKey) return null
  const list = lists[provider]
  const models = list?.key === apiKey ? list.models : []
  const model = settings.models[provider] ?? pickDefaultModel(provider, models)
  if (!model) return null
  const modelInfo = models.find((m) => m.id === model)
  return modelInfo ? { provider, apiKey, model, modelInfo } : { provider, apiKey, model }
}

export function useAiSettings() {
  const [stored, setStored] = useStore(aiSettingsStore)
  const settings = cleanSettings(stored)
  const change = (fn: (prev: AiSettings) => AiSettings) => setStored((prev) => fn(cleanSettings(prev)))
  return {
    settings,
    /** Guarda la clave (ya comprobada) y deja ese proveedor como el activo. */
    connect: (provider: ProviderId, apiKey: string, model?: string) =>
      change((prev) => ({
        provider,
        keys: { ...prev.keys, [provider]: cleanKey(apiKey) },
        models: model ? { ...prev.models, [provider]: model } : prev.models,
      })),
    /** Cambia a otro proveedor que ya tiene clave guardada. */
    selectProvider: (provider: ProviderId) => change((prev) => ({ ...prev, provider })),
    setModel: (provider: ProviderId, model: string) => change((prev) => ({ ...prev, models: { ...prev.models, [provider]: model.trim() } })),
    /** Borra la clave de ese proveedor de este navegador. Si era el activo, pasa a otro con clave (o a ninguno). */
    forgetKey: (provider: ProviderId) => {
      change((prev) => {
        const keys = { ...prev.keys }
        delete keys[provider]
        const models = { ...prev.models }
        delete models[provider]
        const next = prev.provider === provider ? (PROVIDER_IDS.find((p) => keys[p]) ?? null) : prev.provider
        return { provider: next, keys, models }
      })
      modelListStore.set((prev) => {
        const rest = { ...prev }
        delete rest[provider]
        return rest
      })
    },
  }
}

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { activeConfig, cleanSettings, loadModels, modelListStore } from './store'
import type { FetchLike } from './types'

describe('cleanSettings', () => {
  it('sanea datos raros sin romperse', () => {
    expect(cleanSettings(null)).toEqual({ provider: null, keys: {}, models: {} })
    expect(cleanSettings({ provider: 'otro', keys: { openai: '  sk-x ', fake: 'y', gemini: 3 }, models: 'x' })).toEqual({
      provider: null,
      keys: { openai: 'sk-x' },
      models: {},
    })
  })
})

describe('activeConfig', () => {
  const lists = { anthropic: { status: 'ready' as const, key: 'k', models: [{ id: 'claude-opus-5-5', label: 'Opus', structuredOutputs: true }] } }

  it('nada si falta proveedor o clave', () => {
    expect(activeConfig({ provider: null, keys: {}, models: {} }, {})).toBeNull()
    expect(activeConfig({ provider: 'openai', keys: {}, models: {} }, {})).toBeNull()
  })

  it('usa el modelo guardado y sus datos si están en la lista', () => {
    const config = activeConfig({ provider: 'anthropic', keys: { anthropic: 'k' }, models: { anthropic: 'claude-opus-5-5' } }, lists)
    expect(config).toEqual({ provider: 'anthropic', apiKey: 'k', model: 'claude-opus-5-5', modelInfo: lists.anthropic.models[0] })
  })

  it('sin modelo guardado, elige el predeterminado de la lista', () => {
    expect(activeConfig({ provider: 'anthropic', keys: { anthropic: 'k' }, models: {} }, lists)?.model).toBe('claude-opus-5-5')
  })

  it('un modelo escrito a mano funciona aunque no esté en la lista', () => {
    expect(activeConfig({ provider: 'openai', keys: { openai: 'k' }, models: { openai: 'mi-modelo' } }, {})).toEqual({
      provider: 'openai',
      apiKey: 'k',
      model: 'mi-modelo',
    })
  })
})

describe('loadModels', () => {
  beforeEach(() => modelListStore.reset())

  const ok = () => new Response(JSON.stringify({ data: [{ id: 'gpt-5-mini', created: 1 }] }), { status: 200 })

  it('guarda la lista en memoria y no la repite con la misma clave', async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => ok())
    await loadModels('openai', 'sk-1', { fetchImpl })
    await loadModels('openai', 'sk-1', { fetchImpl })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(modelListStore.get().openai).toMatchObject({ status: 'ready', key: 'sk-1' })
    await loadModels('openai', 'sk-2', { fetchImpl })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('guarda el error para enseñarlo', async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => new Response(JSON.stringify({ error: { code: 'invalid_api_key' } }), { status: 401 }))
    await expect(loadModels('openai', 'sk-bad', { fetchImpl })).rejects.toMatchObject({ kind: 'auth' })
    expect(modelListStore.get().openai).toMatchObject({ status: 'error', error: 'La clave de ChatGPT no es válida. Revísala o crea una nueva.' })
  })
})

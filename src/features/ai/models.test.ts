import { describe, expect, it } from 'vitest'
import { buildListModelsRequest, isChatModel, parseModelList, pickDefaultModel } from './models'
import type { ModelInfo } from './types'

const ids = (models: ModelInfo[]) => models.map((m) => m.id)
const asModels = (list: string[]): ModelInfo[] => list.map((id) => ({ id, label: id }))

describe('buildListModelsRequest', () => {
  it('pide la lista a cada proveedor con su forma de autenticación', () => {
    const a = buildListModelsRequest('anthropic', 'sk-ant-k')
    expect(a.url).toBe('https://api.anthropic.com/v1/models?limit=1000')
    expect(a.init.headers['x-api-key']).toBe('sk-ant-k')
    expect(a.init.headers['anthropic-dangerous-direct-browser-access']).toBe('true')

    const o = buildListModelsRequest('openai', 'sk-k')
    expect(o.url).toBe('https://api.openai.com/v1/models')
    expect(o.init.headers.authorization).toBe('Bearer sk-k')

    const g = buildListModelsRequest('gemini', 'AIzaK')
    expect(g.url).toBe('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000')
    expect(g.url).not.toContain('AIza')
    expect(g.init.headers['x-goog-api-key']).toBe('AIzaK')
  })
})

describe('parseModelList', () => {
  it('Claude: nombre, límite de salida y si admite JSON con esquema', () => {
    const models = parseModelList('anthropic', {
      data: [
        {
          type: 'model',
          id: 'claude-opus-5-5',
          display_name: 'Claude Opus 5.5',
          max_tokens: 128000,
          capabilities: { structured_outputs: { supported: true } },
        },
        { type: 'model', id: 'claude-old', display_name: 'Claude Old', max_tokens: 0, capabilities: null },
      ],
      has_more: false,
    })
    expect(models).toEqual([
      { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', maxOutputTokens: 128000, structuredOutputs: true },
      { id: 'claude-old', label: 'Claude Old' },
    ])
  })

  it('ChatGPT: deja solo los modelos de texto, los más nuevos primero', () => {
    const models = parseModelList('openai', {
      object: 'list',
      data: [
        { id: 'text-embedding-3-small', created: 5 },
        { id: 'gpt-4o-mini', created: 1 },
        { id: 'gpt-image-1', created: 9 },
        { id: 'whisper-1', created: 2 },
        { id: 'gpt-5-mini', created: 8 },
        { id: 'gpt-4o-realtime-preview', created: 7 },
        { id: 'o4-mini', created: 6 },
        { id: 'tts-1', created: 3 },
        { id: 'dall-e-3', created: 4 },
        { id: 'gpt-4o-mini-search-preview', created: 10 },
      ],
    })
    expect(ids(models)).toEqual(['gpt-5-mini', 'o4-mini', 'gpt-4o-mini'])
  })

  it('Gemini: solo los que generan texto, sin «models/» delante', () => {
    const models = parseModelList('gemini', {
      models: [
        { name: 'models/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', outputTokenLimit: 65536, supportedGenerationMethods: ['generateContent', 'countTokens'] },
        { name: 'models/text-embedding-004', displayName: 'Embedding', supportedGenerationMethods: ['embedContent'] },
        { name: 'models/gemini-2.5-flash-preview-tts', displayName: 'TTS', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemma-3-27b-it', displayName: 'Gemma 3 27B', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/imagen-4.0-generate-001', displayName: 'Imagen', supportedGenerationMethods: ['predict'] },
        { name: 'models/gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', supportedGenerationMethods: ['generateContent'] },
      ],
    })
    expect(models).toEqual([
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', maxOutputTokens: 65536, structuredOutputs: true },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', structuredOutputs: true },
    ])
  })

  it('distingue modelos con el mismo nombre y quita duplicados', () => {
    const models = parseModelList('gemini', {
      models: [
        { name: 'models/gemini-a', displayName: 'Gemini Flash', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-b', displayName: 'Gemini Flash', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-a', displayName: 'Gemini Flash', supportedGenerationMethods: ['generateContent'] },
      ],
    })
    expect(models.map((m) => m.label)).toEqual(['Gemini Flash · gemini-a', 'Gemini Flash · gemini-b'])
  })

  it('no se rompe con respuestas raras', () => {
    expect(parseModelList('anthropic', null)).toEqual([])
    expect(parseModelList('openai', { data: 'x' })).toEqual([])
    expect(parseModelList('gemini', { models: [null, 1] })).toEqual([])
  })
})

describe('isChatModel', () => {
  it('reconoce los modelos de conversación', () => {
    expect(isChatModel('openai', 'gpt-6-astra')).toBe(true)
    expect(isChatModel('openai', 'o3')).toBe(true)
    expect(isChatModel('openai', 'gpt-4o-transcribe')).toBe(false)
    expect(isChatModel('gemini', 'gemini-3.8-flash')).toBe(true)
    expect(isChatModel('gemini', 'gemini-2.5-flash-image')).toBe(false)
    expect(isChatModel('anthropic', 'claude-haiku-4-5')).toBe(true)
  })
})

describe('pickDefaultModel', () => {
  it('Claude: el modelo recomendado si está; si no, el más nuevo', () => {
    expect(pickDefaultModel('anthropic', asModels(['claude-fable-5-1', 'claude-opus-5-5', 'claude-haiku-4-5']))).toBe('claude-opus-5-5')
    expect(pickDefaultModel('anthropic', asModels(['claude-sonnet-5-5', 'claude-haiku-4-5']))).toBe('claude-sonnet-5-5')
  })

  it('ChatGPT: el «mini» más nuevo sin fecha', () => {
    expect(pickDefaultModel('openai', asModels(['gpt-6-astra', 'gpt-5-mini-2025-08-07', 'gpt-5-mini', 'gpt-4.1-mini', 'gpt-5.1-mini', 'gpt-4o-mini']))).toBe(
      'gpt-5.1-mini',
    )
    expect(pickDefaultModel('openai', asModels(['gpt-4o', 'gpt-4o-mini', 'gpt-4o-mini-2024-07-18']))).toBe('gpt-4o-mini')
    expect(pickDefaultModel('openai', asModels(['gpt-6-astra', 'gpt-6-astra-2026-01-01', 'gpt-5']))).toBe('gpt-6-astra')
  })

  it('Gemini: el Flash estable más nuevo (o el alias «latest»)', () => {
    expect(pickDefaultModel('gemini', asModels(['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-3.8-flash', 'gemini-3.8-flash-lite', 'gemini-4-flash-preview']))).toBe(
      'gemini-3.8-flash',
    )
    expect(pickDefaultModel('gemini', asModels(['gemini-3.8-flash', 'gemini-flash-latest']))).toBe('gemini-flash-latest')
    expect(pickDefaultModel('gemini', asModels(['gemini-2.5-pro']))).toBe('gemini-2.5-pro')
  })

  it('sin modelos no elige ninguno', () => {
    expect(pickDefaultModel('openai', [])).toBeUndefined()
  })
})

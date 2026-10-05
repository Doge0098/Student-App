import { describe, expect, it } from 'vitest'
import { ANTHROPIC_FALLBACK_BETA, ANTHROPIC_MAX_TOKENS, buildGenerateRequest, decodeStreamEvent, embeddedError, parseGenerateResponse } from './requests'
import { QUIZ_SCHEMA } from './schemas'
import type { AiConfig, AiRequest } from './types'

const req: AiRequest = {
  system: 'Eres un asistente.',
  messages: [
    { role: 'user', text: 'Hola' },
    { role: 'assistant', text: '¡Hola!' },
    { role: 'user', text: '¿Qué es una derivada?' },
  ],
  schema: QUIZ_SCHEMA,
  schemaName: 'test',
}

const body = (r: { init: { body?: string } }) => JSON.parse(r.init.body ?? '{}')

describe('buildGenerateRequest · Claude', () => {
  const config: AiConfig = { provider: 'anthropic', apiKey: 'sk-ant-secret-123456', model: 'claude-opus-5-5' }

  it('usa la API de mensajes con las cabeceras de acceso directo desde el navegador', () => {
    const r = buildGenerateRequest(config, req, { stream: false, structured: false })
    expect(r.url).toBe('https://api.anthropic.com/v1/messages')
    expect(r.init.method).toBe('POST')
    expect(r.init.headers['x-api-key']).toBe('sk-ant-secret-123456')
    expect(r.init.headers['anthropic-version']).toBe('2023-06-01')
    expect(r.init.headers['anthropic-dangerous-direct-browser-access']).toBe('true')
    const b = body(r)
    expect(b.model).toBe('claude-opus-5-5')
    expect(b.max_tokens).toBe(ANTHROPIC_MAX_TOKENS)
    expect(b.system).toBe('Eres un asistente.')
    expect(b.messages).toEqual([
      { role: 'user', content: 'Hola' },
      { role: 'assistant', content: '¡Hola!' },
      { role: 'user', content: '¿Qué es una derivada?' },
    ])
    expect(b.stream).toBeUndefined()
    expect(b.output_config).toBeUndefined()
    // No se mandan parámetros que los modelos actuales rechazan.
    expect(b.temperature).toBeUndefined()
    expect(b.thinking).toBeUndefined()
  })

  it('pide la repetición automática en otro modelo solo en los modelos que la admiten', () => {
    const r = buildGenerateRequest(config, req, { stream: false, structured: false })
    expect(body(r).fallbacks).toBe('default')
    expect(r.init.headers['anthropic-beta']).toBe(ANTHROPIC_FALLBACK_BETA)

    const haiku = buildGenerateRequest({ ...config, model: 'claude-haiku-4-5' }, req, { stream: false, structured: false })
    expect(body(haiku).fallbacks).toBeUndefined()
    expect(haiku.init.headers['anthropic-beta']).toBeUndefined()

    const off = buildGenerateRequest(config, req, { stream: false, structured: false, noFallback: true })
    expect(body(off).fallbacks).toBeUndefined()
    expect(off.init.headers['anthropic-beta']).toBeUndefined()
  })

  it('añade el esquema JSON y el streaming cuando se piden', () => {
    const b = body(buildGenerateRequest(config, req, { stream: true, structured: true }))
    expect(b.stream).toBe(true)
    expect(b.output_config).toEqual({ format: { type: 'json_schema', schema: QUIZ_SCHEMA } })
  })

  it('no pide más tokens de salida de los que admite el modelo', () => {
    const small = { ...config, model: 'claude-x', modelInfo: { id: 'claude-x', label: 'X', maxOutputTokens: 4096 } }
    expect(body(buildGenerateRequest(small, req, { stream: false, structured: false })).max_tokens).toBe(4096)
  })
})

describe('buildGenerateRequest · ChatGPT', () => {
  const config: AiConfig = { provider: 'openai', apiKey: 'sk-proj-secret', model: 'gpt-5-mini' }

  it('usa la API Responses sin guardar la conversación', () => {
    const r = buildGenerateRequest(config, req, { stream: false, structured: false })
    expect(r.url).toBe('https://api.openai.com/v1/responses')
    expect(r.init.headers.authorization).toBe('Bearer sk-proj-secret')
    const b = body(r)
    expect(b.model).toBe('gpt-5-mini')
    expect(b.instructions).toBe('Eres un asistente.')
    expect(b.store).toBe(false)
    expect(b.input).toEqual([
      { role: 'user', content: 'Hola' },
      { role: 'assistant', content: '¡Hola!' },
      { role: 'user', content: '¿Qué es una derivada?' },
    ])
    expect(b.text).toBeUndefined()
  })

  it('añade el formato json_schema estricto', () => {
    const b = body(buildGenerateRequest(config, req, { stream: true, structured: true }))
    expect(b.stream).toBe(true)
    expect(b.text).toEqual({ format: { type: 'json_schema', name: 'test', schema: QUIZ_SCHEMA, strict: true } })
  })
})

describe('buildGenerateRequest · Gemini', () => {
  const config: AiConfig = { provider: 'gemini', apiKey: 'AIzaSecretSecretSecret', model: 'models/gemini-2.5-flash' }

  it('manda la clave en una cabecera, nunca en la URL', () => {
    const r = buildGenerateRequest(config, req, { stream: false, structured: false })
    expect(r.url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent')
    expect(r.url).not.toContain('AIza')
    expect(r.init.headers['x-goog-api-key']).toBe('AIzaSecretSecretSecret')
  })

  it('convierte los roles y las instrucciones de sistema', () => {
    const b = body(buildGenerateRequest(config, req, { stream: false, structured: false }))
    expect(b.systemInstruction).toEqual({ parts: [{ text: 'Eres un asistente.' }] })
    expect(b.contents.map((c: { role: string }) => c.role)).toEqual(['user', 'model', 'user'])
    expect(b.contents[2].parts).toEqual([{ text: '¿Qué es una derivada?' }])
    expect(b.generationConfig).toBeUndefined()
  })

  it('usa SSE para el streaming y el esquema de Gemini para el JSON', () => {
    const r = buildGenerateRequest(config, req, { stream: true, structured: true })
    expect(r.url).toMatch(/:streamGenerateContent\?alt=sse$/)
    const b = body(r)
    expect(b.generationConfig.responseMimeType).toBe('application/json')
    expect(b.generationConfig.responseSchema.type).toBe('OBJECT')
    expect(JSON.stringify(b.generationConfig.responseSchema)).not.toContain('additionalProperties')
  })
})

describe('parseGenerateResponse', () => {
  it('Claude: junta solo los bloques de texto y detecta rechazos y cortes', () => {
    const ok = parseGenerateResponse('anthropic', {
      content: [{ type: 'thinking', thinking: '' }, { type: 'fallback' }, { type: 'text', text: 'Hola ' }, { type: 'text', text: 'mundo' }],
      stop_reason: 'end_turn',
    })
    expect(ok).toEqual({ text: 'Hola mundo', finish: 'stop' })
    expect(parseGenerateResponse('anthropic', { content: [], stop_reason: 'refusal' }).finish).toBe('refusal')
    expect(parseGenerateResponse('anthropic', { content: [{ type: 'text', text: 'a' }], stop_reason: 'max_tokens' }).finish).toBe('max_tokens')
  })

  it('ChatGPT: lee los mensajes de la salida (saltando el razonamiento)', () => {
    const ok = parseGenerateResponse('openai', {
      status: 'completed',
      output: [
        { type: 'reasoning', summary: [] },
        { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '{"a":1}' }] },
      ],
    })
    expect(ok).toEqual({ text: '{"a":1}', finish: 'stop' })
    const refusal = parseGenerateResponse('openai', {
      status: 'completed',
      output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'No.' }] }],
    })
    expect(refusal.finish).toBe('refusal')
    const cut = parseGenerateResponse('openai', { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output: [] })
    expect(cut.finish).toBe('max_tokens')
  })

  it('ChatGPT: un 200 con status "failed" se trata como error', () => {
    expect(embeddedError('openai', { status: 'failed', error: { code: 'server_error', message: 'x' } })).toEqual({
      error: { code: 'server_error', message: 'x' },
    })
    expect(embeddedError('openai', { status: 'completed' })).toBeNull()
  })

  it('Gemini: salta los «pensamientos» y detecta bloqueos', () => {
    const ok = parseGenerateResponse('gemini', {
      candidates: [{ content: { role: 'model', parts: [{ text: 'pienso…', thought: true }, { text: 'Respuesta' }] }, finishReason: 'STOP' }],
    })
    expect(ok).toEqual({ text: 'Respuesta', finish: 'stop' })
    expect(parseGenerateResponse('gemini', { promptFeedback: { blockReason: 'SAFETY' } }).finish).toBe('refusal')
    expect(parseGenerateResponse('gemini', { candidates: [{ finishReason: 'SAFETY' }] }).finish).toBe('refusal')
    expect(parseGenerateResponse('gemini', { candidates: [{ content: { parts: [{ text: 'a' }] }, finishReason: 'MAX_TOKENS' }] }).finish).toBe(
      'max_tokens',
    )
  })

  it('no se rompe con respuestas raras', () => {
    expect(parseGenerateResponse('anthropic', null)).toEqual({ text: '', finish: 'stop' })
    expect(parseGenerateResponse('openai', 'hola')).toEqual({ text: '', finish: 'stop' })
    expect(parseGenerateResponse('gemini', [])).toEqual({ text: '', finish: 'stop' })
  })
})

describe('decodeStreamEvent', () => {
  const ev = (data: unknown, event = 'message') => ({ event, data: JSON.stringify(data) })

  it('Claude', () => {
    expect(decodeStreamEvent('anthropic', ev({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Ho' } }))).toEqual({ delta: 'Ho' })
    expect(decodeStreamEvent('anthropic', ev({ type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: 'x' } }))).toEqual({})
    expect(decodeStreamEvent('anthropic', ev({ type: 'message_delta', delta: { stop_reason: 'end_turn' } }))).toEqual({ finish: 'stop' })
    expect(decodeStreamEvent('anthropic', ev({ type: 'message_delta', delta: { stop_reason: 'refusal' } }))).toEqual({ finish: 'refusal' })
    expect(decodeStreamEvent('anthropic', ev({ type: 'ping' }))).toEqual({})
    const error = { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }
    expect(decodeStreamEvent('anthropic', ev(error, 'error'))).toEqual({ error })
  })

  it('ChatGPT', () => {
    expect(decodeStreamEvent('openai', ev({ type: 'response.output_text.delta', delta: 'Ho' }))).toEqual({ delta: 'Ho' })
    expect(decodeStreamEvent('openai', ev({ type: 'response.completed', response: {} }))).toEqual({ finish: 'stop' })
    expect(decodeStreamEvent('openai', ev({ type: 'response.refusal.done', refusal: 'No' }))).toEqual({ finish: 'refusal' })
    expect(decodeStreamEvent('openai', ev({ type: 'response.incomplete', response: { incomplete_details: { reason: 'max_output_tokens' } } }))).toEqual({
      finish: 'max_tokens',
    })
    expect(decodeStreamEvent('openai', ev({ type: 'response.failed', response: { error: { code: 'server_error', message: 'x' } } }))).toEqual({
      error: { error: { code: 'server_error', message: 'x' } },
    })
    expect(decodeStreamEvent('openai', { event: 'message', data: '[DONE]' })).toEqual({})
  })

  it('Gemini', () => {
    expect(decodeStreamEvent('gemini', ev({ candidates: [{ content: { parts: [{ text: 'Ho' }] } }] }))).toEqual({ delta: 'Ho' })
    expect(decodeStreamEvent('gemini', ev({ candidates: [{ content: { parts: [{ text: 'la' }] }, finishReason: 'STOP' }] }))).toEqual({
      delta: 'la',
      finish: 'stop',
    })
    const error = { error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'Quota' } }
    expect(decodeStreamEvent('gemini', ev(error))).toEqual({ error })
  })

  it('ignora datos que no son JSON', () => {
    expect(decodeStreamEvent('anthropic', { event: 'message', data: 'basura' })).toEqual({})
  })
})

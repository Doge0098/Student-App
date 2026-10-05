import { describe, expect, it, vi } from 'vitest'
import { generate, generateJson, listModels, streamText, supportsStructured } from './client'
import { AiError } from './errors'
import { QUIZ_SCHEMA, parseQuiz } from './schemas'
import type { AiConfig, AiRequest, FetchLike } from './types'

/* Sin claves ni red: todas las respuestas son simuladas. */

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const sse = (chunks: string[]) => {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c))
      controller.close()
    },
  })
  return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } })
}

/** fetch simulado que devuelve las respuestas en orden y guarda las peticiones. */
function mockFetch(...responses: (Response | Error)[]) {
  const calls: { url: string; init: RequestInit }[] = []
  const fn = vi.fn<FetchLike>(async (url, init) => {
    calls.push({ url, init })
    const next = responses.shift()
    if (!next) throw new Error('sin más respuestas')
    if (next instanceof Error) throw next
    return next
  })
  return { fn, calls, body: (i: number) => JSON.parse(String(calls[i].init.body)) }
}

const claude: AiConfig = { provider: 'anthropic', apiKey: 'sk-ant-api03-SECRETSECRET', model: 'claude-opus-5-5' }
const chatgpt: AiConfig = { provider: 'openai', apiKey: 'sk-proj-SECRETSECRET', model: 'gpt-5-mini' }
const gemini: AiConfig = { provider: 'gemini', apiKey: 'AIzaSyD-SECRETSECRETSECRET', model: 'gemini-2.5-flash' }

const ask: AiRequest = { system: 'S', messages: [{ role: 'user', text: 'Hola' }] }

describe('listModels', () => {
  it('devuelve los modelos de conversación', async () => {
    const m = mockFetch(json(200, { data: [{ id: 'gpt-5-mini', created: 1 }, { id: 'whisper-1', created: 2 }] }))
    await expect(listModels('openai', 'sk-x', m.fn)).resolves.toEqual([{ id: 'gpt-5-mini', label: 'gpt-5-mini' }])
    expect(m.calls[0].url).toBe('https://api.openai.com/v1/models')
  })

  it('clave mala → error amable sin la clave', async () => {
    const m = mockFetch(json(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }))
    const error = await listModels('anthropic', claude.apiKey, m.fn).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AiError)
    expect((error as AiError).kind).toBe('auth')
    expect(JSON.stringify(error)).not.toContain('SECRET')
    expect((error as AiError).message).not.toContain('SECRET')
  })

  it('sin conexión (o bloqueado por el navegador) → error de red', async () => {
    const m = mockFetch(new TypeError('Failed to fetch'))
    await expect(listModels('gemini', gemini.apiKey, m.fn)).rejects.toMatchObject({ kind: 'network' })
  })
})

describe('generate', () => {
  it('Claude: devuelve el texto', async () => {
    const m = mockFetch(json(200, { content: [{ type: 'text', text: 'Hola' }], stop_reason: 'end_turn' }))
    await expect(generate(claude, ask, { fetchImpl: m.fn })).resolves.toEqual({ text: 'Hola', truncated: false })
  })

  it('rechazo de la IA → error «refused»', async () => {
    const m = mockFetch(json(200, { content: [], stop_reason: 'refusal', stop_details: { type: 'refusal', category: null } }))
    await expect(generate(claude, ask, { fetchImpl: m.fn })).rejects.toMatchObject({ kind: 'refused' })
  })

  it('si la cuenta no admite la repetición en otro modelo, repite sin ella', async () => {
    const m = mockFetch(
      json(400, { type: 'error', error: { type: 'invalid_request_error', message: 'Unexpected value(s) `server-side-fallback-2026-07-01` for the `anthropic-beta` header.' } }),
      json(200, { content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn' }),
    )
    await expect(generate(claude, ask, { fetchImpl: m.fn })).resolves.toMatchObject({ text: 'ok' })
    expect(m.body(0).fallbacks).toBe('default')
    expect(m.body(1).fallbacks).toBeUndefined()
    expect((m.calls[1].init.headers as Record<string, string>)['anthropic-beta']).toBeUndefined()
  })

  it('ChatGPT: un 200 con status "failed" es un error', async () => {
    const m = mockFetch(json(200, { status: 'failed', error: { code: 'server_error', message: 'boom' }, output: [] }))
    await expect(generate(chatgpt, ask, { fetchImpl: m.fn })).rejects.toMatchObject({ kind: 'overloaded' })
  })

  it('cancelar → «aborted»', async () => {
    const m = mockFetch(new DOMException('The operation was aborted.', 'AbortError'))
    await expect(generate(gemini, ask, { fetchImpl: m.fn })).rejects.toMatchObject({ kind: 'aborted' })
  })

  it('respuesta vacía → error amable', async () => {
    const m = mockFetch(json(200, { candidates: [{ content: { parts: [] }, finishReason: 'STOP' }] }))
    await expect(generate(gemini, ask, { fetchImpl: m.fn })).rejects.toMatchObject({ kind: 'bad_output' })
  })
})

describe('streamText', () => {
  it('Claude: va entregando el texto acumulado', async () => {
    const m = mockFetch(
      sse([
        'event: message_start\ndata: {"type":"message_start","message":{"id":"m"}}\n\n',
        'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
        'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Ho"}}\n\nevent: content_bl',
        'ock_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"la"}}\n\n',
        'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\nevent: message_stop\ndata: {"type":"message_stop"}\n\n',
      ]),
    )
    const seen: string[] = []
    const result = await streamText(claude, ask, (t) => seen.push(t), { fetchImpl: m.fn })
    expect(seen).toEqual(['Ho', 'Hola'])
    expect(result).toEqual({ text: 'Hola', truncated: false })
    expect(m.body(0).stream).toBe(true)
  })

  it('ChatGPT (API Responses)', async () => {
    const m = mockFetch(
      sse([
        'event: response.created\ndata: {"type":"response.created","response":{}}\n\n',
        'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Bue"}\n\n',
        'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"nas"}\n\n',
        'event: response.completed\ndata: {"type":"response.completed","response":{"status":"completed"}}\n\n',
      ]),
    )
    const result = await streamText(chatgpt, ask, () => {}, { fetchImpl: m.fn })
    expect(result.text).toBe('Buenas')
  })

  it('Gemini (SSE sin nombres de evento, con \\r\\n)', async () => {
    const m = mockFetch(
      sse([
        'data: {"candidates":[{"content":{"parts":[{"text":"Uno "}],"role":"model"}}]}\r\n\r\n',
        'data: {"candidates":[{"content":{"parts":[{"text":"dos"}],"role":"model"},"finishReason":"STOP"}]}\r\n\r\n',
      ]),
    )
    const result = await streamText(gemini, ask, () => {}, { fetchImpl: m.fn })
    expect(result.text).toBe('Uno dos')
    expect(m.calls[0].url).toContain(':streamGenerateContent?alt=sse')
  })

  it('error dentro del stream → error amable', async () => {
    const m = mockFetch(
      sse([
        'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Ho"}}\n\n',
        'event: error\ndata: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}\n\n',
      ]),
    )
    await expect(streamText(claude, ask, () => {}, { fetchImpl: m.fn })).rejects.toMatchObject({ kind: 'overloaded' })
  })

  it('rechazo a mitad → error «refused» (no se da por buena la respuesta a medias)', async () => {
    const m = mockFetch(
      sse([
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Ho"}}\n\n',
        'data: {"type":"message_delta","delta":{"stop_reason":"refusal"}}\n\n',
      ]),
    )
    await expect(streamText(claude, ask, () => {}, { fetchImpl: m.fn })).rejects.toMatchObject({ kind: 'refused' })
  })

  it('si el proveedor no deja usar streaming con ese modelo, la pide entera', async () => {
    const m = mockFetch(
      json(400, { error: { message: 'Your organization must be verified to stream this model.', type: 'invalid_request_error', param: 'stream', code: 'unsupported_value' } }),
      json(200, { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'Entera' }] }] }),
    )
    const seen: string[] = []
    const result = await streamText(chatgpt, ask, (t) => seen.push(t), { fetchImpl: m.fn })
    expect(result.text).toBe('Entera')
    expect(seen).toEqual(['Entera'])
    expect(m.body(1).stream).toBeUndefined()
  })

  it('respuesta cortada por longitud → truncated', async () => {
    const m = mockFetch(sse(['data: {"candidates":[{"content":{"parts":[{"text":"Muy larg"}]},"finishReason":"MAX_TOKENS"}]}\n\n']))
    await expect(streamText(gemini, ask, () => {}, { fetchImpl: m.fn })).resolves.toEqual({ text: 'Muy larg', truncated: true })
  })
})

describe('generateJson', () => {
  const quizReq: AiRequest = { ...ask, schema: QUIZ_SCHEMA, schemaName: 'test' }
  const quizJson = JSON.stringify({ questions: [{ question: 'P', options: ['A', 'B'], answer: 0, explanation: 'E' }] })

  it('pide el esquema si el modelo lo admite y valida el resultado', async () => {
    const m = mockFetch(json(200, { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: quizJson }] }] }))
    const quiz = await generateJson(chatgpt, quizReq, (t) => parseQuiz(t, 5), { fetchImpl: m.fn })
    expect(quiz).toHaveLength(1)
    expect(m.body(0).text.format.type).toBe('json_schema')
  })

  it('si el proveedor rechaza el esquema, repite sin él', async () => {
    const m = mockFetch(
      json(400, { error: { code: 400, status: 'INVALID_ARGUMENT', message: 'Invalid JSON payload received. Unknown name "responseSchema"' } }),
      json(200, { candidates: [{ content: { parts: [{ text: '```json\n' + quizJson + '\n```' }] }, finishReason: 'STOP' }] }),
    )
    const quiz = await generateJson(gemini, quizReq, (t) => parseQuiz(t, 5), { fetchImpl: m.fn })
    expect(quiz[0].question).toBe('P')
    expect(m.body(0).generationConfig).toBeDefined()
    expect(m.body(1).generationConfig).toBeUndefined()
  })

  it('Claude sin datos del modelo: pide el JSON solo con instrucciones', async () => {
    const m = mockFetch(json(200, { content: [{ type: 'text', text: quizJson }], stop_reason: 'end_turn' }))
    await generateJson(claude, quizReq, (t) => parseQuiz(t, 5), { fetchImpl: m.fn })
    expect(m.body(0).output_config).toBeUndefined()
  })

  it('Claude con un modelo que admite esquemas: lo pide', async () => {
    const m = mockFetch(json(200, { content: [{ type: 'text', text: quizJson }], stop_reason: 'end_turn' }))
    const config = { ...claude, modelInfo: { id: claude.model, label: 'Opus', structuredOutputs: true } }
    await generateJson(config, quizReq, (t) => parseQuiz(t, 5), { fetchImpl: m.fn })
    expect(m.body(0).output_config.format.type).toBe('json_schema')
  })

  it('respuesta cortada → error amable', async () => {
    const m = mockFetch(json(200, { content: [{ type: 'text', text: '{"questions":[' }], stop_reason: 'max_tokens' }))
    await expect(generateJson(claude, quizReq, (t) => parseQuiz(t, 5), { fetchImpl: m.fn })).rejects.toMatchObject({ kind: 'truncated' })
  })

  it('basura → error amable', async () => {
    const m = mockFetch(json(200, { content: [{ type: 'text', text: 'Lo siento, no sé.' }], stop_reason: 'end_turn' }))
    await expect(generateJson(claude, quizReq, (t) => parseQuiz(t, 5), { fetchImpl: m.fn })).rejects.toMatchObject({ kind: 'bad_output' })
  })

  it('los demás errores no se repiten', async () => {
    const m = mockFetch(json(401, { error: { code: 'invalid_api_key', message: 'x' } }))
    await expect(generateJson(chatgpt, quizReq, (t) => parseQuiz(t, 5), { fetchImpl: m.fn })).rejects.toMatchObject({ kind: 'auth' })
    expect(m.fn).toHaveBeenCalledTimes(1)
  })
})

describe('supportsStructured', () => {
  it('según proveedor y modelo', () => {
    expect(supportsStructured(chatgpt)).toBe(true)
    expect(supportsStructured({ ...chatgpt, model: 'gpt-3.5-turbo' })).toBe(false)
    expect(supportsStructured({ ...chatgpt, model: 'gpt-4-turbo' })).toBe(false)
    expect(supportsStructured({ ...chatgpt, model: 'gpt-4o' })).toBe(true)
    expect(supportsStructured(claude)).toBe(false)
    expect(supportsStructured(gemini)).toBe(true)
    expect(supportsStructured({ ...gemini, modelInfo: { id: 'g', label: 'g', structuredOutputs: false } })).toBe(false)
  })
})

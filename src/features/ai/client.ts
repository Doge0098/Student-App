/**
 * Llamadas a los proveedores desde el navegador del estudiante, con su propia clave.
 * LockIn no tiene servidor: la petición va directa de este navegador a la IA elegida.
 * Nunca se escribe la clave en consola ni aparece en los mensajes de error.
 */
import { AiError, classifyError, fetchFailure, makeError, type ErrorContext } from './errors'
import { buildListModelsRequest, parseModelList } from './models'
import { buildGenerateRequest, decodeStreamEvent, embeddedError, parseGenerateResponse, usesAnthropicFallback, type BuildOptions, type HttpRequest } from './requests'
import { createSseParser } from './sse'
import type { AiConfig, AiRequest, AiResult, FetchLike, ModelInfo, ProviderId } from './types'

const defaultFetch: FetchLike = (url, init) => fetch(url, init)

const contextOf = (config: AiConfig): ErrorContext => ({ provider: config.provider, model: config.model, apiKey: config.apiKey })

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return null
  }
}

async function send(http: HttpRequest, ctx: ErrorContext, fetchImpl: FetchLike, signal?: AbortSignal): Promise<Response> {
  let res: Response
  try {
    res = await fetchImpl(http.url, { ...http.init, signal })
  } catch (error) {
    throw fetchFailure(ctx, error)
  }
  if (!res.ok) throw classifyError(ctx, res.status, await readJson(res))
  return res
}

/** Pide la lista de modelos. También sirve para comprobar que la clave funciona. */
export async function listModels(provider: ProviderId, apiKey: string, fetchImpl: FetchLike = defaultFetch, signal?: AbortSignal): Promise<ModelInfo[]> {
  const ctx: ErrorContext = { provider, apiKey }
  const res = await send(buildListModelsRequest(provider, apiKey), ctx, fetchImpl, signal)
  const body = await readJson(res)
  if (body === null) throw makeError('unknown', ctx, 'invalid JSON')
  return parseModelList(provider, body)
}

/** ¿El modelo admite salida JSON con esquema? Si no se sabe, se intenta y, si falla, se repite sin esquema. */
export function supportsStructured(config: AiConfig): boolean {
  if (config.provider === 'anthropic') return config.modelInfo?.structuredOutputs === true
  if (config.provider === 'openai') return !/^(gpt-3\.5|gpt-4(-|$)|gpt-4-turbo|o1-(mini|preview))/.test(config.model)
  return config.modelInfo?.structuredOutputs !== false
}

/** Errores 400 por los que vale la pena repetir la petición de otra forma. */
const isRetryable = (error: unknown, pattern: RegExp) => error instanceof AiError && error.kind === 'bad_request' && pattern.test(error.detail)

/**
 * Hace la petición y, si Claude no acepta la repetición automática en otro modelo (beta no activada
 * en esa cuenta), la repite sin ella.
 */
async function withFallbackRetry<T>(config: AiConfig, run: (noFallback: boolean) => Promise<T>): Promise<T> {
  try {
    return await run(false)
  } catch (error) {
    if (config.provider === 'anthropic' && usesAnthropicFallback(config.model) && isRetryable(error, /anthropic-beta|fallback/i)) {
      return run(true)
    }
    throw error
  }
}

function finishResult(ctx: ErrorContext, text: string, finish: 'stop' | 'max_tokens' | 'refusal'): AiResult {
  if (finish === 'refusal') throw makeError('refused', ctx)
  if (!text.trim()) throw makeError(finish === 'max_tokens' ? 'truncated' : 'bad_output', ctx, 'empty response')
  return { text, truncated: finish === 'max_tokens' }
}

async function generateOnce(config: AiConfig, req: AiRequest, opts: BuildOptions, fetchImpl: FetchLike, signal?: AbortSignal): Promise<AiResult> {
  const ctx = contextOf(config)
  const res = await send(buildGenerateRequest(config, req, opts), ctx, fetchImpl, signal)
  const body = await readJson(res)
  if (body === null) throw makeError('unknown', ctx, 'invalid JSON')
  const embedded = embeddedError(config.provider, body)
  if (embedded) throw classifyError(ctx, undefined, embedded)
  const { text, finish } = parseGenerateResponse(config.provider, body)
  return finishResult(ctx, text, finish)
}

/** Respuesta completa de una vez. */
export function generate(config: AiConfig, req: AiRequest, options: { structured?: boolean; signal?: AbortSignal; fetchImpl?: FetchLike } = {}): Promise<AiResult> {
  const { structured = false, signal, fetchImpl = defaultFetch } = options
  return withFallbackRetry(config, (noFallback) => generateOnce(config, req, { stream: false, structured, noFallback }, fetchImpl, signal))
}

async function streamOnce(
  config: AiConfig,
  req: AiRequest,
  noFallback: boolean,
  onText: (text: string) => void,
  fetchImpl: FetchLike,
  signal?: AbortSignal,
): Promise<AiResult> {
  const ctx = contextOf(config)
  const res = await send(buildGenerateRequest(config, req, { stream: true, structured: false, noFallback }), ctx, fetchImpl, signal)
  if (!res.body) throw makeError('unknown', ctx, 'no body')

  const parser = createSseParser()
  const decoder = new TextDecoder()
  const reader = res.body.getReader()
  let text = ''
  let finish: 'stop' | 'max_tokens' | 'refusal' = 'stop'
  // Ha llegado el evento final de la IA (si no, la conexión se cortó a medias).
  let ended = false

  const handle = (events: ReturnType<typeof parser.feed>) => {
    for (const ev of events) {
      const step = decodeStreamEvent(config.provider, ev)
      if (step.error) throw classifyError(ctx, undefined, step.error)
      if (step.delta) {
        text += step.delta
        onText(text)
      }
      if (step.finish) ended = true
      if (step.finish && step.finish !== 'stop') finish = step.finish
    }
  }

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      handle(parser.feed(decoder.decode(value, { stream: true })))
    }
    handle(parser.feed(decoder.decode()))
    handle(parser.end())
  } catch (error) {
    reader.cancel().catch(() => {})
    throw fetchFailure(ctx, error)
  }
  if (!ended && finish === 'stop') {
    // La conexión se cerró sin el evento final: lo recibido no es una respuesta completa.
    if (!text.trim()) throw makeError('network', ctx, 'stream ended early')
    return { text, truncated: true }
  }
  return finishResult(ctx, text, finish)
}

/**
 * Respuesta poco a poco (para el chat). `onText` recibe el texto acumulado cada vez que llega más.
 * Si el proveedor no deja usar streaming con ese modelo (p. ej. cuentas sin verificar), se pide entera.
 */
export async function streamText(
  config: AiConfig,
  req: AiRequest,
  onText: (text: string) => void,
  options: { signal?: AbortSignal; fetchImpl?: FetchLike } = {},
): Promise<AiResult> {
  const { signal, fetchImpl = defaultFetch } = options
  try {
    return await withFallbackRetry(config, (noFallback) => streamOnce(config, req, noFallback, onText, fetchImpl, signal))
  } catch (error) {
    if (!isRetryable(error, /stream/i)) throw error
    const result = await generate(config, req, { signal, fetchImpl })
    onText(result.text)
    return result
  }
}

/**
 * Pide JSON (con esquema si el modelo lo admite) y lo valida con `parse`.
 * Si el proveedor rechaza el esquema, se repite pidiendo el JSON solo con las instrucciones.
 */
export async function generateJson<T>(
  config: AiConfig,
  req: AiRequest,
  parse: (text: string) => T,
  options: { signal?: AbortSignal; fetchImpl?: FetchLike } = {},
): Promise<T> {
  const structured = Boolean(req.schema) && supportsStructured(config)
  let result: AiResult
  try {
    result = await generate(config, req, { ...options, structured })
  } catch (error) {
    if (!structured || !(error instanceof AiError) || error.kind !== 'bad_request') throw error
    result = await generate(config, req, { ...options, structured: false })
  }
  if (result.truncated) throw makeError('truncated', contextOf(config))
  return parse(result.text)
}

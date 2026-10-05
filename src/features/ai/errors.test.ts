import { describe, expect, it } from 'vitest'
import { AiError, classifyError, fetchFailure, redact } from './errors'

const anthropic = { provider: 'anthropic' as const, model: 'claude-opus-5-5', apiKey: 'sk-ant-api03-SECRETSECRET' }
const openai = { provider: 'openai' as const, model: 'gpt-5-mini', apiKey: 'sk-proj-SECRETSECRET' }
const gemini = { provider: 'gemini' as const, model: 'gemini-2.5-flash', apiKey: 'AIzaSyD-SECRETSECRETSECRET' }

describe('classifyError', () => {
  it('clave no válida (respuestas reales de cada proveedor)', () => {
    const a = classifyError(anthropic, 401, { type: 'error', error: { type: 'authentication_error', message: 'API key is invalid.' }, request_id: null })
    expect(a.kind).toBe('auth')
    expect(a.message).toBe('La clave de Claude no es válida. Revísala o crea una nueva.')

    const o = classifyError(openai, 401, {
      error: { message: 'Incorrect API key provided: sk-proj-****CRET.', type: 'invalid_request_error', param: null, code: 'invalid_api_key' },
    })
    expect(o.kind).toBe('auth')

    // Gemini responde 400 (no 401) cuando la clave no vale.
    const g = classifyError(gemini, 400, {
      error: {
        code: 400,
        message: 'API key not valid. Please pass a valid API key.',
        status: 'INVALID_ARGUMENT',
        details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'API_KEY_INVALID', domain: 'googleapis.com' }],
      },
    })
    expect(g.kind).toBe('auth')
    expect(g.message).toContain('Gemini')
  })

  it('sin saldo o cuota agotada', () => {
    expect(classifyError(anthropic, 400, { type: 'error', error: { type: 'invalid_request_error', message: 'Your credit balance is too low to access the Anthropic API.' } }).kind).toBe('quota')
    expect(classifyError(anthropic, 402, { type: 'error', error: { type: 'billing_error', message: 'x' } }).kind).toBe('quota')
    const o = classifyError(openai, 429, { error: { message: 'You exceeded your current quota', type: 'insufficient_quota', code: 'insufficient_quota' } })
    expect(o.kind).toBe('quota')
    expect(o.message).toContain('saldo')
  })

  it('demasiadas peticiones (Gemini explica el límite del plan gratis)', () => {
    expect(classifyError(anthropic, 429, { type: 'error', error: { type: 'rate_limit_error', message: 'x' } }).kind).toBe('rate')
    expect(classifyError(openai, 429, { error: { code: 'rate_limit_exceeded', message: 'x' } }).kind).toBe('rate')
    const g = classifyError(gemini, 429, { error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded' } })
    expect(g.kind).toBe('rate')
    expect(g.message).toContain('plan gratis')
  })

  it('modelo que no existe', () => {
    const a = classifyError(anthropic, 404, { type: 'error', error: { type: 'not_found_error', message: 'model: claude-x' } })
    expect(a.kind).toBe('model')
    expect(a.message).toContain('«claude-opus-5-5»')
    expect(classifyError(openai, 400, { error: { code: 'model_not_found', message: 'The model `x` does not exist' } }).kind).toBe('model')
    expect(classifyError(gemini, 404, { error: { code: 404, status: 'NOT_FOUND', message: 'models/x is not found' } }).kind).toBe('model')
  })

  it('texto demasiado largo', () => {
    expect(classifyError(anthropic, 400, { type: 'error', error: { type: 'invalid_request_error', message: 'prompt is too long: 250000 tokens > 200000 maximum' } }).kind).toBe('too_long')
    expect(classifyError(openai, 400, { error: { code: 'context_length_exceeded', message: 'x' } }).kind).toBe('too_long')
    expect(classifyError(anthropic, 413, { type: 'error', error: { type: 'request_too_large', message: 'x' } }).kind).toBe('too_long')
    expect(classifyError(gemini, 400, { error: { status: 'INVALID_ARGUMENT', message: 'The input token count exceeds the maximum number of tokens allowed' } }).kind).toBe('too_long')
  })

  it('servicio saturado (también dentro del streaming, sin código HTTP)', () => {
    expect(classifyError(anthropic, 529, { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }).kind).toBe('overloaded')
    expect(classifyError(anthropic, undefined, { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }).kind).toBe('overloaded')
    expect(classifyError(openai, undefined, { error: { code: 'server_error', message: 'x' } }).kind).toBe('overloaded')
    expect(classifyError(gemini, 503, { error: { status: 'UNAVAILABLE', message: 'x' } }).kind).toBe('overloaded')
  })

  it('permisos y otras peticiones rechazadas', () => {
    expect(classifyError(anthropic, 403, { type: 'error', error: { type: 'permission_error', message: 'x' } }).kind).toBe('forbidden')
    const bad = classifyError(openai, 400, { error: { code: 'unsupported_value', message: 'Your organization must be verified to stream this model.' } })
    expect(bad.kind).toBe('bad_request')
    expect(bad.detail).toContain('stream')
    expect(bad.message).toBe('ChatGPT no ha aceptado la petición. Motivo: Your organization must be verified to stream this model.')
    expect(classifyError(openai, 418, null).kind).toBe('unknown')
  })

  it('nunca deja la clave en el detalle', () => {
    const e = classifyError(openai, 400, { error: { message: 'Bad key sk-proj-SECRETSECRET used with AIzaSyD-SECRETSECRETSECRET' } })
    expect(e.detail).not.toContain('SECRET')
    expect(e.message).not.toContain('SECRET')
  })
})

describe('redact', () => {
  it('tapa cualquier cosa que parezca una clave', () => {
    expect(redact('key sk-ant-api03-abcdefgh and AIzaSyAbcdefghijklmnop')).toBe('key •••• and ••••')
    expect(redact('my key is customKEY12345 ok', 'customKEY12345')).toBe('my key is •••• ok')
  })
})

describe('fetchFailure', () => {
  it('distingue cancelar de no tener conexión', () => {
    expect(fetchFailure(anthropic, new DOMException('aborted', 'AbortError')).kind).toBe('aborted')
    const net = fetchFailure(gemini, new TypeError('Failed to fetch'))
    expect(net.kind).toBe('network')
    expect(net.message).toBe('No se pudo conectar con Gemini. Revisa tu conexión a internet.')
    const same = new AiError('auth', 'x')
    expect(fetchFailure(openai, same)).toBe(same)
  })
})

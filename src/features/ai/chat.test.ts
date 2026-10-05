import { beforeEach, describe, expect, it, vi } from 'vitest'
import { chatStore, resetChat, retryLast, sendChat, stopChat } from './chat'
import type { AiConfig, FetchLike } from './types'

const config: AiConfig = { provider: 'gemini', apiKey: 'AIzaSyD-SECRETSECRETSECRET', model: 'gemini-2.5-flash' }

const sse = (chunks: string[]) => {
  const encoder = new TextEncoder()
  return new Response(
    new ReadableStream<Uint8Array>({
      start(c) {
        for (const chunk of chunks) c.enqueue(encoder.encode(chunk))
        c.close()
      },
    }),
    { status: 200 },
  )
}

const reply = (text: string) => sse([`data: {"candidates":[{"content":{"parts":[{"text":${JSON.stringify(text)}}]},"finishReason":"STOP"}]}\n\n`])

describe('chat', () => {
  beforeEach(() => resetChat())

  it('añade la pregunta y la respuesta, y manda la conversación anterior', async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => reply('R1'))
    await sendChat('  P1 ', config, 'eso', fetchImpl)
    fetchImpl.mockImplementation(async () => reply('R2'))
    await sendChat('P2', config, 'eso', fetchImpl)

    const { messages, busy } = chatStore.get()
    expect(busy).toBe(false)
    expect(messages.map((m) => [m.role, m.text])).toEqual([
      ['user', 'P1'],
      ['assistant', 'R1'],
      ['user', 'P2'],
      ['assistant', 'R2'],
    ])
    const sent = JSON.parse(String(fetchImpl.mock.calls[1][1].body))
    expect(sent.contents.map((c: { parts: { text: string }[] }) => c.parts[0].text)).toEqual(['P1', 'R1', 'P2'])
    expect(sent.systemInstruction.parts[0].text).toContain('ESO')
  })

  it('no manda preguntas vacías', async () => {
    const fetchImpl = vi.fn<FetchLike>()
    await expect(sendChat('   ', config, null, fetchImpl)).resolves.toMatch(/Escribe/)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('si falla, la respuesta muestra el error y no se reenvía en la siguiente pregunta', async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => new Response(JSON.stringify({ error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'q' } }), { status: 429 }))
    await sendChat('P1', config, null, fetchImpl)
    const failed = chatStore.get().messages[1]
    expect(failed.error).toMatch(/límite de Gemini/)
    expect(failed.text).toBe('')

    fetchImpl.mockImplementation(async () => reply('R2'))
    await sendChat('P2', config, null, fetchImpl)
    const sent = JSON.parse(String(fetchImpl.mock.calls[1][1].body))
    expect(sent.contents).toHaveLength(1)
  })

  it('reintentar repite la última pregunta fallida sin duplicarla', async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => new Response(JSON.stringify({ error: { status: 'UNAVAILABLE', message: 'x' } }), { status: 503 }))
    await sendChat('P1', config, null, fetchImpl)
    expect(chatStore.get().messages[1].error).toMatch(/saturado/)
    fetchImpl.mockImplementation(async () => reply('R1'))
    await retryLast(config, null, fetchImpl)
    expect(chatStore.get().messages.map((m) => [m.role, m.text, m.error])).toEqual([
      ['user', 'P1', undefined],
      ['assistant', 'R1', undefined],
    ])
    // Sin fallo que reintentar, no hace nada.
    await retryLast(config, null, fetchImpl)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('parar sin respuesta todavía quita el mensaje vacío', async () => {
    const fetchImpl = vi.fn<FetchLike>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        }),
    )
    const pending = sendChat('P1', config, null, fetchImpl)
    expect(chatStore.get().busy).toBe(true)
    stopChat()
    await pending
    expect(chatStore.get().messages.map((m) => m.role)).toEqual(['user'])
    expect(chatStore.get().busy).toBe(false)
  })

  it('empezar de nuevo a mitad de una respuesta no mezcla conversaciones', async () => {
    const fetchImpl = vi.fn<FetchLike>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        }),
    )
    const first = sendChat('P1', config, null, fetchImpl)
    resetChat()
    fetchImpl.mockImplementation(async () => reply('Nueva'))
    const second = sendChat('Otra', config, null, fetchImpl)
    await Promise.all([first, second])
    expect(chatStore.get().messages.map((m) => m.text)).toEqual(['Otra', 'Nueva'])
    expect(chatStore.get().busy).toBe(false)
  })
})

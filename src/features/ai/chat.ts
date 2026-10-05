/**
 * Conversación del modo «Preguntar». Vive fuera de React (en memoria) para que no se pierda al
 * cambiar de pestaña, y para que la respuesta siga llegando aunque el panel no esté a la vista.
 */
import type { LevelId } from '../profile/profile'
import { uid } from '../../lib/text'
import { streamText } from './client'
import { AiError } from './errors'
import { createMemoryStore } from './memoryStore'
import { chatHistory, chatSystem, checkQuestion } from './prompts'
import type { AiConfig, FetchLike } from './types'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  /** Mensaje de error (en vez de respuesta). */
  error?: string
  /** El estudiante paró la respuesta a medias. */
  stopped?: boolean
}

export interface ChatState {
  messages: ChatMessage[]
  busy: boolean
}

export const chatStore = createMemoryStore<ChatState>({ messages: [], busy: false })

let controller: AbortController | null = null

const patch = (id: string, change: Partial<ChatMessage>) =>
  chatStore.set((s) => ({ ...s, messages: s.messages.map((m) => (m.id === id ? { ...m, ...change } : m)) }))

/**
 * Manda una pregunta y va escribiendo la respuesta. Devuelve un aviso si la pregunta no vale
 * (vacía o demasiado larga), o null si se ha enviado.
 */
export async function sendChat(question: string, config: AiConfig, level: LevelId | null, fetchImpl?: FetchLike): Promise<string | null> {
  const problem = checkQuestion(question)
  if (problem) return problem
  if (chatStore.get().busy) return null

  const text = question.trim()
  const history = chatHistory(
    chatStore.get().messages.map((m) => ({ role: m.role, text: m.text, failed: Boolean(m.error) || Boolean(m.stopped) })),
    text,
  )
  const reply: ChatMessage = { id: uid(), role: 'assistant', text: '' }
  chatStore.set((s) => ({ busy: true, messages: [...s.messages, { id: uid(), role: 'user', text }, reply] }))

  const mine = new AbortController()
  controller = mine
  try {
    const result = await streamText(config, { system: chatSystem(level), messages: history }, (partial) => patch(reply.id, { text: partial }), {
      signal: mine.signal,
      fetchImpl,
    })
    patch(reply.id, { text: result.text, stopped: result.truncated || undefined })
  } catch (error) {
    const kind = error instanceof AiError ? error.kind : 'unknown'
    const partial = chatStore.get().messages.find((m) => m.id === reply.id)?.text ?? ''
    if (kind === 'aborted' && partial.trim()) {
      patch(reply.id, { stopped: true })
    } else if (kind === 'aborted') {
      chatStore.set((s) => ({ ...s, messages: s.messages.filter((m) => m.id !== reply.id) }))
    } else {
      // Si la IA se niega o falla a medias, no se deja una respuesta incompleta.
      patch(reply.id, { text: '', error: error instanceof Error ? error.message : 'Algo ha fallado. Vuelve a intentarlo.' })
    }
  } finally {
    // Si mientras tanto se empezó otra conversación, esta ya no manda.
    if (controller === mine) {
      controller = null
      chatStore.set((s) => ({ ...s, busy: false }))
    }
  }
  return null
}

/** Vuelve a mandar la última pregunta si su respuesta falló (quitando el intento fallido). */
export function retryLast(config: AiConfig, level: LevelId | null, fetchImpl?: FetchLike): Promise<string | null> {
  const { messages, busy } = chatStore.get()
  const last = messages.at(-1)
  const question = messages.at(-2)
  if (busy || !last?.error || question?.role !== 'user') return Promise.resolve(null)
  chatStore.set((s) => ({ ...s, messages: s.messages.slice(0, -2) }))
  return sendChat(question.text, config, level, fetchImpl)
}

export function stopChat(): void {
  controller?.abort()
}

export function resetChat(): void {
  controller?.abort()
  controller = null
  chatStore.set({ messages: [], busy: false })
}

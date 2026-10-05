/**
 * Estado de la sesión del asistente (en memoria): modo elegido, texto de estudio compartido entre
 * Resumir, Test y Tarjetas, y el resultado de cada modo. Así nada se pierde al cambiar de modo o
 * de pestaña, y una petición en marcha termina aunque el panel no esté a la vista.
 */
import { AiError } from './errors'
import { createMemoryStore } from './memoryStore'

export type AiMode = 'chat' | 'summary' | 'quiz' | 'cards'

export const AI_MODES: { id: AiMode; label: string }[] = [
  { id: 'chat', label: 'Preguntar' },
  { id: 'summary', label: 'Resumir' },
  { id: 'quiz', label: 'Test' },
  { id: 'cards', label: 'Tarjetas' },
]

export const modeStore = createMemoryStore<AiMode>('chat')

/** Texto de estudio (pegado o sacado de una nota). */
export interface Source {
  text: string
  /** Nota de la que salió (para el título y la asignatura). */
  noteId: string | null
}

export const sourceStore = createMemoryStore<Source>({ text: '', noteId: null })

export interface TaskState<T> {
  loading: boolean
  error: string | null
  result: T | null
}

/** Una petición a la IA que se puede cancelar, con su resultado guardado en memoria. */
export function createTask<T>() {
  const store = createMemoryStore<TaskState<T>>({ loading: false, error: null, result: null })
  let controller: AbortController | null = null

  return {
    store,
    async run(work: (signal: AbortSignal) => Promise<T>): Promise<void> {
      controller?.abort()
      const mine = new AbortController()
      controller = mine
      store.set({ loading: true, error: null, result: null })
      try {
        const result = await work(mine.signal)
        if (controller === mine) store.set({ loading: false, error: null, result })
      } catch (error) {
        if (controller !== mine) return
        const aborted = error instanceof AiError && error.kind === 'aborted'
        const message = error instanceof Error && error.message ? error.message : 'Algo ha fallado. Vuelve a intentarlo.'
        store.set({ loading: false, error: aborted ? null : message, result: null })
      } finally {
        if (controller === mine) controller = null
      }
    },
    cancel(): void {
      controller?.abort()
    },
    /** Cambia el resultado (p. ej. al contestar una pregunta o editar una tarjeta). */
    update(fn: (prev: T) => T): void {
      store.set((s) => (s.result === null ? s : { ...s, result: fn(s.result) }))
    },
    clear(): void {
      controller?.abort()
      controller = null
      store.set({ loading: false, error: null, result: null })
    },
  }
}

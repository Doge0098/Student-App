import type { Store } from '../../hooks/store'
import { SUBJECT_IDS, type SubjectId } from '../../lib/subjects'

/*
 * Datos editados a mano, de otra versión o de una copia con otra forma: nunca rompen la app.
 * Lo usan las tareas, las notas y las tarjetas (src/features/notes, src/features/flashcards).
 */

/**
 * El mismo store, pero lo que se lee (y lo que reciben los updaters de `set`) pasa antes por `clean`.
 * Así están protegidos todos los que lo leen, también fuera de React (temporizador, recordatorios…).
 * El resultado se recuerda mientras no cambie lo guardado: `useSyncExternalStore` necesita
 * recibir el mismo valor si nada ha cambiado.
 */
export function withClean<T>(store: Store<T>, clean: (value: unknown) => T): Store<T> {
  let hasLast = false
  let lastRaw: unknown
  let lastClean: T

  const cleaned = (raw: unknown): T => {
    if (!hasLast || raw !== lastRaw) {
      lastRaw = raw
      lastClean = clean(raw)
      hasLast = true
    }
    return lastClean
  }

  return {
    key: store.key,
    get: () => cleaned(store.get()),
    set: (next) =>
      store.set((prev) => (typeof next === 'function' ? (next as (prev: T) => T)(cleaned(prev)) : next)),
    subscribe: store.subscribe,
  }
}

/** Limpia una lista: quita lo que no se puede arreglar y arregla el resto. Si todo estaba bien, devuelve la misma lista. */
export function cleanList<T>(value: unknown, cleanItem: (item: unknown) => T | null): T[] {
  if (!Array.isArray(value)) return []
  let changed = false
  const out: T[] = []
  for (const item of value) {
    const fixed = cleanItem(item)
    if (fixed === null) changed = true
    else {
      if (fixed !== item) changed = true
      out.push(fixed)
    }
  }
  return changed ? out : (value as T[])
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isSubjectId(value: unknown): value is SubjectId {
  return typeof value === 'string' && (SUBJECT_IDS as string[]).includes(value)
}

/** Una asignatura desconocida (p. ej. de una versión más nueva) pasa a «General». */
export function cleanSubject(value: unknown): SubjectId {
  return isSubjectId(value) ? value : 'general'
}

export function finiteOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/** true si el objeto ya tenía exactamente esos valores (así no se copia lo que está bien). */
export function sameFields(item: Record<string, unknown>, fixed: Record<string, unknown>): boolean {
  return Object.keys(fixed).every((key) => item[key] === fixed[key])
}
